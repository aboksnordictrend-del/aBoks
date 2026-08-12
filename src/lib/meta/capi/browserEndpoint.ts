// The server half of AddToCart / InitiateCheckout: everything behind `POST /api/meta/event`.
//
// ── What this is, and what it is not ──
//
// It is a *mirror*. The browser has already told the Meta Pixel about the action; this sends
// the same action, with the same `event_id`, from the server, so Meta can merge the two into
// one conversion and still count it when the Pixel is blocked. It is not a general proxy: the
// event name comes from a two-item allowlist, the currency is always NOK, the time is the
// server's, and the customer's identifiers are read off this very request rather than accepted
// from the body. The access token exists only in `sendCapiEvent`'s URL and never leaves the
// server.
//
// ── Why Purchase is not routed through here ──
//
// Purchase is sent from the Kustom webhook, after payment, under a database claim that
// guarantees exactly one send per order (see ./claim). A browser-triggered event has no order
// to claim against and no money to protect, so it is the opposite trade-off: never blocking,
// never retried, and losing one is merely a lost signal. Sharing the pieces that genuinely are
// shared — the config, `buildUserData`, the attribution reader, the HTTP call — is deliberate;
// sharing the flow would mean weakening the Purchase guarantee.
//
// Nothing here can fail the caller in a way the customer sees: the client does not read the
// response, and every outcome that is not a malformed or untrusted request is a 202.

import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import {
  rateLimit as defaultRateLimit,
  type RateLimitOptions,
  type RateLimitResult,
} from '@/lib/rateLimit'
import { MetaError } from '../errors'
import { resolveMetaAttribution, type MetaAttribution, type ValueLookup } from './attribution'
import { getMetaCapiConfig, type MetaCapiConfig } from './config'
import { buildUserData, type MetaUserData } from './event'
import { BROWSER_CAPI_EVENT_ID_PREFIX, type BrowserCapiEventName } from './eventId'
import { sendCapiEvent, type SendEventResult } from './send'
import type { BrowserCapiContent, BrowserCapiEventRequest } from './browserEvent'

/* ------------------------------ limits ------------------------------ */

/** More lines than any real cart. */
const MAX_CONTENTS = 50
/** Variant and product ids are short; this only bounds abuse. */
const MAX_CONTENT_ID_LENGTH = 64
/** No single line is worth this much, and no cart is. Guards against absurd conversion values. */
const MAX_VALUE = 1_000_000
/** A quantity larger than this is not a cart, it is an attempt at something. */
const MAX_QUANTITY = 999
/** Rejects a multi-kilobyte body before JSON.parse ever sees it. */
const MAX_BODY_BYTES = 8_192
/** A URL longer than this is not a page of this shop. */
const MAX_URL_LENGTH = 2_048
/** Random part of an event id: 10–64 lowercase alphanumerics. */
const EVENT_ID_TOKEN = /^[a-z0-9]{10,64}$/

/**
 * Generous, because these are ordinary shopping actions — a customer adding six things to the
 * cart and going to the checkout twice must never be limited. It exists to bound scripted
 * abuse of a route that makes an outbound API call.
 */
const RATE_LIMIT = { limit: 60, windowMs: 5 * 60 * 1000 }

/**
 * Shorter than the webhook's eight seconds. Nobody is waiting on this request — but a
 * serverless invocation that sits on an unresponsive Meta is billed for the whole time, and
 * there is nothing to retry when it fails.
 */
const SEND_TIMEOUT_MS = 5_000

/* ------------------------------ payload ------------------------------ */

export interface MetaBrowserEvent {
  event_name: BrowserCapiEventName
  event_time: number
  event_id: string
  action_source: 'website'
  event_source_url?: string
  user_data: MetaUserData
  custom_data: {
    currency: 'NOK'
    value: number
    content_type: 'product'
    content_ids?: string[]
    contents?: Array<{ id: string; quantity: number; item_price: number }>
    num_items?: number
  }
}

export interface MetaBrowserEventPayload {
  data: [MetaBrowserEvent]
  test_event_code?: string
}

export interface BuildBrowserEventInput {
  eventName: BrowserCapiEventName
  eventId: string
  value: number
  contents: BrowserCapiContent[]
  numItems?: number
  eventSourceUrl?: string
  attribution?: MetaAttribution | null
  /** Defaults to now. Injectable so the payload is deterministic in tests. */
  eventTimeMs?: number
  /** Only ever passed when META_TEST_EVENT_CODE is set. */
  testEventCode?: string
}

