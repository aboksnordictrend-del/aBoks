// Parsing, validating and dating Pinterest OAuth token responses.
//
// Pure — no network, no Payload, no env. Everything the callback and the refresh path need to
// decide "is this response usable, and when does it stop being usable" lives here, so both the
// happy path and every malformed-response branch are testable without a stub server.
//
// Pinterest's `POST /v5/oauth/token` answers with:
//   { response_type, access_token, refresh_token, token_type, expires_in,
//     refresh_token_expires_in, scope }
// `expires_in` / `refresh_token_expires_in` are **relative seconds**, so they are converted to
// absolute instants here, once, against a single `now`.
//
// This app was created after 2025-09-25, so Pinterest issues continuous refresh tokens
// automatically: every refresh returns a NEW refresh token, and the previous one stops working.
// `continuous_refresh` is therefore deliberately not sent — it is the opt-in for older apps.

/** Raw shape of a Pinterest token response. Every field is untrusted. */
export interface PinterestTokenResponseBody {
  access_token?: unknown
  refresh_token?: unknown
  token_type?: unknown
  expires_in?: unknown
  refresh_token_expires_in?: unknown
  scope?: unknown
  response_type?: unknown
}

/** A validated grant, with absolute expiries. */
export interface PinterestTokenGrant {
  accessToken: string
  refreshToken: string
  tokenType: string
  /** ISO 8601. */
  accessTokenExpiresAt: string
  /** ISO 8601, or null when Pinterest did not state one. */
  refreshTokenExpiresAt: string | null
  scope: string
}

export class PinterestTokenResponseError extends Error {
  constructor(
    message: string,
    /** Short machine code for the server log — never contains a token. */
    readonly code: string,
  ) {
    super(message)
    this.name = 'PinterestTokenResponseError'
  }
}

/**
 * Access-token lifetime assumed when Pinterest omits `expires_in`. Deliberately short: an
 * assumed-long lifetime that turns out to be wrong produces 401s in the middle of a sync,
 * whereas an assumed-short one only causes an extra refresh.
 */
const FALLBACK_ACCESS_TTL_SECONDS = 60 * 60

/** Refresh when the access token has less than this left. Requirement: 24 hours. */
export const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000

function str(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

/** `expires_in` arrives as a number, but a numeric string is accepted defensively. */
function seconds(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
}

function isoAfter(now: Date, secondsFromNow: number): string {
  return new Date(now.getTime() + secondsFromNow * 1000).toISOString()
}

/**
 * Validate a token response and convert it into a storable grant.
 *
 * Throws PinterestTokenResponseError — with a safe Norwegian message and a short code — when
 * the body is not an object, carries no access token, or (on a flow that must rotate) carries
 * no refresh token. A 200 with a missing field is treated as a failure rather than persisted:
 * storing half a grant only moves the failure to the next sync, where it is far harder to
 * diagnose.
 *
 * `requireRefreshToken` is true for both the authorization-code exchange and a continuous
 * refresh, because both must return one. It exists as a parameter only so a future non-rotating
 * flow does not have to fork this function.
 */
export function parseTokenResponse(
  body: unknown,
  now: Date,
  { requireRefreshToken = true }: { requireRefreshToken?: boolean } = {},
): PinterestTokenGrant {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PinterestTokenResponseError(
      'Pinterest svarte med et uventet format under autorisering.',
      'not-an-object',
    )
  }
  const raw = body as PinterestTokenResponseBody

  const accessToken = str(raw.access_token)
  if (!accessToken) {
    throw new PinterestTokenResponseError(
      'Pinterest returnerte ikke et tilgangstoken. Prøv å koble til på nytt.',
      'no-access-token',
    )
  }

  const refreshToken = str(raw.refresh_token)
  if (requireRefreshToken && !refreshToken) {
    throw new PinterestTokenResponseError(
      'Pinterest returnerte ikke et fornyelsestoken. Prøv å koble til på nytt.',
      'no-refresh-token',
    )
  }

  const accessTtl = seconds(raw.expires_in) ?? FALLBACK_ACCESS_TTL_SECONDS
  const refreshTtl = seconds(raw.refresh_token_expires_in)

  return {
    accessToken,
    refreshToken,
    // Pinterest sends "bearer"; normalise the case so the stored value is predictable.
    tokenType: str(raw.token_type).toLowerCase() || 'bearer',
    accessTokenExpiresAt: isoAfter(now, accessTtl),
    refreshTokenExpiresAt: refreshTtl != null ? isoAfter(now, refreshTtl) : null,
    // The granted scope may legitimately differ from the requested one; store what was granted.
    scope: str(raw.scope),
  }
}

/** Milliseconds until an ISO instant, or null when the value is absent/unparseable. */
export function msUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const at = Date.parse(iso)
  return Number.isFinite(at) ? at - now.getTime() : null
}

/**
 * True when the stored access token is good for more than 24 hours and can be used as-is.
 *
 * An unknown or unparseable expiry returns false — refreshing unnecessarily costs one request,
 * while using an expired token costs a failed sync.
 */
export function accessTokenIsFresh(
  accessTokenExpiresAt: string | null | undefined,
  now: Date,
  thresholdMs: number = REFRESH_THRESHOLD_MS,
): boolean {
  const remaining = msUntil(accessTokenExpiresAt, now)
  return remaining != null && remaining > thresholdMs
}

/** True when the refresh token itself has expired, so only a re-authorization can help. */
export function refreshTokenIsExpired(
  refreshTokenExpiresAt: string | null | undefined,
  now: Date,
): boolean {
  const remaining = msUntil(refreshTokenExpiresAt, now)
  // Null means "Pinterest never stated an expiry" — that is not evidence of expiry.
  return remaining != null && remaining <= 0
}

/**
 * True when the granted scope covers every scope this integration needs. Compared as a set:
 * Pinterest may return the scopes in any order and may add ones we did not ask for.
 *
 * An empty granted scope returns true — some responses omit the field entirely, and treating
 * that as "insufficient" would break a perfectly good connection.
 */
export function scopeCovers(granted: string, required: readonly string[]): boolean {
  const trimmed = granted.trim()
  if (!trimmed) return true
  const have = new Set(trimmed.split(/[\s,]+/).filter(Boolean))
  return required.every((s) => have.has(s))
}
