import { JWTAuthentication, createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { MILJO_ACCOUNTS_SLUG, mustChangePassword, relationshipId } from '@/lib/miljo/business'
import { resolveAuthorizedBusinessCustomerId } from '@/lib/miljo/businessAccess'
import { MILJO_SESSION_COOKIE, MILJO_SESSION_SECONDS } from './constants'

/**
 * The Miljø session (Stage 2.2b, docs/MILJO-SESSION-ISOLATION.md option B).
 *
 *   • The token is a Payload JWT for `miljo-accounts`, issued by `payload.login` (password check,
 *     lockout, the `beforeLogin` rule), with Payload's session id (`sid`) inside.
 *   • It lives ONLY in the `aboks-miljo-session` cookie — HttpOnly, SameSite=Lax, Secure in
 *     production, two hours like the JWT. Payload never reads that cookie (it reads `payload-token`
 *     and the Authorization header), so a Miljø session is invisible to the admin panel and the
 *     REST API, and an administrator's `payload-token` is never touched.
 *   • Every request verifies the JWT, its session id against the account row (so a revoked session
 *     is dead at once), and then the access rule of @/lib/miljo/businessAccess — account active and
 *     verified, company «Aktiv», a valid linked order — against the database.
 *   • Temporary password (Stage 2.5). An account created by aBoks with a temporary password signs
 *     in normally, but until it has chosen its own password its session is refused by every gate
 *     except `'password-change'` — Min side, statistics, exports, PIN and QR all see «no session».
 *     Read from the account row on every request, so it cannot be skipped by navigating directly.
 */

type Doc = Record<string, unknown> & { id: number | string }

export interface MiljoSession {
  account: Doc
  sid: string
  businessCustomerId: number | string
  /** A Local API request acting as this account (overrideAccess stays the caller's choice). */
  req: PayloadRequest
  /** The account still has an administrator-issued temporary password (only with the 'password-change' gate). */
  passwordChangeRequired: boolean
}

/**
 * What a caller lets through: `'full'` (everything on Min side — the default) refuses a session that
 * must change its password; `'password-change'` (only the password change itself) accepts it.
 */
export type SessionGate = 'full' | 'password-change'

const secureCookies = () => process.env.NODE_ENV === 'production'

export function sessionCookieHeader(token: string): string {
  return `${MILJO_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MILJO_SESSION_SECONDS}${secureCookies() ? '; Secure' : ''}`
}

export function clearedSessionCookieHeader(): string {
  return `${MILJO_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookies() ? '; Secure' : ''}`
}

/** The Miljø token from a `Cookie` header, or null. Only our cookie — never `payload-token`. */
export function readSessionToken(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() !== MILJO_SESSION_COOKIE) continue
    const value = part.slice(eq + 1).trim()
    return /^[A-Za-z0-9_\-.]{20,4096}$/.test(value) ? value : null
  }
  return null
}

/** Account + session id for a valid, unrevoked Miljø JWT — whatever the account's state. */
export async function verifyMiljoToken(payload: Payload, token: string | null | undefined): Promise<{ account: Doc; sid: string } | null> {
  if (!token) return null
  const headers = new Headers({ Authorization: `JWT ${token}`, DisableAutologin: 'true' })
  const { user } = await JWTAuthentication({ headers, payload, strategyName: 'miljo-session' } as never)
  const account = user as (Doc & { collection?: unknown; _sid?: unknown }) | null
  if (!account || account.collection !== MILJO_ACCOUNTS_SLUG || typeof account._sid !== 'string') return null
  return { account, sid: account._sid }
}

/**
 * The authorised session behind a token, or null (not signed in, revoked, no access now — or, with
 * the default `'full'` gate, still on a temporary password).
 */
export async function currentSession(payload: Payload, token: string | null | undefined, gate: SessionGate = 'full'): Promise<MiljoSession | null> {
  const verified = await verifyMiljoToken(payload, token)
  if (!verified) return null
  const passwordChangeRequired = mustChangePassword(verified.account)
  if (passwordChangeRequired && gate !== 'password-change') return null
  const req = await createLocalReq({}, payload)
  req.user = verified.account as never
  const businessCustomerId = await resolveAuthorizedBusinessCustomerId(req, verified.account)
  if (businessCustomerId == null || String(businessCustomerId) !== String(relationshipId(verified.account.businessCustomer))) return null
  return { account: verified.account, sid: verified.sid, businessCustomerId, req, passwordChangeRequired }
}

/**
 * Removes sessions from the account row — exactly what Payload's own logout writes. `only`: that
 * one session (sign-out); otherwise every session (password changed or reset).
 */
export async function revokeSessions(payload: Payload, accountId: number | string, opts: { only?: string; req?: PayloadRequest } = {}): Promise<void> {
  const row = (await payload.db.findOne({ collection: MILJO_ACCOUNTS_SLUG, where: { id: { equals: accountId } }, req: opts.req } as never)) as
    | (Doc & { sessions?: { id: string }[] })
    | null
  if (!row) return
  const sessions = opts.only ? (row.sessions ?? []).filter((s) => s.id !== opts.only) : []
  await payload.db.updateOne({
    collection: MILJO_ACCOUNTS_SLUG,
    id: accountId,
    data: { ...row, sessions, updatedAt: null },
    req: opts.req,
    returning: false,
  } as never)
}
