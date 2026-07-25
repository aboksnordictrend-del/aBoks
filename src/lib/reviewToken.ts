import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Secure one-time invitation tokens for the review flow.
 *
 * Design (see the review-system spec §4):
 *  • The raw token is generated with crypto.randomBytes and is only ever sent in the
 *    email link. It is never stored, never logged.
 *  • The database stores only the SHA-256 hash of the raw token (unique index), so a
 *    database leak does not reveal any usable link.
 *  • Validation is hash-based: hash the token from the URL, look the row up by that
 *    hash. There is no way to enumerate valid tokens — 32 random bytes is 256 bits.
 *
 * No JWT: an opaque random one-time token is simpler, has no signing key to leak, and
 * is trivially revocable (delete/expire the row).
 */

/** Raw token length in bytes → 32 bytes = 256 bits of entropy. */
const TOKEN_BYTES = 32

/** Default lifetime of an invitation, in days. */
export const INVITATION_TTL_DAYS = 30

/**
 * A base64url raw token is [A-Za-z0-9_-]. randomBytes(32) → 43 chars. We accept a small
 * range to stay tolerant of trailing padding differences, but reject anything that is
 * obviously not one of our tokens before ever touching the database.
 */
const RAW_TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/

/** Generates a fresh raw token (base64url, no padding). Never store this value. */
export function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** SHA-256 hash (hex) of a raw token. This is the only form stored in the database. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

/** Cheap structural check so malformed input never reaches a database lookup. */
export function isWellFormedToken(rawToken: unknown): rawToken is string {
  return typeof rawToken === 'string' && RAW_TOKEN_RE.test(rawToken)
}

/**
 * Constant-time comparison of two hex hashes. Used when we already hold the stored hash
 * and want to compare without leaking timing. (The primary lookup is by indexed equality,
 * which is already effectively constant across candidates; this is defence in depth.)
 */
export function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ba.length !== bb.length || ba.length === 0) return false
  return timingSafeEqual(ba, bb)
}

/** Absolute public URL for a review invitation. Base comes from env, never hardcoded. */
export function reviewInvitationUrl(rawToken: string, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  return `${base}/anmeldelse/${rawToken}`
}

/** Expiry timestamp `ttlDays` from `from` (default now), as an ISO string. */
export function invitationExpiry(ttlDays: number = INVITATION_TTL_DAYS, from: Date = new Date()): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + ttlDays)
  return d.toISOString()
}
