// Low-level Meta Graph API client: a single request helper with timeout, non-2xx
// handling, JSON parsing and cursor pagination. No Payload dependency, so it is fully
// unit-testable with an injected fetch.
//
// Security rules enforced here:
//  - the access token is only ever placed in the request URL/params sent to Meta,
//    never in a thrown message and never in a log line (we log paths, not full URLs);
//  - request failures are normalized to MetaError (safe public message + structured
//    detail for server logs).

import { MetaError, parseMetaError } from './errors'

/** Injectable fetch, matching the global `fetch` signature we rely on. */
export type FetchImpl = (
  input: string,
  init?: { method?: string; signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}>

export interface MetaRequestOptions {
  fetchImpl?: FetchImpl
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number
  /** Safety cap on the number of pages followed via paging.next. */
  maxPages?: number
}

const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_MAX_PAGES = 200

interface MetaPage<T> {
  data?: T[]
  paging?: { next?: string }
}

/** Fetch a single absolute Graph URL with a timeout; normalize errors to MetaError. */
async function fetchJson(
  url: string,
  fetchImpl: FetchImpl,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Awaited<ReturnType<FetchImpl>>
  try {
    res = await fetchImpl(url, { method: 'GET', signal: controller.signal })
  } catch (err) {
    // AbortError or a network failure. Never include the URL (it carries the token).
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new MetaError(
      aborted
        ? 'Tidsavbrudd mot Meta-tjenesten. Prøv igjen.'
        : 'Kunne ikke nå Meta-tjenesten. Sjekk nettverket og prøv igjen.',
      { message: err instanceof Error ? err.message : 'network error' },
    )
  } finally {
    clearTimeout(timer)
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    if (!res.ok) throw parseMetaError(undefined, res.status)
    throw new MetaError('Uventet svar fra Meta-tjenesten.', { message: 'invalid JSON' }, res.status)
  }

  if (!res.ok) throw parseMetaError(body, res.status)
  return body
}

/**
 * GET a Graph endpoint and follow cursor pagination (paging.next), concatenating each
 * page's `data`. `path` is relative to the account/version base; `params` are appended
 * to the first request only — follow-up requests use the fully-formed `paging.next` URL
 * (which already carries the access token from Meta).
 */
export async function metaPaginatedGet<T>(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  accessToken: string,
  options: MetaRequestOptions = {},
): Promise<T[]> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES

  const search = new URLSearchParams(params)
  search.set('access_token', accessToken)
  let url: string | undefined = `${baseUrl}/${path}?${search.toString()}`

  const rows: T[] = []
  let pages = 0
  while (url && pages < maxPages) {
    const body = (await fetchJson(url, fetchImpl, timeoutMs)) as MetaPage<T>
    if (Array.isArray(body.data)) rows.push(...body.data)
    url = body.paging?.next
    pages += 1
  }

  if (url && pages >= maxPages) {
    throw new MetaError('For mange sider med data fra Meta. Velg en kortere periode.', {
      message: `pagination exceeded ${maxPages} pages`,
    })
  }

  return rows
}
