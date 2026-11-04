import { randomInt } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { createMiljoInvitationEmail } from '@/emails'
import {
  BUSINESS_CUSTOMERS_SLUG,
  MILJO_ACCOUNTS_SLUG,
  MILJO_TRUSTED_ACCOUNT_CREATE,
  accountCanAuthenticate,
  relationshipId,
  type MiljoAccountProvisioning,
} from '@/lib/miljo/business'
import { hasValidLinkedOrder } from '@/lib/miljo/businessAccess'
import { ENV_ORGANIZATIONS_SLUG } from '@/lib/miljo/constants'
import { executorOf } from '@/lib/miljo/registration/atomic'
import { MILJO_REGISTRATIONS_SLUG } from '@/lib/miljo/registration/constants'
import { PASSWORD_MAX_LENGTH, validateNewPassword } from '@/lib/miljo/registration/password'
import { normalizeEmail } from '@/lib/miljo/registration/purchase'
import { normalizeOrganizationNumber, validateOrganizationNumber } from '@/lib/partner/referral'
import { generateRawToken, hashToken } from '@/lib/reviewToken'
import { INVITATION_TTL_MS, MILJO_PATHS } from './constants'
import { storeNewPassword } from './service'
import { revokeSessions } from './session'

/**
 * Administrator-managed Miljø accounts (Stage 2.5) — what Payload Admin → Miljøregistrering →
 * Organisasjoner → «Brukerkontoer» does. Every function is called only from the admin-only
 * endpoints in @/collections/endpoints/miljo (administrator checked there); the organisation is
 * always the one in the URL, and an account is acted on only when it belongs to that organisation.
 *
 *   • createOrganizationAccount  the responsible person's account, by one of two methods:
 *       – `password`   a temporary password (typed or generated). The account can sign in at once
 *                      but must choose its own password first (`mustChangePassword`, enforced in
 *                      ./session). The password is returned ONCE in the response and never again:
 *                      only Payload's salted hash is stored. Nothing is e-mailed.
 *       – `invitation` an e-mail with a one-time link (32 random bytes, stored only as SHA-256,
 *                      valid seven days). The recipient chooses the password (./invitation).
 *   • revoke / restore           close or reopen access; revoking ends every session at once.
 *   • reissueInvitation          a new link; the previous one stops working.
 *   • resetTemporaryPassword     a new temporary password (must be changed at the next sign-in).
 *
 * The organisation's business customer is reused when it exists; otherwise one is created from the
 * organisation with access «by agreement» (no web order needed). One e-mail is one account (the
 * auth collection's unique e-mail), and — for now — one active or invited account per organisation.
 * No password, token or e-mail address is ever logged.
 */

type Doc = Record<string, unknown> & { id: number | string }

export interface AdminAccountDeps {
  payload: Payload
  sendEmail: (message: { to: string; subject: string; html: string; text: string }) => Promise<void>
  siteUrl: string
  now?: () => Date
}

export type AdminResult<T extends object = object> = ({ ok: true } & T) | { ok: false; status: number; message: string; field?: string }

const fail = (status: number, message: string, field?: string): { ok: false; status: number; message: string; field?: string } => ({ ok: false, status, message, field })
const clock = (deps: AdminAccountDeps) => (deps.now ? deps.now() : new Date())
const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const errName = (err: unknown) => (err instanceof Error ? err.name : 'unknown')

export const ADMIN_ACCOUNT_MESSAGES = {
  orgNotFound: 'Fant ikke organisasjonen.',
  accountNotFound: 'Fant ikke brukerkontoen for denne organisasjonen.',
  nameRequired: 'Skriv inn navnet til den ansvarlige.',
  emailInvalid: 'Skriv inn en gyldig e-postadresse.',
  emailInUse: 'Det finnes allerede en brukerkonto med denne e-postadressen.',
  emailPendingRegistration: 'Denne e-postadressen brukes i en selvregistrering som venter på bekreftelse.',
  methodInvalid: 'Velg midlertidig passord eller e-postinvitasjon.',
  organizationNumberRequired: 'Organisasjonen har ikke noe organisasjonsnummer. Oppgi det (9 sifre) for å opprette brukerkontoen.',
  organizationNumberTaken: 'Organisasjonsnummeret tilhører en bedriftskunde som er knyttet til en annen organisasjon.',
  alreadyHasAccount: 'Organisasjonen har allerede en aktiv eller invitert brukerkonto. Deaktiver den først for å opprette en ny.',
  notInvited: 'Bare en invitert konto som ikke er aktivert, kan få ny invitasjon.',
  disabled: 'Kontoen er deaktivert. Gjenopprett den først.',
  notDisabled: 'Kontoen er ikke deaktivert.',
  failed: 'Endringen kunne ikke lagres. Ingenting ble endret.',
} as const

