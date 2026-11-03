import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { createMiljoRegistrationConfirmationEmail } from '@/emails'
import { BUSINESS_CUSTOMERS_SLUG, MILJO_ACCOUNTS_SLUG, MILJO_TRUSTED_ACCOUNT_CREATE, isEligibleOrderStatus, relationshipId } from '@/lib/miljo/business'
import { ENV_ORGANIZATIONS_SLUG, ORGANIZATION_LIMITS } from '@/lib/miljo/constants'
import { generatePin, hashPin } from '@/lib/miljo/pin'
import { pinVaultKey, sealPin } from '@/lib/miljo/pinVault'
import { generateRawToken, hashToken, isWellFormedToken } from '@/lib/reviewToken'
import { withinLimits, type RateLimitStore } from '@/lib/security/dbRateLimit'
import { claimPendingRegistration, linkOrderIfFree } from './atomic'
import type { BrregResult } from './brreg'
import {
  CONFIRMATION_TTL_MS,
  MILJO_REGISTRATIONS_SLUG,
  RATE_LIMITED_MESSAGE,
  RATE_LIMITS,
  RESEND_MAX_SENDS,
  RESEND_MIN_INTERVAL_MS,
} from './constants'
import { hashPasswordForPayload, validateNewPassword } from './password'
import { AB_ORDER_NUMBER, PURCHASE_MESSAGES, decidePurchase, normalizeEmail, normalizeOrderNumber, type PurchaseOrder } from './purchase'

/**
 * Miljøregistrering Bedrift — self-registration (Stage 2.2a).
 *
 *   1. verifyPurchase       order number + purchase e-mail → may this buyer register?
 *   2. lookupOrganization   organisation number → official name from Enhetsregisteret
 *   3. submitRegistration   company, contact, login e-mail, password → a «Venter» registration and
 *                           ONE confirmation e-mail to the login address. Nothing is activated and
 *                           no company, account or organisation is created yet.
 *   4. resendConfirmation   a new link (the old one stops working), rate-limited
 *   5. confirmRegistration  the link → ONE transaction that creates or links everything:
 *                           business customer (active), the order link, the environmental
 *                           organisation with its QR code, a delivery PIN, and the Miljø account
 *                           (active, verified, with the password chosen in step 3).
 *
 * ── Who may become which company ──
 *
 * Ownership of the PURCHASE is proven by the order number together with its e-mail. The company
 * number is checked against the official register, which proves the company exists — not that the
 * registrant may act for it. A company that is already registered can never be taken over:
 *   • the company number already has an account                     → refused («logg inn»);
 *   • the company exists (created by aBoks) without an account     → allowed ONLY when aBoks has
 *     already linked this very order to it; otherwise «kontakt aBoks»;
 *   • the order is already linked to a company                     → only that company, and only
 *     if it has no account yet.
 * The database backs every one of these: unique company number, one account per company, unique
 * login e-mail, one company per order (conditional update), one «Venter» registration per order.
 *
 * ── Idempotency ──
 *
 * Opening the link again after activation answers «already activated» and creates nothing. Two
 * simultaneous confirmations of the same link: one claims the registration, the other waits on the
 * row lock and then finds it confirmed. Any failure rolls the whole activation back; the
 * registration stays «Venter» and the link can be used again.
 */

export interface RegistrationDeps {
  payload: Payload
  rateLimits: RateLimitStore
  lookupOrganization: (organizationNumber: string) => Promise<BrregResult>
  sendEmail: (message: { to: string; subject: string; html: string; text: string }) => Promise<void>
  siteUrl: string
  now?: () => Date
}

export type StepResult<T extends object = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; status: number; message: string; field?: string; code?: string }

const GENERIC = PURCHASE_MESSAGES.not_found
const fail = (status: number, message: string, field?: string, code?: string): StepResult<never> => ({ ok: false, status, message, field, code })

