import { sql } from '@payloadcms/db-postgres'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, type PayloadRequest } from 'payload'
import { MILJO_ACCOUNTS_SLUG } from '@/lib/miljo/business'
import { executorOf, rowCount, serialised } from '@/lib/miljo/registration/atomic'
import { validateNewPassword } from '@/lib/miljo/registration/password'
import type { StepResult } from '@/lib/miljo/registration/service'
import { hashToken, isWellFormedToken } from '@/lib/reviewToken'
import { withinLimits } from '@/lib/security/dbRateLimit'
import { ACCOUNT_MESSAGES, ACCOUNT_RATE_LIMITS } from './constants'
import { payloadLogin, storeNewPassword, type AccountDeps } from './service'

/**
 * Accepting an invitation from aBoks (Stage 2.5): the recipient opens the e-mailed link, chooses a
 * password, and the account becomes active with a verified e-mail (the link proved the address).
 *
 * The token is consumed by ONE conditional UPDATE — `WHERE invite_token_hash = ? AND
 * invite_expires_at > now AND status = 'invited'` — inside the same transaction that stores the
 * password, so a link works exactly once even when it is submitted twice at the same moment, and
 * an expired, superseded or revoked invitation can never activate anything. The raw token is never
 * stored or logged. Afterwards this browser is signed in, when the business customer grants access.
 */

type Doc = Record<string, unknown> & { id: number | string }

/** The account this call activated, or why not. */
async function consumeInvitation(req: PayloadRequest, tokenHash: string, now: Date): Promise<{ id: number | string; email: string } | 'expired' | 'invalid'> {
  const db = executorOf(req)
  if (db) {
    const result = await db.execute(sql`
      UPDATE "miljo_accounts"
         SET "invite_token_hash" = NULL, "invite_expires_at" = NULL
       WHERE "invite_token_hash" = ${tokenHash} AND "invite_expires_at" > ${now.toISOString()} AND "status" = 'invited'
      RETURNING "id", "email"
    `)
    if (rowCount(result) === 1) {
      const rows = Array.isArray(result) ? result : (result as { rows: Record<string, unknown>[] }).rows
      const row = rows[0] as { id: number; email: string }
      return { id: row.id, email: row.email }
    }
    const left = await db.execute(sql`SELECT "id" FROM "miljo_accounts" WHERE "invite_token_hash" = ${tokenHash} AND "status" = 'invited'`)
    return rowCount(left) > 0 ? 'expired' : 'invalid'
  }
  return serialised(`invite:${tokenHash}`, async () => {
    const row = (await req.payload.db.findOne({ collection: MILJO_ACCOUNTS_SLUG, where: { inviteTokenHash: { equals: tokenHash } }, req } as never)) as Doc | null
    if (!row || row.status !== 'invited') return 'invalid'
    if (!(new Date(String(row.inviteExpiresAt)).getTime() > now.getTime())) return 'expired'
    await req.payload.db.updateOne({ collection: MILJO_ACCOUNTS_SLUG, id: row.id, data: { ...row, inviteTokenHash: null, inviteExpiresAt: null }, req, returning: false } as never)
    return { id: row.id, email: String(row.email) }
  })
}

export async function acceptInvitation(
  deps: AccountDeps,
  input: { token: unknown; password: unknown; passwordConfirmation: unknown; ip: string },
): Promise<StepResult<{ token: string; message: string }>> {
  if (!(await withinLimits(deps.rateLimits, [{ key: `acct:activate:ip:${input.ip}`, ...ACCOUNT_RATE_LIMITS.activatePerIp }]))) {
    return { ok: false, status: 429, message: ACCOUNT_MESSAGES.rateLimited }
  }
  if (!isWellFormedToken(input.token)) return { ok: false, status: 400, message: ACCOUNT_MESSAGES.inviteInvalid, code: 'invalid' }
  const problem = validateNewPassword(input.password, input.passwordConfirmation)
  if (problem) return { ok: false, status: 400, message: problem, field: 'password' }

  const now = deps.now ? deps.now() : new Date()
  const req = await createLocalReq({}, deps.payload)
  const shouldCommit = await initTransaction(req)
  let email: string
  let accountId: number | string
  try {
    const consumed = await consumeInvitation(req, hashToken(input.token), now)
    if (consumed === 'expired' || consumed === 'invalid') {
      await killTransaction(req)
      return consumed === 'expired'
        ? { ok: false, status: 410, message: ACCOUNT_MESSAGES.inviteExpired, code: 'expired' }
        : { ok: false, status: 400, message: ACCOUNT_MESSAGES.inviteInvalid, code: 'invalid' }
    }
    accountId = consumed.id
    email = consumed.email
    await storeNewPassword(req, accountId, input.password as string, {
      mustChangePassword: false,
      status: 'active',
      emailVerifiedAt: now.toISOString(),
      inviteTokenHash: null,
      inviteExpiresAt: null,
    })
    if (shouldCommit) await commitTransaction(req)
  } catch (err) {
    await killTransaction(req)
    deps.payload.logger.error(`[miljo-account] invitation acceptance rolled back: ${err instanceof Error ? err.name : 'unknown'}`)
    return { ok: false, status: 500, message: ACCOUNT_MESSAGES.failed }
  }
  deps.payload.logger.info(`[miljo-account] invitation accepted; account ${String(accountId)} active`)
  try {
    return { ok: true, token: await payloadLogin(deps.payload, email, input.password as string), message: ACCOUNT_MESSAGES.inviteDone }
  } catch {
    // Active, but the business customer does not grant access yet (e.g. «Venter»): no session.
    return { ok: true, token: '', message: ACCOUNT_MESSAGES.inviteDone }
  }
}
