// Low-level TikTok Marketing API client: request helpers with timeout, envelope validation,
// page-number pagination and a small bounded retry. No Payload dependency, so it is fully
// unit-testable with an injected fetch. Mirrors src/lib/pinterest/client.ts.
//
// Transport choice: the TikTok Marketing **REST** API v1.3 over `fetch`. TikTok publishes a
// generated SDK, but it is a thin wrapper over the same JSON endpoints and would add a large
// dependency for three calls — so this uses the repository's existing native-fetch
// convention, which also runs cleanly in the Next.js server runtime on Vercel.
//
// The one thing that makes this client different from the other providers:
//   **TikTok returns HTTP 200 for application errors.** Success is `code === 0` in the body,
//   not `res.ok`. Every reply therefore goes through `assertEnvelope` before its `data` is
//   handed back, so a "200 OK, code 40100" can never be mistaken for data.
//
// Security rules enforced here:
//  - the access token only ever appears in the Access-Token header sent to TikTok, and the
//    app secret only ever in a POST body / query to TikTok — never in a thrown message and
//    never in a log line (we log paths, not full URLs);
//  - failures are normalized to TikTokAdsError (safe Norwegian message + structured detail
//    for the server log).

import type { TikTokAdsConfig } from './config'
import { TikTokAdsError, networkError, parseTikTokAdsError } from './errors'
import type { TikTokPageInfo } from './types'

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

export interface TikTokRequestOptions {
  fetchImpl?: FetchImpl
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Safety cap on the number of pages followed. */
  maxPages?: number
  /** Extra attempts for a *transient* failure (429/5xx/network/code 5xxxx). Never unbounded. */
  maxRetries?: number
  /** Injected sleep so retry backoff is instant in tests. */
  sleep?: (ms: number) => Promise<void>
  /** Date chunk label carried into any error detail, for the server log. */
  chunk?: string
  /**
   * Short label naming the call, e.g. 'token-exchange'. A single admin action makes several
   * TikTok calls; without this a failure cannot be attributed to one of them from the log.
   */
  operation?: string
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_PAGES = 200
const DEFAULT_MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 500

/** TikTok's maximum page size for report queries. */
export const MAX_PAGE_SIZE = 1000

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** A `data` payload that carries a list plus pagination. */
interface TikTokListData<T> {
  list?: T[]
  page_info?: TikTokPageInfo
}

/**
 * Validate the TikTok envelope and return its `data`.
 *
 * `code === 0` is the only success signal — an HTTP 200 with a non-zero code is an error and
 * must never be treated as data. A body that is not an object at all is equally unusable.
 */
function assertEnvelope(
  parsed: unknown,
  httpStatus: number,
  context: { chunk?: string; operation?: string },
): unknown {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TikTokAdsError(
      'Uventet svar fra TikTok Ads.',
      { message: 'response body is not an object', ...context },
      httpStatus,
    )
  }
  const envelope = parsed as { code?: unknown; data?: unknown }
  if (envelope.code !== 0) throw parseTikTokAdsError(parsed, httpStatus, context)
  return envelope.data ?? {}
}

/** Body excerpt kept for the log when a response could not be parsed as JSON. */
const RAW_BODY_LOG_CHARS = 300

/** Perform one request; normalize every failure mode to TikTokAdsError. */
async function request(
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string },
  fetchImpl: FetchImpl,
  timeoutMs: number,
  context: { chunk?: string; operation?: string },
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Awaited<ReturnType<FetchImpl>>
  try {
    res = await fetchImpl(url, { ...init, signal: controller.signal })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw networkError(err, aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }

  // Read the body as text *first*, then parse. A response body can only be consumed once, so
  // calling res.json() directly would leave nothing to log when the body is not JSON — which
  // is exactly the case where the raw text is the only evidence of what went wrong.
  let raw: string
  try {
    raw = await res.text()
  } catch (err) {
    throw networkError(err, 'network')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // A non-JSON body is an infrastructure error (gateway page, empty 5xx) or an endpoint
    // that did not answer with TikTok's envelope at all.
    throw parseTikTokAdsError(undefined, res.status, {
      ...context,
      rawBody: raw.slice(0, RAW_BODY_LOG_CHARS),
    })
  }

  // A non-2xx *and* a 200 with a non-zero code both land in parseTikTokAdsError, via
  // assertEnvelope — TikTok's status code alone never decides success.
  return assertEnvelope(parsed, res.status, context)
}