/* ------------------------------ temporary passwords ------------------------------ */

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * A readable temporary password: three groups of four from a 55-character alphabet without
 * look-alikes (≈ 69 bits), drawn with `crypto.randomInt`; always contains a letter and a digit, so
 * it satisfies the account password rules.
 */
export function generateTemporaryPassword(): string {
  for (;;) {
    const groups = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join(''))
    const candidate = groups.join('-')
    if (/[a-zA-Z]/.test(candidate) && /\d/.test(candidate)) return candidate
  }
}

/* ------------------------------ reading ------------------------------ */

export interface AccountSummary {
  id: number | string
  email: string
  fullName: string
  status: string
  provisioning: string
  mustChangePassword: boolean
  emailVerifiedAt: string | null
  invitedAt: string | null
  inviteExpiresAt: string | null
  inviteExpired: boolean
  createdAt: string | null
}

export interface CustomerSummary {
  id: number | string
  name: string
  organizationNumber: string
  status: string
  accessBasis: string
  /** Whether the customer itself grants access now (status «Aktiv» and its access basis holds). */
  accessOk: boolean
  /** Why not, in Norwegian, for the administrator. */
  accessProblem: string | null
}

const iso = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export function toAccountSummary(doc: Doc, now: Date): AccountSummary {
  const expires = iso(doc.inviteExpiresAt)
  return {
    id: doc.id,
    email: String(doc.email ?? ''),
    fullName: String(doc.fullName ?? ''),
    status: String(doc.status ?? ''),
    provisioning: String(doc.provisioning ?? 'self-registration'),
    mustChangePassword: doc.mustChangePassword === true,
    emailVerifiedAt: iso(doc.emailVerifiedAt),
    invitedAt: iso(doc.invitedAt),
    inviteExpiresAt: expires,
    inviteExpired: doc.status === 'invited' && !!expires && new Date(expires).getTime() <= now.getTime(),
    createdAt: iso(doc.createdAt),
  }
}

async function findById(req: PayloadRequest, collection: string, id: unknown): Promise<Doc | null> {
  if (id == null) return null
  return (await req.payload.findByID({ collection: collection as never, id: id as never, depth: 0, overrideAccess: true, disableErrors: true, req })) as unknown as Doc | null
}

async function findFirst(req: PayloadRequest, collection: string, where: Record<string, unknown>): Promise<Doc | null> {
  const res = await req.payload.find({ collection: collection as never, where: where as never, depth: 0, limit: 1, pagination: false, overrideAccess: true, req })
  return (res.docs[0] as unknown as Doc | undefined) ?? null
}

async function customerOf(req: PayloadRequest, orgId: number): Promise<Doc | null> {
  return findFirst(req, BUSINESS_CUSTOMERS_SLUG, { environmentalOrganization: { equals: orgId } })
}

async function customerSummary(req: PayloadRequest, customer: Doc): Promise<CustomerSummary> {
  const status = String(customer.status ?? '')
  const accessBasis = String(customer.accessBasis ?? 'purchase')
  let accessProblem: string | null = null
  if (status !== 'active') accessProblem = `Bedriftskunden har status «${status === 'suspended' ? 'Sperret' : 'Venter'}». Ingen konto kan logge inn før status er «Aktiv».`
  else if (accessBasis !== 'agreement' && !(await hasValidLinkedOrder(req, customer.id))) {
    accessProblem = 'Bedriftskunden har ingen gyldig ordre. Koble en ordre, eller sett «Grunnlag for tilgang» til «Avtale med aBoks».'
  }
  return {
    id: customer.id,
    name: String(customer.name ?? ''),
    organizationNumber: String(customer.organizationNumber ?? ''),
    status,
    accessBasis,
    accessOk: accessProblem === null,
    accessProblem,
  }
}