export const REGISTRATION_MESSAGES = {
  alreadyRegistered:
    'Organisasjonen er allerede registrert i Miljøregistrering. Logg inn med organisasjonens konto, eller kontakt aBoks dersom dere ikke har tilgang.',
  contactAboks:
    'Organisasjonen er allerede opprettet hos aBoks, men kan ikke kobles til denne ordren automatisk. Kontakt aBoks, så hjelper vi dere.',
  orderOtherCompany: 'Ordren er knyttet til en annen organisasjon. Kontakt aBoks dersom dette ikke stemmer.',
  emailInUse: 'E-postadressen brukes allerede av en annen konto i Miljøregistrering. Velg en annen e-postadresse.',
  contactName: 'Skriv inn navnet på kontaktpersonen.',
  loginEmail: 'Skriv inn en gyldig e-postadresse for innlogging.',
  linkInvalid: 'Lenken er ugyldig eller allerede erstattet av en nyere. Bruk den nyeste e-posten, eller start registreringen på nytt.',
  linkExpired: 'Lenken har utløpt. Start registreringen på nytt for å få en ny lenke.',
  activationFailed: 'Vi kunne ikke aktivere kontoen akkurat nå. Ingenting er endret. Prøv lenken igjen om litt, eller kontakt aBoks.',
  sendFailed: 'Registreringen er lagret, men vi fikk ikke sendt e-posten. Prøv «Send e-posten på nytt» om litt.',
  resendTooSoon: 'Vent et minutt før du ber om en ny e-post.',
  resendLimit: 'Det er sendt mange e-poster for denne registreringen. Start registreringen på nytt, eller kontakt aBoks.',
  busy: 'Registreringen er i ferd med å bli behandlet. Prøv igjen om litt.',
} as const

/* ------------------------------ helpers ------------------------------ */

const clock = (deps: RegistrationDeps) => (deps.now ? deps.now() : new Date())
const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')

type Doc = Record<string, unknown> & { id: number | string }

async function findOne(req: PayloadRequest, collection: string, where: Record<string, unknown>): Promise<Doc | null> {
  const res = await req.payload.find({ collection: collection as never, where: where as never, depth: 0, limit: 1, pagination: false, overrideAccess: true, req })
  return (res.docs[0] as unknown as Doc | undefined) ?? null
}

async function hasAccount(req: PayloadRequest, businessCustomerId: unknown): Promise<boolean> {
  const id = relationshipId(businessCustomerId)
  if (id == null) return false
  const res = await req.payload.count({ collection: MILJO_ACCOUNTS_SLUG, where: { businessCustomer: { equals: id } }, overrideAccess: true, req })
  return res.totalDocs > 0
}

/** Order + decision. Loads the products of the order's lines to read their section. */
async function loadPurchase(req: PayloadRequest, orderNumberRaw: unknown, emailRaw: unknown) {
  const orderNumber = normalizeOrderNumber(orderNumberRaw)
  const email = normalizeEmail(emailRaw)
  if (!AB_ORDER_NUMBER.test(orderNumber) || !isEmail(email)) return { decision: { ok: false as const, reason: 'not_found' as const }, order: null, orderNumber }
  const order = (await findOne(req, 'orders', { orderNumber: { equals: orderNumber } })) as (PurchaseOrder & Doc) | null
  const productIds = [...new Set((order?.items ?? []).map((l) => relationshipId(l.product)).filter((id): id is number | string => id != null).map(String))]
  const products = productIds.length
    ? await req.payload.find({ collection: 'products', where: { id: { in: productIds } }, depth: 0, limit: 0, pagination: false, overrideAccess: true, req })
    : { docs: [] }
  const productSections = new Map((products.docs as unknown as Doc[]).map((p) => [String(p.id), p.section]))
  const linkedCustomerHasAccount = order ? await hasAccount(req, order.businessCustomer) : false
  return { decision: decidePurchase({ order, email, productSections, linkedCustomerHasAccount }), order, orderNumber }
}

function purchaseFailure(reason: Exclude<ReturnType<typeof decidePurchase>, { ok: true }>['reason']): StepResult<never> {
  return fail(reason === 'not_found' ? 400 : 409, PURCHASE_MESSAGES[reason], undefined, reason)
}

/**
 * Which business customer the activation would use, or why none may be used. `target` null means
 * «create a new one».
 */
