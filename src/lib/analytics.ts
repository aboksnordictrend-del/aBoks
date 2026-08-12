import { browserCapiEventId, purchaseEventId } from '@/lib/meta/capi/eventId'
import {
  currentFbclid,
  currentPageUrl,
  sendBrowserCapiEvent,
} from '@/lib/meta/capi/browserEvent'
import { resolvedLineRef } from '@/lib/cart/lineRef'

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

export interface GA4Item {
  item_id: string
  item_name: string
  item_variant?: string
  price: number
  /**
   * Promo-code discount per unit, in kroner. GA4's convention is that `price` stays the
   * ordinary unit price and the reduction is reported here, so item rows reconcile with the
   * event's `value` (which is the amount actually charged). Absent when nothing was
   * discounted.
   */
  discount?: number
  quantity: number
  item_category: string
}

// Minimal shape needed from CartItem — avoids importing the 'use client' store
interface CartLikeItem {
  /** Absent for a product that has no variants; `productId` then identifies the line. */
  variantId?: string
  productId?: string
  colorName: string
  price: number
  qty: number
}

/**
 * `extra` lands at the top level of the dataLayer push, next to `event`, rather than inside
 * `ecommerce`. That is where a GTM Data Layer Variable expects to find a non-GA4 field like
 * Meta's `event_id`, and it keeps `ecommerce` a clean GA4 payload.
 *
 * `event_id` is cleared in the same reset push as `ecommerce`, for the same reason GA4 needs
 * that reset: GTM's data model *merges* pushes, so a key that is not re-sent keeps its
 * previous value. Without the clear, an event that has no id of its own (view_item, view_cart,
 * add_shipping_info…) would be read by GTM as still carrying the id of whichever event pushed
 * one last — and a Meta tag configured with `{{DLV - event_id}}` would then stamp two
 * different actions with one id, which is precisely the collision deduplication exists to
 * avoid. Events that do push an id are unaffected: their own push follows this one.
 */
function push(
  event: string,
  ecommerce: Record<string, unknown>,
  extra?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  // GA4 recommended clear before each ecommerce event; see above for `event_id`.
  window.dataLayer.push({ ecommerce: null, event_id: null })
  window.dataLayer.push({ event, ...extra, ecommerce })
}

/**
 * Where the action happened, for the server event: the real page the customer is on — the
 * product page for an add, the cart or whichever page the drawer was opened over for a
 * checkout — never a hardcoded origin. The server keeps origin + path and drops the rest.
 *
 * `fbclid` rides along for the same reason the checkout sends it: when the Pixel was blocked
 * on the landing page there is no `_fbc` cookie to read, and Meta's documented reconstruction
 * from the click id is the only way the click is attributable at all. Nothing is invented —
 * both are simply absent when the browser has nothing to offer.
 */
function withPageContext(): { eventSourceUrl?: string; fbclid?: string } {
  const eventSourceUrl = currentPageUrl()
  const fbclid = currentFbclid()
  return {
    ...(eventSourceUrl ? { eventSourceUrl } : {}),
    ...(fbclid ? { fbclid } : {}),
  }
}

export function cartItemToGA4(item: CartLikeItem): GA4Item {
  return {
    // The line's own reference — the variant id as it has always been, or `product-<id>` for
    // a product with no variants. Reporting an empty id for those would merge every one of
    // them into a single GA4 item row.
    item_id: resolvedLineRef(item),
    item_name: 'aBoks',
    item_variant: item.colorName,
    price: item.price,
    quantity: item.qty,
    item_category: 'Battery Organizer',
  }
}

export function trackViewItem(params: {
  variantId: string
  variantName: string
  productTitle: string
  price: number
}): void {
  push('view_item', {
    currency: 'NOK',
    value: params.price,
    items: [
      {
        item_id: params.variantId,
        item_name: params.productTitle,
        item_variant: params.variantName,
        price: params.price,
        quantity: 1,
        item_category: 'Battery Organizer',
      } satisfies GA4Item,
    ],
  })
}

/**
 * add_to_cart, and the Meta AddToCart that mirrors it.
 *
 * Call this **from the click handler that actually added the line**, never from an effect: one
 * deliberate add is one event, and an effect would re-fire it on every re-render, on
 * StrictMode's second pass and again after hydration. Both call sites (the product page and
 * the cart's «Passer godt sammen med» cards) do exactly that, and each returns early before
 * reaching this line when nothing was added.
 *
 * One id is minted here and used twice — by the Pixel through GTM, and by the server event —
 * so Meta merges them into a single AddToCart.
 */
