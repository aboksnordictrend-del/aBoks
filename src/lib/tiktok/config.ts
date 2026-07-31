// Server-only TikTok Ads (Marketing API v1.3) configuration. Every value comes from server
// env vars — never NEXT_PUBLIC_*, so the app secret and any access token can never reach the
// browser. Importing this module from client code would fail (no process.env values), which
// is the intended boundary. Mirrors src/lib/pinterest/config.ts.
//
// Nothing here is ever persisted to Payload/PostgreSQL, logged, or serialized into an API
// response: callers only ever expose `maskAdvertiserId(...)`.

import { DATE_RE } from '@/lib/marketing/dateMath'

export interface TikTokAdsConfig {
  /** TikTok app id from the developer portal. Not a secret. */
  appId: string
  /** TikTok app secret. Used only in the server-side token exchange. */
  appSecret: string
  /**
   * Exact redirect URI registered on the TikTok app. TikTok compares this string, so it must
   * match the registered value byte for byte.
   */
  redirectUri: string
  /**
   * Advertiser whose spend is imported. Optional: when the authorization grants exactly one
   * advertiser it is selected automatically and stored on the connection. Digits only.
   */
  advertiserId: string
  /**
   * Optional access token supplied directly via env, bypassing the OAuth flow entirely.
   * Same escape hatch Meta and Pinterest use. Empty when the connection is OAuth-based.
   */
  accessToken: string
  /**
   * ISO 4217 currency the advertiser account reports in, declared by the operator.
   *
   * Only needed because `GET /advertiser/info/` — the *only* TikTok endpoint that exposes an
   * advertiser's currency — requires the **Ad Account Management** scope, while a read-only
   * spend integration is authorized for **Reporting** alone. Neither
   * `oauth2/advertiser/get` (advertiser_id + advertiser_name) nor `report/integrated/get`
   * (metrics + dimensions) carries a currency, so with Reporting-only access there is no way
   * to read it from the API.
   *
   * Empty when unset. It is a *declaration*, never a conversion setting: the NOK guard still
   * applies to whatever value resolves, so declaring USD stops the import rather than
   * enabling it.
   */
  advertiserCurrency: string
  /** Marketing API version segment, e.g. 'v1.3'. */
  apiVersion: string
  /** `https://business-api.tiktok.com/open_api/{apiVersion}`. */
  baseUrl: string
  /** `https://business-api.tiktok.com/portal/auth` — where the admin is sent to authorize. */
  authorizeUrl: string
  /**
   * Floor for a full import. The advertiser's own creation date normally narrows this
   * further; the floor only matters when TikTok does not report one. Configurable so an
   * unusually old account can be widened without a code change.
   */
  historyStart: string
}

/**
 * TikTok Marketing API version. v1.3 is the current generation (v1.2 is retired). Kept in one
 * place (TIKTOK_API_VERSION) instead of being hard-coded across call sites, so a future
 * version bump is an env change rather than a code change.
 */
const DEFAULT_API_VERSION = 'v1.3'
const DEFAULT_BASE_HOST = 'https://business-api.tiktok.com'
/**
 * TikTok for Business ads only became available to Norwegian advertisers around 2020, so this
 * is a safe floor for a full import. Only used when the advertiser's `create_time` is missing
 * from the API response — normally the account's own creation date wins.
 */
const DEFAULT_HISTORY_START = '2020-01-01'

export class TikTokAdsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TikTokAdsConfigError'
  }
}

/**
 * Env vars without which the TikTok integration cannot be set up at all.
 *
 * TIKTOK_ADVERTISER_ID is deliberately *not* required: the OAuth flow discovers the
 * authorized advertisers and auto-selects when there is exactly one, so requiring it up front
 * would mark a valid single-advertiser setup as "Ikke konfigurert" — the same reasoning that
 * keeps GOOGLE_ADS_LOGIN_CUSTOMER_ID and PINTEREST_APP_ID out of their required lists.
 *
 * TIKTOK_ACCESS_TOKEN is likewise optional: it is the escape hatch for a token issued outside
 * this app, and the normal path obtains one through "Koble til".
 */
export const TIKTOK_ADS_REQUIRED_ENV = [
  'TIKTOK_APP_ID',
  'TIKTOK_APP_SECRET',
  'TIKTOK_REDIRECT_URI',
] as const

/**
 * TikTok advertiser ids are numeric strings (e.g. 7012345678901234567). Accept stray
 * whitespace or separators and canonicalize to digits only, which is what the API expects.
 */