async function resolveTargetCustomer(req: PayloadRequest, order: Doc, organizationNumber: string): Promise<StepResult<{ target: Doc | null }>> {
  const linkedId = relationshipId(order.businessCustomer)
  if (linkedId != null) {
    const linked = await findOne(req, BUSINESS_CUSTOMERS_SLUG, { id: { equals: linkedId } })
    if (!linked) return fail(409, REGISTRATION_MESSAGES.contactAboks)
    if (await hasAccount(req, linked.id)) return fail(409, REGISTRATION_MESSAGES.alreadyRegistered, undefined, 'already_registered')
    if (String(linked.organizationNumber) !== organizationNumber) return fail(409, REGISTRATION_MESSAGES.orderOtherCompany, 'organizationNumber')
    if (linked.status === 'suspended') return fail(409, REGISTRATION_MESSAGES.contactAboks)
    return { ok: true, target: linked }
  }
  const existing = await findOne(req, BUSINESS_CUSTOMERS_SLUG, { organizationNumber: { equals: organizationNumber } })
  if (!existing) return { ok: true, target: null }
  if (await hasAccount(req, existing.id)) return fail(409, REGISTRATION_MESSAGES.alreadyRegistered, 'organizationNumber', 'already_registered')
  // Created by aBoks, no account, and this order is not linked to it: never taken over by number alone.
  return fail(409, REGISTRATION_MESSAGES.contactAboks, 'organizationNumber', 'contact_aboks')
}

function confirmUrl(siteUrl: string, rawToken: string) {
  return `${siteUrl.replace(/\/$/, '')}/miljoregistrering/bekreft?token=${encodeURIComponent(rawToken)}`
}

async function sendConfirmation(deps: RegistrationDeps, reg: Doc, rawToken: string, expiresAt: Date): Promise<boolean> {
  try {
    const email = createMiljoRegistrationConfirmationEmail({
      organizationName: String(reg.officialName),
      organizationNumber: String(reg.organizationNumber),
      contactName: String(reg.contactName),
      confirmUrl: confirmUrl(deps.siteUrl, rawToken),
      expiresAt,
    })
    await deps.sendEmail({ to: String(reg.loginEmail), ...email })
    return true
  } catch (err) {
    deps.payload.logger.error(`[miljo-registration] confirmation e-mail for registration ${String(reg.id)} failed: ${err instanceof Error ? err.name : 'unknown'}`)
    return false
  }
}

/** «k***@firma.no» — enough for the registrant to recognise the address, nothing more. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return ''
  return `${local[0]}${'*'.repeat(Math.max(1, Math.min(local.length - 1, 3)))}@${domain}`
}

/* ------------------------------ 1. purchase ------------------------------ */

export async function verifyPurchase(deps: RegistrationDeps, input: { orderNumber: unknown; email: unknown; ip: string }): Promise<StepResult<{ orderNumber: string }>> {
  const orderKey = normalizeOrderNumber(input.orderNumber)
  if (!(await withinLimits(deps.rateLimits, [
    { key: `reg:verify:ip:${input.ip}`, ...RATE_LIMITS.verifyPerIp },
    { key: `reg:verify:order:${orderKey}`, ...RATE_LIMITS.verifyPerOrder },
  ]))) return fail(429, RATE_LIMITED_MESSAGE)

  const req = await createLocalReq({}, deps.payload)
  const { decision, orderNumber } = await loadPurchase(req, input.orderNumber, input.email)
  if (!decision.ok) return purchaseFailure(decision.reason)
  return { ok: true, orderNumber }
}

/* ------------------------------ 2. organisation ------------------------------ */

export async function lookupOrganizationForRegistration(
  deps: RegistrationDeps,
  input: { orderNumber: unknown; email: unknown; organizationNumber: unknown; ip: string },
): Promise<StepResult<{ organizationNumber: string; officialName: string }>> {
  if (!(await withinLimits(deps.rateLimits, [{ key: `reg:lookup:ip:${input.ip}`, ...RATE_LIMITS.lookupPerIp }]))) return fail(429, RATE_LIMITED_MESSAGE)
  const req = await createLocalReq({}, deps.payload)
  const { decision, order } = await loadPurchase(req, input.orderNumber, input.email)
  if (!decision.ok || !order) return purchaseFailure(decision.ok ? 'not_found' : decision.reason)

  const registry = await deps.lookupOrganization(String(input.organizationNumber ?? ''))
  if (!registry.ok) return fail(registry.reason === 'unavailable' ? 503 : 400, registry.message, 'organizationNumber', registry.reason)
  const target = await resolveTargetCustomer(req, order as Doc, registry.organizationNumber)
  if (!target.ok) return target
  return { ok: true, organizationNumber: registry.organizationNumber, officialName: registry.officialName }
}

/* ------------------------------ 3. submit ------------------------------ */

export interface SubmitInput {
  orderNumber: unknown
  email: unknown
  organizationNumber: unknown
  contactName: unknown
  loginEmail: unknown
  password: unknown
  passwordConfirmation: unknown
  ip: string
}

