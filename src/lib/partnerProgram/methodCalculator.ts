import { toOere } from '@/lib/money'
import { MAX_LINE_QUANTITY } from '@/lib/quantityLimits'
import {
  baseUnitPriceOere,
  formatTierRange,
  getPricingTier,
  isQuoteThresholdReached,
  quoteThresholdFor,
  type QuantityPricedProduct,
} from '@/lib/quantityPricing'

/**
 * Illustrative arithmetic for the two earning methods on /bli-partner that are not tied to a
 * promo code: Bedriftssalg and Forhandlersalg.
 *
 * The Promokode method keeps its own module (`./calculator`), whose commission step is the
 * real engine used on paid orders. Nothing here touches that module, the commission engine,
 * checkout or a real order — these two methods have no automated tracking, so this file only
 * powers the page's examples.
 *
 * ── Bedriftssalg ──
 *
 *   1. ordinary price      = the shop's single-unit price × quantity
 *   2. − volume discount   = what the real quantity-pricing engine takes off at that quantity
 *                            (`@/lib/quantityPricing`, the same tiers checkout charges) —
 *                            never a percentage invented here
 *   3. = paid goods value  — the commission base
 *   4. commission          = 25 % of step 3
 *
 * No partner promo-code discount is applied on top.
 *
 * ── Forhandlersalg ──
 *
 *   1. ordinary retail price = the REGULAR catalogue price (`products.price`) × quantity.
 *                              A temporary sale/campaign price is deliberately ignored
 *   2. − retailer discount   = 35 % of step 1. It REPLACES every other discount: the quantity
 *                              tiers and the sale rule are not read, so nothing can stack
 *   3. = paid wholesale value — the commission base
 *   4. commission            = 15 % of step 3, per paid order from the retailer
 *
 * Bedriftssalg's «ordinary price», by contrast, is `baseUnitPriceOere` — the shop's 1–n band
 * through the existing sale rule — because the business customer pays exactly what the shop's
 * quantity tiers charge.
 *
 * Shipping is never part of any amount here, and no VAT is added or deducted: every figure is
 * the paid goods value, as on the rest of the page.
 *
 * ── Money ──
 *
 * Integer øre. Each percentage step rounds once, to the nearest øre, per order — the same rule
 * as `./calculator`. Multi-order totals multiply the rounded per-order figures.
 */

/** Commission on the paid goods value of a business sale the partner negotiated. Programme term. */
export const BUSINESS_SALE_COMMISSION_PERCENT = 25
/** Discount a registered retailer gets off the ordinary retail price. Programme term. */
export const RETAILER_DISCOUNT_PERCENT = 35
/** Commission on the paid wholesale value of each retailer order. Programme term. */
export const RETAILER_COMMISSION_PERCENT = 15

/** Input bounds for the two calculators. */
export const METHOD_CALCULATOR_LIMITS = {
  quantityMin: 1,
  quantityMax: MAX_LINE_QUANTITY,
  ordersMin: 1,
  ordersMax: 52,
} as const

/** All amounts in øre, for ONE order. */
export interface MethodSaleOrder {
  quantity: number
  /** The shop's single-unit price. */
  listUnitOere: number
  /** What one unit costs after the method's discount (rounded for display). */
  paidUnitOere: number
  /** `listUnitOere × quantity`. */
  ordinaryOere: number
  discountOere: number
  /** The commission base: what is paid for the goods. */
  paidOere: number
  commissionOere: number
  retainedOere: number
}

export interface BusinessSaleExample extends MethodSaleOrder {
  /** «20–39 stk.» — the volume band the quantity falls in. */
  tierRange: string
  /** False when the quantity is still in the ordinary 1–n band. */
  isVolumeTier: boolean
  /** True when a tailored quote is also offered at this quantity. */
  quoteOffered: boolean
  quoteThreshold: number | null
}

export interface RetailerExample {
  /** The inputs after clamping. */
  orders: number
  perOrder: MethodSaleOrder
  /** `perOrder × orders`. */
  total: MethodSaleOrder
}

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const clampWhole = (value: unknown, min: number, max: number, fallback: number): number =>
  Math.round(Math.min(Math.max(finiteOr(value, fallback), min), max))

/** `amount × percent`, rounded once to the nearest øre. */
const percentOf = (amountOere: number, percent: number): number =>
  Math.round((amountOere * Math.round(percent * 100)) / 10_000)

export const normalizeQuantity = (quantity: unknown): number =>
  clampWhole(quantity, METHOD_CALCULATOR_LIMITS.quantityMin, METHOD_CALCULATOR_LIMITS.quantityMax, 1)

export const normalizeOrders = (orders: unknown): number =>
  clampWhole(orders, METHOD_CALCULATOR_LIMITS.ordersMin, METHOD_CALCULATOR_LIMITS.ordersMax, 1)

function order(
  quantity: number,
  listUnitOere: number,
  paidOere: number,
  commissionPercent: number,
): MethodSaleOrder {
  const ordinaryOere = listUnitOere * quantity
  const commissionOere = percentOf(paidOere, commissionPercent)
  return {
    quantity,
    listUnitOere,
    paidUnitOere: Math.round(paidOere / quantity),
    ordinaryOere,
    discountOere: ordinaryOere - paidOere,
    paidOere,
    commissionOere,
    retainedOere: paidOere - commissionOere,
  }
}

/** Pure. One business order at the real volume price for `quantity` units of `product`. */
export function calculateBusinessSaleExample(
  product: QuantityPricedProduct,
  rawQuantity: unknown,
): BusinessSaleExample {
  const quantity = normalizeQuantity(rawQuantity)
  const tier = getPricingTier(product, quantity)
  // The volume price applies to every unit of the line — the engine's own rule.
  const paidOere = tier.unitPriceOere * quantity
  return {
    ...order(quantity, baseUnitPriceOere(product), paidOere, BUSINESS_SALE_COMMISSION_PERCENT),
    tierRange: formatTierRange(tier),
    isVolumeTier: tier.isVolumeTier,
    quoteOffered: isQuoteThresholdReached(product, quantity),
    quoteThreshold: quoteThresholdFor(product),
  }
}

/** Pure. `orders` identical retailer orders of `quantity` units of `product`. */
export function calculateRetailerExample(
  product: QuantityPricedProduct,
  rawQuantity: unknown,
  rawOrders: unknown = 1,
): RetailerExample {
  const quantity = normalizeQuantity(rawQuantity)
  const orders = normalizeOrders(rawOrders)
  // The regular catalogue price — never a sale price, never a volume tier.
  const listUnitOere = toOere(product.price)
  const ordinaryOere = listUnitOere * quantity
  const paidOere = ordinaryOere - percentOf(ordinaryOere, RETAILER_DISCOUNT_PERCENT)
  const perOrder = order(quantity, listUnitOere, paidOere, RETAILER_COMMISSION_PERCENT)
  const total = {} as MethodSaleOrder
  for (const key of Object.keys(perOrder) as (keyof MethodSaleOrder)[]) {
    // Unit prices stay per unit; everything else is a sum over the orders.
    total[key] = key === 'listUnitOere' || key === 'paidUnitOere' ? perOrder[key] : perOrder[key] * orders
  }
  return { orders, perOrder, total }
}

/**
 * Where the two calculators start, and the worked examples printed in each method's tab. A
 * slug missing from the catalogue falls back to the first product offered.
 */
export const METHOD_EXAMPLE_DEFAULTS = {
  business: { slug: 'aboks-office', quantity: 25 },
  retailer: { slug: 'aboks', quantity: 20, orders: 1 },
} as const
