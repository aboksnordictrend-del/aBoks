// CSRF state for the TikTok OAuth flow.
//
// The state is *stateless and signed* rather than stored: a payload of
// `{ userId, issuedAtMs, nonce }` is HMAC-SHA256-signed with a key derived from
// PAYLOAD_SECRET. That gives the same guarantee a server-side session store would, without
// adding a table or depending on a shared cache across serverless instances:
//
//  - only `/admin/integrations/tiktok/connect` — which requires an authenticated admin — can
//    mint a valid state, so a forged callback cannot be accepted;
//  - the signature covers the admin's user id, so a state minted for one administrator can be
//    checked against the user who actually returns;
//  - a short TTL bounds replay, and the auth_code itself is single-use and expires in one
//    hour on TikTok's side.
//
// Nothing secret is placed *in* the state: it travels through TikTok's servers and back
// through the browser's address bar, so it carries only an opaque nonce, a timestamp and the
// admin's own user id.

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/** How long a minted state stays valid. Long enough to log in to TikTok, short enough to bound replay. */
export const STATE_TTL_MS = 10 * 60_000

export interface TikTokOAuthStatePayload {
  /** Payload user id of the admin who started the flow. */
  userId: string
  /** Issue time in epoch milliseconds. */
  issuedAtMs: number
  /** Random per-flow value, so two states minted in the same millisecond still differ. */
  nonce: string
}

export type StateVerification =
  | { ok: true; payload: TikTokOAuthStatePayload }
  | { ok: false; reason: 'malformed' | 'signature' | 'expired' }

/** Domain-separated HMAC key, so this signature can never collide with Payload's own cookies. */
function sign(secret: string, body: string): string {
  return createHmac('sha256', `tiktok-oauth-state:${secret}`).update(body).digest('base64url')
}

/** Constant-time compare of two base64url signatures. */
function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Mint a signed state value for an admin starting the flow. `secret` must be a server secret
 * (PAYLOAD_SECRET); it is never included in the returned string.
 */
export function createOAuthState(
  userId: string,
  secret: string,
  now: number = Date.now(),
): string {
  const payload: TikTokOAuthStatePayload = {
    userId,
    issuedAtMs: now,
    nonce: randomBytes(12).toString('base64url'),
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(secret, body)}`
}

/**
 * Verify a state value returned by TikTok. Returns a discriminated result rather than
 * throwing, so the callback can map each failure to its own safe message without a try/catch
 * around control flow. A missing, malformed, unsigned, wrongly-signed or expired state is
 * always a rejection — there is no lenient path.
 */
export function verifyOAuthState(
  raw: unknown,
  secret: string,
  now: number = Date.now(),
): StateVerification {
  if (typeof raw !== 'string' || raw === '') return { ok: false, reason: 'malformed' }

  const dot = raw.lastIndexOf('.')
  if (dot <= 0 || dot === raw.length - 1) return { ok: false, reason: 'malformed' }

  const body = raw.slice(0, dot)
  const signature = raw.slice(dot + 1)
  if (!signaturesMatch(sign(secret, body), signature)) return { ok: false, reason: 'signature' }

  let payload: TikTokOAuthStatePayload
  try {
    const decoded: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!decoded || typeof decoded !== 'object') return { ok: false, reason: 'malformed' }
    const p = decoded as Partial<TikTokOAuthStatePayload>
    if (typeof p.userId !== 'string' || typeof p.issuedAtMs !== 'number') {
      return { ok: false, reason: 'malformed' }
    }
    payload = { userId: p.userId, issuedAtMs: p.issuedAtMs, nonce: String(p.nonce ?? '') }
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  // A state from the future (clock skew, hand-crafted) is as invalid as an expired one.
  const age = now - payload.issuedAtMs
  if (age < -60_000 || age > STATE_TTL_MS) return { ok: false, reason: 'expired' }

  return { ok: true, payload }
}
