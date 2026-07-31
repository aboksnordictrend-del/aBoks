// Normalized TikTok Marketing API errors. The public `message` is always Norwegian, safe to
// show an administrator, and never contains the app secret, an access token or an auth code;
// the structured detail fields are for server-side logging only.
//
// Mirrors src/lib/pinterest/errors.ts, with one structural difference that matters:
// **TikTok answers HTTP 200 even for application errors.** The envelope is
// `{ code, message, request_id, data }` and `code === 0` means success — so the client must
// key off `code`, not the HTTP status. `parseTikTokAdsError` is therefore called for a
// non-2xx reply *and* for a 200 whose `code` is non-zero.
//
// Error-code mapping is deliberately conservative. TikTok publishes a large code list whose
// secondary documentation is inconsistent, so only codes with unambiguous meaning are named
// here; everything else falls back to the HTTP status and finally to a generic message. The
// unmapped code, TikTok's own message and the request id always reach the server log, so an
// unnamed failure stays diagnosable without guessing at semantics in user-facing copy.

/** Structured detail parsed from a TikTok v1.3 error envelope. */
export interface TikTokAdsErrorDetail {
  message?: string
  /** TikTok's own numeric error code, e.g. 40100. `0` means success. */
  code?: number
  /** `request_id` from the response body — quote this in a TikTok support ticket. */
  requestId?: string
  /** Date chunk being fetched when the failure happened (never a secret). */
  chunk?: string
  /**
   * Which call failed, e.g. 'token-exchange' or 'advertiser-list'. Without this a log line
   * cannot be attributed to one of the several TikTok calls a single admin action makes.
   */
  operation?: string
  /**
   * First 300 characters of the response body when it was not valid JSON (a gateway page, an
   * empty 5xx). TikTok never returns a credential in an error body, and the value is
   * truncated, so this is safe to log — and it is the only evidence available when the
   * envelope could not be parsed.
   */
  rawBody?: string
}

export class TikTokAdsError extends Error {
  readonly detail: TikTokAdsErrorDetail
  /** HTTP status of the TikTok response, when the error came from an HTTP reply. */
  readonly httpStatus?: number
  /** True for transient failures a bounded retry may fix (429 / 5xx / network / code 5xxxx). */
  readonly retryable: boolean
  /** True when the stored authorization is gone and the admin must reconnect. */
  readonly needsReconnect: boolean

  constructor(
    publicMessage: string,
    detail: TikTokAdsErrorDetail = {},
    httpStatus?: number,
    retryable = false,
    needsReconnect = false,
  ) {
    super(publicMessage)
    this.name = 'TikTokAdsError'
    this.detail = detail
    this.httpStatus = httpStatus
    this.retryable = retryable
    this.needsReconnect = needsReconnect
  }

  /** One-line, secret-free summary for server logs. */
  logLine(): string {
    const d = this.detail
    const parts = [
      d.operation ? `op=${d.operation}` : null,
      this.httpStatus != null ? `http=${this.httpStatus}` : null,
      d.code != null ? `code=${d.code}` : null,
      d.requestId ? `request_id=${d.requestId}` : null,
      d.chunk ? `chunk=${d.chunk}` : null,
      d.message ? `message=${JSON.stringify(d.message)}` : null,
      d.rawBody ? `raw=${JSON.stringify(d.rawBody)}` : null,
    ].filter(Boolean)
    return `[tiktok-ads] ${parts.join(' ')}`
  }
}

const GENERIC = 'TikTok Ads svarte med en feil. Prøv igjen senere.'

const RECONNECT =
  'TikTok-autorisasjonen er utløpt eller trukket tilbake. Koble til TikTok på nytt.'

/**
 * The few TikTok error codes whose meaning is unambiguous. Anything not listed falls back to
 * the HTTP-status message below, and finally to the generic one — the technical cause always
 * reaches the server log via `logLine()`.
 */
const CODE_MESSAGES: Record<number, string> = {
  40001: 'TikTok-appen har ikke tilgang til denne annonsekontoen. Kontroller autorisasjonen og TIKTOK_ADVERTISER_ID.',
  40100: RECONNECT,
  40105: RECONNECT,
}

/** Codes after which the stored token is worthless and only a reconnect helps. */
const RECONNECT_CODES = new Set([40100, 40105])

/** Fallbacks per HTTP status when TikTok sends no recognised code. */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'TikTok Ads avviste forespørselen. Kontroller kontooppsettet.',
  401: RECONNECT,
  403: 'Ingen tilgang til TikTok-annonsekontoen. Kontroller at autorisasjonen omfatter rapportlesing.',
  404: 'Fant ikke TikTok-endepunktet. Kontroller TIKTOK_API_VERSION.',
  429: 'TikTok-kvoten er brukt opp eller forespørslene kom for tett. Prøv igjen om litt.',
}

interface TikTokErrorShape {
  code?: unknown
  message?: unknown
  request_id?: unknown
}

/** TikTok sends `code` as a number, but a string is accepted defensively. */
function parseCode(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/**
 * Transient failures worth a bounded retry:
 *  - HTTP 429 (documented rate limit) and any 5xx;
 *  - TikTok's own 5xxxx code family, which is its server-side error range and is returned
 *    under an HTTP 200.
 */
function isRetryable(httpStatus: number | undefined, code: number | undefined): boolean {
  if (httpStatus != null && (httpStatus === 429 || httpStatus >= 500)) return true
  if (code != null && code >= 50000 && code < 60000) return true
  return false
}

/**
 * Parse a TikTok Marketing API error body into a TikTokAdsError with an actionable Norwegian
 * message. Falls back to a generic message when the body is not the expected shape — the
 * detail always carries whatever could be parsed, for the server log.
 */
export function parseTikTokAdsError(
  body: unknown,
  httpStatus?: number,
  context: { chunk?: string; operation?: string; rawBody?: string } = {},
): TikTokAdsError {
  const envelope = (body ?? undefined) as TikTokErrorShape | undefined
  const code = parseCode(envelope?.code)
  const message = typeof envelope?.message === 'string' ? envelope.message : undefined
  const requestId = typeof envelope?.request_id === 'string' ? envelope.request_id : undefined

  const publicMessage =
    (code != null && CODE_MESSAGES[code]) ||
    (httpStatus != null && STATUS_MESSAGES[httpStatus]) ||
    GENERIC

  return new TikTokAdsError(
    publicMessage,
    { message, code, requestId, ...context },
    httpStatus,
    isRetryable(httpStatus, code),
    (code != null && RECONNECT_CODES.has(code)) || httpStatus === 401,
  )
}

/** Network failure / abort → a retryable TikTokAdsError with a safe message. */
export function networkError(err: unknown, what: 'timeout' | 'network'): TikTokAdsError {
  return new TikTokAdsError(
    what === 'timeout'
      ? 'Tidsavbrudd mot TikTok Ads. Prøv igjen.'
      : 'Kunne ikke nå TikTok Ads. Sjekk nettverket og prøv igjen.',
    { message: err instanceof Error ? err.message : String(what) },
    undefined,
    true,
  )
}

/** The integration has no usable authorization yet (never connected, or token cleared). */
export function notConnectedError(): TikTokAdsError {
  return new TikTokAdsError(
    'TikTok Ads er ikke koblet til ennå. Bruk «Koble til» for å autorisere kontoen.',
    { message: 'no access token available' },
  )
}
