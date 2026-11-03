// Prices and totals for orders an administrator creates or edits by hand in Payload Admin.
//
// Pure — no Payload, no React — so the server hook (./hooks/orderManualPricing) and the admin form
// components compute exactly the same numbers.
//
// ── The order's money model (unchanged, see src/collections/Orders.ts) ──
//
// Every amount is stored in kroner INCLUDING MVA and calculated in integer øre (@/lib/money).
//
//   lineTotal = unitPrice × quantity          — the line BEFORE any promo discount
//   subtotal  = Σ lineTotal                   — goods before discount
//   total     = subtotal + shipping − discount.discountAmount
//
// `discount.discountAmount` is the promo-code discount checkout froze onto the order (0 on every
// order without one); it never applies to shipping. MVA is never added on top — the prices already
// include it — and `vatRate` / cost / profit stay with the existing snapshot hook.
//
// ── The catalogue price ──
//
// The same function checkout charges with: the product's price through the sale rule, then its
// quantity bands (`getUnitPriceOere`, @/lib/quantityPricing). Product variants have no price of
// their own — a variant is priced by its parent product.

import { oereToKr, toOere } from '@/lib/money'
import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from '@/lib/quantityLimits'
import { getUnitPriceOere } from '@/lib/quantityPricing'

/** The product fields the catalogue price needs (`products.*`). */
export interface PricedProductDoc {
  slug?: string | null
  price?: number | null
  salePrice?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
}

export const PRICE_MISSING_MESSAGE = 'Produktet har ingen gyldig pris. Sett pris på produktet eller skriv inn en enhetspris.'
export const PRICE_INVALID_MESSAGE = 'Enhetsprisen må være et tall på 0 kr eller mer, med høyst to desimaler.'
export const QUANTITY_INVALID_MESSAGE = `Antall må være et helt tall fra ${MIN_LINE_QUANTITY} til ${MAX_LINE_QUANTITY}.`
export const SHIPPING_INVALID_MESSAGE = 'Frakt må være et tall på 0 kr eller mer.'
export const TOTAL_NEGATIVE_MESSAGE = 'Rabatten kan ikke være større enn varesummen.'

const isMoney = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** Catalogue unit price in øre for this quantity, or null when the product has no valid price. */
export function catalogueUnitPriceOere(product: PricedProductDoc | null | undefined, quantity: number): number | null {
  if (!product || !isMoney(product.price) || product.price < 0) return null
  return getUnitPriceOere(
    {
      slug: product.slug?.trim() ?? '',
      price: product.price,
      sale: { salePrice: product.salePrice, saleStartDate: product.saleStartDate, saleEndDate: product.saleEndDate },
    },
    quantity,
  )
}

/** Catalogue unit price in kroner, or null. */
export function catalogueUnitPrice(product: PricedProductDoc | null | undefined, quantity: number): number | null {
  const oere = catalogueUnitPriceOere(product, quantity)
  return oere == null ? null : oereToKr(oere)
}

/** Norwegian message, or null for a valid unit price (≥ 0, at most two decimals). */
export function validateUnitPrice(value: unknown): string | null {
  if (!isMoney(value) || value < 0) return PRICE_INVALID_MESSAGE
  return Math.abs(toOere(value) - value * 100) > 1e-6 ? PRICE_INVALID_MESSAGE : null
}

/** Norwegian message, or null for a whole quantity within the shop's limits. */
export function validateQuantity(value: unknown): string | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_LINE_QUANTITY && value <= MAX_LINE_QUANTITY
    ? null
    : QUANTITY_INVALID_MESSAGE
}

/** lineTotal in kroner = unitPrice × quantity, computed in øre. */
export function lineTotalKr(unitPrice: number, quantity: number): number {
  return oereToKr(toOere(unitPrice) * quantity)
}

export interface TotalsInput {
  lines: { unitPrice: number; quantity: number }[]
  shipping: number | null | undefined
  discountAmount: number | null | undefined
}

export interface Totals {
  lineTotals: number[]
  subtotal: number
  shipping: number
  discount: number
  total: number
}

/** All totals of an order, in kroner; computed in øre so twelve 349-kr boxes are exactly 4 188 kr. */
export function computeOrderTotals({ lines, shipping, discountAmount }: TotalsInput): Totals {
  return sumOrderTotals(
    lines.map((line) => lineTotalKr(line.unitPrice, line.quantity)),
    shipping,
    discountAmount,
  )
}

/**
 * Totals from line totals that are already known — e.g. a historical line that keeps its stored
 * `lineTotal` next to a newly priced one.
 */
export function sumOrderTotals(
  lineTotals: number[],
  shipping: number | null | undefined,
  discountAmount: number | null | undefined,
): Totals {
  const lineOere = lineTotals.map((v) => (isMoney(v) ? toOere(v) : 0))
  const subtotalOere = lineOere.reduce((sum, v) => sum + v, 0)
  const shippingOere = isMoney(shipping) && shipping > 0 ? toOere(shipping) : 0
  const discountOere = isMoney(discountAmount) && discountAmount > 0 ? toOere(discountAmount) : 0
  return {
    lineTotals: lineOere.map(oereToKr),
    subtotal: oereToKr(subtotalOere),
    shipping: oereToKr(shippingOere),
    discount: oereToKr(discountOere),
    total: oereToKr(subtotalOere + shippingOere - discountOere),
  }
}

/** Two kroner amounts are the same price (compared in øre). */
export function samePrice(a: unknown, b: unknown): boolean {
  return isMoney(a) && isMoney(b) && toOere(a) === toOere(b)
}