/** Run a request with a bounded retry for transient failures only. */
async function withRetry(
  run: () => Promise<unknown>,
  options: TikTokRequestOptions,
): Promise<unknown> {
  const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES)
  const sleep = options.sleep ?? defaultSleep

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run()
    } catch (err) {
      // Invalid credentials, a missing scope, an unknown advertiser and a malformed request
      // are all permanent — only 429 / 5xx / network / TikTok's 5xxxx family are retried.
      const retryable = err instanceof TikTokAdsError && err.retryable
      if (!retryable || attempt >= maxRetries) throw err
      await sleep(RETRY_BASE_DELAY_MS * (attempt + 1))
    }
  }
}

function buildUrl(config: TikTokAdsConfig, path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString()
  return `${config.baseUrl}/${path}${qs ? `?${qs}` : ''}`
}

/**
 * GET a TikTok endpoint with the Access-Token header and return its `data` payload.
 * Used for the single-object reads (advertiser list, advertiser info).
 */
export async function tiktokGet<T>(
  config: TikTokAdsConfig,
  accessToken: string,
  path: string,
  params: Record<string, string> = {},
  options: TikTokRequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const url = buildUrl(config, path, params)

  const data = await withRetry(
    () =>
      request(
        url,
        {
          method: 'GET',
          headers: {
            // The only place the token ever appears.
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        },
        fetchImpl,
        timeoutMs,
        { chunk: options.chunk, operation: options.operation },
      ),
    options,
  )
  return data as T
}

/**
 * POST a JSON body to a TikTok endpoint and return its `data` payload. Used only by the
 * token exchange, which authenticates with the app credentials in the body rather than with
 * an Access-Token header.
 */
export async function tiktokPostJson<T>(
  config: TikTokAdsConfig,
  path: string,
  body: Record<string, unknown>,
  options: TikTokRequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const url = buildUrl(config, path, {})

  const data = await withRetry(
    () =>
      request(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        fetchImpl,
        timeoutMs,
        { chunk: options.chunk, operation: options.operation },
      ),
    options,
  )
  return data as T
}

/**
 * GET a list endpoint and follow `page`/`page_info.total_page` pagination, concatenating each
 * page's rows.
 *
 * TikTok paginates by page *number* (not a cursor), so the loop increments `page` until
 * `page_info.total_page` is reached. A response without `page_info` is treated as a single
 * complete page, which is what the small collection endpoints return.
 */
export async function tiktokGetList<T>(
  config: TikTokAdsConfig,
  accessToken: string,
  path: string,
  params: Record<string, string> = {},
  options: TikTokRequestOptions = {},
): Promise<T[]> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES

  const rows: T[] = []
  let page = 1

  while (page <= maxPages) {
    const data = await tiktokGet<TikTokListData<T>>(
      config,
      accessToken,
      path,
      { ...params, page: String(page) },
      options,
    )

    // A partial or reshaped response must not silently look like "no more data": an absent
    // `list` is accepted as an empty page, but the pagination decision below still comes from
    // page_info, so a truncated reply cannot end the loop early and be reported as complete.
    const list = Array.isArray(data?.list) ? data.list : []
    rows.push(...list)

    const totalPage = Number(data?.page_info?.total_page)
    if (!Number.isFinite(totalPage) || totalPage <= page) return rows
    page += 1
  }

  throw new TikTokAdsError('For mange sider med data fra TikTok Ads. Velg en kortere periode.', {
    message: `pagination exceeded ${maxPages} pages`,
    chunk: options.chunk,
    operation: options.operation,
  })
}
