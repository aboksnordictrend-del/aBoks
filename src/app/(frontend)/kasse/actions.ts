'use server'

import { createKustomOrder, getKustomOrder } from '@/lib/kustom'
import { getPayloadClient } from '@/lib/payload'
import { generateOrderNumber } from '@/lib/format'
import type { CartItem } from '@/store/cart'

const FREE_SHIPPING_THRESHOLD = 650
const SHIPPING_COST = 69
// Norwegian MVA 25% expressed in Kustom basis points
const TAX_RATE = 2500

function toOere(kr: number): number {
  return Math.round(kr * 100)
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
      name: `aBoks · ${item.colorName}`,
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

  const orderNumber = generateOrderNumber()

  const kustomOrder = await createKustomOrder({
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

  // Create a pending order in Payload CMS before payment
  const payload = await getPayloadClient()

  await payload.create({
    collection: 'orders',
    data: {
      orderNumber,
      kustomOrderId: kustomOrder.order_id,
      items: items.map((item) => ({
        variant: Number(item.variantId),
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
  const kustomOrder = await getKustomOrder(kustomOrderId)

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'orders',
    where: { kustomOrderId: { equals: kustomOrderId } },
    limit: 1,
  })

  const addr = kustomOrder.billing_address ?? kustomOrder.shipping_address

  const shippingLine = kustomOrder.order_lines.find((l) => l.type === 'shipping_fee')
  const shippingKr = shippingLine ? shippingLine.total_amount / 100 : 0

  const orderItems = kustomOrder.order_lines
    .filter((l) => l.type === 'physical')
    .map((l) => {
      const [rawName = 'aBoks', rawVariant = ''] = l.name.split(' · ')
      return {
        itemId: l.reference,
        itemName: rawName.trim(),
        itemVariant: rawVariant.trim(),
        price: l.unit_price / 100,
        quantity: l.quantity,
      }
    })

  return {
    status: kustomOrder.status,
    orderNumber: result.docs[0]?.orderNumber ?? '',
    email: addr?.email ?? '',
    totalKr: kustomOrder.order_amount / 100,
    shippingKr,
    orderItems,
  }
}
