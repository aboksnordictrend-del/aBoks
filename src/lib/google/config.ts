// Server-only Google Ads API configuration. Every value comes from server env vars — never
// NEXT_PUBLIC_*, so the refresh token, client secret and developer token can never reach the
// browser. Importing this module from client code would fail (no process.env values), which
// is the intended boundary. Mirrors src/lib/meta/config.ts.
//
// Nothing here is ever persisted to Payload/PostgreSQL, logged, or serialized into an API
// response: callers only ever expose `maskCustomerId(...)`.

import { DATE_RE } from '@/lib/marketing/dateMath'

export interface GoogleAdsConfig {
  clientId: string
  clientSecret: string
  developerToken: string
  refreshToken: string
  /** Ad account whose spend is imported. Digits only, no dashes. */
  customerId: string
  /** Manager account (MCC) used for the login-customer-id header. '' when not used. */
  loginCustomerId: string
  /** Google Ads API version segment, e.g. 'v24'. */
  apiVersion: string
  /** `https://googleads.googleapis.com/{apiVersion}`. */
  baseUrl: string
  /** OAuth2 token endpoint. */
  tokenUrl: string
  /**
   * Floor used when probing the API for the account's first day with data (full import).
   * Configurable so an unusually old account can be widened without a code change.
   */
  historyStart: string
}

/**
 * Google Ads API version. Versions are sunset roughly a year after release; when Google
 * retires this one the API answers 404/UNSUPPORTED_VERSION and errors.ts tells the operator
 * to bump GOOGLE_ADS_API_VERSION — we never silently guess a different version.
 */
const DEFAULT_API_VERSION = 'v24'
const DEFAULT_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DEFAULT_BASE_HOST = 'https://googleads.googleapis.com'
/** Old enough to cover any realistic aBoks account; only ever used for a LIMIT 1 probe. */
const DEFAULT_HISTORY_START = '2015-01-01'

export class GoogleAdsConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleAdsConfigError'
  }
}

/** Env vars without which no Google Ads call can be made. */
export const GOOGLE_ADS_REQUIRED_ENV = [
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
] as const

/**
 * Customer ids are 10-digit numbers that Google shows as `123-456-7890`. Accept either
 * form (and stray whitespace) and canonicalize to digits only, which is what both the REST
 * path and the login-customer-id header require.
 */
export function normalizeCustomerId(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Safe display form of a customer id: only the last four digits survive. Used everywhere an
 * id would otherwise be sent to the browser or written to a log.
 */
export function maskCustomerId(customerId: string): string {
  const digits = normalizeCustomerId(customerId)
  if (!digits) return '—'
  if (digits.length <= 4) return `•••${digits}`
  return `•••-•••-${digits.slice(-4)}`
}

/**
 * Read + validate the Google Ads configuration from env. Throws GoogleAdsConfigError with a
 * safe, secret-free message when required values are missing or malformed. The returned
 * object is never logged or serialized to a client response.
 */
export function getGoogleAdsConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleAdsConfig {
  const clientId = (env.GOOGLE_ADS_CLIENT_ID ?? '').trim()
  const clientSecret = (env.GOOGLE_ADS_CLIENT_SECRET ?? '').trim()
  const developerToken = (env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '').trim()
  const refreshToken = (env.GOOGLE_ADS_REFRESH_TOKEN ?? '').trim()
  const rawCustomerId = (env.GOOGLE_ADS_CUSTOMER_ID ?? '').trim()
  const rawLoginCustomerId = (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '').trim()
  const apiVersion = (env.GOOGLE_ADS_API_VERSION ?? '').trim() || DEFAULT_API_VERSION
  const historyStartRaw = (env.GOOGLE_ADS_HISTORY_START ?? '').trim()

  const present: Record<string, string> = {
    GOOGLE_ADS_CLIENT_ID: clientId,
    GOOGLE_ADS_CLIENT_SECRET: clientSecret,
    GOOGLE_ADS_DEVELOPER_TOKEN: developerToken,
    GOOGLE_ADS_REFRESH_TOKEN: refreshToken,
    GOOGLE_ADS_CUSTOMER_ID: rawCustomerId,
  }
  const missing = GOOGLE_ADS_REQUIRED_ENV.filter((k) => !present[k])
  if (missing.length > 0) {
    throw new GoogleAdsConfigError(
      `Google Ads-konfigurasjonen mangler eller er ugyldig: ${missing.join(', ')} er ikke satt.`,
    )
  }

  const customerId = normalizeCustomerId(rawCustomerId)
  if (!customerId) {
    throw new GoogleAdsConfigError(
      'GOOGLE_ADS_CUSTOMER_ID inneholder ikke et gyldig kundenummer. Forventet 10 siffer, med eller uten bindestreker.',
    )
  }

  // The manager account is optional: a standalone (non-MCC) account works without it.
  const loginCustomerId = rawLoginCustomerId ? normalizeCustomerId(rawLoginCustomerId) : ''
  if (rawLoginCustomerId && !loginCustomerId) {
    throw new GoogleAdsConfigError(
      'GOOGLE_ADS_LOGIN_CUSTOMER_ID inneholder ikke et gyldig kundenummer. Forventet 10 siffer, med eller uten bindestreker.',
    )
  }

  if (historyStartRaw && !DATE_RE.test(historyStartRaw)) {
    throw new GoogleAdsConfigError(
      'GOOGLE_ADS_HISTORY_START må være på formatet ÅÅÅÅ-MM-DD.',
    )
  }

  if (!/^v\d+$/.test(apiVersion)) {
    throw new GoogleAdsConfigError(
      'GOOGLE_ADS_API_VERSION må være på formatet v24.',
    )
  }

  return {
    clientId,
    clientSecret,
    developerToken,
    refreshToken,
    customerId,
    loginCustomerId,
    apiVersion,
    baseUrl: `${DEFAULT_BASE_HOST}/${apiVersion}`,
    tokenUrl: (env.GOOGLE_ADS_TOKEN_URL ?? '').trim() || DEFAULT_TOKEN_URL,
    historyStart: historyStartRaw || DEFAULT_HISTORY_START,
  }
}
