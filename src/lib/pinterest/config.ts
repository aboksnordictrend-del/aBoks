// Server-only Pinterest Ads API configuration. Every value comes from server env vars —
// never NEXT_PUBLIC_*, so the access token and app secret can never reach the browser.
// Importing this module from client code would fail (no process.env values), which is the
// intended boundary. Mirrors src/lib/meta/config.ts and src/lib/google/config.ts.
//
// Nothing here is ever persisted to Payload/PostgreSQL, logged, or serialized into an API
// response: callers only ever expose `maskAdAccountId(...)`.

import { DATE_RE } from '@/lib/marketing/dateMath'

export interface PinterestAdsConfig {
  /** Pinterest app (client) id. The OAuth flow reads it from src/lib/pinterest/oauth/config.ts. */
  appId: string
  /** Pinterest app secret. Only ever used by the OAuth token endpoint, never by a v5 read. */
  appSecret: string
  /**
   * Legacy env-var bearer token, or '' once the integration is connected through OAuth.
   *
   * **Migration fallback only.** Every Pinterest call now goes through the token provider
   * (src/lib/pinterest/oauth/accessToken.ts), which prefers the stored, refreshable OAuth grant
   * and only falls back to this value when no grant exists. Delete PINTEREST_ACCESS_TOKEN from
   * the environment once "Koble til" has been completed.
   */
  accessToken: string
  /** Ad account whose spend is imported. Digits only. */
  adAccountId: string
  /** Pinterest API version segment, e.g. 'v5'. */
  apiVersion: string
  /** `https://api.pinterest.com/{apiVersion}`. */
  baseUrl: string
  /**
   * Floor for a full import. The ad account's own creation date normally narrows this
   * further; the floor only matters when Pinterest does not report one. Configurable so an
   * unusually old account can be widened without a code change.
   */
  historyStart: string
}

/**
 * Pinterest API version. v5 is the current generation; v3/v4 are retired. Kept in one place
 * (PINTEREST_API_VERSION) instead of being hard-coded across call sites, so a future version
 * bump is an env change rather than a code change.
 */
const DEFAULT_API_VERSION = 'v5'
const DEFAULT_BASE_HOST = 'https://api.pinterest.com'
/**
 * Pinterest Ads became available in the Nordics well after this date, so it is a safe floor
 * for a full import. Only used when the ad account's `created_time` is missing from the API
 * response — normally the account's own creation date wins.
 */
const DEFAULT_HISTORY_START = '2019-01-01'

export class PinterestAdsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PinterestAdsConfigError'
  }
}

/**
 * Env vars without which no Pinterest Ads call can be made.
 *
 * Only the ad account id. **PINTEREST_ACCESS_TOKEN is no longer required** — that is the point
 * of the OAuth flow: the token is obtained by "Koble til" and stored (encrypted) in the
 * database, so requiring an env token would mark a properly connected integration as "Ikke
 * konfigurert" and would keep the manual-token dependency alive forever.
 *
 * PINTEREST_APP_ID / PINTEREST_APP_SECRET are validated separately, by
 * src/lib/pinterest/oauth/config.ts, because they are only needed while *connecting* or
 * *refreshing*. Keeping them out of this list means a missing app secret cannot make an
 * already-connected integration look unconfigured — the same reasoning that keeps
 * GOOGLE_ADS_LOGIN_CUSTOMER_ID out of the Google Ads required list.
 */
export const PINTEREST_ADS_REQUIRED_ENV = ['PINTEREST_AD_ACCOUNT_ID'] as const

/**
 * Pinterest ad account ids are numeric strings (e.g. 549755885175). Accept stray whitespace
 * or separators and canonicalize to digits only, which is what the REST path requires.
 */
export function normalizeAdAccountId(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Safe display form of an ad account id: only the last four digits survive. Used everywhere
 * an id would otherwise be sent to the browser or written to a log.
 */
export function maskAdAccountId(adAccountId: string): string {
  const digits = normalizeAdAccountId(adAccountId)
  if (!digits) return '—'
  if (digits.length <= 4) return `•••${digits}`
  return `•••${digits.slice(-4)}`
}

/**
 * Read + validate the Pinterest Ads configuration from env. Throws PinterestAdsConfigError
 * with a safe, secret-free message when required values are missing or malformed. The
 * returned object is never logged or serialized to a client response.
 */
export function getPinterestAdsConfig(
  env: Record<string, string | undefined> = process.env,
): PinterestAdsConfig {
  const appId = (env.PINTEREST_APP_ID ?? '').trim()
  const appSecret = (env.PINTEREST_APP_SECRET ?? '').trim()
  const accessToken = (env.PINTEREST_ACCESS_TOKEN ?? '').trim()
  const rawAdAccountId = (env.PINTEREST_AD_ACCOUNT_ID ?? '').trim()
  const apiVersion = (env.PINTEREST_API_VERSION ?? '').trim() || DEFAULT_API_VERSION
  const historyStartRaw = (env.PINTEREST_HISTORY_START ?? '').trim()

  const present: Record<string, string> = {
    PINTEREST_AD_ACCOUNT_ID: rawAdAccountId,
  }
  const missing = PINTEREST_ADS_REQUIRED_ENV.filter((k) => !present[k])
  if (missing.length > 0) {
    throw new PinterestAdsConfigError(
      `Pinterest Ads-konfigurasjonen mangler eller er ugyldig: ${missing.join(', ')} er ikke satt.`,
    )
  }

  const adAccountId = normalizeAdAccountId(rawAdAccountId)
  if (!adAccountId) {
    throw new PinterestAdsConfigError(
      'PINTEREST_AD_ACCOUNT_ID inneholder ikke et gyldig kontonummer. Forventet annonsekontoens ID (kun siffer).',
    )
  }

  if (historyStartRaw && !DATE_RE.test(historyStartRaw)) {
    throw new PinterestAdsConfigError(
      'PINTEREST_HISTORY_START må være på formatet ÅÅÅÅ-MM-DD.',
    )
  }

  if (!/^v\d+$/.test(apiVersion)) {
    throw new PinterestAdsConfigError('PINTEREST_API_VERSION må være på formatet v5.')
  }

  return {
    appId,
    appSecret,
    accessToken,
    adAccountId,
    apiVersion,
    baseUrl: `${DEFAULT_BASE_HOST}/${apiVersion}`,
    historyStart: historyStartRaw || DEFAULT_HISTORY_START,
  }
}