export async function submitRegistration(deps: RegistrationDeps, input: SubmitInput): Promise<StepResult<{ resendKey: string; emailHint: string; emailSent: boolean }>> {
  const orderKey = normalizeOrderNumber(input.orderNumber)
  if (!(await withinLimits(deps.rateLimits, [
    { key: `reg:submit:ip:${input.ip}`, ...RATE_LIMITS.submitPerIp },
    { key: `reg:submit:order:${orderKey}`, ...RATE_LIMITS.submitPerOrder },
  ]))) return fail(429, RATE_LIMITED_MESSAGE)

  const contactName = text(input.contactName, 120)
  if (contactName.length < 2) return fail(400, REGISTRATION_MESSAGES.contactName, 'contactName')
  const loginEmail = normalizeEmail(input.loginEmail)
  if (!isEmail(loginEmail)) return fail(400, REGISTRATION_MESSAGES.loginEmail, 'loginEmail')
  const passwordProblem = validateNewPassword(input.password, input.passwordConfirmation)
  if (passwordProblem) return fail(400, passwordProblem, 'password')

  const lookupReq = await createLocalReq({}, deps.payload)
  const { decision, order, orderNumber } = await loadPurchase(lookupReq, input.orderNumber, input.email)
  if (!decision.ok || !order) return purchaseFailure(decision.ok ? 'not_found' : decision.reason)

  const registry = await deps.lookupOrganization(String(input.organizationNumber ?? ''))
  if (!registry.ok) return fail(registry.reason === 'unavailable' ? 503 : 400, registry.message, 'organizationNumber', registry.reason)
  const target = await resolveTargetCustomer(lookupReq, order as Doc, registry.organizationNumber)
  if (!target.ok) return target
  if (await findOne(lookupReq, MILJO_ACCOUNTS_SLUG, { email: { equals: loginEmail } })) return fail(409, REGISTRATION_MESSAGES.emailInUse, 'loginEmail')

  const { salt, hash } = await hashPasswordForPayload(input.password as string)
  const rawToken = generateRawToken()
  const resendKey = generateRawToken()
  const now = clock(deps)
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_MS)

  // Supersede an earlier «Venter» registration for this order and create the new one, atomically.
  const req = await createLocalReq({}, deps.payload)
  const shouldCommit = await initTransaction(req)
  let reg: Doc
  try {
    await req.payload.update({
      collection: MILJO_REGISTRATIONS_SLUG,
      where: { and: [{ order: { equals: order.id } }, { status: { equals: 'pending' } }] },
      data: { status: 'superseded', tokenHash: null, resendKeyHash: null, passwordHash: null, passwordSalt: null } as never,
      overrideAccess: true,
      req,
    })
    reg = (await req.payload.create({
      collection: MILJO_REGISTRATIONS_SLUG,
      data: {
        status: 'pending',
        order: order.id,
        orderNumber,
        organizationNumber: registry.organizationNumber,
        officialName: registry.officialName,
        contactName,
        loginEmail,
        passwordSalt: salt,
        passwordHash: hash,
        tokenHash: hashToken(rawToken),
        resendKeyHash: hashToken(resendKey),
        tokenExpiresAt: expiresAt.toISOString(),
        sendCount: 1,
        lastSentAt: now.toISOString(),
      } as never,
      overrideAccess: true,
      req,
    })) as unknown as Doc
    if (shouldCommit) await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.warn(`[miljo-registration] submit for order ${String(order.id)} not stored: ${err instanceof Error ? err.name : 'unknown'}`)
    return fail(409, REGISTRATION_MESSAGES.busy)
  }

  const emailSent = await sendConfirmation(deps, reg, rawToken, expiresAt)
  return { ok: true, resendKey, emailHint: maskEmail(loginEmail), emailSent }
}

/* ------------------------------ 4. resend ------------------------------ */

