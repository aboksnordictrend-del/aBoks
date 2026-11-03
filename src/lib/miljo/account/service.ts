import { sql } from '@payloadcms/db-postgres'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type Payload, type PayloadRequest } from 'payload'
import { createMiljoPasswordResetEmail } from '@/emails'
import { BUSINESS_CUSTOMERS_SLUG, MILJO_ACCOUNTS_SLUG, MILJO_AUTH_CONTEXT, relationshipId } from '@/lib/miljo/business'
import { resolveAuthorizedBusinessCustomerId } from '@/lib/miljo/businessAccess'
import { ENV_ORGANIZATIONS_SLUG } from '@/lib/miljo/constants'
import { verifyPin } from '@/lib/miljo/pin'
import { openPin, pinVaultKey } from '@/lib/miljo/pinVault'
import { miljoPublicUrl } from '@/lib/miljo/qrPrint'
import { executorOf, rowCount, serialised } from '@/lib/miljo/registration/atomic'
import { PASSWORD_MAX_LENGTH, hashPasswordForPayload, validateNewPassword, verifyPayloadPassword } from '@/lib/miljo/registration/password'
import { normalizeEmail } from '@/lib/miljo/registration/purchase'
import type { StepResult } from '@/lib/miljo/registration/service'
import { generateRawToken, hashToken, isWellFormedToken } from '@/lib/reviewToken'
import { withinLimits, type RateLimitStore } from '@/lib/security/dbRateLimit'
import { ACCOUNT_MESSAGES, ACCOUNT_RATE_LIMITS, MILJO_PATHS, RESET_TTL_MS } from './constants'
import { revokeSessions, verifyMiljoToken, type MiljoSession } from './session'

/**
 * Miljø accounts after activation (Stage 2.2b): sign-in, sign-out, password recovery and change,
 * the delivery PIN, and what Min side shows. The HTTP edge is ./endpoint; this module decides.
 *
 *   • signIn          payload.login with MILJO_AUTH_CONTEXT — Payload's password check, lockout
 *                     (5 attempts → 15 min) and the `beforeLogin` access rule — plus database rate
 *                     limits per client and per e-mail. Every refusal is the same message.
 *   • signOut         revokes THIS session on the account row; the cookie is cleared by the route.
 *   • requestReset    always the same answer. Only an account that may sign in gets an e-mail. The
 *                     one-time token is stored as a SHA-256 hash in Payload's own reset columns
 *                     (Payload's reset endpoint stays closed, so nothing else reads them).
 *   • resetPassword   consumes the token with ONE conditional UPDATE (a second use finds nothing),
 *                     sets the new password and revokes every session — in one transaction.
 *   • changePassword  needs the current password; revokes every session, then signs this browser
 *                     in again with the new password.
 *   • revealPin       the active PIN of the account's OWN organisation, from the existing vault —
 *                     no new PIN, nothing in a URL, logged without the value.
 *   • dashboard       what Min side shows, for the account's OWN business customer only.
 *
 * The organisation is never taken from the request: it is always the session's business customer.
 */

export interface AccountDeps {
  payload: Payload
  rateLimits: RateLimitStore
  sendEmail: (message: { to: string; subject: string; html: string; text: string }) => Promise<void>
  siteUrl: string
  now?: () => Date
}

type Doc = Record<string, unknown> & { id: number | string }

const fail = (status: number, message: string, field?: string, code?: string): StepResult<never> => ({ ok: false, status, message, field, code })
const clock = (deps: AccountDeps) => (deps.now ? deps.now() : new Date())
const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const errName = (err: unknown) => (err instanceof Error ? err.name : 'unknown')

async function findById(req: PayloadRequest, collection: string, id: unknown): Promise<Doc | null> {
  if (id == null) return null
  return (await req.payload.findByID({ collection: collection as never, id: id as never, depth: 0, overrideAccess: true, disableErrors: true, req })) as unknown as Doc | null
}

/* ------------------------------ sign in / out ------------------------------ */

