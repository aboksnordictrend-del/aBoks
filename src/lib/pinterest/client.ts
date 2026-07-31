// Low-level Pinterest Ads API client: one request helper with timeout, non-2xx handling,
// JSON parsing, bookmark pagination and a small bounded retry. No Payload dependency, so it
// is fully unit-testable with an injected fetch. Mirrors src/lib/google/client.ts.
//
// Transport choice: the Pinterest **REST** API v5 over `fetch`. Pinterest ships no official
// Node SDK, and v5 is a plain bearer-token JSON API, so there is nothing to gain from an
// extra dependency — this runs cleanly in the Next.js server runtime on Vercel.
//
// Security rules enforced here:
//  - the access token only ever appears in the Authorization header sent to Pinterest, never
//    in a thrown message and never in a log line (we log paths, not full URLs);
//  - failures are normalized to PinterestAdsError (safe Norwegian message + structured
//    detail for the server log).

import type { PinterestAdsConfig } from './config'
import { PinterestAdsError, networkError, parsePinterestAdsError } from './errors'
import type { PinterestTokenProvider } from './oauth/accessToken'

/** Injectable fetch, matching the subset of the global `fetch` contract we rely on. */
export type FetchImpl = (
  input: string,
  init?: {
    method?: string
    signal?: AbortSignal
    headers?: Record<string, string>
  },
) => Promise<{
  ok: boolean
  status: number
  headers?: { get: (name: string) => string | null }
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export interface PinterestRequestOptions {
  fetchImpl?: FetchImpl
  /**
   * Supplies (and, on a 401, renews) the bearer token. When omitted the token is taken from
   * `config.accessToken` — the legacy env-var path, which cannot be renewed.
   */
  tokenProvider?: PinterestTokenProvider
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Safety cap on the number of pages followed via `bookmark`. */
  maxPages?: number
  /** Extra attempts for a *transient* failure (429/5xx/network). Never unbounded. */
  maxRetries?: number
  /** Injected sleep so retry backoff is instant in tests. */
  sleep?: (ms: number) => Promise<void>
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_PAGES = 200
const DEFAULT_MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 500

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Pinterest's paginated envelope. Analytics endpoints return a bare array instead. */
interface PinterestListEnvelope<T> {
  items?: T[]
  data?: T[]
  bookmark?: string | null
}

/** GET one page; normalize every failure mode to PinterestAdsError. */
async function getPage(
  config: PinterestAdsConfig,
  accessToken: string,
  path: string,
  params: Record<string, string>,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<unknown> {
  const search = new URLSearchParams(params)
  const qs = search.toString()
  const url = `${config.baseUrl}/${path}${qs ? `?${qs}` : ''}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Awaited<ReturnType<FetchImpl>>
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        // The only place the token ever appears.
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw networkError(err, aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
  }

  // Pinterest echoes a request id that is invaluable in a support ticket and carries no
  // secret. Absent on a stubbed fetch, hence the optional access.
  const requestId = res.headers?.get('x-pinterest-rid') ?? undefined

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    if (!res.ok) throw parsePinterestAdsError(undefined, res.status, requestId)
    throw new PinterestAdsError(
      'Uventet svar fra Pinterest Ads.',
      { message: 'invalid JSON', requestId },
      res.status,
    )
  }

  if (!res.ok) throw parsePinterestAdsError(parsed, res.status, requestId)
  return parsed ?? {}
}

/**
 * GET a path with a bounded retry for transient failures. Read-only, so a 429/5xx/network
 * error is retried with linear backoff up to `maxRetries` extra attempts — never in an
 * unbounded loop. Non-transient errors (no permission, unknown account) are thrown immediately
 * with their mapped message.
 *
 * A **401 is handled separately and exactly once**: Pinterest access tokens expire, and a token
 * that was fresh when the sync started can lapse mid-run (or be invalidated server-side). The
 * first 401 triggers one forced refresh and one replay of the same request; a second 401 is
 * thrown. `refreshedOnce` is what bounds this — without it, a permanently rejected token would
 * refresh-and-retry forever.
 *
 * Without a token provider (the legacy env-var path) there is nothing to refresh, so a 401 is
 * thrown on the spot.
 */
async function getWithRetry(
  config: PinterestAdsConfig,
  path: string,
  params: Record<string, string>,
  options: PinterestRequestOptions,
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES)
  const sleep = options.sleep ?? defaultSleep
  const provider = options.tokenProvider

  let accessToken = provider ? await provider.getAccessToken() : config.accessToken
  let refreshedOnce = false

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await getPage(config, accessToken, path, params, fetchImpl, timeoutMs)
    } catch (err) {
      if (
        provider &&
        !refreshedOnce &&
        err instanceof PinterestAdsError &&
        err.httpStatus === 401
      ) {
        refreshedOnce = true
        // May throw PinterestReauthorizationRequiredError, which is deliberately not caught
        // here: it is terminal, and retrying could not help.
        const renewed = await provider.forceRefresh()
        if (!renewed) throw err
        accessToken = renewed
        continue
      }
      const retryable = err instanceof PinterestAdsError && err.retryable
      if (!retryable || attempt >= maxRetries) throw err
      await sleep(RETRY_BASE_DELAY_MS * (attempt + 1))
    }
  }
}

/** GET a single JSON object (e.g. the ad account resource). */
export async function pinterestGetObject<T>(
  config: PinterestAdsConfig,
  path: string,
  params: Record<string, string> = {},
  options: PinterestRequestOptions = {},
): Promise<T> {
  return (await getWithRetry(config, path, params, options)) as T
}

/**
 * GET a list endpoint and follow `bookmark` pagination, concatenating each page's rows.
 *
 * Pinterest is inconsistent by design here: the ads *analytics* endpoints answer with a bare
 * JSON array (no pagination), while the collection endpoints answer with
 * `{ items: [...], bookmark: "..." }`. Both shapes are accepted, so a caller never has to
 * care which one it hit.
 */
export async function pinterestGetList<T>(
  config: PinterestAdsConfig,
  path: string,
  params: Record<string, string> = {},
  options: PinterestRequestOptions = {},
): Promise<T[]> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES

  const rows: T[] = []
  let bookmark: string | undefined
  let pages = 0

  while (pages < maxPages) {
    const body = await getWithRetry(
      config,
      path,
      bookmark ? { ...params, bookmark } : params,
      options,
    )

    if (Array.isArray(body)) {
      // Bare array ⇒ the whole result set; there is no bookmark to follow.
      rows.push(...(body as T[]))
      return rows
    }

    const envelope = (body ?? {}) as PinterestListEnvelope<T>
    const page = Array.isArray(envelope.items)
      ? envelope.items
      : Array.isArray(envelope.data)
        ? envelope.data
        : []
    rows.push(...page)

    bookmark = envelope.bookmark || undefined
    pages += 1
    if (!bookmark) return rows
  }

  throw new PinterestAdsError(
    'For mange sider med data fra Pinterest Ads. Velg en kortere periode.',
    { message: `pagination exceeded ${maxPages} pages` },
  )
}
