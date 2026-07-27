import { round2 } from './money'
import { resolveDiscountAmount } from '../orders/renderOrderSummary'
import { allocateDiscount } from '../promo/allocate'

/**
 * Resolving what a historical order was actually worth, from its stored snapshot alone.
 *
 * Analytics must never re-price an old order. Catalogue prices change, shipping rules change,
 * promo codes expire and get deleted — none of that may move a figure that has already been
 * paid. Every function here takes stored numbers and returns stored numbers; there is no path
 * to the catalogue, to promo validation or to the current promo configuration.
 *
 * Money is decimal kroner throughout, matching the Orders collection and the rest of
 * `lib/analytics`. Allocation borrows the checkout's integer-øre routine internally, because
 * that is the only way to split a discount without drift, and converts back at the boundary.
 */

/** One stored order line, exactly as the Orders collection holds it. */
export interface StoredOrderLine {
  quantity?: number | null
  /** Catalogue price at purchase — never the discounted price. */
  unitPrice?: number | null
  /** quantity × unitPrice, pre-discount. */
  lineTotal?: number | null
  /** This line's share of the order discount (Stage 7). Absent on legacy orders. */
  discountAmount?: number | null
}

/** The stored monetary shape of an order. */
export interface StoredOrderMoney {
  subtotal?: number | null
  shipping?: number | null
  total?: number | null
  discount?: { code?: string | null; discountAmount?: number | null } | null
  items?: StoredOrderLine[] | null
}

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/** quantity × unitPrice, preferring the stored lineTotal when it is present. */
export function lineGrossOf(line: StoredOrderLine): number {
  const stored = num(line.lineTotal)
  if (stored > 0) return stored
  return round2(num(line.quantity) * num(line.unitPrice))
}

/**
 * The order-level discount, in kroner, resolved from stored fields only.
 *
 * Precedence:
 *   1. the explicit stored `discount.discountAmount` (Stage 7 and the webhook write this);
 *   2. the sum of the stored per-line allocations, if the group is missing but lines carry it;
 *   3. the legacy inference `subtotal + shipping − total`.
 *
 * (1) and (3) are delegated to the same helper the receipt and e-mails use, so a document and
 * a report can never disagree about whether an order was discounted. Never negative, always
 * rounded to øre, and never dependent on the promo record still existing.
 */
export function resolveOrderDiscount(order: StoredOrderMoney): number {
  const explicit = num(order.discount?.discountAmount)
  if (explicit > 0) return round2(explicit)

  const fromLines = round2(
    (order.items ?? []).reduce((sum, line) => sum + num(line.discountAmount), 0),
  )
  if (fromLines > 0) return fromLines

  // Shared with the order documents — one inference rule, one rounding rule.
  return resolveDiscountAmount({
    subtotal: num(order.subtotal),
    shipping: num(order.shipping),
    total: num(order.total),
    discount: null,
  })
}

/**
 * Per-line discount, in kroner, one entry per line in the given order.
 *
 * Stage 7 already allocated and stored this, so it is simply read back — the discount is
 * never allocated twice. Only a legacy order that has an order-level discount but no stored
 * line shares gets a fallback split, proportional to the lines' gross values, using the same
 * largest-remainder routine as checkout so the shares always sum to exactly the order
 * discount and no line can go negative.
 */
export function resolveLineDiscounts(order: StoredOrderMoney): number[] {
  const lines = order.items ?? []
  if (lines.length === 0) return []

  const stored = lines.map((line) => round2(num(line.discountAmount)))
  if (stored.some((value) => value > 0)) return stored

  const orderDiscount = resolveOrderDiscount(order)
  if (orderDiscount <= 0) return lines.map(() => 0)

  // Legacy fallback. Integer øre so the split is exact and deterministic.
  const allocation = allocateDiscount(
    lines.map((line, index) => ({
      key: String(index),
      amountOere: Math.round(lineGrossOf(line) * 100),
    })),
    Math.round(orderDiscount * 100),
  )
  return allocation.entries.map((entry) => entry.discountOere / 100)
}

export interface StoredOrderFinancials {
  /** Goods before discount. */
  productSubtotalGross: number
  shippingGross: number
  discountGross: number
  /** What the customer actually paid. */
  paidTotalGross: number
  /** Goods after discount — the goods part of the paid total. */
  productRevenueAfterDiscount: number
  shippingRevenue: number
}

/**
 * The stored figures an order contributes to a report.
 *
 * `paidTotalGross` is the stored total wherever there is one; only an order missing it falls
 * back to the derived `subtotal + shipping − discount`. That ordering matters: the stored
 * total is the amount that actually left the customer's account.
 */
export function storedOrderFinancials(order: StoredOrderMoney): StoredOrderFinancials {
  const productSubtotalGross = round2(num(order.subtotal))
  const shippingGross = round2(num(order.shipping))
  const discountGross = resolveOrderDiscount(order)

  const storedTotal = num(order.total)
  const paidTotalGross =
    storedTotal > 0
      ? round2(storedTotal)
      : Math.max(0, round2(productSubtotalGross + shippingGross - discountGross))

  return {
    productSubtotalGross,
    shippingGross,
    discountGross,
    paidTotalGross,
    // Never negative: a legacy order with inconsistent stored figures reports zero goods
    // revenue rather than a nonsensical negative one.
    productRevenueAfterDiscount: Math.max(0, round2(productSubtotalGross - discountGross)),
    shippingRevenue: shippingGross,
  }
}
