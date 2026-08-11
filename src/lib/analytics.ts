import { purchaseEventId } from '@/lib/meta/capi/eventId'
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
 */
function push(
  event: string,
  ecommerce: Record<string, unknown>,
  extra?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ ecommerce: null }) // GA4 recommended clear before each ecommerce event
  window.dataLayer.push({ event, ...extra, ecommerce })
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

export function trackAddToCart(params: {
  variantId: string
  variantName: string
  productTitle: string
  price: number
  quantity: number
}): void {
  push('add_to_cart', {
    currency: 'NOK',
    value: params.price * params.quantity,
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
  })
}

export function trackViewCart(items: CartLikeItem[], total: number): void {
  push('view_cart', {
    currency: 'NOK',
    value: total,
    items: items.map(cartItemToGA4),
  })
}

export function trackBeginCheckout(items: CartLikeItem[], total: number): void {
  push('begin_checkout', {
    currency: 'NOK',
    value: total,
    items: items.map(cartItemToGA4),
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
