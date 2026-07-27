'use server'

import { createKustomOrder, getKustomOrder } from '@/lib/kustom'
import { getPayloadClient } from '@/lib/payload'
import { generateOrderNumber } from '@/lib/format'
import { allocateOrderNumber } from '@/lib/orderNumber'
import { splitLineName } from '@/lib/orderLineName'
import {
  CHECKOUT_MESSAGES,
  checkoutResultFromKustomOrder,
  createTrustedCheckout,
  type CheckoutInput,
  type CheckoutResult,
} from '@/lib/promo/checkoutFlow'

/**
 * Server actions for the checkout page.
 *
 * Deliberately thin: all of the checkout logic — the trust boundary, trusted pricing, promo
 * revalidation, Kustom line construction, the invariants and the pending order — lives in
 * `@/lib/promo/checkoutFlow`, which takes its dependencies as arguments and is therefore
 * testable without the Payload config, a database or api.kustom.co.
 *
 * The browser sends only `{ items: [{ variantId, quantity }], promoCode? }`. No price, name,
 * colour, subtotal, shipping, tax, discount or total crosses this boundary.
 */
export async function initKustomCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'https://aboks.no'

  if (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) {
    console.warn(
      '[kasse] merchant_urls contain localhost — Kustom requires public HTTPS URLs. ' +
        'Set NEXT_PUBLIC_SERVER_URL to your ngrok/Vercel URL for live testing.',
    )
  }

  const payload = await getPayloadClient()

  return createTrustedCheckout(
    {
      payload,
      createOrder: createKustomOrder,
      allocateOrderNumber,
      fallbackOrderNumber: generateOrderNumber,
      serverUrl,
    },
    input,
  )
}

/** Re-opens an existing Kustom checkout (the customer came back via Kustom's own URL). */
export async function fetchExistingCheckout(orderId: string): Promise<CheckoutResult> {
  try {
    const kustomOrder = await getKustomOrder(orderId)
    return checkoutResultFromKustomOrder(kustomOrder)
  } catch (err) {
    console.error('[kasse] Kustom get order failed:', err instanceof Error ? err.message : err)
    return {
      ok: false,
      type: 'payment_unavailable',
      message: CHECKOUT_MESSAGES.paymentUnavailable,
    }
  }
}

export async function getOrderConfirmation(kustomOrderId: string) {
  // Kustom is the primary source of truth for the confirmation page.
  // Payload is queried only to enrich the orderNumber; if it fails we fall
  // back to merchant_reference (which is the orderNumber we set at CREATE_ORDER).
  const kustomOrder = await getKustomOrder(kustomOrderId)

  // merchant_reference holds the orderNumber we generated in initKustomCheckout
  let orderNumber: string = kustomOrder.merchant_reference ?? ''

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'orders',
      where: { kustomOrderId: { equals: kustomOrderId } },
      limit: 1,
    })
    if (result.docs[0]?.orderNumber) {
      orderNumber = result.docs[0].orderNumber
    }
  } catch {
    // Payload unavailable — merchant_reference is already set above
  }

  const addr = kustomOrder.billing_address ?? kustomOrder.shipping_address

  const shippingLine = kustomOrder.order_lines.find((l) => l.type === 'shipping_fee')
  const shippingKr = shippingLine ? shippingLine.total_amount / 100 : 0

  const orderItems = kustomOrder.order_lines
    .filter((l) => l.type === 'physical')
    .map((l) => {
      // GA4 wants the product and the colour apart. The line name is the variant's display
      // name ("aBoks Vegg – Mørk blå"), so split it — never assume the product is "aBoks".
      const { productName, colorName } = splitLineName(l.name)
      // `price` stays the ordinary unit price and the promo share is reported separately, as
      // GA4 expects. The event's `value` is Kustom's order_amount, which is already net, so
      // revenue is correct either way — this makes the item rows agree with it.
      const unitDiscount = l.quantity > 0 ? (l.total_discount_amount ?? 0) / l.quantity : 0
      return {
        itemId: l.reference,
        itemName: productName,
        itemVariant: colorName,
        price: l.unit_price / 100,
        ...(unitDiscount > 0 ? { discount: unitDiscount / 100 } : {}),
        quantity: l.quantity,
      }
    })

  return {
    status: kustomOrder.status,
    orderNumber,
    email: addr?.email ?? '',
    totalKr: kustomOrder.order_amount / 100,
    shippingKr,
    orderItems,
  }
}
