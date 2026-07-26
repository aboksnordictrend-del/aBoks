'use server'

import { createKustomOrder, getKustomOrder } from '@/lib/kustom'
import { getPayloadClient } from '@/lib/payload'
import { generateOrderNumber } from '@/lib/format'
import { allocateOrderNumber } from '@/lib/orderNumber'
import { splitLineName } from '@/lib/orderLineName'
import { VAT_RATE_BASIS_POINTS } from '@/lib/tax'
import type { CartItem } from '@/store/cart'

const FREE_SHIPPING_THRESHOLD = 650
const SHIPPING_COST = 69
// Norwegian MVA in Kustom basis points — single source of truth in @/lib/tax.
const TAX_RATE = VAT_RATE_BASIS_POINTS

function toOere(kr: number): number {
  return Math.round(kr * 100)
}

/**
 * Display names for the cart's variants, resolved server-side from the catalogue.
 *
 * The cart only carries a colour ("Mørk blå"), which is meaningless on its own now that
 * several products share colours — so the product name must come from the variant, never
 * from a hardcoded literal. Used for the Kustom order-line names the customer sees while
 * paying, and as the initial `displayName` on the pre-created order. Never throws: a
 * catalogue read must not be able to block checkout.
 */
async function resolveVariantDisplayNames(items: CartItem[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const ids = items.map((i) => Number(i.variantId)).filter((id) => Number.isFinite(id))
  if (!ids.length) return names

  try {
    const payload = await getPayloadClient()
    const { docs } = await payload.find({
      collection: 'product-variants',
      where: { id: { in: ids } },
      limit: ids.length,
      depth: 0,
    })
    for (const doc of docs) {
      const displayName = typeof doc.displayName === 'string' ? doc.displayName.trim() : ''
      if (displayName) names.set(String(doc.id), displayName)
    }
  } catch (err) {
    console.error(
      '[kasse] Failed to resolve variant display names:',
      err instanceof Error ? err.message : err,
    )
  }
  return names
}

// VAT is included in the price: tax = amount * rate / (10000 + rate)
function lineTax(totalAmountOere: number): number {
  return Math.round((totalAmountOere * TAX_RATE) / (10000 + TAX_RATE))
}

export async function initKustomCheckout(
  items: CartItem[],
): Promise<{ kustomOrderId: string; htmlSnippet: string }> {
  if (!items.length) throw new Error('Handlekurven er tom')

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'https://aboks.no'

  // Safe log: verify which base URL Kustom will receive — no secrets here
  console.log('[kasse] initKustomCheckout serverUrl:', serverUrl)
  if (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1')) {
    console.warn(
      '[kasse] merchant_urls contain localhost — Kustom requires public HTTPS URLs. ' +
      'Set NEXT_PUBLIC_SERVER_URL to your ngrok/Vercel URL for live testing.',
    )
  }

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0)
  const shippingKr = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST
  const total = subtotal + shippingKr

  const variantNames = await resolveVariantDisplayNames(items)
  // Falls back to the bare colour rather than guessing a product name — a wrong product
  // name is worse than a missing one, and the order's own snapshot is fixed up server-side
  // by the orders beforeChange hook regardless of what is sent to Kustom.
  const lineNameOf = (item: CartItem) => variantNames.get(item.variantId) ?? item.colorName

  const orderLines: {
    type: 'physical' | 'shipping_fee'
    reference: string
    name: string
    quantity: number
    quantity_unit: string
    unit_price: number
    tax_rate: number
    total_amount: number
    total_discount_amount: number
    total_tax_amount: number
  }[] = items.map((item) => {
    const lineTotal = toOere(item.qty * item.price)
    return {
      type: 'physical',
      reference: item.variantId,
      name: lineNameOf(item),
      quantity: item.qty,
      quantity_unit: 'pcs',
      unit_price: toOere(item.price),
      tax_rate: TAX_RATE,
      total_amount: lineTotal,
      total_discount_amount: 0,
      total_tax_amount: lineTax(lineTotal),
    }
  })

  if (shippingKr > 0) {
    const shippingOere = toOere(shippingKr)
    orderLines.push({
      type: 'shipping_fee',
      reference: 'FRAKT-STD',
      name: 'Frakt',
      quantity: 1,
      quantity_unit: 'pcs',
      unit_price: shippingOere,
      tax_rate: TAX_RATE,
      total_amount: shippingOere,
      total_discount_amount: 0,
      total_tax_amount: lineTax(shippingOere),
    })
  }

  const orderAmountOere = toOere(total)
  const orderTaxAmountOere = orderLines.reduce((s, l) => s + l.total_tax_amount, 0)

  // Allocated up front: Kustom needs it as merchant_reference before the Payload order
  // row exists. Passing it into payload.create() below means the collection's
  // assignOrderNumber hook leaves it untouched. A database hiccup here must not stop the
  // customer from paying, so an unreachable allocator degrades to the old random number.
  let orderNumber: string
  try {
    orderNumber = await allocateOrderNumber(await getPayloadClient())
  } catch (err) {
    console.error('[kasse] Failed to allocate order number:', err instanceof Error ? err.message : err)
    orderNumber = generateOrderNumber()
  }

  let kustomOrder
  try {
    kustomOrder = await createKustomOrder({
      purchase_country: 'NO',
      purchase_currency: 'NOK',
      locale: 'nb-NO',
      order_amount: orderAmountOere,
      order_tax_amount: orderTaxAmountOere,
      order_lines: orderLines,
      merchant_urls: {
        terms: `${serverUrl}/kjopsvilkar`,
        checkout: `${serverUrl}/kasse?order_id={checkout.order.id}`,
        confirmation: `${serverUrl}/kasse/bekreftelse?order_id={checkout.order.id}`,
        push: `${serverUrl}/api/kustom/webhook?order_id={checkout.order.id}`,
      },
      merchant_reference: orderNumber,
      billing_countries: ['NO'],
      shipping_countries: ['NO'],
    })
  } catch (err) {
    console.error('[kasse] Kustom create order failed:', err instanceof Error ? err.message : err)
    throw new Error('Betalingstjenesten er ikke tilgjengelig akkurat nå. Prøv igjen om litt.')
  }

  // Detect account-level misconfiguration: no checkout widget AND no payment
  // methods enabled on the merchant account in the Kustom Portal.
  // Note: html_snippet === 'deducted' is normal — it is not an error indicator.
  const noPaymentMethods =
    (kustomOrder.external_payment_methods?.length ?? 0) === 0 &&
    (kustomOrder.external_checkouts?.length ?? 0) === 0
  if (!kustomOrder.html_snippet && noPaymentMethods) {
    console.error(
      '[kasse] Kustom returned no usable checkout widget. ' +
      'html_snippet=%s external_payment_methods=%d external_checkouts=%d — ' +
      'Enable payment methods in the Kustom Portal under Elements/Integrations.',
      kustomOrder.html_snippet,
      kustomOrder.external_payment_methods?.length ?? 0,
      kustomOrder.external_checkouts?.length ?? 0,
    )
    throw new Error(
      'Ingen betalingsmetoder er aktivert for nettbutikken. Kontakt oss på post@aboks.no for hjelp.',
    )
  }

  // Create a pending order in Payload CMS before payment.
  // This is non-blocking: a DB failure must not prevent the checkout widget from loading.
  // The webhook will attempt to re-create/update the order after payment completes.
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'orders',
      data: {
        orderNumber,
        kustomOrderId: kustomOrder.order_id,
        items: items.map((item) => ({
          variant: Number(item.variantId),
          displayName: lineNameOf(item),
          variantName: item.colorName,
          quantity: item.qty,
          unitPrice: item.price,
          lineTotal: item.qty * item.price,
        })),
        subtotal,
        shipping: shippingKr,
        total,
        status: 'pending',
      },
    })
  } catch (err) {
    // Log the error but do not block checkout — the user can still pay.
    console.error('[kasse] Failed to pre-create order in Payload CMS:', err instanceof Error ? err.message : err)
  }

  return {
    kustomOrderId: kustomOrder.order_id,
    htmlSnippet: kustomOrder.html_snippet ?? '',
  }
}

export async function fetchExistingCheckout(
  orderId: string,
): Promise<{ kustomOrderId: string; htmlSnippet: string }> {
  const kustomOrder = await getKustomOrder(orderId)
  return {
    kustomOrderId: kustomOrder.order_id,
    htmlSnippet: kustomOrder.html_snippet ?? '',
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
      return {
        itemId: l.reference,
        itemName: productName,
        itemVariant: colorName,
        price: l.unit_price / 100,
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
