import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { createMiljoRegistrationApprovedEmail, createMiljoRegistrationRejectedEmail } from '@/emails'
import { BUSINESS_CUSTOMERS_SLUG, MILJO_ACCOUNTS_SLUG, MILJO_TRUSTED_ACCOUNT_CREATE, isEligibleOrderStatus, relationshipId } from '@/lib/miljo/business'
import { ENV_ORGANIZATIONS_SLUG, ORGANIZATION_LIMITS } from '@/lib/miljo/constants'
import { generatePin, hashPin } from '@/lib/miljo/pin'
import { pinVaultKey, sealPin } from '@/lib/miljo/pinVault'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { generateRawToken } from '@/lib/reviewToken'
import { claimDecision, linkOrderIfFree } from './atomic'
import {
  DECISION_NOTE_MAX,
  INTERNAL_NOTES_MAX,
  MILJO_REGISTRATIONS_SLUG,
  VERIFICATION_METHODS,
  type VerificationMethod,
} from './constants'
import { normalizeEmail } from './purchase'
import { REGISTRATION_MESSAGES, findOne, hasAccount, resolveTargetCustomer, writeRegistrationAudit, type Doc } from './service'

/**
 * The administrator's half of self-registration (Stage 2.6). The ONLY way a self-registered
 * organisation becomes active. Every function is called only from the admin-only endpoints in
 * @/collections/endpoints/miljoRegistrationApproval, which check the administrator on the server.
 *
 *   • approveRegistration  one transaction: claim the decision, create or link everything (business
 *                          customer, order link, organisation + QR code, PIN, account with the
 *                          password chosen at registration), write the history. Any failure rolls
 *                          all of it back and the registration stays «Venter på godkjenning».
 *   • rejectRegistration   claims the decision, removes the stored password hash, writes the history.
 *   • saveInternalNotes    the administrators' own notes. Never shown to the applicant.
 *   • registrationReview   what the review panel shows, including conflicts to look for.
 *
 * The decision is claimed by a conditional UPDATE (./atomic), so repeated or simultaneous approvals
 * cannot create a second account, and an approval and a rejection cannot both win. A decision is
 * final: the applicant may apply again, and earlier refusals are shown to the administrator.
 *
 * An administrator can never approve an application made with their own e-mail address — neither as
 * login address nor as the order's address.
 */

export interface ApprovalDeps {
  payload: Payload
  sendEmail: (message: { to: string; subject: string; html: string; text: string }) => Promise<void>
  siteUrl: string
  now?: () => Date
}

export interface Administrator {
  id: number | string
  email: string
}

export type ApprovalResult<T extends object = object> = ({ ok: true } & T) | { ok: false; status: number; message: string; field?: string }

const fail = (status: number, message: string, field?: string): { ok: false; status: number; message: string; field?: string } => ({ ok: false, status, message, field })
const errName = (err: unknown) => (err instanceof Error ? err.name : 'unknown')
const clock = (deps: ApprovalDeps) => (deps.now ? deps.now() : new Date())

export const APPROVAL_MESSAGES = {
  notFound: 'Fant ikke registreringen.',
  notReady: 'Registreringen kan ikke behandles før søkeren har bekreftet e-postadressen.',
  alreadyDecided: 'Registreringen er allerede behandlet.',
  selfApproval: 'Du kan ikke godkjenne en registrering som er gjort med din egen e-postadresse. En annen administrator må behandle den.',
  methodRequired: 'Velg hvordan søkerens tilknytning til organisasjonen ble bekreftet.',
  noteRequired: 'Beskriv i notatet hvordan tilknytningen ble bekreftet.',
  reasonRequired: 'Skriv en intern begrunnelse for avvisningen.',
  noteTooLong: `Notatet kan ikke være lengre enn ${DECISION_NOTE_MAX} tegn.`,
  notesTooLong: `Internt notat kan ikke være lengre enn ${INTERNAL_NOTES_MAX} tegn.`,
  orderNotEligible: 'Ordren er ikke lenger bekreftet, sendt eller levert. Registreringen kan ikke godkjennes.',
  alreadyRegistered: 'Organisasjonen har allerede en konto i Miljøregistrering. Avvis denne søknaden, eller administrer den eksisterende kontoen fra organisasjonen.',
  existingCustomer: 'Organisasjonen finnes allerede som bedriftskunde uten å være koblet til denne ordren. Koble ordren til bedriftskunden først, eller opprett kontoen fra organisasjonen.',
  orderOtherCompany: 'Ordren er knyttet til en annen organisasjon.',
  emailInUse: 'Innloggingsadressen brukes allerede av en annen Miljøkonto. Avvis søknaden og be søkeren registrere seg med en annen adresse.',
  vault: 'PIN-nøkkelen (MILJO_PIN_ENCRYPTION_KEY) mangler i dette miljøet. Ingenting ble endret.',
  failed: 'Godkjenningen kunne ikke fullføres. Ingenting ble endret.',
  saveFailed: 'Endringen kunne ikke lagres. Ingenting ble endret.',
} as const

