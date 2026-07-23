// Normalized Google Ads / OAuth errors. The public `message` is always Norwegian, safe to
// show an administrator, and never contains the refresh token, client secret or developer
// token; the structured detail fields are for server-side logging only.
//
// Mirrors src/lib/meta/errors.ts, but Google returns a much richer error envelope, so the
// mapping table below turns the common operational failures (revoked token, test-access
// developer token, wrong login-customer-id, quota) into an actionable message instead of a
// generic 500.

/** Structured detail parsed from a Google Ads API error envelope. */
export interface GoogleAdsErrorDetail {
  message?: string
  /** gRPC-style status, e.g. 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED'. */
  status?: string
  /** Innermost Google Ads error code key, e.g. 'authenticationError'. */
  errorCode?: string
  /** Its value, e.g. 'DEVELOPER_TOKEN_NOT_APPROVED'. */
  errorValue?: string
  /** OAuth `error` field for token-endpoint failures, e.g. 'invalid_grant'. */
  oauthError?: string
  requestId?: string
}

export class GoogleAdsError extends Error {
  readonly detail: GoogleAdsErrorDetail
  /** HTTP status of the Google response, when the error came from a non-2xx reply. */
  readonly httpStatus?: number
  /** True for transient failures a bounded retry may fix (429 / 5xx / network). */
  readonly retryable: boolean

  constructor(
    publicMessage: string,
    detail: GoogleAdsErrorDetail = {},
    httpStatus?: number,
    retryable = false,
  ) {
    super(publicMessage)
    this.name = 'GoogleAdsError'
    this.detail = detail
    this.httpStatus = httpStatus
    this.retryable = retryable
  }

  /** One-line, secret-free summary for server logs. */
  logLine(): string {
    const d = this.detail
    const parts = [
      this.httpStatus != null ? `http=${this.httpStatus}` : null,
      d.status ? `status=${d.status}` : null,
      d.errorCode ? `code=${d.errorCode}` : null,
      d.errorValue ? `value=${d.errorValue}` : null,
      d.oauthError ? `oauth_error=${d.oauthError}` : null,
      d.requestId ? `request_id=${d.requestId}` : null,
      d.message ? `message=${JSON.stringify(d.message)}` : null,
    ].filter(Boolean)
    return `[google-ads] ${parts.join(' ')}`
  }
}

const GENERIC = 'Google Ads svarte med en feil. Prøv igjen senere.'

/**
 * Operational failures worth naming, keyed by the Google Ads enum value (or gRPC status).
 * Anything not listed falls back to the generic message — the technical cause always
 * reaches the server log via `logLine()`.
 */
const MESSAGES: Record<string, string> = {
  // --- Developer token ---
  DEVELOPER_TOKEN_NOT_APPROVED:
    'Utviklertokenet har kun testtilgang og kan ikke lese denne produksjonskontoen. Søk om «Basic Access» for utviklertokenet i Google Ads API Center.',
  DEVELOPER_TOKEN_PROHIBITED:
    'Utviklertokenet har ikke tilgang til Google Ads API. Kontroller tokenets status i API Center.',
  INVALID_DEVELOPER_TOKEN:
    'Ugyldig utviklertoken (GOOGLE_ADS_DEVELOPER_TOKEN). Kontroller verdien i miljøvariablene.',
  DEVELOPER_TOKEN_PARAMETER_MISSING:
    'Utviklertokenet mangler i forespørselen. Kontroller GOOGLE_ADS_DEVELOPER_TOKEN.',
  // --- OAuth / authentication ---
  OAUTH_TOKEN_REVOKED:
    'Tilgangen er trukket tilbake. Generer et nytt GOOGLE_ADS_REFRESH_TOKEN og oppdater miljøvariablene.',
  OAUTH_TOKEN_INVALID:
    'Ugyldig OAuth-token. Generer et nytt GOOGLE_ADS_REFRESH_TOKEN og oppdater miljøvariablene.',
  OAUTH_TOKEN_EXPIRED:
    'OAuth-tokenet er utløpt. Generer et nytt GOOGLE_ADS_REFRESH_TOKEN og oppdater miljøvariablene.',
  NOT_ADS_USER: 'Google-kontoen som tokenet tilhører har ikke tilgang til Google Ads.',
  CLIENT_CUSTOMER_ID_INVALID:
    'Ugyldig kunde-ID (GOOGLE_ADS_CUSTOMER_ID). Forventet 10 siffer for annonsekontoen.',
  CUSTOMER_NOT_FOUND:
    'Fant ikke Google Ads-kontoen. Kontroller GOOGLE_ADS_CUSTOMER_ID (annonsekontoen) og GOOGLE_ADS_LOGIN_CUSTOMER_ID (administratorkontoen).',
  CUSTOMER_NOT_ENABLED:
    'Google Ads-kontoen er ikke aktiv (kan være avsluttet eller ikke ferdig opprettet).',
  LOGIN_CUSTOMER_ID_PARAMETER_MISSING:
    'Kontoen krever en administratorkonto. Sett GOOGLE_ADS_LOGIN_CUSTOMER_ID til MCC-kontoens ID.',
  CUSTOMER_NOT_ALLOWED_FOR_THIS_LOGIN_CUSTOMER_ID:
    'Administratorkontoen (GOOGLE_ADS_LOGIN_CUSTOMER_ID) har ikke tilgang til denne annonsekontoen.',
  USER_PERMISSION_DENIED:
    'Google-brukeren mangler tilgang til denne Google Ads-kontoen.',
  // --- Query ---
  UNRECOGNIZED_FIELD: 'Google Ads avviste spørringen (ukjent felt). Dette er en feil i integrasjonen.',
  UNEXPECTED_END_OF_QUERY: 'Google Ads avviste spørringen. Dette er en feil i integrasjonen.',
  // --- gRPC statuses ---
  UNAUTHENTICATED:
    'Google Ads avviste påloggingen. Kontroller GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CLIENT_ID og GOOGLE_ADS_CLIENT_SECRET.',
  PERMISSION_DENIED:
    'Ingen tilgang til Google Ads-kontoen. Kontroller kunde-ID, administratorkonto og utviklertokenets tilgangsnivå.',
  RESOURCE_EXHAUSTED:
    'Google Ads-kvoten er brukt opp eller forespørslene kom for tett. Prøv igjen om litt.',
  NOT_FOUND:
    'Google Ads-endepunktet finnes ikke. API-versjonen kan være utgått — sett GOOGLE_ADS_API_VERSION til en støttet versjon.',
  INVALID_ARGUMENT: 'Google Ads avviste forespørselen. Kontroller kontooppsettet.',
}

