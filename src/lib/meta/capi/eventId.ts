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
