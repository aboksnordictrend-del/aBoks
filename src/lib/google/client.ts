// Low-level Google Ads API client: one request helper with timeout, non-2xx handling, JSON
// parsing, page-token pagination and a small bounded retry. No Payload dependency, so it is
// fully unit-testable with an injected fetch. Mirrors src/lib/meta/client.ts.
//
// Transport choice: the official Google Ads **REST** interface over `fetch`. It is the same
// API surface as the gRPC client libraries, but needs no extra dependency and runs cleanly
// in the Next.js server runtime on Vercel (the gRPC-based `google-ads-api` package pulls in
// native/proto machinery that does not bundle well in a serverless function).
//
// Security rules enforced here:
//  - the developer token and access token only ever appear in request headers sent to
//    Google, never in a thrown message and never in a log line;
//  - failures are normalized to GoogleAdsError (safe Norwegian message + structured detail
//    for the server log).

import { getAccessToken, invalidateAccessToken, type FetchImpl } from './auth'
import type { GoogleAdsConfig } from './config'
import { GoogleAdsError, networkError, parseGoogleAdsError } from './errors'

export interface GoogleAdsRequestOptions {
  fetchImpl?: FetchImpl
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Safety cap on the number of pages followed via nextPageToken. */
  maxPages?: number
  /** Extra attempts for a *transient* failure (429/5xx/network). Never unbounded. */
  maxRetries?: number
  /** Injected sleep so retry backoff is instant in tests. */
  sleep?: (ms: number) => Promise<void>
  /** Injected access-token provider (tests bypass the OAuth round-trip). */
  getToken?: (config: GoogleAdsConfig) => Promise<string>
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_PAGES = 200
const DEFAULT_MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 500

interface SearchResponse<T> {
  results?: T[]
  nextPageToken?: string
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** POST one search page; normalize every failure mode to GoogleAdsError. */
async function postSearchPage<T>(
  config: GoogleAdsConfig,
  query: string,
  pageToken: string | undefined,
  accessToken: string,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<SearchResponse<T>> {
  const url = `${config.baseUrl}/customers/${config.customerId}/googleAds:search`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': config.developerToken,
    'Content-Type': 'application/json',
  }
  // Only sent when a manager account is configured; a standalone account must omit it.
  if (config.loginCustomerId) headers['login-customer-id'] = config.loginCustomerId

  // `pageSize` is deliberately NOT sent: from Google Ads API v17+ the search endpoint
  // rejects it with INVALID_ARGUMENT / PAGE_SIZE_NOT_SUPPORTED ("Search Responses will have
  // fixed page size of '10000' rows"). Paging is driven purely by nextPageToken; a
  // per-query row cap is expressed in GAQL with LIMIT instead.
  const body = JSON.stringify(pageToken ? { query, pageToken } : { query })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Awaited<ReturnType<FetchImpl>>
  try {
    res = await fetchImpl(url, { method: 'POST', headers, body, signal: controller.signal })
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
    if (!res.ok) throw parseGoogleAdsError(undefined, res.status)
    throw new GoogleAdsError(
      'Uventet svar fra Google Ads.',
      { message: 'invalid JSON' },
      res.status,
    )
  }

  if (!res.ok) throw parseGoogleAdsError(parsed, res.status)
  return (parsed ?? {}) as SearchResponse<T>
}

/**
 * Run a GAQL query and follow `nextPageToken`, concatenating each page's `results`.
 *
 * Read-only, so a transient failure is retried with linear backoff up to `maxRetries`
 * extra attempts — never in an unbounded loop. A 401 additionally drops the cached access
 * token so the retry re-authenticates. Non-transient errors (bad token, no permission,
 * malformed query) are thrown immediately with their mapped message.
 */
export async function googleAdsSearch<T>(
  config: GoogleAdsConfig,
  query: string,
  options: GoogleAdsRequestOptions = {},
): Promise<T[]> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES
  const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES)
  const sleep = options.sleep ?? defaultSleep
  const getToken = options.getToken ?? ((c: GoogleAdsConfig) => getAccessToken(c, { fetchImpl }))

  const rows: T[] = []
  let pageToken: string | undefined
  let pages = 0

  while (pages < maxPages) {
    let page: SearchResponse<T> | undefined
    let lastError: unknown

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const accessToken = await getToken(config)
        page = await postSearchPage<T>(config, query, pageToken, accessToken, fetchImpl, timeoutMs)
        break
      } catch (err) {
        lastError = err
        const retryable = err instanceof GoogleAdsError && err.retryable
        // An expired/invalidated access token is worth exactly one clean re-auth.
        if (err instanceof GoogleAdsError && err.httpStatus === 401) {
          invalidateAccessToken(config)
        }
        const canRetry =
          attempt < maxRetries &&
          (retryable || (err instanceof GoogleAdsError && err.httpStatus === 401))
        if (!canRetry) throw err
        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1))
      }
    }

    if (!page) throw lastError instanceof Error ? lastError : new GoogleAdsError('Google Ads svarte ikke.')

    if (Array.isArray(page.results)) rows.push(...page.results)
    pageToken = page.nextPageToken || undefined
    pages += 1
    if (!pageToken) return rows
  }

  throw new GoogleAdsError('For mange sider med data fra Google Ads. Velg en kortere periode.', {
    message: `pagination exceeded ${maxPages} pages`,
  })
}