export interface OrganizationAccounts {
  organization: { id: number; name: string; organizationNumber: string }
  businessCustomer: CustomerSummary | null
  accounts: AccountSummary[]
}

export async function listOrganizationAccounts(req: PayloadRequest, orgId: number, now: Date = new Date()): Promise<OrganizationAccounts | null> {
  const org = await findById(req, ENV_ORGANIZATIONS_SLUG, orgId)
  if (!org) return null
  const customer = await customerOf(req, orgId)
  const accounts = customer
    ? ((
        await req.payload.find({
          collection: MILJO_ACCOUNTS_SLUG,
          where: { businessCustomer: { equals: customer.id } },
          depth: 0,
          limit: 50,
          pagination: false,
          sort: 'createdAt',
          overrideAccess: true,
          req,
        })
      ).docs as unknown as Doc[])
    : []
  return {
    organization: { id: orgId, name: String(org.name ?? ''), organizationNumber: String(org.organizationNumber ?? '') },
    businessCustomer: customer ? await customerSummary(req, customer) : null,
    accounts: accounts.map((a) => toAccountSummary(a, now)),
  }
}

/** The account — only when it belongs to the organisation in the URL. */
async function orgAccount(req: PayloadRequest, orgId: number, accountId: unknown): Promise<Doc | null> {
  const id = typeof accountId === 'string' || typeof accountId === 'number' ? Number(accountId) : NaN
  if (!Number.isInteger(id) || id <= 0) return null
  const account = await findById(req, MILJO_ACCOUNTS_SLUG, id)
  if (!account) return null
  const customer = await findById(req, BUSINESS_CUSTOMERS_SLUG, relationshipId(account.businessCustomer))
  return customer && String(relationshipId(customer.environmentalOrganization)) === String(orgId) ? account : null
}

/* ------------------------------ creating ------------------------------ */

export interface CreateAccountInput {
  fullName: unknown
  email: unknown
  method: unknown
  /** `password` method: the temporary password; empty → one is generated. */
  password?: unknown
  /** Only when a business customer must be created and the organisation has no number on file. */
  organizationNumber?: unknown
}

export interface CreatedAccount {
  account: AccountSummary
  /** `password` method only — shown to the administrator once, never stored or returned again. */
  temporaryPassword?: string
  /** `invitation` method only. */
  invitationSent?: boolean
  businessCustomerCreated: boolean
  /** Set when the account exists but cannot sign in yet because of the business customer. */
  accessProblem: string | null
}

function activateUrl(siteUrl: string, rawToken: string) {
  return `${siteUrl.replace(/\/$/, '')}${MILJO_PATHS.activate}?token=${encodeURIComponent(rawToken)}`
}

/** Locks the business customer row until the transaction ends (no-op on the in-memory test database). */
async function lockCustomer(req: PayloadRequest, customerId: number | string): Promise<void> {
  const db = executorOf(req)
  if (db) await db.execute(sql`SELECT "id" FROM "business_customers" WHERE "id" = ${Number(customerId)} FOR UPDATE`)
}