/** Payload's login, allowed only here. Throws on any refusal. */
async function payloadLogin(payload: Payload, email: string, password: string): Promise<string> {
  const req = await createLocalReq({ context: { [MILJO_AUTH_CONTEXT]: true } }, payload)
  const result = await payload.login({ collection: MILJO_ACCOUNTS_SLUG, data: { email, password }, depth: 0, req })
  if (!result.token) throw new Error('No token')
  return result.token
}

export async function signIn(deps: AccountDeps, input: { email: unknown; password: unknown; ip: string }): Promise<StepResult<{ token: string }>> {
  const email = normalizeEmail(input.email)
  if (!(await withinLimits(deps.rateLimits, [
    { key: `acct:login:ip:${input.ip}`, ...ACCOUNT_RATE_LIMITS.loginPerIp },
    { key: `acct:login:email:${email}`, ...ACCOUNT_RATE_LIMITS.loginPerEmail },
  ]))) return fail(429, ACCOUNT_MESSAGES.rateLimited)
  const password = input.password
  if (!isEmail(email) || typeof password !== 'string' || password === '' || password.length > PASSWORD_MAX_LENGTH) {
    return fail(401, ACCOUNT_MESSAGES.loginFailed)
  }
  try {
    return { ok: true, token: await payloadLogin(deps.payload, email, password) }
  } catch {
    // Wrong password, unknown e-mail, locked, inactive, company not «Aktiv»: one answer for all.
    return fail(401, ACCOUNT_MESSAGES.loginFailed)
  }
}

/** Revokes the token's session, if it is one. Works even when the account has lost access. */
export async function signOut(deps: AccountDeps, token: string | null): Promise<void> {
  const verified = await verifyMiljoToken(deps.payload, token).catch(() => null)
  if (verified) await revokeSessions(deps.payload, verified.account.id, { only: verified.sid })
}

/* ------------------------------ password recovery ------------------------------ */

function resetUrl(siteUrl: string, rawToken: string) {
  return `${siteUrl.replace(/\/$/, '')}${MILJO_PATHS.reset}?token=${encodeURIComponent(rawToken)}`
}

export async function requestPasswordReset(deps: AccountDeps, input: { email: unknown; ip: string }): Promise<StepResult<{ message: string }>> {
  const email = normalizeEmail(input.email)
  if (!(await withinLimits(deps.rateLimits, [
    { key: `acct:forgot:ip:${input.ip}`, ...ACCOUNT_RATE_LIMITS.forgotPerIp },
    { key: `acct:forgot:email:${email}`, ...ACCOUNT_RATE_LIMITS.forgotPerEmail },
  ]))) return fail(429, ACCOUNT_MESSAGES.rateLimited)
  if (!isEmail(email)) return fail(400, 'Skriv inn en gyldig e-postadresse.', 'email')
  const done = { ok: true as const, message: ACCOUNT_MESSAGES.forgotSent }

  const req = await createLocalReq({}, deps.payload)
  const found = await req.payload.find({ collection: MILJO_ACCOUNTS_SLUG, where: { email: { equals: email } }, depth: 0, limit: 1, pagination: false, overrideAccess: true, req })
  const account = found.docs[0] as unknown as Doc | undefined
  if (!account) return done
  const customerId = await resolveAuthorizedBusinessCustomerId(req, { ...account, collection: MILJO_ACCOUNTS_SLUG })
  if (customerId == null) return done

  const rawToken = generateRawToken()
  const expiresAt = new Date(clock(deps).getTime() + RESET_TTL_MS)
  try {
    const row = (await deps.payload.db.findOne({ collection: MILJO_ACCOUNTS_SLUG, where: { id: { equals: account.id } }, req } as never)) as Doc
    await deps.payload.db.updateOne({
      collection: MILJO_ACCOUNTS_SLUG,
      id: account.id,
      data: { ...row, resetPasswordToken: hashToken(rawToken), resetPasswordExpiration: expiresAt.toISOString(), updatedAt: null },
      req,
      returning: false,
    } as never)
    const customer = await findById(req, BUSINESS_CUSTOMERS_SLUG, customerId)
    const message = createMiljoPasswordResetEmail({ organizationName: String(customer?.name ?? ''), resetUrl: resetUrl(deps.siteUrl, rawToken), expiresAt })
    await deps.sendEmail({ to: email, ...message })
  } catch (err) {
    deps.payload.logger.error(`[miljo-account] password reset for account ${String(account.id)} not sent: ${errName(err)}`)
  }
  return done
}