/**
 * The complete request body.
 *
 * `content_ids` is derived from `contents` rather than accepted separately: Meta wants both,
 * they must agree, and one source of truth cannot disagree with itself. Both are omitted
 * entirely for an event with no lines — an empty array is a claim about the cart, and a wrong
 * one.
 *
 * `user_data` is built by the same function the Purchase event uses, with no email or phone:
 * an add-to-cart happens long before the customer has typed either, and collecting more
 * personal data for a marketing signal than the action itself involves is not a trade this
 * shop makes.
 */
export function buildBrowserEventPayload(
  input: BuildBrowserEventInput,
): MetaBrowserEventPayload {
  const eventTimeMs = input.eventTimeMs ?? Date.now()
  const hasContents = input.contents.length > 0

  const event: MetaBrowserEvent = {
    event_name: input.eventName,
    event_time: Math.floor(eventTimeMs / 1000),
    event_id: input.eventId,
    action_source: 'website',
    ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
    user_data: buildUserData({ attribution: input.attribution }),
    custom_data: {
      currency: 'NOK',
      value: input.value,
      content_type: 'product',
      ...(hasContents
        ? {
            content_ids: input.contents.map((line) => line.id),
            contents: input.contents.map((line) => ({
              id: line.id,
              quantity: line.quantity,
              item_price: line.itemPrice,
            })),
          }
        : {}),
      ...(input.numItems != null ? { num_items: input.numItems } : {}),
    },
  }

  return {
    data: [event],
    ...(input.testEventCode ? { test_event_code: input.testEventCode } : {}),
  }
}

/* ------------------------------ request parsing ------------------------------ */

export type BrowserEventRejection =
  | 'invalid_request'
  | 'unknown_event'
  | 'event_id_mismatch'
  | 'invalid_value'
  | 'invalid_contents'

export type ParsedBrowserEvent = Required<
  Pick<BrowserCapiEventRequest, 'eventName' | 'eventId' | 'value' | 'contents'>
> & {
  numItems?: number
  eventSourceUrl?: string
  fbclid?: string
}

export type BrowserEventParseResult =
  | { ok: true; value: ParsedBrowserEvent }
  | { ok: false; reason: BrowserEventRejection }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Kroner, rounded to øre. Rejects NaN, Infinity, negatives and absurd magnitudes. */
function readMoney(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > max) return null
  return Math.round(value * 100) / 100
}

/**
 * The event name, checked against the allowlist by identity.
 *
 * This is the line that stops the route being a public proxy for arbitrary Meta events. It is
 * an explicit two-item check rather than "any string that looks like an event name", so adding
 * a third event is a deliberate edit here and in `BROWSER_CAPI_EVENT_ID_PREFIX`. `Purchase` is
 * not on the list and can never be sent through this route.
 */
function readEventName(value: unknown): BrowserCapiEventName | null {
  if (value === 'AddToCart' || value === 'InitiateCheckout') return value
  return null
}

/**
 * The id must be the one this event's own generator would have produced: the event's prefix,
 * an underscore, and a random token. That ties the id to the event name, so a caller cannot
 * attach a foreign id — a Purchase deduplication key, or the id of an event it already sent —
 * to an AddToCart.
 */
function eventIdMatches(eventName: BrowserCapiEventName, value: unknown): value is string {
  if (typeof value !== 'string') return false
  const prefix = `${BROWSER_CAPI_EVENT_ID_PREFIX[eventName]}_`
  if (!value.startsWith(prefix)) return false
  return EVENT_ID_TOKEN.test(value.slice(prefix.length))
}

/**
 * Builds a new object from the fields this endpoint understands; anything else the client
 * sends is structurally incapable of reaching the outgoing payload, because nothing reads it.
 */
