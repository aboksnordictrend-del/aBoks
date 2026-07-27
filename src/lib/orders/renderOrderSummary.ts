import { round2 } from '@/lib/analytics/money'

/**
 * The one place that decides which money rows an order document shows.
 *
 * Used by the confirmation email, the admin email, the PDF receipt and the confirmation page,
 * so those four can never disagree about whether an order was discounted or by how much.
 *
 * ── Historical correctness ──
 *
 * This is a *presentation* function over a stored snapshot, and nothing else. It performs no
 * catalogue lookup, no promo validation, no re-pricing and no arithmetic beyond arranging
 * numbers that were already written onto the order at purchase time. A receipt printed years
 * later therefore shows exactly what the customer paid, even if the promo code has since
 * expired or been deleted, the product price has changed, or the shipping rules have moved.
 *
 * It deliberately takes a plain object rather than a Payload `Order`, so it stays free of the
 * CMS and is trivially testable.
 */

export interface OrderSummaryDiscount {
  /** The promo code as snapshotted. Absent on a reconstructed order with no code identity. */
  code?: string | null
  /** The discount actually granted, in kroner. */
  discountAmount?: number | null
}

/** Exactly the stored fields these rows are built from — nothing live. */
export interface OrderSummaryInput {
  /** Goods total BEFORE discount, as stored. */
  subtotal: number
  shipping?: number | null
  /** The amount actually paid, as stored. */
  total: number
  discount?: OrderSummaryDiscount | null
}

export type OrderSummaryRowKey = 'subtotal' | 'shipping' | 'discount' | 'total'

export interface OrderSummaryRow {
  key: OrderSummaryRowKey
  /** Norwegian label, ready to print. `Rabatt (WELCOME10)` when a code is known. */
  label: string
  /** Kroner. Negative on the discount row, so a renderer can print it verbatim. */
  amount: number
  /** Shipping only: print "Gratis" instead of an amount. */
  free?: boolean
  /** The closing total, rendered with emphasis. */
  strong?: boolean
}

const num = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

/**
 * The discount to display, in kroner.
 *
 * Prefers the stored `discount.discountAmount` written by checkout. Falls back to the amount
 * implied by the stored figures (`subtotal + shipping − total`) — which is what the PDF
 * receipt has always inferred — so an order predating the discount group, or one an admin
 * adjusted by hand, keeps rendering exactly as it does today. Never recomputed from a promo
 * code, a percentage or a catalogue price.
 */
export function resolveDiscountAmount(order: OrderSummaryInput): number {
  const stored = num(order.discount?.discountAmount)
  if (stored > 0) return stored

  // Rounded to øre: `449 + 69 − 473.1` is 44.899999999999984 in binary floating point, and a
  // customer must never be shown that. Guarded above half an øre, which is not a discount.
  const implied = round2(num(order.subtotal) + num(order.shipping) - num(order.total))
  return implied > 0.005 ? implied : 0
}

/** `Rabatt (WELCOME10)`, or plain `Rabatt` when the order carries no code. */
export function discountLabel(code?: string | null): string {
  const trimmed = typeof code === 'string' ? code.trim() : ''
  return trimmed ? `Rabatt (${trimmed})` : 'Rabatt'
}

/**
 * The summary rows, in the order every order document prints them:
 *
 *     Delsum · Frakt · Rabatt (CODE) · Totalt
 *
 * "Delsum" is kept rather than "Produkter" because that is the label the emails, the PDF and
 * the cart already use; changing it would be a redesign, not a discount feature.
 *
 * The discount row appears **only** when there is a real discount — an order without one
 * produces precisely the three rows it produces today, with no placeholder and no empty row.
 */
export function buildOrderSummaryRows(order: OrderSummaryInput): OrderSummaryRow[] {
  const shipping = num(order.shipping)
  const discount = resolveDiscountAmount(order)

  const rows: OrderSummaryRow[] = [
    { key: 'subtotal', label: 'Delsum', amount: num(order.subtotal) },
    { key: 'shipping', label: 'Frakt', amount: shipping, free: shipping === 0 },
  ]

  if (discount > 0) {
    rows.push({
      key: 'discount',
      label: discountLabel(order.discount?.code),
      amount: -discount,
    })
  }

  rows.push({ key: 'total', label: 'Totalt', amount: num(order.total), strong: true })
  return rows
}

/** True when the order should show a discount row at all. */
export function hasDiscount(order: OrderSummaryInput): boolean {
  return resolveDiscountAmount(order) > 0
}