/** True when THIS call consumed a valid, unexpired reset token; `accountId` is then set. */
async function consumeResetToken(req: PayloadRequest, tokenHash: string, now: Date): Promise<number | string | null> {
  const db = executorOf(req)
  if (db) {
    const result = await db.execute(sql`
      UPDATE "miljo_accounts"
         SET "reset_password_token" = NULL, "reset_password_expiration" = NULL
       WHERE "reset_password_token" = ${tokenHash} AND "reset_password_expiration" > ${now.toISOString()}
      RETURNING "id"
    `)
    if (rowCount(result) !== 1) return null
    const rows = Array.isArray(result) ? result : (result as { rows: { id: number }[] }).rows
    return (rows[0] as { id: number }).id
  }
  return serialised(`reset:${tokenHash}`, async () => {
    const row = (await req.payload.db.findOne({ collection: MILJO_ACCOUNTS_SLUG, where: { resetPasswordToken: { equals: tokenHash } }, req } as never)) as Doc | null
    if (!row || !(new Date(String(row.resetPasswordExpiration)).getTime() > now.getTime())) return null
    await req.payload.db.updateOne({ collection: MILJO_ACCOUNTS_SLUG, id: row.id, data: { ...row, resetPasswordToken: null, resetPasswordExpiration: null }, req, returning: false } as never)
    return row.id
  })
}

/** New salt + hash, every session revoked, failed attempts cleared — one write. */
async function storeNewPassword(req: PayloadRequest, accountId: number | string, password: string): Promise<void> {
  const { salt, hash } = await hashPasswordForPayload(password)
  const row = (await req.payload.db.findOne({ collection: MILJO_ACCOUNTS_SLUG, where: { id: { equals: accountId } }, req } as never)) as Doc
  await req.payload.db.updateOne({
    collection: MILJO_ACCOUNTS_SLUG,
    id: accountId,
    data: { ...row, salt, hash, sessions: [], loginAttempts: 0, lockUntil: null, resetPasswordToken: null, resetPasswordExpiration: null },
    req,
    returning: false,
  } as never)
}

export async function resetPassword(
  deps: AccountDeps,
  input: { token: unknown; password: unknown; passwordConfirmation: unknown; ip: string },
): Promise<StepResult<{ message: string }>> {
  if (!(await withinLimits(deps.rateLimits, [{ key: `acct:reset:ip:${input.ip}`, ...ACCOUNT_RATE_LIMITS.resetPerIp }]))) return fail(429, ACCOUNT_MESSAGES.rateLimited)
  if (!isWellFormedToken(input.token)) return fail(400, ACCOUNT_MESSAGES.resetInvalid, undefined, 'invalid')
  const problem = validateNewPassword(input.password, input.passwordConfirmation)
  if (problem) return fail(400, problem, 'password')

  const req = await createLocalReq({}, deps.payload)
  const shouldCommit = await initTransaction(req)
  try {
    const accountId = await consumeResetToken(req, hashToken(input.token), clock(deps))
    if (accountId == null) {
      await killTransaction(req)
      return fail(400, ACCOUNT_MESSAGES.resetInvalid, undefined, 'invalid')
    }
    await storeNewPassword(req, accountId, input.password as string)
    if (shouldCommit) await commitTransaction(req)
    deps.payload.logger.info(`[miljo-account] password reset for account ${String(accountId)}; all sessions revoked`)
    return { ok: true, message: ACCOUNT_MESSAGES.resetDone }
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.error(`[miljo-account] password reset rolled back: ${errName(err)}`)
    return fail(500, ACCOUNT_MESSAGES.failed)
  }
}

/* ------------------------------ signed in ------------------------------ */