export function normalizeAdvertiserId(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Safe display form of an advertiser id: only the last four digits survive. Used everywhere
 * an id would otherwise be sent to the browser or written to a log.
 */
export function maskAdvertiserId(advertiserId: string): string {
  const digits = normalizeAdvertiserId(advertiserId)
  if (!digits) return '—'
  if (digits.length <= 4) return `•••${digits}`
  return `•••${digits.slice(-4)}`
}

/**
 * Validate a redirect URI. TikTok requires an absolute https:// URL that matches the value
 * registered on the app exactly; http:// is accepted only for localhost during development.
 */
function validateRedirectUri(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new TikTokAdsConfigError(
      'TIKTOK_REDIRECT_URI må være en fullstendig URL, f.eks. https://aboks.no/api/admin/integrations/tiktok/callback.',
    )
  }
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
    throw new TikTokAdsConfigError('TIKTOK_REDIRECT_URI må bruke https (http er kun tillatt for localhost).')
  }
  return raw
}

/**
 * Read + validate the TikTok Ads configuration from env. Throws TikTokAdsConfigError with a
 * safe, secret-free message when required values are missing or malformed. The returned
 * object is never logged or serialized to a client response.
 */
export function getTikTokAdsConfig(
  env: Record<string, string | undefined> = process.env,
): TikTokAdsConfig {
  const appId = (env.TIKTOK_APP_ID ?? '').trim()
  const appSecret = (env.TIKTOK_APP_SECRET ?? '').trim()
  const redirectUriRaw = (env.TIKTOK_REDIRECT_URI ?? '').trim()
  const rawAdvertiserId = (env.TIKTOK_ADVERTISER_ID ?? '').trim()
  const accessToken = (env.TIKTOK_ACCESS_TOKEN ?? '').trim()
  const advertiserCurrency = (env.TIKTOK_ADVERTISER_CURRENCY ?? '').trim().toUpperCase()
  const apiVersion = (env.TIKTOK_API_VERSION ?? '').trim() || DEFAULT_API_VERSION
  const historyStartRaw = (env.TIKTOK_HISTORY_START ?? '').trim()

  const present: Record<string, string> = {
    TIKTOK_APP_ID: appId,
    TIKTOK_APP_SECRET: appSecret,
    TIKTOK_REDIRECT_URI: redirectUriRaw,
  }
  const missing = TIKTOK_ADS_REQUIRED_ENV.filter((k) => !present[k])
  if (missing.length > 0) {
    throw new TikTokAdsConfigError(
      `TikTok Ads-konfigurasjonen mangler eller er ugyldig: ${missing.join(', ')} er ikke satt.`,
    )
  }

  if (!/^\d+$/.test(appId)) {
    throw new TikTokAdsConfigError('TIKTOK_APP_ID må bestå av kun siffer.')
  }

  const redirectUri = validateRedirectUri(redirectUriRaw)

  // An advertiser id is optional, but a value that contains no digit at all is a typo, not a
  // deliberate "let OAuth decide" — fail loudly rather than silently ignoring it.
  const advertiserId = normalizeAdvertiserId(rawAdvertiserId)
  if (rawAdvertiserId && !advertiserId) {
    throw new TikTokAdsConfigError(
      'TIKTOK_ADVERTISER_ID inneholder ikke et gyldig annonsekonto-ID. Forventet annonsekontoens ID (kun siffer).',
    )
  }

  // A currency is optional, but a malformed one is a typo that would otherwise be compared
  // against 'NOK' and silently stop every import with a confusing message.
  if (advertiserCurrency && !/^[A-Z]{3}$/.test(advertiserCurrency)) {
    throw new TikTokAdsConfigError(
      'TIKTOK_ADVERTISER_CURRENCY må være en ISO 4217-kode med tre bokstaver, f.eks. NOK.',
    )
  }

  if (historyStartRaw && !DATE_RE.test(historyStartRaw)) {
    throw new TikTokAdsConfigError('TIKTOK_HISTORY_START må være på formatet ÅÅÅÅ-MM-DD.')
  }

  if (!/^v\d+(\.\d+)?$/.test(apiVersion)) {
    throw new TikTokAdsConfigError('TIKTOK_API_VERSION må være på formatet v1.3.')
  }

  return {
    appId,
    appSecret,
    redirectUri,
    advertiserId,
    accessToken,
    advertiserCurrency,
    apiVersion,
    baseUrl: `${DEFAULT_BASE_HOST}/open_api/${apiVersion}`,
    authorizeUrl: `${DEFAULT_BASE_HOST}/portal/auth`,
    historyStart: historyStartRaw || DEFAULT_HISTORY_START,
  }
}
