import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { createAdminMiljoApplicationEmail, createMiljoRegistrationConfirmationEmail, createMiljoRegistrationOrderNoticeEmail } from '@/emails'
import { BUSINESS_CUSTOMERS_SLUG, MILJO_ACCOUNTS_SLUG, relationshipId } from '@/lib/miljo/business'
import { ENV_ORGANIZATIONS_SLUG } from '@/lib/miljo/constants'
import { ADMIN_EMAIL } from '@/lib/orderEmails'
import { generateRawToken, hashToken, isWellFormedToken } from '@/lib/reviewToken'
import { withinLimits, type RateLimitStore } from '@/lib/security/dbRateLimit'
import { claimEmailConfirmation } from './atomic'
import type { BrregResult } from './brreg'
import {
  CONFIRMATION_TTL_MS,
  MILJO_REGISTRATIONS_SLUG,
  MILJO_REGISTRATION_AUDIT_SLUG,
  RATE_LIMITED_MESSAGE,
  RATE_LIMITS,
  RESEND_MAX_SENDS,
  RESEND_MIN_INTERVAL_MS,
  type RegistrationAuditAction,
} from './constants'
import { hashPasswordForPayload, validateNewPassword } from './password'
import { AB_ORDER_NUMBER, PURCHASE_MESSAGES, decidePurchase, normalizeEmail, normalizeOrderNumber, type PurchaseOrder } from './purchase'

/**
 * Miljøregistrering Bedrift — self-registration, the applicant's half (Stage 2.2a; approval Stage 2.6).
 *
 *   1. verifyPurchase       order number + purchase e-mail → may this buyer apply?
 *   2. lookupOrganization   organisation number → official name from Enhetsregisteret
 *   3. submitRegistration   company, contact, login e-mail, password → a «Venter» registration, ONE
 *                           confirmation e-mail to the login address, and a security notice to the
 *                           order's own e-mail address when that is a different address.
 *   4. resendConfirmation   a new link (the old one stops working), rate-limited
 *   5. confirmRegistration  the link → «Venter på godkjenning». This proves the login e-mail and
 *                           NOTHING else: no company, order link, organisation, PIN or account is
 *                           created here. Only an administrator's approval (./approval) does that.
 *
 * ── Why an administrator decides ──
 *
 * Ownership of the PURCHASE is proven by the order number together with its e-mail. The company
 * number is checked against the official register, which proves the company exists — not that the
 * applicant may act for it. A private checkout order is a valid purchase for a real organisation,
 * so orders are deliberately not classified. That gap is closed by a person, who checks the
 * applicant's connection through an independent channel before approving.
 *
 * A pending or rejected applicant has no account at all, so every sign-in and every organisation
 * resource is refused by the existing rules of @/lib/miljo/businessAccess with no new state to check.
 *
 * ── Who may apply for which company ──
 *
 * A company that is already registered can never be taken over:
 *   • the company number already has an account                     → refused («logg inn»);
 *   • the company exists (created by aBoks) without an account     → allowed ONLY when aBoks has
 *     already linked this very order to it; otherwise «kontakt aBoks»;
 *   • the order is already linked to a company                     → only that company, and only
 *     if it has no account yet.
 * An order with a registration awaiting approval cannot start another one: knowing an order number
 * and its e-mail must not be enough to push a real application out of the queue. The database backs
 * these: unique company number, unique login e-mail, one company per order (conditional update), one
 * open registration per order.
 *
 * ── Idempotency ──
 *
 * Opening the link again answers with the registration's current state and changes nothing. Two
 * simultaneous confirmations of the same link: one claims the registration, the other finds it
 * already confirmed. Any failure rolls the step back; the link can be used again.
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

export const fail = (status: number, message: string, field?: string, code?: string): StepResult<never> => ({ ok: false, status, message, field, code })

export const REGISTRATION_MESSAGES = {
  alreadyRegistered:
    'Organisasjonen er allerede registrert i Miljøregistrering. Logg inn med organisasjonens konto, eller kontakt aBoks dersom dere ikke har tilgang.',
  contactAboks:
    'Organisasjonen er allerede opprettet hos aBoks, men kan ikke kobles til denne ordren automatisk. Kontakt aBoks, så hjelper vi dere.',
  orderOtherCompany: 'Ordren er knyttet til en annen organisasjon. Kontakt aBoks dersom dette ikke stemmer.',
  awaitingApproval: 'Det finnes allerede en registrering med denne ordren som venter på godkjenning fra aBoks. Du får beskjed på e-post når den er behandlet.',
  emailInUse: 'E-postadressen brukes allerede av en annen konto i Miljøregistrering. Velg en annen e-postadresse.',
  contactName: 'Skriv inn navnet på kontaktpersonen.',
  loginEmail: 'Skriv inn en gyldig e-postadresse for innlogging.',
  linkInvalid: 'Lenken er ugyldig eller allerede erstattet av en nyere. Bruk den nyeste e-posten, eller start registreringen på nytt.',
  linkExpired: 'Lenken har utløpt. Start registreringen på nytt for å få en ny lenke.',
  confirmFailed: 'Vi kunne ikke bekrefte e-postadressen akkurat nå. Ingenting er endret. Prøv lenken igjen om litt, eller kontakt aBoks.',
  sendFailed: 'Registreringen er lagret, men vi fikk ikke sendt e-posten. Prøv «Send e-posten på nytt» om litt.',
  resendTooSoon: 'Vent et minutt før du ber om en ny e-post.',
  resendLimit: 'Det er sendt mange e-poster for denne registreringen. Start registreringen på nytt, eller kontakt aBoks.',
  busy: 'Registreringen er i ferd med å bli behandlet. Prøv igjen om litt.',
} as const

/* ------------------------------ helpers ------------------------------ */