/** The applicant-facing refusals of resolveTargetCustomer, in words for an administrator. */
const ADMIN_REFUSAL: Record<string, string> = {
  [REGISTRATION_MESSAGES.alreadyRegistered]: APPROVAL_MESSAGES.alreadyRegistered,
  [REGISTRATION_MESSAGES.contactAboks]: APPROVAL_MESSAGES.existingCustomer,
  [REGISTRATION_MESSAGES.orderOtherCompany]: APPROVAL_MESSAGES.orderOtherCompany,
}

const cleanNote = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

async function loadRegistration(req: PayloadRequest, id: number | string): Promise<Doc | null> {
  return findOne(req, MILJO_REGISTRATIONS_SLUG, { id: { equals: id } })
}

async function orderEmailOf(req: PayloadRequest, reg: Doc): Promise<string> {
  if (typeof reg.orderEmail === 'string' && reg.orderEmail) return normalizeEmail(reg.orderEmail)
  // Registered before the snapshot existed.
  const order = await findOne(req, 'orders', { id: { equals: relationshipId(reg.order) } })
  return normalizeEmail((order?.customerInfo as { email?: unknown } | undefined)?.email)
}

async function isOwnApplication(req: PayloadRequest, reg: Doc, admin: Administrator): Promise<boolean> {
  const mine = normalizeEmail(admin.email)
  return !!mine && (mine === normalizeEmail(reg.loginEmail) || mine === (await orderEmailOf(req, reg)))
}

/* ------------------------------ approve ------------------------------ */

/** Everything an approval creates, inside ONE transaction. Returns the refusal to roll back. */
async function activate(req: PayloadRequest, reg: Doc, now: Date, vaultKey: Buffer): Promise<{ ok: true; organizationId: number | string; accountId: number | string } | { ok: false; message: string; status: number }> {
  // The order must still qualify.
  const order = await findOne(req, 'orders', { id: { equals: relationshipId(reg.order) } })
  if (!order || !isEligibleOrderStatus(order.status)) return { ok: false, status: 409, message: APPROVAL_MESSAGES.orderNotEligible }

  // The business customer: the one aBoks linked this order to, or a new one.
  const target = await resolveTargetCustomer(req, order, String(reg.organizationNumber))
  if (!target.ok) return { ok: false, status: 409, message: ADMIN_REFUSAL[target.message] ?? target.message }
  if (await findOne(req, MILJO_ACCOUNTS_SLUG, { email: { equals: reg.loginEmail } })) return { ok: false, status: 409, message: APPROVAL_MESSAGES.emailInUse }

  const activatedAt = now.toISOString()
  let customer = target.target
  if (customer) {
    customer = (await req.payload.update({
      collection: BUSINESS_CUSTOMERS_SLUG,
      id: customer.id,
      data: { status: 'active', contactEmailVerifiedAt: activatedAt, ...(customer.contactName ? {} : { contactName: reg.contactName }) } as never,
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
        contactEmailVerifiedAt: activatedAt,
        status: 'active',
      } as never,
      overrideAccess: true,
      req,
    })) as unknown as Doc
  }

  // One company per order — decided by the database.
  if (!(await linkOrderIfFree(req, order.id, customer.id))) return { ok: false, status: 409, message: APPROVAL_MESSAGES.orderOtherCompany }

  // The environmental organisation (one QR code per company) — reuse the one aBoks made.
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

  // A delivery PIN, if the organisation has none — the same storage as the admin «PIN» action.
  const org = await findOne(req, ENV_ORGANIZATIONS_SLUG, { id: { equals: orgId } })
  if (!org?.pinHash) {
    const pin = generatePin()
    await req.payload.update({
      collection: ENV_ORGANIZATIONS_SLUG,
      id: orgId,
      data: {
        pinHash: await hashPin(pin),
        pinSetAt: activatedAt,
        pinEncrypted: sealPin(pin, Number(orgId), vaultKey),
        pinAttemptCount: 0,
        pinAttemptWindowStart: null,
      } as never,
      context: { miljoSetPin: true },
      overrideAccess: true,
      req,
    })
  }

  // The Miljø account: active, verified, with the password chosen at registration.
  const account = (await req.payload.create({
    collection: MILJO_ACCOUNTS_SLUG,
    data: {
      email: reg.loginEmail,
      password: generateRawToken(), // replaced below by the registrant's own hash
      businessCustomer: customer.id,
      status: 'active',
      emailVerifiedAt: activatedAt,
    } as never,
    context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true },
    overrideAccess: true,
    req,
  })) as unknown as Doc
  await req.payload.db.updateOne({ collection: MILJO_ACCOUNTS_SLUG, id: account.id, data: { salt: reg.passwordSalt, hash: reg.passwordHash }, req } as never)

  // The result on the registration; the password hash is no longer needed there.
  await req.payload.update({
    collection: MILJO_REGISTRATIONS_SLUG,
    id: reg.id,
    data: { businessCustomer: customer.id, account: account.id, environmentalOrganization: orgId, passwordHash: null, passwordSalt: null, resendKeyHash: null } as never,
    overrideAccess: true,
    req,
  })
  return { ok: true, organizationId: orgId, accountId: account.id }
}

