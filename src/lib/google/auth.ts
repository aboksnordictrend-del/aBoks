// OAuth2 access-token factory for the Google Ads API.
//
// Deliberately isolated from the query service and the sync orchestration: today the
// refresh token is supplied manually via GOOGLE_ADS_REFRESH_TOKEN, and adding a real
// "Koble til Google"-OAuth flow later only means writing a different token source behind the
// same `getAccessToken(config)` signature — no sync/service/UI change.
//
// Security rules enforced here:
//  - the refresh token, client secret and access token only ever travel in the POST body to
//    Google's token endpoint; they never appear in a thrown message or a log line;
//  - tokens are cached in process memory only — never in Payload/PostgreSQL.

import type { GoogleAdsConfig } from './config'
import { networkError, parseGoogleOAuthError } from './errors'

/** Injectable fetch, matching the subset of the global `fetch` contract we rely on. */
export type FetchImpl = (
  input: string,
  init?: {
    method?: string
    signal?: AbortSignal
    headers?: Record<string, string>
    body?: string
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export interface AuthOptions {
  fetchImpl?: FetchImpl
  timeoutMs?: number
  /** Injected clock so cache-expiry behaviour is testable. */
  now?: () => number
}

const DEFAULT_TIMEOUT_MS = 15_000
/** Refresh a little early so a token can never expire mid-request. */
const EXPIRY_SKEW_MS = 60_000

interface CacheEntry {
  token: string
  expiresAt: number
}

// Process-local cache. Serverless instances each keep their own; worst case is one extra
// token request per cold start, which is exactly the intended trade-off.
const tokenCache = new Map<string, CacheEntry>()

/**
 * Cache key. Derived from the *client id + customer id* only — never from the refresh token
 * or the client secret, so no secret material is retained as a map key.
 */
function cacheKey(config: GoogleAdsConfig): string {
  return `${config.clientId}::${config.customerId}`
}

/** Drop any cached token for this config (used after a 401 so the next call re-authenticates). */
export function invalidateAccessToken(config: GoogleAdsConfig): void {
  tokenCache.delete(cacheKey(config))
}

/** Test-only: clear every cached token. */
export function clearAccessTokenCache(): void {
  tokenCache.clear()
}

/**
 * Exchange the refresh token for a short-lived access token, reusing the cached one while
 * it is still valid. Throws a GoogleAdsError with an actionable Norwegian message when the
 * refresh token has been revoked or the OAuth client is misconfigured.
 */
export async function getAccessToken(
  config: GoogleAdsConfig,
  options: AuthOptions = {},
): Promise<string> {
  const nowFn = options.now ?? Date.now
  const key = cacheKey(config)
  const cached = tokenCache.get(key)
  if (cached && cached.expiresAt > nowFn()) return cached.token

  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  }).toString()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Awaited<ReturnType<FetchImpl>>
  try {
    res = await fetchImpl(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw networkError(err, aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    throw parseGoogleOAuthError(undefined, res.status)
  }

  if (!res.ok) throw parseGoogleOAuthError(parsed, res.status)

  const payload = parsed as { access_token?: unknown; expires_in?: unknown }
  const token = typeof payload.access_token === 'string' ? payload.access_token : ''
  if (!token) {
    // A 200 without a token means the response shape changed — never cache that.
    throw parseGoogleOAuthError({ error_description: 'missing access_token in response' }, res.status)
  }

  const expiresInSec = typeof payload.expires_in === 'number' ? payload.expires_in : 3600
  tokenCache.set(key, {
    token,
    expiresAt: nowFn() + Math.max(0, expiresInSec * 1000 - EXPIRY_SKEW_MS),
  })
  return token
}