const clock = (deps: { now?: () => Date }) => (deps.now ? deps.now() : new Date())
const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '')
const errName = (err: unknown) => (err instanceof Error ? err.name : 'unknown')

export type Doc = Record<string, unknown> & { id: number | string }

export async function findOne(req: PayloadRequest, collection: string, where: Record<string, unknown>): Promise<Doc | null> {
  const res = await req.payload.find({ collection: collection as never, where: where as never, depth: 0, limit: 1, pagination: false, overrideAccess: true, req })
  return (res.docs[0] as unknown as Doc | undefined) ?? null
}

export async function hasAccount(req: PayloadRequest, businessCustomerId: unknown): Promise<boolean> {
  const id = relationshipId(businessCustomerId)
  if (id == null) return false
  const res = await req.payload.count({ collection: MILJO_ACCOUNTS_SLUG, where: { businessCustomer: { equals: id } }, overrideAccess: true, req })
  return res.totalDocs > 0
}

/** One row of the registration's append-only history, in the caller's transaction. */
export async function writeRegistrationAudit(
  req: PayloadRequest,
  entry: {
    registration: number | string
    action: RegistrationAuditAction
    at: Date
    performedBy?: number | string | null
    label: string
    organization?: number | string | null
    reason?: string | null
    before?: unknown
    after?: unknown
  },
): Promise<void> {
  await req.payload.create({
    collection: MILJO_REGISTRATION_AUDIT_SLUG,
    data: {
      registration: entry.registration,
      organization: entry.organization ?? null,
      action: entry.action,
      performedAt: entry.at.toISOString(),
      performedBy: entry.performedBy ?? null,
      performedByLabel: entry.label,
      reason: entry.reason ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    } as never,
    overrideAccess: true,
    req,
  })
}

/** Order + decision. Loads the products of the order's lines to read their section. */
async function loadPurchase(req: PayloadRequest, orderNumberRaw: unknown, emailRaw: unknown) {
  const orderNumber = normalizeOrderNumber(orderNumberRaw)
  const email = normalizeEmail(emailRaw)
  if (!AB_ORDER_NUMBER.test(orderNumber) || !isEmail(email)) return { decision: { ok: false as const, reason: 'not_found' as const }, order: null, orderNumber }
  const order = (await findOne(req, 'orders', { orderNumber: { equals: orderNumber } })) as (PurchaseOrder & Doc) | null
  // A wrong e-mail stops here, exactly like an unknown order: no further queries for an observer to time.
  if (!order || normalizeEmail(order.customerInfo?.email) !== email) return { decision: { ok: false as const, reason: 'not_found' as const }, order: null, orderNumber }
  const productIds = [...new Set((order.items ?? []).map((l) => relationshipId(l.product)).filter((id): id is number | string => id != null).map(String))]
  const products = productIds.length
    ? await req.payload.find({ collection: 'products', where: { id: { in: productIds } }, depth: 0, limit: 0, pagination: false, overrideAccess: true, req })
    : { docs: [] }
  const productSections = new Map((products.docs as unknown as Doc[]).map((p) => [String(p.id), p.section]))
  const linkedCustomerHasAccount = await hasAccount(req, order.businessCustomer)
  return { decision: decidePurchase({ order, email, productSections, linkedCustomerHasAccount }), order, orderNumber }
}

function purchaseFailure(reason: Exclude<ReturnType<typeof decidePurchase>, { ok: true }>['reason']): StepResult<never> {
  return fail(reason === 'not_found' ? 400 : 409, PURCHASE_MESSAGES[reason], undefined, reason)
}

