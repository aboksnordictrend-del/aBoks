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
  quantity: number
  item_category: string
}

// Minimal shape needed from CartItem — avoids importing the 'use client' store
interface CartLikeItem {
  variantId: string
  colorName: string
  price: number
  qty: number
}

function push(event: string, ecommerce: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ ecommerce: null }) // GA4 recommended clear before each ecommerce event
  window.dataLayer.push({ event, ecommerce })
}

export function cartItemToGA4(item: CartLikeItem): GA4Item {
  return {
    item_id: item.variantId,
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
  transactionId: string
  value: number
  shipping: number
  items: GA4Item[]
}): void {
  if (typeof window === 'undefined') return
  // Deduplicate: prevent re-sending on page refresh
  const key = `ga4_purchase_sent_${params.transactionId}`
  if (localStorage.getItem(key)) return

  push('purchase', {
    transaction_id: params.transactionId,
    value: params.value,
    tax: 0,
    shipping: params.shipping,
    currency: 'NOK',
    items: params.items,
  })

  localStorage.setItem(key, '1')
}