export async function resendConfirmation(deps: RegistrationDeps, input: { resendKey: unknown; ip: string }): Promise<StepResult<{ emailHint: string }>> {
  if (!(await withinLimits(deps.rateLimits, [{ key: `reg:resend:ip:${input.ip}`, ...RATE_LIMITS.resendPerIp }]))) return fail(429, RATE_LIMITED_MESSAGE)
  if (!isWellFormedToken(input.resendKey)) return fail(400, REGISTRATION_MESSAGES.linkInvalid, undefined, 'invalid')
  const req = await createLocalReq({}, deps.payload)
  const reg = await findOne(req, MILJO_REGISTRATIONS_SLUG, { resendKeyHash: { equals: hashToken(input.resendKey) } })
  if (!reg || reg.status !== 'pending') return fail(400, REGISTRATION_MESSAGES.linkInvalid, undefined, 'invalid')

  const now = clock(deps)
  if (Number(reg.sendCount ?? 0) >= RESEND_MAX_SENDS) return fail(429, REGISTRATION_MESSAGES.resendLimit)
  const last = reg.lastSentAt ? new Date(String(reg.lastSentAt)).getTime() : 0
  if (now.getTime() - last < RESEND_MIN_INTERVAL_MS) return fail(429, REGISTRATION_MESSAGES.resendTooSoon)

  const rawToken = generateRawToken()
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_MS)
  await req.payload.update({
    collection: MILJO_REGISTRATIONS_SLUG,
    id: reg.id,
    data: { tokenHash: hashToken(rawToken), tokenExpiresAt: expiresAt.toISOString(), sendCount: Number(reg.sendCount ?? 0) + 1, lastSentAt: now.toISOString() } as never,
    overrideAccess: true,
    req,
  })
  if (!(await sendConfirmation(deps, reg, rawToken, expiresAt))) return fail(502, REGISTRATION_MESSAGES.sendFailed)
  return { ok: true, emailHint: maskEmail(String(reg.loginEmail)) }
}

/* ------------------------------ 5. confirm + activate ------------------------------ */

export interface ActivationResult {
  alreadyActivated: boolean
  organizationName: string
  publicCode: string | null
}

export async function confirmRegistration(deps: RegistrationDeps, input: { token: unknown; ip: string }): Promise<StepResult<ActivationResult>> {
  if (!(await withinLimits(deps.rateLimits, [{ key: `reg:confirm:ip:${input.ip}`, ...RATE_LIMITS.confirmPerIp }]))) return fail(429, RATE_LIMITED_MESSAGE)
  if (!isWellFormedToken(input.token)) return fail(400, REGISTRATION_MESSAGES.linkInvalid, undefined, 'invalid')
  const tokenHash = hashToken(input.token)
  const lookup = await createLocalReq({}, deps.payload)
  const found = await findOne(lookup, MILJO_REGISTRATIONS_SLUG, { tokenHash: { equals: tokenHash } })
  if (!found || found.status === 'superseded') return fail(400, REGISTRATION_MESSAGES.linkInvalid, undefined, 'invalid')
  if (found.status === 'confirmed') return activatedResult(lookup, found, true)
  const now = clock(deps)
  if (!(new Date(String(found.tokenExpiresAt)).getTime() > now.getTime())) return fail(410, REGISTRATION_MESSAGES.linkExpired, undefined, 'expired')
  // Without the vault key the new PIN could be stored only as a hash, and Min side could never show
  // it («Vis PIN»). Refuse before anything is claimed or written; the link stays usable.
  const vaultKey = pinVaultKey()
  if (!vaultKey) {
    deps.payload.logger.error(`[miljo-registration] activation of registration ${String(found.id)} refused: MILJO_PIN_ENCRYPTION_KEY is not configured`)
    return fail(503, REGISTRATION_MESSAGES.activationFailed, undefined, 'vault-not-configured')
  }

  const req = await createLocalReq({}, deps.payload)
  const shouldCommit = await initTransaction(req)
  try {
    const result = await activate(req, found, now, vaultKey)
    if (!result.ok) {
      await killTransaction(req)
      return result
    }
    if (shouldCommit) await commitTransaction(req)
    return result
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.error(`[miljo-registration] activation of registration ${String(found.id)} rolled back: ${err instanceof Error ? err.name : 'unknown'}`)
    return fail(500, REGISTRATION_MESSAGES.activationFailed)
  }
}

async function activatedResult(req: PayloadRequest, reg: Doc, alreadyActivated: boolean): Promise<StepResult<ActivationResult>> {
  const orgId = relationshipId(reg.environmentalOrganization)
  const org = orgId != null ? await findOne(req, ENV_ORGANIZATIONS_SLUG, { id: { equals: orgId } }) : null
  return { ok: true, alreadyActivated, organizationName: String(reg.officialName), publicCode: (org?.publicCode as string | undefined) ?? null }
}

