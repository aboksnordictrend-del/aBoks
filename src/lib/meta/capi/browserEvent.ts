// The browser half of AddToCart / InitiateCheckout: the wire contract, and the fire-and-forget
// POST that hands the event to our own server so it can be mirrored to the Conversions API.
//
// ── Why this module imports nothing but ./eventId ──
//
// It runs in the browser bundle. Everything else under `capi/` is server-only — `identity.ts`
// pulls in node:crypto, `send.ts` carries the access token, `config.ts` reads server env — so
// importing any of them from here would either break the build or leak a secret. The server
// side of this same contract lives in ./browserEndpoint and imports *this* file for its types,
// never the other way round.
//
// ── Why the browser mints the id and the server is told it ──
//
// Meta deduplicates a browser event against a server event on `event_name` + `event_id`. One
// click has to produce exactly one id, used twice. The click happens in the browser, so that
// is where the id is made; the dataLayer push carries it to the Pixel tag in GTM, and the
// request below carries the same string to the server. Two independently generated ids —
// however well-formed — would be two conversions.

import { browserCapiEventId, type BrowserCapiEventName } from './eventId'

export { browserCapiEventId }
export type { BrowserCapiEventName }

/** Our own route. Not Meta's — the browser never talks to graph.facebook.com. */
export const META_BROWSER_EVENT_ENDPOINT = '/api/meta/event'

/** One line of the event, in kroner. Mirrors `contents` without imposing Meta's field names. */
export interface BrowserCapiContent {
  /** The same identifier the browser Pixel reports for this line. */
  id: string
  quantity: number
  /** Unit price in kroner. */
  itemPrice: number
}

/**
 * Everything the client is allowed to say about an event.
 *
 * Deliberately small. There is no `userData`, no email, no phone, no pixel id, no token and no
 * `eventTime`: the identifiers are read server-side from the request the browser is already
 * making (cookies, IP, User-Agent), and the time is the server's. A field that is not here
 * cannot be spoofed, because there is no code path that reads it.
 */
export interface BrowserCapiEventRequest {
  eventName: BrowserCapiEventName
  /** The id minted by `browserCapiEventId` and given to the Pixel in the same breath. */
  eventId: string
  /** The event's value in kroner — the same number the browser Pixel reports. */
  value: number
  contents: BrowserCapiContent[]
  /** Total units, for InitiateCheckout. */
  numItems?: number
  /** The page the action happened on. Validated and reduced to origin + path server-side. */
  eventSourceUrl?: string
  /** Only used to reconstruct `_fbc` when Meta's cookie is missing — as the checkout does. */
  fbclid?: string
}

type FetchLike = (input: string, init: Record<string, unknown>) => Promise<unknown>

export interface SendBrowserCapiEventOptions {
  fetchImpl?: FetchLike
}

/**
 * Posts the event and forgets about it.
 *
 * Nothing is awaited and nothing is thrown: this sits inside "add to cart" and "go to
 * checkout" handlers, and a Meta outage, an offline device, an ad blocker that kills the
 * request or a 500 from our own route must all be invisible to the customer. The promise
 * rejection is swallowed rather than left unhandled, and the synchronous call is wrapped too —
 * a browser that refuses `keepalive` throws a TypeError from `fetch` itself.
 *
 * `keepalive` is what makes InitiateCheckout survive: the click that fires it also navigates
 * to /kasse, and an ordinary fetch would be cancelled as the page unloads.
 */
export function sendBrowserCapiEvent(
  request: BrowserCapiEventRequest,
  options: SendBrowserCapiEventOptions = {},
): void {
  if (typeof window === 'undefined') return

  const fetchImpl =
    options.fetchImpl ??
    (typeof globalThis.fetch === 'function'
      ? (globalThis.fetch.bind(globalThis) as unknown as FetchLike)
      : null)
  if (!fetchImpl) return

  try {
    const result = fetchImpl(META_BROWSER_EVENT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      keepalive: true,
      // Same-origin is the default, but it is stated because the whole point of routing
      // through our own server is that it can read `_fbp`/`_fbc` off this request.
      credentials: 'same-origin',
    })
    if (result && typeof (result as Promise<unknown>).catch === 'function') {
      void (result as Promise<unknown>).catch(() => {})
    }
  } catch {
    // Marketing telemetry is never a reason to interrupt what the customer is doing.
  }
}

/** The current page, or undefined off-browser. Query and hash are dropped server-side. */
export function currentPageUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location?.href || undefined
}

/** `fbclid` from the current URL, when Meta's click id is in it. */
export function currentFbclid(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const search = window.location?.search
  if (!search) return undefined
  try {
    return new URLSearchParams(search).get('fbclid') ?? undefined
  } catch {
    return undefined
  }
}
