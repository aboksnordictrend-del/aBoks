// CSRF state for the Pinterest OAuth flow.
//
// Unlike the TikTok flow (which uses a stateless HMAC-signed state), this one is **stored
// server-side as a hash**. The difference matters for one requirement a signed value cannot
// meet on its own: single use. A signed state is replayable until it expires, because the
// server keeps no record that it was already spent. Storing SHA-256(state) on the connection
// global — and clearing it the moment the callback reads it — makes a second presentation of
// the same value fail.
//
// What is stored is the *hash*, never the state itself, so a database dump does not yield a
// value that could be replayed against a still-open flow.
//
// The state is also bound to the administrator who started the flow, so the callback can
// re-check that this person is still an admin before any credential is touched.

import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/** Long enough to log in to Pinterest and consent; short enough to bound replay. */
export const PINTEREST_STATE_TTL_MS = 10 * 60_000

/** 32 bytes of CSPRNG output — 256 bits, far beyond guessable. */
const STATE_BYTES = 32

export interface PinterestPendingState {
  /** SHA-256 of the state value, base64url. The state itself is never stored. */
  hash: string
  /** Absolute expiry, ISO 8601. */
  expiresAt: string
  /** Payload user id of the admin who started the flow. */
  userId: string
}

export interface CreatedState {
  /** The value to put in the authorization URL. Never persisted. */
  state: string
  pending: PinterestPendingState
}

/** SHA-256(state), base64url. Deterministic, so the callback can look it up by hash. */
export function hashState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('base64url')
}

/** Mint a fresh state for an admin starting the flow, plus the record to persist. */
export function createPendingState(userId: string, now: number = Date.now()): CreatedState {
  const state = randomBytes(STATE_BYTES).toString('base64url')
  return {
    state,
    pending: {
      hash: hashState(state),
      expiresAt: new Date(now + PINTEREST_STATE_TTL_MS).toISOString(),
      userId,
    },
  }
}

export type StateVerification =
  | { ok: true; userId: string }
  | { ok: false; reason: 'missing' | 'none-pending' | 'mismatch' | 'expired' }

/** Constant-time compare of two base64url digests of equal expected length. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Verify a state value returned by Pinterest against the stored pending record.
 *
 * Pure: the caller is responsible for having already *consumed* (cleared) the stored record, so
 * that a second callback carrying the same value finds nothing to match — that is what makes
 * the state one-time. Every failure mode is a rejection; there is no lenient path.
 */
export function verifyPendingState(
  returned: unknown,
  pending: PinterestPendingState | null,
  now: number = Date.now(),
): StateVerification {
  if (typeof returned !== 'string' || returned.trim() === '') {
    return { ok: false, reason: 'missing' }
  }
  if (!pending || !pending.hash) return { ok: false, reason: 'none-pending' }

  // Expiry is checked before the comparison so a stale record cannot be probed for equality.
  const expiresAtMs = Date.parse(pending.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) return { ok: false, reason: 'expired' }

  if (!digestsMatch(hashState(returned), pending.hash)) return { ok: false, reason: 'mismatch' }
  if (!pending.userId) return { ok: false, reason: 'none-pending' }

  return { ok: true, userId: pending.userId }
}