export async function approveRegistration(
  deps: ApprovalDeps,
  admin: Administrator,
  id: number | string,
  input: { verificationMethod: unknown; note: unknown },
): Promise<ApprovalResult<{ emailSent: boolean }>> {
  const method = input.verificationMethod
  if (typeof method !== 'string' || !VERIFICATION_METHODS.includes(method as VerificationMethod)) return fail(400, APPROVAL_MESSAGES.methodRequired, 'verificationMethod')
  const note = cleanNote(input.note)
  if (note.length > DECISION_NOTE_MAX) return fail(400, APPROVAL_MESSAGES.noteTooLong, 'note')
  if (method === 'other' && !note) return fail(400, APPROVAL_MESSAGES.noteRequired, 'note')

  const now = clock(deps)
  const req = await createLocalReq({}, deps.payload)
  const reg = await loadRegistration(req, id)
  if (!reg) return fail(404, APPROVAL_MESSAGES.notFound)
  if (reg.status === 'pending') return fail(409, APPROVAL_MESSAGES.notReady)
  if (reg.status !== 'awaiting_approval') return fail(409, APPROVAL_MESSAGES.alreadyDecided)
  if (await isOwnApplication(req, reg, admin)) return fail(403, APPROVAL_MESSAGES.selfApproval)
  // Without the vault key the new PIN could be stored only as a hash, and Min side could never show it.
  const vaultKey = pinVaultKey()
  if (!vaultKey) {
    deps.payload.logger.error(`[miljo-registration] approval of registration ${String(reg.id)} refused: MILJO_PIN_ENCRYPTION_KEY is not configured`)
    return fail(503, APPROVAL_MESSAGES.vault)
  }

  const shouldCommit = await initTransaction(req)
  try {
    const claimed = await claimDecision(req, reg.id, {
      outcome: 'confirmed',
      decidedAt: now,
      decidedById: admin.id,
      decidedByLabel: admin.email,
      verificationMethod: method,
      decisionNote: note || null,
    })
    if (!claimed) {
      await killTransaction(req)
      return fail(409, APPROVAL_MESSAGES.alreadyDecided)
    }
    const result = await activate(req, reg, now, vaultKey)
    if (!result.ok) {
      await killTransaction(req)
      return fail(result.status, result.message)
    }
    await writeRegistrationAudit(req, { registration: reg.id, action: 'approved', at: now, performedBy: admin.id, label: admin.email, organization: result.organizationId, reason: note || null, after: { status: 'confirmed', verificationMethod: method } })
    await writeRegistrationAudit(req, { registration: reg.id, action: 'activated', at: now, performedBy: admin.id, label: admin.email, organization: result.organizationId, after: { account: result.accountId } })
    if (shouldCommit) await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.error(`[miljo-registration] approval of registration ${String(reg.id)} rolled back: ${errName(err)}`)
    return fail(500, APPROVAL_MESSAGES.failed)
  }

  const emailSent = await sendDecisionEmail(deps, reg, now, () =>
    createMiljoRegistrationApprovedEmail({
      organizationName: String(reg.officialName),
      loginUrl: `${deps.siteUrl.replace(/\/$/, '')}${MILJO_PATHS.login}`,
    }),
  )
  return { ok: true, emailSent }
}

/* ------------------------------ reject ------------------------------ */