export async function changePassword(
  deps: AccountDeps,
  session: MiljoSession,
  input: { currentPassword: unknown; password: unknown; passwordConfirmation: unknown },
): Promise<StepResult<{ token: string; message: string }>> {
  const accountId = session.account.id
  if (!(await withinLimits(deps.rateLimits, [{ key: `acct:change:${String(accountId)}`, ...ACCOUNT_RATE_LIMITS.changePerAccount }]))) {
    return fail(429, ACCOUNT_MESSAGES.rateLimited)
  }
  const problem = validateNewPassword(input.password, input.passwordConfirmation)
  if (problem) return fail(400, problem, 'password')
  if (typeof input.currentPassword !== 'string' || input.currentPassword.length > PASSWORD_MAX_LENGTH) {
    return fail(400, ACCOUNT_MESSAGES.currentPasswordWrong, 'currentPassword')
  }
  const row = (await deps.payload.db.findOne({ collection: MILJO_ACCOUNTS_SLUG, where: { id: { equals: accountId } } } as never)) as
    | (Doc & { salt?: string; hash?: string })
    | null
  if (!row || !(await verifyPayloadPassword(input.currentPassword, row))) return fail(400, ACCOUNT_MESSAGES.currentPasswordWrong, 'currentPassword')
  if (input.currentPassword === input.password) return fail(400, ACCOUNT_MESSAGES.samePassword, 'password')

  const req = await createLocalReq({}, deps.payload)
  await storeNewPassword(req, accountId, input.password as string)
  deps.payload.logger.info(`[miljo-account] password changed for account ${String(accountId)}; all sessions revoked`)
  try {
    return { ok: true, token: await payloadLogin(deps.payload, String(row.email), input.password as string), message: ACCOUNT_MESSAGES.changeDone }
  } catch {
    return { ok: true, token: '', message: ACCOUNT_MESSAGES.resetDone }
  }
}

async function ownOrganization(session: MiljoSession): Promise<{ customer: Doc; org: Doc | null }> {
  const customer = await findById(session.req, BUSINESS_CUSTOMERS_SLUG, session.businessCustomerId)
  if (!customer) throw new Error('Business customer vanished')
  const org = await findById(session.req, ENV_ORGANIZATIONS_SLUG, relationshipId(customer.environmentalOrganization))
  return { customer, org }
}

export async function revealPin(deps: AccountDeps, session: MiljoSession): Promise<StepResult<{ pin: string }>> {
  const accountId = session.account.id
  if (!(await withinLimits(deps.rateLimits, [{ key: `acct:pin:${String(accountId)}`, ...ACCOUNT_RATE_LIMITS.pinPerAccount }]))) {
    return fail(429, ACCOUNT_MESSAGES.rateLimited)
  }
  const { org } = await ownOrganization(session)
  const key = pinVaultKey()
  const pin = org && key ? openPin(org.pinEncrypted as string | null, Number(org.id), key) : null
  if (!org || !pin || !(await verifyPin(pin, org.pinHash as string | null))) {
    deps.payload.logger.warn(`[miljo-account] delivery PIN not revealable for account ${String(accountId)}`)
    return fail(409, ACCOUNT_MESSAGES.pinUnavailable, undefined, 'unavailable')
  }
  deps.payload.logger.info(`[miljo] delivery PIN revealed for organization ${String(org.id)} by miljo account ${String(accountId)}`)
  return { ok: true, pin }
}

export interface DashboardData {
  officialName: string
  organizationNumber: string
  contactName: string
  loginEmail: string
  accessStatus: string
  activatedAt: string | null
  organizationName: string | null
  organizationActive: boolean
  publicCode: string | null
  /** Always the production address — never a preview deployment's. */
  publicUrl: string | null
}

export async function dashboard(session: MiljoSession): Promise<DashboardData> {
  const { customer, org } = await ownOrganization(session)
  const code = typeof org?.publicCode === 'string' && org.publicCode ? org.publicCode : null
  return {
    officialName: String(customer.name ?? ''),
    organizationNumber: String(customer.organizationNumber ?? ''),
    contactName: String(customer.contactName ?? ''),
    loginEmail: String(session.account.email ?? ''),
    accessStatus: 'Aktiv',
    activatedAt: typeof session.account.emailVerifiedAt === 'string' ? session.account.emailVerifiedAt : null,
    organizationName: org ? String(org.name ?? '') : null,
    organizationActive: org?.status === 'active',
    publicCode: code,
    publicUrl: code ? miljoPublicUrl(code) : null,
  }
}