async function openAccountCount(req: PayloadRequest, customerId: number | string, exceptId?: number | string): Promise<number> {
  const res = await req.payload.find({
    collection: MILJO_ACCOUNTS_SLUG,
    where: { and: [{ businessCustomer: { equals: customerId } }, { status: { not_equals: 'disabled' } }] },
    depth: 0,
    limit: 50,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return (res.docs as unknown as Doc[]).filter((d) => exceptId == null || String(d.id) !== String(exceptId)).length
}

/** The organisation's business customer — existing, an unlinked one with the same number, or new. */
async function ensureCustomer(
  req: PayloadRequest,
  org: Doc,
  input: { fullName: string; email: string; organizationNumber: unknown },
): Promise<AdminResult<{ customer: Doc; created: boolean }>> {
  const existing = await customerOf(req, Number(org.id))
  if (existing) return { ok: true, customer: existing, created: false }

  const raw = typeof input.organizationNumber === 'string' && input.organizationNumber.trim() ? input.organizationNumber : org.organizationNumber
  const digits = normalizeOrganizationNumber(typeof raw === 'string' ? raw : '')
  if (!digits) return fail(400, ADMIN_ACCOUNT_MESSAGES.organizationNumberRequired, 'organizationNumber')
  const check = validateOrganizationNumber(digits)
  if (check !== true) return fail(400, check, 'organizationNumber')

  const sameNumber = await findFirst(req, BUSINESS_CUSTOMERS_SLUG, { organizationNumber: { equals: digits } })
  if (sameNumber) {
    if (relationshipId(sameNumber.environmentalOrganization) != null) return fail(409, ADMIN_ACCOUNT_MESSAGES.organizationNumberTaken, 'organizationNumber')
    // An unlinked customer for the same company: link it rather than creating a duplicate.
    const linked = (await req.payload.update({
      collection: BUSINESS_CUSTOMERS_SLUG,
      id: sameNumber.id,
      data: { environmentalOrganization: org.id } as never,
      overrideAccess: true,
      req,
    })) as unknown as Doc
    return { ok: true, customer: linked, created: false }
  }
  const created = (await req.payload.create({
    collection: BUSINESS_CUSTOMERS_SLUG,
    data: {
      name: String(org.name ?? '').slice(0, 200),
      organizationNumber: digits,
      contactName: input.fullName,
      contactEmail: input.email,
      status: 'active',
      accessBasis: 'agreement',
      environmentalOrganization: org.id,
    } as never,
    overrideAccess: true,
    req,
  })) as unknown as Doc
  return { ok: true, customer: created, created: true }
}

export async function createOrganizationAccount(deps: AdminAccountDeps, adminUserId: unknown, orgId: number, input: CreateAccountInput): Promise<AdminResult<CreatedAccount>> {
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : ''
  if (!fullName || fullName.length > 120) return fail(400, ADMIN_ACCOUNT_MESSAGES.nameRequired, 'fullName')
  const email = normalizeEmail(input.email)
  if (!isEmail(email)) return fail(400, ADMIN_ACCOUNT_MESSAGES.emailInvalid, 'email')
  const method = input.method === 'password' || input.method === 'invitation' ? input.method : null
  if (!method) return fail(400, ADMIN_ACCOUNT_MESSAGES.methodInvalid, 'method')

  let password: string
  if (method === 'password') {
    const typed = typeof input.password === 'string' ? input.password : ''
    if (typed) {
      const problem = validateNewPassword(typed, typed)
      if (problem) return fail(400, problem, 'password')
      password = typed
    } else password = generateTemporaryPassword()
  } else {
    // Nobody ever learns this one: the invitation replaces it with the recipient's own password.
    password = `${generateRawToken()}Aa1`.slice(0, PASSWORD_MAX_LENGTH)
  }

  const now = clock(deps)
  const req = await createLocalReq({}, deps.payload)
  const org = await findById(req, ENV_ORGANIZATIONS_SLUG, orgId)
  if (!org) return fail(404, ADMIN_ACCOUNT_MESSAGES.orgNotFound)
  if (await findFirst(req, MILJO_ACCOUNTS_SLUG, { email: { equals: email } })) return fail(409, ADMIN_ACCOUNT_MESSAGES.emailInUse, 'email')
  if (await findFirst(req, MILJO_REGISTRATIONS_SLUG, { and: [{ loginEmail: { equals: email } }, { status: { equals: 'pending' } }] })) {
    return fail(409, ADMIN_ACCOUNT_MESSAGES.emailPendingRegistration, 'email')
  }

  const rawToken = method === 'invitation' ? generateRawToken() : null
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS)
  const provisioning: MiljoAccountProvisioning = method === 'password' ? 'admin-password' : 'admin-invitation'

  const shouldCommit = await initTransaction(req)
  let account: Doc
  let customer: Doc
  let customerCreated = false
  try {
    const ensured = await ensureCustomer(req, org, { fullName, email, organizationNumber: input.organizationNumber })
    if (!ensured.ok) {
      await killTransaction(req)
      return ensured
    }
    customer = ensured.customer
    customerCreated = ensured.created
    await lockCustomer(req, customer.id)
    if ((await openAccountCount(req, customer.id)) > 0) {
      await killTransaction(req)
      return fail(409, ADMIN_ACCOUNT_MESSAGES.alreadyHasAccount)
    }
    account = (await req.payload.create({
      collection: MILJO_ACCOUNTS_SLUG,
      data: {
        email,
        password,
        fullName,
        businessCustomer: customer.id,
        provisioning,
        ...(method === 'password'
          ? { status: 'active', emailVerifiedAt: now.toISOString(), mustChangePassword: true }
          : { status: 'invited', inviteTokenHash: hashToken(rawToken!), invitedAt: now.toISOString(), inviteExpiresAt: expiresAt.toISOString() }),
      } as never,
      overrideAccess: true,
      context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true },
      req,
    })) as unknown as Doc
    if (shouldCommit) await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    // A parallel request may have taken the e-mail between the check and the insert (unique index).
    if (await findFirst(await createLocalReq({}, deps.payload), MILJO_ACCOUNTS_SLUG, { email: { equals: email } }).catch(() => null)) {
      return fail(409, ADMIN_ACCOUNT_MESSAGES.emailInUse, 'email')
    }
    deps.payload.logger.error(`[miljo-admin] account creation for organization ${orgId} rolled back: ${errName(err)}`)
    return fail(500, ADMIN_ACCOUNT_MESSAGES.failed)
  }
  deps.payload.logger.info(`[miljo-admin] account ${String(account.id)} created for organization ${orgId} by user ${String(adminUserId)} (${provisioning})`)

  let invitationSent: boolean | undefined
  if (rawToken) invitationSent = await sendInvitation(deps, req, account, String(org.name ?? ''), fullName, rawToken, expiresAt)
  const summary = await customerSummary(req, customer)
  return {
    ok: true,
    account: toAccountSummary(account, now),
    ...(method === 'password' ? { temporaryPassword: password } : { invitationSent }),
    businessCustomerCreated: customerCreated,
    accessProblem: summary.accessProblem,
  }
}