/** Everything inside ONE transaction (`req`). Throws, or returns a refusal, to roll back. */
async function activate(req: PayloadRequest, reg: Doc, now: Date, vaultKey: Buffer): Promise<StepResult<ActivationResult>> {
  // a. Claim the registration — decided by the database (see ./atomic).
  if (!(await claimPendingRegistration(req, reg.id, now))) {
    const current = await findOne(req, MILJO_REGISTRATIONS_SLUG, { id: { equals: reg.id } })
    if (current?.status === 'confirmed') return activatedResult(req, current, true)
    return fail(410, REGISTRATION_MESSAGES.linkExpired, undefined, 'expired')
  }

  // b. The order must still qualify.
  const order = await findOne(req, 'orders', { id: { equals: relationshipId(reg.order) } })
  if (!order || !isEligibleOrderStatus(order.status)) return fail(409, PURCHASE_MESSAGES.not_eligible_status)

  // c. The business customer: the one aBoks linked this order to, or a new one.
  const target = await resolveTargetCustomer(req, order, String(reg.organizationNumber))
  if (!target.ok) return target
  const verifiedAt = now.toISOString()
  let customer = target.target
  if (customer) {
    customer = (await req.payload.update({
      collection: BUSINESS_CUSTOMERS_SLUG,
      id: customer.id,
      data: { status: 'active', contactEmailVerifiedAt: verifiedAt, ...(customer.contactName ? {} : { contactName: reg.contactName }) } as never,
      overrideAccess: true,
      req,
    })) as unknown as Doc
  } else {
    customer = (await req.payload.create({
      collection: BUSINESS_CUSTOMERS_SLUG,
      data: {
        name: reg.officialName,
        organizationNumber: reg.organizationNumber,
        contactName: reg.contactName,
        contactEmail: reg.loginEmail,
        contactEmailVerifiedAt: verifiedAt,
        status: 'active',
      } as never,
      overrideAccess: true,
      req,
    })) as unknown as Doc
  }

  // d. One company per order — decided by the database.
  if (!(await linkOrderIfFree(req, order.id, customer.id))) return fail(409, REGISTRATION_MESSAGES.orderOtherCompany)

  // e. The environmental organisation (one QR code per company) — reuse the one aBoks made.
  let orgId = relationshipId(customer.environmentalOrganization)
  if (orgId == null) {
    const org = (await req.payload.create({
      collection: ENV_ORGANIZATIONS_SLUG,
      // The register's name can be longer than an organisation name may be; the business customer keeps it whole.
      data: { name: String(reg.officialName).slice(0, ORGANIZATION_LIMITS.nameMax), organizationType: 'bedrift', status: 'active' } as never,
      overrideAccess: true,
      req,
    })) as unknown as Doc
    orgId = org.id
    await req.payload.update({ collection: BUSINESS_CUSTOMERS_SLUG, id: customer.id, data: { environmentalOrganization: orgId } as never, overrideAccess: true, req })
  }

  // f. A delivery PIN, if the organisation has none — the same storage as the admin «PIN» action.
  const org = await findOne(req, ENV_ORGANIZATIONS_SLUG, { id: { equals: orgId } })
  if (!org?.pinHash) {
    const pin = generatePin()
    await req.payload.update({
      collection: ENV_ORGANIZATIONS_SLUG,
      id: orgId,
      data: {
        pinHash: await hashPin(pin),
        pinSetAt: verifiedAt,
        pinEncrypted: sealPin(pin, Number(orgId), vaultKey),
        pinAttemptCount: 0,
        pinAttemptWindowStart: null,
      } as never,
      context: { miljoSetPin: true },
      overrideAccess: true,
      req,
    })
  }

  // g. The Miljø account: active, verified, with the password chosen at registration.
  const account = (await req.payload.create({
    collection: MILJO_ACCOUNTS_SLUG,
    data: {
      email: reg.loginEmail,
      password: generateRawToken(), // replaced below by the registrant's own hash
      businessCustomer: customer.id,
      status: 'active',
      emailVerifiedAt: verifiedAt,
    } as never,
    context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true },
    overrideAccess: true,
    req,
  })) as unknown as Doc
  await req.payload.db.updateOne({ collection: MILJO_ACCOUNTS_SLUG, id: account.id, data: { salt: reg.passwordSalt, hash: reg.passwordHash }, req } as never)

  // h. Record the result; the password hash is no longer needed here.
  const updated = (await req.payload.update({
    collection: MILJO_REGISTRATIONS_SLUG,
    id: reg.id,
    data: { businessCustomer: customer.id, account: account.id, environmentalOrganization: orgId, passwordHash: null, passwordSalt: null, resendKeyHash: null } as never,
    overrideAccess: true,
    req,
  })) as unknown as Doc
  return activatedResult(req, updated, false)
}
