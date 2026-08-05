// The HTTP call to the Conversions API.
//
// Kept apart from `@/lib/meta/client`, which only knows how to GET and paginate the Marketing
// API. This is one POST with a JSON body and no pagination.
//
// Security rules, same as the Marketing client:
//  - the access token only ever appears in the outgoing URL, never in a thrown message and
//    never in a log line;
//  - nothing here logs the payload — it carries hashed identifiers, the customer's IP and
//    their user agent.

import type { MetaCapiConfig } from './config'
import { MetaError, parseMetaError } from '../errors'
import type { MetaPurchasePayload } from './event'

/** Injectable fetch for a JSON POST. Matches the shape of the global `fetch` we rely on. */
export type CapiFetchImpl = (
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

export interface SendEventOptions {
  fetchImpl?: CapiFetchImpl
  timeoutMs?: number
}

/**
 * A webhook must answer Kustom quickly, and this call sits inside it. Eight seconds is long
 * enough for a healthy Graph API round trip and short enough that an unreachable Meta cannot
 * push the handler towards Vercel's function timeout.
 */
const DEFAULT_TIMEOUT_MS = 8_000

export interface SendEventResult {
  /** Meta's own count of accepted events — 1 for a healthy Purchase. */
  eventsReceived: number
  fbTraceId?: string
}

/**
 * POST the payload and normalize every failure mode to MetaError.
 *
 * The token goes in the query string rather than the body so it is impossible to include by
 * accident when something serializes the body for a log line.
 */
export async function sendPurchaseEvent(
  config: MetaCapiConfig,
  payload: MetaPurchasePayload,
  options: SendEventOptions = {},
): Promise<SendEventResult> {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as CapiFetchImpl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = `${config.eventsUrl}?access_token=${encodeURIComponent(config.accessToken)}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Awaited<ReturnType<CapiFetchImpl>>
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new MetaError(
      aborted ? 'Tidsavbrudd mot Meta Conversions API.' : 'Kunne ikke nå Meta Conversions API.',
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
    throw new MetaError(
      'Uventet svar fra Meta Conversions API.',
      { message: 'invalid JSON' },
      res.status,
    )
  }

  if (!res.ok) throw parseMetaError(body, res.status)

  const parsed = (body ?? {}) as { events_received?: unknown; fbtrace_id?: unknown }
  return {
    eventsReceived: typeof parsed.events_received === 'number' ? parsed.events_received : 0,
    ...(typeof parsed.fbtrace_id === 'string' ? { fbTraceId: parsed.fbtrace_id } : {}),
  }
}