export function trackAddToCart(params: {
  variantId: string
  variantName: string
  productTitle: string
  price: number
  quantity: number
}): void {
  const eventId = browserCapiEventId('AddToCart')
  const value = params.price * params.quantity

  push(
    'add_to_cart',
    {
      currency: 'NOK',
      value,
      items: [
        {
          item_id: params.variantId,
          item_name: params.productTitle,
          item_variant: params.variantName,
          price: params.price,
          quantity: params.quantity,
          item_category: 'Battery Organizer',
        } satisfies GA4Item,
      ],
    },
    { event_id: eventId },
  )

  // The same line, the same identifier the Pixel reports as `item_id`, and the same value.
  sendBrowserCapiEvent({
    eventName: 'AddToCart',
    eventId,
    value,
    contents: [{ id: params.variantId, quantity: params.quantity, itemPrice: params.price }],
    ...withPageContext(),
  })
}

export function trackViewCart(items: CartLikeItem[], total: number): void {
  push('view_cart', {
    currency: 'NOK',
    value: total,
    items: items.map(cartItemToGA4),
  })
}

/**
 * begin_checkout, and the Meta InitiateCheckout that mirrors it.
 *
 * `value` is `total` for both halves — the one number this function is given. That is what
 * keeps the browser and server events from disagreeing: there is no second calculation of
 * shipping, discount or line sums anywhere in this path, so the two cannot drift apart. Both
 * call sites pass the cart's own order total (`orderTotal()`), which is what GA4 reports too.
 *
 * Called from the two «Gå til kassen» links, which are alternatives to each other and are
 * never clicked together.
 */
export function trackBeginCheckout(items: CartLikeItem[], total: number): void {
  const eventId = browserCapiEventId('InitiateCheckout')

  push(
    'begin_checkout',
    {
      currency: 'NOK',
      value: total,
      items: items.map(cartItemToGA4),
    },
    { event_id: eventId },
  )

  sendBrowserCapiEvent({
    eventName: 'InitiateCheckout',
    eventId,
    value: total,
    // The same line references GA4 gets as `item_id`, with each line's real quantity.
    contents: items.map((item) => ({
      id: resolvedLineRef(item),
      quantity: item.qty,
      itemPrice: item.price,
    })),
    numItems: items.reduce((count, item) => count + item.qty, 0),
    ...withPageContext(),
  })
}

export function trackAddShippingInfo(
  items: CartLikeItem[],
  total: number,
  shippingTier: string,
): void {
  push('add_shipping_info', {
    currency: 'NOK',
    value: total,
    shipping_tier: shippingTier,
    items: items.map(cartItemToGA4),
  })
}

export function trackAddPaymentInfo(items: CartLikeItem[], total: number): void {
  push('add_payment_info', {
    currency: 'NOK',
    value: total,
    payment_type: 'Kustom',
    items: items.map(cartItemToGA4),
  })
}

export function trackPurchase(params: {
  /**
   * The Kustom order id from the confirmation URL. Two jobs, and it is the same value for
   * both: the localStorage key that stops a refresh re-sending the event, and the seed of the
   * Meta `event_id` that deduplicates this event against the server's Conversions API one.
   *
   * It must be this and not `transactionId`. The order number arrives from the push webhook
   * and can be missing on the first render, so a key built from it would be `<uuid>` on the
   * first visit and `AB-xxxxxx` after a refresh — two different keys, and the purchase fired
   * twice with two different transaction ids.
   */
  kustomOrderId: string
  /** `AB-xxxxxx` where known — GA4's transaction id, unchanged. */
  transactionId: string
  value: number
  shipping: number
  items: GA4Item[]
}): void {
  if (typeof window === 'undefined') return
  // Deduplicate: prevent re-sending on page refresh
  const key = `ga4_purchase_sent_${params.kustomOrderId}`
  if (localStorage.getItem(key)) return

  push(
    'purchase',
    {
      transaction_id: params.transactionId,
      value: params.value,
      tax: 0,
      shipping: params.shipping,
      currency: 'NOK',
      items: params.items,
    },
    // Read by the Meta Pixel tag in GTM as `eventID`. Without that mapping the server event
    // and this one are two separate conversions — see gtm/META-CAPI-SETUP.md.
    { event_id: purchaseEventId(params.kustomOrderId) },
  )

  localStorage.setItem(key, '1')
}