async function sendInvitation(deps: AdminAccountDeps, req: PayloadRequest, account: Doc, organizationName: string, fullName: string, rawToken: string, expiresAt: Date): Promise<boolean> {
  try {
    const message = createMiljoInvitationEmail({ recipientName: fullName, organizationName, activateUrl: activateUrl(deps.siteUrl, rawToken), expiresAt })
    await deps.sendEmail({ to: String(account.email), ...message })
    return true
  } catch (err) {
    req.payload.logger.error(`[miljo-admin] invitation for account ${String(account.id)} not sent: ${errName(err)}`)
    return false
  }
}

/* ------------------------------ managing ------------------------------ */

export async function revokeAccount(deps: AdminAccountDeps, adminUserId: unknown, orgId: number, accountId: unknown): Promise<AdminResult<{ account: AccountSummary }>> {
  const req = await createLocalReq({}, deps.payload)
  const account = await orgAccount(req, orgId, accountId)
  if (!account) return fail(404, ADMIN_ACCOUNT_MESSAGES.accountNotFound)
  const updated = (await req.payload.update({
    collection: MILJO_ACCOUNTS_SLUG,
    id: account.id,
    data: { status: 'disabled', inviteTokenHash: null, inviteExpiresAt: null } as never,
    overrideAccess: true,
    req,
  })) as unknown as Doc
  await revokeSessions(deps.payload, account.id)
  deps.payload.logger.info(`[miljo-admin] account ${String(account.id)} of organization ${orgId} revoked by user ${String(adminUserId)}; sessions ended`)
  return { ok: true, account: toAccountSummary(updated, clock(deps)) }
}

