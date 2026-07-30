// Normalized Pinterest Ads API errors. The public `message` is always Norwegian, safe to
// show an administrator, and never contains the access token or app secret; the structured
// detail fields are for server-side logging only.
//
// Mirrors src/lib/google/errors.ts. Pinterest v5 answers with a flat
// `{ code, message }` envelope, so the mapping below keys the common operational failures
// (expired/revoked token, missing scope, unknown ad account, rate limit) off the HTTP status
// and the Pinterest error code instead of returning a generic 500.

/** Structured detail parsed from a Pinterest v5 error envelope. */
export interface PinterestAdsErrorDetail {
  message?: string
  /** Pinterest's own numeric error code, e.g. 2 (authentication failed). */
  code?: number
  /** Request id from the response headers, when present. */
  requestId?: string
}

export class PinterestAdsError extends Error {
  readonly detail: PinterestAdsErrorDetail
  /** HTTP status of the Pinterest response, when the error came from a non-2xx reply. */
  readonly httpStatus?: number
  /** True for transient failures a bounded retry may fix (429 / 5xx / network). */
  readonly retryable: boolean

  constructor(
    publicMessage: string,
    detail: PinterestAdsErrorDetail = {},
    httpStatus?: number,
    retryable = false,
  ) {
    super(publicMessage)
    this.name = 'PinterestAdsError'
    this.detail = detail
    this.httpStatus = httpStatus
    this.retryable = retryable
  }

  /** One-line, secret-free summary for server logs. */
  logLine(): string {
    const d = this.detail
    const parts = [
      this.httpStatus != null ? `http=${this.httpStatus}` : null,
      d.code != null ? `code=${d.code}` : null,
      d.requestId ? `request_id=${d.requestId}` : null,
      d.message ? `message=${JSON.stringify(d.message)}` : null,
    ].filter(Boolean)
    return `[pinterest-ads] ${parts.join(' ')}`
  }
}

const GENERIC = 'Pinterest Ads svarte med en feil. Prøv igjen senere.'

/**
 * Operational failures worth naming, keyed by Pinterest's numeric error code. Anything not
 * listed falls back to the HTTP-status message below, and finally to the generic one — the
 * technical cause always reaches the server log via `logLine()`.
 */
const CODE_MESSAGES: Record<number, string> = {
  2: 'Pinterest avviste påloggingen. Generer et nytt PINTEREST_ACCESS_TOKEN og oppdater miljøvariablene.',
  3: 'Tilgangstokenet mangler nødvendige rettigheter. Tokenet må ha lesetilgang til annonsedata (ads:read).',
  7: 'Fant ikke Pinterest-annonsekontoen. Kontroller PINTEREST_AD_ACCOUNT_ID.',
  29: 'Pinterest-kvoten er brukt opp eller forespørslene kom for tett. Prøv igjen om litt.',
  283: 'Tilgangstokenet mangler nødvendige rettigheter. Tokenet må ha lesetilgang til annonsedata (ads:read).',
}

/** Fallbacks per HTTP status when Pinterest sends no recognised code. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Pinterest Ads avviste forespørselen. Kontroller kontooppsettet.',
  401: 'Tilgangstokenet er ugyldig eller utløpt. Generer et nytt PINTEREST_ACCESS_TOKEN og oppdater miljøvariablene.',
  403: 'Ingen tilgang til Pinterest-annonsekontoen. Kontroller at tokenet har ads:read og tilgang til kontoen.',
  404: 'Fant ikke Pinterest-endepunktet eller annonsekontoen. Kontroller PINTEREST_AD_ACCOUNT_ID og PINTEREST_API_VERSION.',
  429: 'Pinterest-kvoten er brukt opp eller forespørslene kom for tett. Prøv igjen om litt.',
}

interface PinterestErrorShape {
  code?: unknown
  message?: unknown
  /** Some v5 endpoints nest the envelope one level down. */
  error?: { code?: unknown; message?: unknown }
}

/** Pinterest sends `code` as a number, but a string is accepted defensively. */
function parseCode(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/** Non-2xx replies from Pinterest are worth retrying only when transient. */
function isRetryableStatus(httpStatus?: number): boolean {
  if (httpStatus == null) return false
  return httpStatus === 429 || httpStatus >= 500
}

/**
 * Parse a Pinterest Ads API error body into a PinterestAdsError with an actionable Norwegian
 * message. Falls back to a generic message when the body is not the expected shape — the
 * detail always carries whatever could be parsed, for the server log.
 */
export function parsePinterestAdsError(
  body: unknown,
  httpStatus?: number,
  requestId?: string,
): PinterestAdsError {
  const envelope = (Array.isArray(body) ? body[0] : body) as PinterestErrorShape | undefined
  const inner = envelope?.error ?? envelope
  const code = parseCode(inner?.code)
  const message = typeof inner?.message === 'string' ? inner.message : undefined

  const publicMessage =
    (code != null && CODE_MESSAGES[code]) ||
    (httpStatus != null && STATUS_MESSAGES[httpStatus]) ||
    GENERIC

  return new PinterestAdsError(
    publicMessage,
    { message, code, requestId },
    httpStatus,
    isRetryableStatus(httpStatus),
  )
}

/** Network failure / abort → a retryable PinterestAdsError with a safe message. */
export function networkError(err: unknown, what: 'timeout' | 'network'): PinterestAdsError {
  return new PinterestAdsError(
    what === 'timeout'
      ? 'Tidsavbrudd mot Pinterest Ads. Prøv igjen.'
      : 'Kunne ikke nå Pinterest Ads. Sjekk nettverket og prøv igjen.',
    { message: err instanceof Error ? err.message : String(what) },
    undefined,
    true,
  )
}
