/**
 * The deduplication key shared by the browser pixel and the server event.
 *
 * Deliberately its own module with **no imports**: the browser needs this exact function, and
 * everything else under `capi/` is server-only — `identity.ts` pulls in node:crypto, `send.ts`
 * carries the access token. Importing `event.ts` from a client component would drag both into
 * the browser bundle.
 *
 * Keyed on the **Kustom order id**, not on `orderNumber`. The order number is written by the
 * push webhook, which can still be in flight while the confirmation page renders — so the
 * browser cannot be relied on to know it, and an id the two sides sometimes disagree about is
 * worse than no deduplication at all. The Kustom id is in the confirmation URL from the first
 * millisecond and is the same string the webhook is called with.
 */
export function purchaseEventId(kustomOrderId: string): string {
  return `purchase_${kustomOrderId}`
}

/* ------------------------------ browser-initiated events ------------------------------ */

/**
 * The events the browser is allowed to mirror to the Conversions API, and the prefix each
 * one's id carries.
 *
 * Purchase is deliberately absent. Its id is *derived* from the Kustom order id — both sides
 * compute the same string without ever exchanging it — and it is sent from the webhook, which
 * no browser can reach. AddToCart and InitiateCheckout have no such natural key: they happen
 * once, in a click handler, with nothing durable to derive an id from. So the browser mints
 * one and hands the same string to both halves.
 *
 * The prefix is not decoration: the endpoint checks that the id it is given matches the event
 * it is asked to send, which is what stops a caller putting an arbitrary id — a Purchase one,
 * say — on an AddToCart.
 */
export const BROWSER_CAPI_EVENT_ID_PREFIX = {
  AddToCart: 'addtocart',
  InitiateCheckout: 'initiatecheckout',
} as const

export type BrowserCapiEventName = keyof typeof BROWSER_CAPI_EVENT_ID_PREFIX

/** `addtocart_9f2c…` — the prefix, then 32 hex characters or a time-seeded fallback. */
export function browserCapiEventId(
  name: BrowserCapiEventName,
  random: () => string = randomToken,
): string {
  return `${BROWSER_CAPI_EVENT_ID_PREFIX[name]}_${random()}`
}

/** Lowercase alphanumerics only, so the id survives the endpoint's own validation. */
function randomToken(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID().replace(/-/g, '')
  }
  // Safari < 15.4 and any non-secure context have no randomUUID. Uniqueness within one
  // customer's session is all that is needed here — this id is a deduplication key, not a
  // secret, and it is never used to look anything up.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}