/** Disabled → active (if the e-mail was verified) or invited (a new invitation is then needed). */
export async function restoreAccount(deps: AdminAccountDeps, adminUserId: unknown, orgId: number, accountId: unknown): Promise<AdminResult<{ account: AccountSummary }>> {
  const req = await createLocalReq({}, deps.payload)
  const account = await orgAccount(req, orgId, accountId)
  if (!account) return fail(404, ADMIN_ACCOUNT_MESSAGES.accountNotFound)
  if (account.status !== 'disabled') return fail(409, ADMIN_ACCOUNT_MESSAGES.notDisabled)
  if ((await openAccountCount(req, relationshipId(account.businessCustomer)!)) > 0) return fail(409, ADMIN_ACCOUNT_MESSAGES.alreadyHasAccount)
  const status = accountCanAuthenticate({ status: 'active', emailVerifiedAt: account.emailVerifiedAt }) ? 'active' : 'invited'
  const updated = (await req.payload.update({ collection: MILJO_ACCOUNTS_SLUG, id: account.id, data: { status } as never, overrideAccess: true, req })) as unknown as Doc
  deps.payload.logger.info(`[miljo-admin] account ${String(account.id)} of organization ${orgId} restored (${status}) by user ${String(adminUserId)}`)
  return { ok: true, account: toAccountSummary(updated, clock(deps)) }
}

export async function reissueInvitation(deps: AdminAccountDeps, adminUserId: unknown, orgId: number, accountId: unknown): Promise<AdminResult<{ account: AccountSummary; invitationSent: boolean }>> {
  const req = await createLocalReq({}, deps.payload)
  const account = await orgAccount(req, orgId, accountId)
  if (!account) return fail(404, ADMIN_ACCOUNT_MESSAGES.accountNotFound)
  if (account.status !== 'invited') return fail(409, account.status === 'disabled' ? ADMIN_ACCOUNT_MESSAGES.disabled : ADMIN_ACCOUNT_MESSAGES.notInvited)
  const now = clock(deps)
  const rawToken = generateRawToken()
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS)
  const updated = (await req.payload.update({
    collection: MILJO_ACCOUNTS_SLUG,
    id: account.id,
    data: { inviteTokenHash: hashToken(rawToken), invitedAt: now.toISOString(), inviteExpiresAt: expiresAt.toISOString() } as never,
    overrideAccess: true,
    req,
  })) as unknown as Doc
  const org = await findById(req, ENV_ORGANIZATIONS_SLUG, orgId)
  const invitationSent = await sendInvitation(deps, req, updated, String(org?.name ?? ''), String(updated.fullName ?? ''), rawToken, expiresAt)
  deps.payload.logger.info(`[miljo-admin] invitation for account ${String(account.id)} of organization ${orgId} reissued by user ${String(adminUserId)}; previous link invalid`)
  return { ok: true, account: toAccountSummary(updated, now), invitationSent }
}

/**
 * A new temporary password for an active or invited account: it can sign in at once with it, must
 * choose its own at the next sign-in, and every existing session ends. An open invitation is
 * withdrawn. Returned once.
 */
export async function resetTemporaryPassword(
  deps: AdminAccountDeps,
  adminUserId: unknown,
  orgId: number,
  accountId: unknown,
  input: { password?: unknown },
): Promise<AdminResult<{ account: AccountSummary; temporaryPassword: string }>> {
  const typed = typeof input.password === 'string' ? input.password : ''
  if (typed) {
    const problem = validateNewPassword(typed, typed)
    if (problem) return fail(400, problem, 'password')
  }
  const password = typed || generateTemporaryPassword()
  const req = await createLocalReq({}, deps.payload)
  const account = await orgAccount(req, orgId, accountId)
  if (!account) return fail(404, ADMIN_ACCOUNT_MESSAGES.accountNotFound)
  if (account.status === 'disabled') return fail(409, ADMIN_ACCOUNT_MESSAGES.disabled)
  const now = clock(deps)
  await storeNewPassword(req, account.id, password, {
    mustChangePassword: true,
    status: 'active',
    emailVerifiedAt: iso(account.emailVerifiedAt) ?? now.toISOString(),
    inviteTokenHash: null,
    inviteExpiresAt: null,
  })
  const updated = (await findById(req, MILJO_ACCOUNTS_SLUG, account.id))!
  deps.payload.logger.info(`[miljo-admin] temporary password set for account ${String(account.id)} of organization ${orgId} by user ${String(adminUserId)}; sessions ended`)
  return { ok: true, account: toAccountSummary(updated, now), temporaryPassword: password }
}