export async function rejectRegistration(deps: ApprovalDeps, admin: Administrator, id: number | string, input: { reason: unknown }): Promise<ApprovalResult<{ emailSent: boolean }>> {
  const reason = cleanNote(input.reason)
  if (!reason) return fail(400, APPROVAL_MESSAGES.reasonRequired, 'reason')
  if (reason.length > DECISION_NOTE_MAX) return fail(400, APPROVAL_MESSAGES.noteTooLong, 'reason')

  const now = clock(deps)
  const req = await createLocalReq({}, deps.payload)
  const reg = await loadRegistration(req, id)
  if (!reg) return fail(404, APPROVAL_MESSAGES.notFound)
  if (reg.status === 'pending') return fail(409, APPROVAL_MESSAGES.notReady)
  if (reg.status !== 'awaiting_approval') return fail(409, APPROVAL_MESSAGES.alreadyDecided)

  const shouldCommit = await initTransaction(req)
  try {
    const claimed = await claimDecision(req, reg.id, { outcome: 'rejected', decidedAt: now, decidedById: admin.id, decidedByLabel: admin.email, verificationMethod: null, decisionNote: reason })
    if (!claimed) {
      await killTransaction(req)
      return fail(409, APPROVAL_MESSAGES.alreadyDecided)
    }
    await req.payload.update({ collection: MILJO_REGISTRATIONS_SLUG, id: reg.id, data: { passwordHash: null, passwordSalt: null, resendKeyHash: null } as never, overrideAccess: true, req })
    await writeRegistrationAudit(req, { registration: reg.id, action: 'rejected', at: now, performedBy: admin.id, label: admin.email, reason, after: { status: 'rejected' } })
    if (shouldCommit) await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.error(`[miljo-registration] rejection of registration ${String(reg.id)} rolled back: ${errName(err)}`)
    return fail(500, APPROVAL_MESSAGES.saveFailed)
  }

  const emailSent = await sendDecisionEmail(deps, reg, now, () => createMiljoRegistrationRejectedEmail({ organizationName: String(reg.officialName) }))
  return { ok: true, emailSent }
}

/** After the commit: a lost e-mail never undoes a decision, and the administrator is told. */
async function sendDecisionEmail(deps: ApprovalDeps, reg: Doc, now: Date, build: () => { subject: string; html: string; text: string }): Promise<boolean> {
  try {
    await deps.sendEmail({ to: String(reg.loginEmail), ...build() })
    await deps.payload.update({ collection: MILJO_REGISTRATIONS_SLUG, id: reg.id, data: { decisionEmailSentAt: now.toISOString() } as never, overrideAccess: true })
    return true
  } catch (err) {
    deps.payload.logger.error(`[miljo-registration] decision e-mail for registration ${String(reg.id)} failed: ${errName(err)}`)
    return false
  }
}

/* ------------------------------ notes ------------------------------ */

export async function saveInternalNotes(deps: ApprovalDeps, admin: Administrator, id: number | string, input: { notes: unknown }): Promise<ApprovalResult> {
  const notes = cleanNote(input.notes)
  if (notes.length > INTERNAL_NOTES_MAX) return fail(400, APPROVAL_MESSAGES.notesTooLong, 'notes')
  const req = await createLocalReq({}, deps.payload)
  const reg = await loadRegistration(req, id)
  if (!reg) return fail(404, APPROVAL_MESSAGES.notFound)
  const previous = typeof reg.internalNotes === 'string' ? reg.internalNotes : ''
  if (previous === notes) return { ok: true }

  const shouldCommit = await initTransaction(req)
  try {
    await req.payload.update({ collection: MILJO_REGISTRATIONS_SLUG, id: reg.id, data: { internalNotes: notes || null } as never, overrideAccess: true, req })
    await writeRegistrationAudit(req, { registration: reg.id, action: 'note-updated', at: clock(deps), performedBy: admin.id, label: admin.email, before: { internalNotes: previous }, after: { internalNotes: notes } })
    if (shouldCommit) await commitTransaction(req)
    return { ok: true }
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.error(`[miljo-registration] notes of registration ${String(reg.id)} not saved: ${errName(err)}`)
    return fail(500, APPROVAL_MESSAGES.saveFailed)
  }
}

/* ------------------------------ review panel ------------------------------ */