export function parseBrowserCapiRequest(body: unknown): BrowserEventParseResult {
  if (!isRecord(body)) return { ok: false, reason: 'invalid_request' }

  const eventName = readEventName(body.eventName)
  if (!eventName) return { ok: false, reason: 'unknown_event' }

  if (!eventIdMatches(eventName, body.eventId)) {
    return { ok: false, reason: 'event_id_mismatch' }
  }
  const eventId = body.eventId as string

  const value = readMoney(body.value, MAX_VALUE)
  if (value === null) return { ok: false, reason: 'invalid_value' }

  const rawContents = body.contents
  if (!Array.isArray(rawContents) || rawContents.length > MAX_CONTENTS) {
    return { ok: false, reason: 'invalid_contents' }
  }

  const contents: BrowserCapiContent[] = []
  for (const raw of rawContents) {
    if (!isRecord(raw)) return { ok: false, reason: 'invalid_contents' }

    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id).trim() : ''
    if (!id || id.length > MAX_CONTENT_ID_LENGTH) return { ok: false, reason: 'invalid_contents' }

    const quantity = raw.quantity
    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_QUANTITY
    ) {
      return { ok: false, reason: 'invalid_contents' }
    }

    const itemPrice = readMoney(raw.itemPrice, MAX_VALUE)
    if (itemPrice === null) return { ok: false, reason: 'invalid_contents' }

    contents.push({ id, quantity, itemPrice })
  }

  const rawNumItems = body.numItems
  const numItems =
    typeof rawNumItems === 'number' &&
    Number.isInteger(rawNumItems) &&
    rawNumItems >= 0 &&
    rawNumItems <= MAX_CONTENTS * MAX_QUANTITY
      ? rawNumItems
      : undefined

  // A URL that fails the origin check is dropped, not rejected: the event is still worth
  // sending, and `event_source_url` is optional to Meta.
  const eventSourceUrl = sanitizeEventSourceUrl(body.eventSourceUrl)

  // Passed through untouched — `fbcFromFbclid` in ./attribution is the authority on what a
  // usable click id looks like, and duplicating that rule here would let the two drift.
  const fbclid = typeof body.fbclid === 'string' ? body.fbclid : undefined

  return {
    ok: true,
    value: {
      eventName,
      eventId,
      value,
      contents,
      ...(numItems !== undefined ? { numItems } : {}),
      ...(eventSourceUrl ? { eventSourceUrl } : {}),
      ...(fbclid ? { fbclid } : {}),
    },
  }
}

const trustedOrigins = new Set(buildCsrfOrigins(SITE_URL))

/**
 * The page URL, reduced to origin + path.
 *
 * Two things happen here. The origin must be one of ours, so the route cannot be used to
 * attribute events to somebody else's site. And the query string and fragment are dropped:
 * they are where a `?email=` or a session token would be, and Meta needs neither to know which
 * page an event happened on.
 */
export function sanitizeEventSourceUrl(
  raw: unknown,
  allowed: Set<string> = trustedOrigins,
): string | undefined {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_URL_LENGTH) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
    if (!allowed.has(url.origin)) return undefined
    return `${url.origin}${url.pathname}`
  } catch {
    return undefined
  }
}

/* ------------------------------ handler ------------------------------ */

/** Same rule as /api/promo-codes/validate: a missing Origin passes, an untrusted one does not. */
function defaultOriginAllowed(origin: string | null): boolean {
  if (!origin) return true
  return trustedOrigins.has(origin)
}

export type BrowserEventOutcome =
  | 'sent'
  | 'send_failed'
  | 'not_configured'
  | 'rejected'
  | 'forbidden_origin'
  | 'rate_limited'

export interface BrowserEventEndpointResult {
  status: number
  /** Intentionally contentless: the client neither reads nor needs anything back. */
  body: { ok: boolean }
  /** For the caller's tests and nothing else — never serialized to the client. */
  outcome: BrowserEventOutcome
}

export interface BrowserEventEndpointDeps {
  /** Omit to read the real env. `null` means "the integration is off". */
  config?: MetaCapiConfig | null
  send?: (
    config: MetaCapiConfig,
    payload: MetaBrowserEventPayload,
  ) => Promise<SendEventResult>
  rateLimit?: (options: RateLimitOptions) => Promise<RateLimitResult>
  originAllowed?: (origin: string | null) => boolean
  /** PII-free structured log. Never the payload, never the token. */
  log?: (fields: Record<string, unknown>) => void
  now?: () => number
}

export interface BrowserEventEndpointInput {
  origin: string | null
  /** Rate-limit key only. The IP that reaches Meta comes from `getHeader`, as Purchase's does. */
  ip: string
  rawBody: string
  getCookie: ValueLookup
  getHeader: ValueLookup
}

const defaultLog = (fields: Record<string, unknown>) =>
  console.log(JSON.stringify({ scope: 'meta-capi-browser', ...fields }))

