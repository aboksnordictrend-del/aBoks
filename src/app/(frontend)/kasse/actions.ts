'use server'

import { createKustomOrder, getKustomOrder } from '@/lib/kustom'
import { getPayloadClient } from '@/lib/payload'
import { generateOrderNumber } from '@/lib/format'
import { allocateOrderNumber } from '@/lib/orderNumber'
import { splitLineName } from '@/lib/orderLineName'
import { resolveApplicationOrigin } from '@/lib/appOrigin'
import { buildOrderSummaryRows, type OrderSummaryRow } from '@/lib/orders/renderOrderSummary'
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
  // The origin Kustom will call back on. On a Preview deployment this is the preview's own
  // hostname, NOT the shared NEXT_PUBLIC_SERVER_URL — otherwise a Preview checkout would send
  // its confirmation and push webhook to Production and confirm a real order there.
  const serverUrl = resolveApplicationOrigin({ fallback: 'https://aboks.no' })

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
  // Summary rows come from the STORED order when it exists — that is the snapshot the
  // receipt and the e-mails print, so the confirmation page shows the same figures. Kustom
  // stays the fallback for the window before the webhook has written the order.
  let storedSummary: OrderSummaryRow[] | null = null

  try {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'orders',
      where: { kustomOrderId: { equals: kustomOrderId } },
      limit: 1,
    })
    const order = result.docs[0]
    if (order?.orderNumber) {
      orderNumber = order.orderNumber
    }
    if (order) {
      storedSummary = buildOrderSummaryRows({
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        discount: order.discount,
      })
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

  // Fallback rows, derived from the paid Kustom order, for the brief window before the
  // webhook has written the local order. Same shape, same labels.
  const kustomGrossOere = kustomOrder.order_lines
    .filter((l) => l.type === 'physical')
    .reduce((sum, l) => sum + l.unit_price * l.quantity, 0)
  const kustomDiscountOere = kustomOrder.order_lines
    .filter((l) => l.type === 'physical')
    .reduce((sum, l) => sum + (l.total_discount_amount ?? 0), 0)

  const summary =
    storedSummary ??
    buildOrderSummaryRows({
      subtotal: kustomGrossOere / 100,
      shipping: shippingKr,
      total: kustomOrder.order_amount / 100,
      discount: kustomDiscountOere > 0 ? { discountAmount: kustomDiscountOere / 100 } : null,
    })

  return {
    status: kustomOrder.status,
    orderNumber,
    email: addr?.email ?? '',
    totalKr: kustomOrder.order_amount / 100,
    shippingKr,
    orderItems,
    /** Delsum / Frakt / Rabatt (CODE) / Totalt — ready to print. */
    summary,
  }
}