export interface RegistrationReview {
  status: string
  canDecide: boolean
  ownApplication: boolean
  order: { id: number | string; orderNumber: string; status: string; eligible: boolean; buyerName: string; orderEmail: string } | null
  loginEmailSameAsOrder: boolean
  orderNoticeSentAt: string | null
  decisionEmailSentAt: string | null
  emailVerifiedAt: string | null
  decidedAt: string | null
  decidedByLabel: string | null
  verificationMethod: string | null
  decisionNote: string | null
  internalNotes: string
  /** Activated before administrator approval existed. */
  legacyActivation: boolean
  /** Things the administrator should look at before deciding, in Norwegian. */
  warnings: string[]
  brregUrl: string
}

export async function registrationReview(req: PayloadRequest, admin: Administrator, id: number | string): Promise<RegistrationReview | null> {
  const reg = await loadRegistration(req, id)
  if (!reg) return null
  const orderId = relationshipId(reg.order)
  const order = orderId != null ? await findOne(req, 'orders', { id: { equals: orderId } }) : null
  const info = (order?.customerInfo ?? {}) as { email?: unknown; firstName?: unknown; lastName?: unknown }
  const orderEmail = await orderEmailOf(req, reg)
  const organizationNumber = String(reg.organizationNumber)
  const open = reg.status === 'pending' || reg.status === 'awaiting_approval'

  const warnings: string[] = []
  if (open) {
    const sameNumber = await req.payload.find({
      collection: MILJO_REGISTRATIONS_SLUG,
      where: { and: [{ organizationNumber: { equals: organizationNumber } }, { id: { not_equals: reg.id } }, { status: { in: ['pending', 'awaiting_approval'] } }] },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })
    if (sameNumber.docs.length > 0) warnings.push(`${sameNumber.docs.length === 1 ? '1 annen åpen søknad' : `${sameNumber.docs.length} andre åpne søknader`} gjelder samme organisasjonsnummer. Bare én kan godkjennes.`)

    const refused = await req.payload.find({
      collection: MILJO_REGISTRATIONS_SLUG,
      where: { and: [{ id: { not_equals: reg.id } }, { status: { equals: 'rejected' } }, { or: [{ organizationNumber: { equals: organizationNumber } }, { order: { equals: orderId } }] }] },
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    })
    if (refused.docs.length > 0) warnings.push(`${refused.docs.length === 1 ? '1 tidligere søknad' : `${refused.docs.length} tidligere søknader`} med samme organisasjonsnummer eller ordre er avvist.`)

    const customer = await findOne(req, BUSINESS_CUSTOMERS_SLUG, { organizationNumber: { equals: organizationNumber } })
    if (customer) warnings.push(await hasAccount(req, customer.id) ? APPROVAL_MESSAGES.alreadyRegistered : 'Organisasjonen finnes allerede som bedriftskunde.')
    if (order && !isEligibleOrderStatus(order.status)) warnings.push(APPROVAL_MESSAGES.orderNotEligible)
    if (await findOne(req, MILJO_ACCOUNTS_SLUG, { email: { equals: reg.loginEmail } })) warnings.push(APPROVAL_MESSAGES.emailInUse)
  }

  const ownApplication = await isOwnApplication(req, reg, admin)
  if (ownApplication && open) warnings.push(APPROVAL_MESSAGES.selfApproval)
  const iso = (v: unknown) => (typeof v === 'string' && v ? v : null)

  return {
    status: String(reg.status),
    canDecide: reg.status === 'awaiting_approval',
    ownApplication,
    order: order
      ? {
          id: order.id,
          orderNumber: String(order.orderNumber ?? reg.orderNumber ?? ''),
          status: String(order.status ?? ''),
          eligible: isEligibleOrderStatus(order.status),
          buyerName: [info.firstName, info.lastName].filter((p) => typeof p === 'string' && p).join(' '),
          orderEmail,
        }
      : null,
    loginEmailSameAsOrder: !!orderEmail && orderEmail === normalizeEmail(reg.loginEmail),
    orderNoticeSentAt: iso(reg.orderNoticeSentAt),
    decisionEmailSentAt: iso(reg.decisionEmailSentAt),
    emailVerifiedAt: iso(reg.confirmedAt),
    decidedAt: iso(reg.decidedAt),
    decidedByLabel: iso(reg.decidedByLabel),
    verificationMethod: iso(reg.verificationMethod),
    decisionNote: iso(reg.decisionNote),
    internalNotes: typeof reg.internalNotes === 'string' ? reg.internalNotes : '',
    legacyActivation: reg.status === 'confirmed' && !reg.decidedAt,
    warnings,
    brregUrl: `https://data.brreg.no/enhetsregisteret/oppslag/enheter/${encodeURIComponent(organizationNumber)}`,
  }
}