/**
 * Validate, mirror, log — and never make the customer's action fail.
 *
 * The status codes exist for our own diagnostics; the browser ignores the response entirely.
 * 400/403/429 mean the request never should have been made. Everything past that point is a
 * 202: a Meta refusal, a timeout, an unset token and a clean success are all "we have taken
 * it from here", because there is nothing a shopper's browser could usefully do about any of
 * them.
 */
export async function handleBrowserCapiEvent(
  deps: BrowserEventEndpointDeps,
  input: BrowserEventEndpointInput,
): Promise<BrowserEventEndpointResult> {
  const startedAt = Date.now()
  const log = deps.log ?? defaultLog
  const limiter = deps.rateLimit ?? defaultRateLimit
  const originAllowed = deps.originAllowed ?? defaultOriginAllowed
  const now = deps.now ?? (() => Date.now())

  const finish = (
    status: number,
    outcome: BrowserEventOutcome,
    extra: Record<string, unknown> = {},
  ): BrowserEventEndpointResult => {
    log({ event: outcome, status, durationMs: Date.now() - startedAt, ...extra })
    return { status, body: { ok: status < 400 }, outcome }
  }

  if (!originAllowed(input.origin)) {
    return finish(403, 'forbidden_origin')
  }

  const rl = await limiter({
    key: `meta-capi-browser:${input.ip}`,
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  })
  if (!rl.ok) return finish(429, 'rate_limited')

  if (input.rawBody.length > MAX_BODY_BYTES) {
    return finish(400, 'rejected', { reason: 'body_too_large' })
  }

  let json: unknown
  try {
    json = JSON.parse(input.rawBody)
  } catch {
    return finish(400, 'rejected', { reason: 'invalid_json' })
  }

  const parsed = parseBrowserCapiRequest(json)
  if (!parsed.ok) return finish(400, 'rejected', { reason: parsed.reason })

  const event = parsed.value
  const base = { eventName: event.eventName, eventId: event.eventId }

  const config = deps.config === undefined ? getMetaCapiConfig() : deps.config
  if (!config) return finish(202, 'not_configured', base)

  // The same signals, read the same way, as the checkout captures for Purchase — off the
  // request that genuinely is the customer's browser.
  let attribution: MetaAttribution = {}
  try {
    attribution = resolveMetaAttribution({
      getCookie: input.getCookie,
      getHeader: input.getHeader,
      fbclid: event.fbclid ?? null,
    })
  } catch {
    // One less field in `user_data`; never a reason not to send.
  }

  const payload = buildBrowserEventPayload({
    eventName: event.eventName,
    eventId: event.eventId,
    value: event.value,
    contents: event.contents,
    ...(event.numItems !== undefined ? { numItems: event.numItems } : {}),
    ...(event.eventSourceUrl ? { eventSourceUrl: event.eventSourceUrl } : {}),
    attribution,
    eventTimeMs: now(),
    ...(config.testEventCode ? { testEventCode: config.testEventCode } : {}),
  })

  const send =
    deps.send ?? ((cfg: MetaCapiConfig, body: MetaBrowserEventPayload) =>
      sendCapiEvent(cfg, body, { timeoutMs: SEND_TIMEOUT_MS }))

  try {
    const result = await send(config, payload)
    return finish(202, 'sent', {
      ...base,
      eventsReceived: result.eventsReceived,
      ...(result.fbTraceId ? { fbtraceId: result.fbTraceId } : {}),
      ...(payload.test_event_code ? { testEvent: true } : {}),
    })
  } catch (err) {
    // Safe diagnostics only: the event identifiers, the HTTP status and Meta's own error code
    // and message. Never the payload (hashed identifiers, IP, user agent), never the token.
    const detail =
      err instanceof MetaError
        ? {
            httpStatus: err.httpStatus ?? null,
            metaCode: err.detail.code ?? null,
            metaSubcode: err.detail.errorSubcode ?? null,
            metaMessage: err.detail.message ?? null,
            fbtraceId: err.detail.fbtraceId ?? null,
          }
        : { error: err instanceof Error ? err.message : 'unknown' }

    // Still a 202. There is no retry — one lost AddToCart is a lost signal, not a lost sale,
    // and telling the browser about it would only invite it to send the event twice.
    return finish(202, 'send_failed', { ...base, ...detail })
  }
}
