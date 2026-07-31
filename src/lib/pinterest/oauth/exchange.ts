// The two calls to `POST https://api.pinterest.com/v5/oauth/token`: exchanging an authorization
// code, and refreshing with a rotating refresh token.
//
// Both authenticate with **HTTP Basic** — `base64(client_id:client_secret)` — and send an
// `application/x-www-form-urlencoded` body, which is what Pinterest's v5 token endpoint
// requires. The app secret therefore never appears in a URL, a query string, or a log line.
//
// `continuous_refresh` is deliberately not sent. It is the opt-in flag for apps created before
// 2025-09-25; this app was created after that date, so Pinterest rotates the refresh token
// automatically and sending the flag is unnecessary.
//
// Neither call is retried. An authorization code is single-use, and a refresh token is rotated
// by a successful call — so a retry after a *successful but slow* request would present a value
// the server has already invalidated, and would turn a transient network blip into a broken
// connection. Failing once and letting the caller decide is strictly safer.

import { basicAuthHeader, type PinterestOAuthConfig } from './config'
import { parseTokenResponse, type PinterestTokenGrant } from './tokens'

const DEFAULT_TIMEOUT_MS = 20_000

/** Injectable fetch, matching the subset of the global `fetch` contract used here. */
export type OAuthFetch = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
  },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export interface OAuthRequestOptions {
  fetchImpl?: OAuthFetch
  timeoutMs?: number
  now?: () => Date
}

/**
 * A failure of the token endpoint, normalized.
 *
 * `message` is safe Norwegian copy for an administrator. `code` and `detail` are for the server
 * log only. Neither ever contains a token, a refresh token or the app secret.
 */
export class PinterestOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus?: number,
    /** Short, secret-free technical detail for the log. */
    readonly detail?: string,
  ) {
    super(message)
    this.name = 'PinterestOAuthError'
  }

  /**
   * True when Pinterest rejected the credential itself, so retrying or refreshing cannot help
   * and only a fresh authorization will. Drives `connectionStatus = 'reauthorization_required'`.
   */
  get needsReauthorization(): boolean {
    return (
      this.code === 'invalid_grant' ||
      this.code === 'invalid_request' ||
      this.code === 'unauthorized_client' ||
      this.httpStatus === 401 ||
      this.httpStatus === 403
    )
  }

  /** One-line, secret-free summary for server logs. */
  logLine(operation: string): string {
    const parts = [
      `op=${operation}`,
      `code=${this.code}`,
      this.httpStatus != null ? `http=${this.httpStatus}` : null,
      this.detail ? `detail=${JSON.stringify(this.detail)}` : null,
    ].filter(Boolean)
    return `[pinterest-oauth] ${parts.join(' ')}`
  }
}

/** Safe Norwegian copy per OAuth error code. Pinterest's own text is never shown to a user. */
const CODE_MESSAGES: Record<string, string> = {
  invalid_grant:
    'Pinterest avviste autorisasjonen. Koden eller fornyelsestokenet er brukt opp, utløpt eller trukket tilbake — koble til på nytt.',
  invalid_client:
    'Pinterest avviste appens legitimasjon. Kontroller PINTEREST_APP_ID og PINTEREST_APP_SECRET.',
  unauthorized_client: 'Pinterest-appen har ikke tillatelse til denne autoriseringsmåten.',
  invalid_request:
    'Pinterest avviste forespørselen om token. Kontroller at redirect-URIen er registrert på appen.',
  invalid_scope: 'Pinterest avviste tilgangsnivået det ble bedt om.',
  unsupported_grant_type: 'Pinterest støtter ikke denne autoriseringsmåten.',
}

const GENERIC = 'Pinterest kunne ikke fullføre autoriseringen. Prøv igjen senere.'

/** Truncate technical detail so a log line stays one line and cannot carry a large payload. */
function short(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed
}

interface ErrorBodyShape {
  error?: unknown
  error_description?: unknown
  message?: unknown
  code?: unknown
}

/** Map a non-2xx token response onto a PinterestOAuthError. */
function toOAuthError(body: unknown, httpStatus: number): PinterestOAuthError {
  const shape = (body && typeof body === 'object' ? body : {}) as ErrorBodyShape
  const code =
    typeof shape.error === 'string' && shape.error.trim()
      ? shape.error.trim()
      : typeof shape.code === 'number' || typeof shape.code === 'string'
        ? `pinterest_${shape.code}`
        : `http_${httpStatus}`

  const description =
    typeof shape.error_description === 'string'
      ? shape.error_description
      : typeof shape.message === 'string'
        ? shape.message
        : ''

  const message =
    CODE_MESSAGES[code] ??
    (httpStatus === 401 || httpStatus === 403
      ? 'Pinterest avviste autorisasjonen. Koble til på nytt.'
      : GENERIC)

  return new PinterestOAuthError(message, code, httpStatus, description ? short(description) : undefined)
}

/** One form-encoded POST to the token endpoint, with every failure normalized. */
async function postToken(
  config: PinterestOAuthConfig,
  params: Record<string, string>,
  options: OAuthRequestOptions,
  requireRefreshToken: boolean,
): Promise<PinterestTokenGrant> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as OAuthFetch)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const now = (options.now ?? (() => new Date()))()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Awaited<ReturnType<OAuthFetch>>
  try {
    res = await fetchImpl(config.tokenUrl, {
      method: 'POST',
      headers: {
        // The only place the app secret is ever used.
        Authorization: basicAuthHeader(config),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(params).toString(),
      signal: controller.signal,
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new PinterestOAuthError(
      aborted
        ? 'Tidsavbrudd mot Pinterest under autorisering. Prøv igjen.'
        : 'Kunne ikke nå Pinterest for autorisering. Sjekk nettverket og prøv igjen.',
      aborted ? 'timeout' : 'network',
      undefined,
      err instanceof Error ? short(err.message) : undefined,
    )
  } finally {
    clearTimeout(timer)
  }

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    if (!res.ok) throw toOAuthError(undefined, res.status)
    throw new PinterestOAuthError(
      'Pinterest svarte med et uventet format under autorisering.',
      'invalid_json',
      res.status,
    )
  }

  if (!res.ok) throw toOAuthError(parsed, res.status)

  // A 200 is not enough: the body still has to carry a usable grant.
  return parseTokenResponse(parsed, now, { requireRefreshToken })
}

/**
 * Exchange a one-time authorization code for a grant.
 *
 * `redirect_uri` must be byte-identical to the one used on the authorize request, which is why
 * it comes from config rather than from the callback's own URL.
 */
export function exchangeAuthorizationCode(
  config: PinterestOAuthConfig,
  code: string,
  options: OAuthRequestOptions = {},
): Promise<PinterestTokenGrant> {
  return postToken(
    config,
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    },
    options,
    true,
  )
}

/**
 * Exchange the current refresh token for a new grant.
 *
 * The response carries a NEW refresh token (continuous refresh), and the one sent here stops
 * working the moment this call succeeds — so the caller must persist both new values
 * atomically before doing anything else.
 */
export function refreshAccessToken(
  config: PinterestOAuthConfig,
  refreshToken: string,
  options: OAuthRequestOptions = {},
): Promise<PinterestTokenGrant> {
  return postToken(
    config,
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      // No `continuous_refresh`: this app was created after 2025-09-25, so rotation is
      // automatic and the flag is only for older apps.
    },
    options,
    true,
  )
}