/** Only after the caller has shown the order number AND its e-mail: they own the order. */
async function awaitingApprovalFor(req: PayloadRequest, orderId: number | string): Promise<boolean> {
  return !!(await findOne(req, MILJO_REGISTRATIONS_SLUG, { and: [{ order: { equals: orderId } }, { status: { equals: 'awaiting_approval' } }] }))
}

/**
 * Which business customer the activation would use, or why none may be used. `target` null means
 * «create a new one».
 */
export async function resolveTargetCustomer(req: PayloadRequest, order: Doc, organizationNumber: string): Promise<StepResult<{ target: Doc | null }>> {
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
    deps.payload.logger.error(`[miljo-registration] confirmation e-mail for registration ${String(reg.id)} failed: ${errName(err)}`)
    return false
  }
}

/**
 * Tells the order's own e-mail address that its order was used to apply. Skipped when the login
 * address is the same one — that mailbox already gets the confirmation, which says what to do if the
 * reader did not register. Informational only: it grants and blocks nothing, and a failed send does
 * not stop the application (the administrator sees that it was not sent).
 */
async function sendOrderNotice(deps: RegistrationDeps, reg: Doc, orderEmail: string, now: Date): Promise<void> {
  if (!orderEmail || orderEmail === normalizeEmail(reg.loginEmail)) return
  try {
    const notice = createMiljoRegistrationOrderNoticeEmail({
      orderNumber: String(reg.orderNumber),
      organizationName: String(reg.officialName),
      organizationNumber: String(reg.organizationNumber),
    })
    await deps.sendEmail({ to: orderEmail, ...notice })
    await deps.payload.update({ collection: MILJO_REGISTRATIONS_SLUG, id: reg.id, data: { orderNoticeSentAt: now.toISOString() } as never, overrideAccess: true })
  } catch (err) {
    deps.payload.logger.error(`[miljo-registration] order notice for registration ${String(reg.id)} failed: ${errName(err)}`)
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
  const { decision, order, orderNumber } = await loadPurchase(req, input.orderNumber, input.email)
  if (!decision.ok || !order) return purchaseFailure(decision.ok ? 'not_found' : decision.reason)
  if (await awaitingApprovalFor(req, order.id)) return fail(409, REGISTRATION_MESSAGES.awaitingApproval, undefined, 'awaiting_approval')
  return { ok: true, orderNumber }
}

/* ------------------------------ 2. organisation ------------------------------ */

export async function lookupOrganizationForRegistration(
  deps: RegistrationDeps,
  input: { orderNumber: unknown; email: unknown; organizationNumber: unknown; ip: string },
): Promise<StepResult<{ organizationNumber: string; officialName: string }>> {
  const orderKey = normalizeOrderNumber(input.orderNumber)
  if (!(await withinLimits(deps.rateLimits, [
    { key: `reg:lookup:ip:${input.ip}`, ...RATE_LIMITS.lookupPerIp },
    { key: `reg:lookup:order:${orderKey}`, ...RATE_LIMITS.lookupPerOrder },
  ]))) return fail(429, RATE_LIMITED_MESSAGE)
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
  if (await awaitingApprovalFor(lookupReq, order.id)) return fail(409, REGISTRATION_MESSAGES.awaitingApproval, undefined, 'awaiting_approval')

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
  const orderEmail = normalizeEmail((order as PurchaseOrder).customerInfo?.email)

  // Supersede an earlier «Venter» registration for this order and create the new one, atomically.
  const req = await createLocalReq({}, deps.payload)
  const shouldCommit = await initTransaction(req)
  let reg: Doc
  try {
    const replaced = await req.payload.update({
      collection: MILJO_REGISTRATIONS_SLUG,
      where: { and: [{ order: { equals: order.id } }, { status: { equals: 'pending' } }] },
      data: { status: 'superseded', tokenHash: null, resendKeyHash: null, passwordHash: null, passwordSalt: null } as never,
      overrideAccess: true,
      req,
    })
    for (const old of replaced.docs as unknown as Doc[]) {
      await writeRegistrationAudit(req, { registration: old.id, action: 'superseded', at: now, label: 'Søker', after: { status: 'superseded' } })
    }
    reg = (await req.payload.create({
      collection: MILJO_REGISTRATIONS_SLUG,
      data: {
        status: 'pending',
        order: order.id,
        orderNumber,
        orderEmail,
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
    await writeRegistrationAudit(req, {
      registration: reg.id,
      action: 'submitted',
      at: now,
      label: 'Søker',
      after: { organizationNumber: registry.organizationNumber, orderNumber },
    })
    if (shouldCommit) await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.warn(`[miljo-registration] submit for order ${String(order.id)} not stored: ${errName(err)}`)
    return fail(409, REGISTRATION_MESSAGES.busy)
  }

  const emailSent = await sendConfirmation(deps, reg, rawToken, expiresAt)
  await sendOrderNotice(deps, reg, orderEmail, now)
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

/* ------------------------------ 5. confirm the e-mail ------------------------------ */

export type ConfirmationState = 'awaiting_approval' | 'activated' | 'rejected'

export interface ConfirmationResult {
  state: ConfirmationState
  /** False the first time the link is used. */
  alreadyConfirmed: boolean
  organizationName: string
  /** Only once an administrator has approved the registration. */
  publicCode: string | null
}

async function currentState(req: PayloadRequest, reg: Doc): Promise<StepResult<ConfirmationResult> | null> {
  const organizationName = String(reg.officialName)
  if (reg.status === 'awaiting_approval') return { ok: true, state: 'awaiting_approval', alreadyConfirmed: true, organizationName, publicCode: null }
  if (reg.status === 'rejected') return { ok: true, state: 'rejected', alreadyConfirmed: true, organizationName, publicCode: null }
  if (reg.status === 'confirmed') {
    const orgId = relationshipId(reg.environmentalOrganization)
    const org = orgId != null ? await findOne(req, ENV_ORGANIZATIONS_SLUG, { id: { equals: orgId } }) : null
    return { ok: true, state: 'activated', alreadyConfirmed: true, organizationName, publicCode: (org?.publicCode as string | undefined) ?? null }
  }
  return null
}

/** Tells aBoks that an application is ready to review. Best effort: the queue in Payload is the record. */
async function notifyAdministrators(deps: RegistrationDeps, reg: Doc): Promise<void> {
  try {
    const message = createAdminMiljoApplicationEmail({
      organizationName: String(reg.officialName),
      organizationNumber: String(reg.organizationNumber),
      orderNumber: String(reg.orderNumber ?? ''),
      contactName: String(reg.contactName),
      loginEmail: String(reg.loginEmail),
      reviewUrl: `${deps.siteUrl.replace(/\/$/, '')}/admin/collections/${MILJO_REGISTRATIONS_SLUG}/${String(reg.id)}`,
    })
    await deps.sendEmail({ to: ADMIN_EMAIL, ...message })
  } catch (err) {
    deps.payload.logger.error(`[miljo-registration] administrator notice for registration ${String(reg.id)} failed: ${errName(err)}`)
  }
}

export async function confirmRegistration(deps: RegistrationDeps, input: { token: unknown; ip: string }): Promise<StepResult<ConfirmationResult>> {
  if (!(await withinLimits(deps.rateLimits, [{ key: `reg:confirm:ip:${input.ip}`, ...RATE_LIMITS.confirmPerIp }]))) return fail(429, RATE_LIMITED_MESSAGE)
  if (!isWellFormedToken(input.token)) return fail(400, REGISTRATION_MESSAGES.linkInvalid, undefined, 'invalid')
  const tokenHash = hashToken(input.token)
  const lookup = await createLocalReq({}, deps.payload)
  const found = await findOne(lookup, MILJO_REGISTRATIONS_SLUG, { tokenHash: { equals: tokenHash } })
  if (!found || found.status === 'superseded') return fail(400, REGISTRATION_MESSAGES.linkInvalid, undefined, 'invalid')
  const known = await currentState(lookup, found)
  if (known) return known
  const now = clock(deps)
  if (!(new Date(String(found.tokenExpiresAt)).getTime() > now.getTime())) return fail(410, REGISTRATION_MESSAGES.linkExpired, undefined, 'expired')

  const req = await createLocalReq({}, deps.payload)
  const shouldCommit = await initTransaction(req)
  try {
    if (!(await claimEmailConfirmation(req, found.id, now))) {
      await killTransaction(req)
      const current = await findOne(lookup, MILJO_REGISTRATIONS_SLUG, { id: { equals: found.id } })
      const state = current ? await currentState(lookup, current) : null
      return state ?? fail(410, REGISTRATION_MESSAGES.linkExpired, undefined, 'expired')
    }
    await writeRegistrationAudit(req, { registration: found.id, action: 'email-verified', at: now, label: 'Søker', after: { status: 'awaiting_approval' } })
    if (shouldCommit) await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.error(`[miljo-registration] confirmation of registration ${String(found.id)} rolled back: ${errName(err)}`)
    return fail(500, REGISTRATION_MESSAGES.confirmFailed)
  }
  await notifyAdministrators(deps, found)
  return { ok: true, state: 'awaiting_approval', alreadyConfirmed: false, organizationName: String(found.officialName), publicCode: null }
}