/** OAuth token-endpoint failures (`{ "error": "invalid_grant", … }`). */
const OAUTH_MESSAGES: Record<string, string> = {
  invalid_grant:
    'Refresh-tokenet er ugyldig eller trukket tilbake. Generer et nytt GOOGLE_ADS_REFRESH_TOKEN og oppdater miljøvariablene.',
  unauthorized_client:
    'OAuth-klienten har ikke lov til å bruke dette refresh-tokenet. Kontroller GOOGLE_ADS_CLIENT_ID og GOOGLE_ADS_CLIENT_SECRET.',
  invalid_client:
    'Ugyldig OAuth-klient. Kontroller GOOGLE_ADS_CLIENT_ID og GOOGLE_ADS_CLIENT_SECRET.',
  access_denied: 'Tilgangen ble avvist av Google. Autoriser integrasjonen på nytt.',
  invalid_request: 'Ugyldig forespørsel til Googles OAuth-tjeneste.',
}

interface GoogleErrorShape {
  error?: {
    code?: number
    message?: string
    status?: string
    details?: Array<{
      requestId?: string
      errors?: Array<{
        errorCode?: Record<string, unknown>
        message?: string
      }>
    }>
  }
}

/** First `{ errorCode: { key: value } }` pair found in the details tree. */
function firstErrorCode(body: GoogleErrorShape): { key?: string; value?: string; message?: string } {
  for (const detail of body.error?.details ?? []) {
    for (const err of detail.errors ?? []) {
      const entries = Object.entries(err.errorCode ?? {})
      if (entries.length > 0) {
        const [key, value] = entries[0]
        return { key, value: typeof value === 'string' ? value : undefined, message: err.message }
      }
      if (err.message) return { message: err.message }
    }
  }
  return {}
}

/** Non-2xx replies from Google are worth retrying only when transient. */
function isRetryableStatus(httpStatus?: number): boolean {
  if (httpStatus == null) return false
  return httpStatus === 429 || httpStatus >= 500
}

/**
 * Parse a Google Ads API error body into a GoogleAdsError with an actionable Norwegian
 * message. Falls back to a generic message when the body is not the expected shape — the
 * detail always carries whatever could be parsed, for the server log.
 */
export function parseGoogleAdsError(body: unknown, httpStatus?: number): GoogleAdsError {
  // Google returns either an object or a single-element array of them.
  const envelope = (Array.isArray(body) ? body[0] : body) as GoogleErrorShape | undefined
  const status = envelope?.error?.status
  const requestId = envelope?.error?.details?.find((d) => d.requestId)?.requestId
  const { key, value, message } = firstErrorCode(envelope ?? {})

  const detail: GoogleAdsErrorDetail = {
    message: message ?? envelope?.error?.message,
    status,
    errorCode: key,
    errorValue: value,
    requestId,
  }

  const publicMessage =
    (value && MESSAGES[value]) ||
    (status && MESSAGES[status]) ||
    (httpStatus === 404 ? MESSAGES.NOT_FOUND : undefined) ||
    GENERIC

  return new GoogleAdsError(publicMessage, detail, httpStatus, isRetryableStatus(httpStatus))
}

/** Parse an OAuth2 token-endpoint failure. */
export function parseGoogleOAuthError(body: unknown, httpStatus?: number): GoogleAdsError {
  const b = (body ?? {}) as { error?: unknown; error_description?: unknown }
  const oauthError = typeof b.error === 'string' ? b.error : undefined
  const description = typeof b.error_description === 'string' ? b.error_description : undefined

  const publicMessage =
    (oauthError && OAUTH_MESSAGES[oauthError]) ||
    'Kunne ikke fornye tilgangen til Google Ads. Kontroller OAuth-konfigurasjonen.'

  return new GoogleAdsError(
    publicMessage,
    { oauthError, message: description },
    httpStatus,
    isRetryableStatus(httpStatus),
  )
}

/** Network failure / abort → a retryable GoogleAdsError with a safe message. */
export function networkError(err: unknown, what: 'timeout' | 'network'): GoogleAdsError {
  return new GoogleAdsError(
    what === 'timeout'
      ? 'Tidsavbrudd mot Google Ads. Prøv igjen.'
      : 'Kunne ikke nå Google Ads. Sjekk nettverket og prøv igjen.',
    { message: err instanceof Error ? err.message : String(what) },
    undefined,
    true,
  )
}
