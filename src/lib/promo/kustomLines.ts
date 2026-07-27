import { VAT_RATE_BASIS_POINTS } from '@/lib/tax'
import { oereToKr, shippingForSubtotalOere, type PricedCart } from '@/lib/cartPricing'
import type { KustomOrderLine } from '@/lib/kustom'
import type { PromoValidationSuccess } from './types'

/**
 * Builds the Kustom order lines from trusted inputs, and proves the result is arithmetically
 * sound before anyone is charged.
 *
 * Pure and I/O-free: it takes a server-priced cart and (optionally) a server-validated promo
 * result, and returns the exact lines plus the totals to store locally. Nothing here reads
 * the catalogue, re-derives a discount or looks at anything the browser sent — those
 * decisions belong to `priceCart()` and `validatePromoCode()`, which have already run.
 *
 * ── Discount representation (Stage 6.5 decision: Kustom "Option A") ──
 *
 * A discount is carried on the product line itself, via `total_discount_amount`, following
 * Kustom's documented rule:
 *
 *     total_amount = (quantity × unit_price) − total_discount_amount
 *
 * `unit_price` therefore stays the ordinary catalogue price — the discount never hides
 * inside it. There is deliberately NO separate negative discount line and no
 * `type: "discount"`: that form is not specified at field level in Kustom's reference, and a
 * rejected line type would mean no promo-code customer could pay at all.
 *
 * Tax is computed from the DISCOUNTED total, because that is what the customer actually pays.
 */

/** Norwegian MVA in Kustom basis points, from the single source of truth in @/lib/tax. */
export const TAX_RATE = VAT_RATE_BASIS_POINTS

/**
 * Inclusive-VAT tax for an amount that already contains the tax.
 *
 * Algebraically identical to Kustom's documented form
 * `total_amount − total_amount × 10000 / (10000 + tax_rate)`; expressed this way it needs
 * one rounding step instead of two. Kustom accepts ±1 øre; this is exact.
 */
export function lineTaxOere(totalAmountOere: number): number {
  return Math.round((totalAmountOere * TAX_RATE) / (10000 + TAX_RATE))
}

/** Kustom's own formula, used only to verify our result stays inside its tolerance. */
export function kustomReferenceTaxOere(totalAmountOere: number): number {
  return totalAmountOere - (totalAmountOere * 10000) / (10000 + TAX_RATE)
}

/** One product line, after the discount has been applied. */
export interface BuiltProductLine {
  variantId: string
  productId: string
  displayName: string
  /** Colour label, carried through for the order snapshot. */
  variantName: string
  quantity: number
  unitPriceOere: number
  /** quantity × unit_price, before discount. */
  grossOere: number
  discountOere: number
  /** grossOere − discountOere. Never negative. */
  totalOere: number
}

/** Every trusted figure the local order and the client summary need. */
export interface TrustedTotals {
  subtotalOere: number
  discountOere: number
  shippingOere: number
  totalOere: number
  subtotal: number
  discount: number
  shipping: number
  total: number
}

export interface KustomOrderBuild {
  orderLines: KustomOrderLine[]
  orderAmountOere: number
  orderTaxAmountOere: number
  productLines: BuiltProductLine[]
  totals: TrustedTotals
}

/** Thrown when a computed order fails a check. Carries a code, never a customer message. */
export class KustomInvariantError extends Error {
  constructor(
    readonly code: string,
    detail: string,
  ) {
    super(`[kustom-invariant] ${code}: ${detail}`)
    this.name = 'KustomInvariantError'
  }
}

/**
 * Builds the order lines.
 *
 * `promo` must already be a *successful* validation of THIS cart — its `lineDiscounts` are
 * matched to cart lines by variant id, and any allocation that does not correspond to a cart
 * line is a programming error the invariants below will catch.
 */
export function buildKustomOrder(
  cart: PricedCart,
  promo: PromoValidationSuccess | null,
): KustomOrderBuild {
  const discountByVariant = new Map<string, number>(
    (promo?.lineDiscounts ?? []).map((l) => [l.variantId, l.discountOere]),
  )

  const productLines: BuiltProductLine[] = cart.lines.map((line) => {
    const grossOere = line.unitPriceOere * line.quantity
    const discountOere = discountByVariant.get(line.variantId) ?? 0
    return {
      variantId: line.variantId,
      productId: line.productId,
      displayName: line.displayName,
      variantName: line.variantName,
      quantity: line.quantity,
      unitPriceOere: line.unitPriceOere,
      grossOere,
      discountOere,
      totalOere: grossOere - discountOere,
    }
  })

  const orderLines: KustomOrderLine[] = productLines.map((line) => ({
    type: 'physical',
    reference: line.variantId,
    name: line.displayName,
    quantity: line.quantity,
    quantity_unit: 'pcs',
    // The ordinary catalogue price — the discount lives in total_discount_amount, never here.
    unit_price: line.unitPriceOere,
    tax_rate: TAX_RATE,
    total_amount: line.totalOere,
    total_discount_amount: line.discountOere,
    // Tax on what is actually paid for this line.
    total_tax_amount: lineTaxOere(line.totalOere),
  }))

  // Shipping is never discounted and is omitted entirely when free — unchanged behaviour.
  if (cart.shippingOere > 0) {
    orderLines.push({
      type: 'shipping_fee',
      reference: 'FRAKT-STD',
      name: 'Frakt',
      quantity: 1,
      quantity_unit: 'pcs',
      unit_price: cart.shippingOere,
      tax_rate: TAX_RATE,
      total_amount: cart.shippingOere,
      total_discount_amount: 0,
      total_tax_amount: lineTaxOere(cart.shippingOere),
    })
  }

  const orderAmountOere = orderLines.reduce((sum, l) => sum + l.total_amount, 0)
  const orderTaxAmountOere = orderLines.reduce((sum, l) => sum + l.total_tax_amount, 0)
  const discountOere = productLines.reduce((sum, l) => sum + l.discountOere, 0)

  return {
    orderLines,
    orderAmountOere,
    orderTaxAmountOere,
    productLines,
    totals: {
      subtotalOere: cart.subtotalOere,
      discountOere,
      shippingOere: cart.shippingOere,
      totalOere: orderAmountOere,
      subtotal: oereToKr(cart.subtotalOere),
      discount: oereToKr(discountOere),
      shipping: oereToKr(cart.shippingOere),
      total: oereToKr(orderAmountOere),
    },
  }
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/**
 * Every check that must hold before a customer is sent to a payment screen.
 *
 * Throws `KustomInvariantError` on the first failure. The caller must treat a throw as
 * "abort": no Kustom call, no local order, a generic message to the customer. These are not
 * user errors — every one of them means our own arithmetic is wrong.
 */
export function assertKustomOrderInvariants(
  build: KustomOrderBuild,
  cart: PricedCart,
  promo: PromoValidationSuccess | null,
): void {
  const { orderLines, orderAmountOere, orderTaxAmountOere, productLines } = build

  if (orderLines.length === 0) throw new KustomInvariantError('no-lines', 'order has no lines')

  // ── Integer øre everywhere ──
  for (const [i, line] of orderLines.entries()) {
    for (const field of [
      'quantity',
      'unit_price',
      'tax_rate',
      'total_amount',
      'total_discount_amount',
      'total_tax_amount',
    ] as const) {
      if (!isInt(line[field])) {
        throw new KustomInvariantError('non-integer', `line ${i} ${field}=${line[field]}`)
      }
    }
  }
  if (!isInt(orderAmountOere) || !isInt(orderTaxAmountOere)) {
    throw new KustomInvariantError(
      'non-integer',
      `order_amount=${orderAmountOere} order_tax_amount=${orderTaxAmountOere}`,
    )
  }

  // ── Per-product-line arithmetic ──
  const seen = new Set<string>()
  for (const line of productLines) {
    if (seen.has(line.variantId)) {
      throw new KustomInvariantError('duplicate-reference', `variant ${line.variantId} twice`)
    }
    seen.add(line.variantId)

    if (line.quantity < 1) {
      throw new KustomInvariantError('bad-quantity', `variant ${line.variantId} qty=${line.quantity}`)
    }
    if (line.grossOere !== line.unitPriceOere * line.quantity) {
      throw new KustomInvariantError('bad-gross', `variant ${line.variantId}`)
    }
    if (line.discountOere < 0 || line.discountOere > line.grossOere) {
      throw new KustomInvariantError(
        'discount-out-of-range',
        `variant ${line.variantId} discount=${line.discountOere} gross=${line.grossOere}`,
      )
    }
    if (line.totalOere !== line.grossOere - line.discountOere) {
      throw new KustomInvariantError('bad-line-total', `variant ${line.variantId}`)
    }
    if (line.totalOere < 0) {
      throw new KustomInvariantError('negative-line-total', `variant ${line.variantId}`)
    }
  }

  // ── Allocation matches the trusted discount exactly ──
  const allocated = productLines.reduce((sum, l) => sum + l.discountOere, 0)
  const trustedDiscount = promo?.discountAmountOere ?? 0
  if (allocated !== trustedDiscount) {
    throw new KustomInvariantError(
      'allocation-mismatch',
      `allocated=${allocated} trusted=${trustedDiscount}`,
    )
  }
  if (!promo && allocated !== 0) {
    throw new KustomInvariantError('discount-without-promo', `allocated=${allocated}`)
  }

  // ── Shipping: never discounted, always derived from the PRE-discount subtotal ──
  const shippingLines = orderLines.filter((l) => l.type === 'shipping_fee')
  if (shippingLines.length > 1) {
    throw new KustomInvariantError('multiple-shipping-lines', String(shippingLines.length))
  }
  for (const line of shippingLines) {
    if (line.total_discount_amount !== 0) {
      throw new KustomInvariantError('shipping-discounted', `discount=${line.total_discount_amount}`)
    }
    if (line.total_amount !== cart.shippingOere) {
      throw new KustomInvariantError('shipping-mismatch', `${line.total_amount} ≠ ${cart.shippingOere}`)
    }
  }
  const expectedShipping = shippingForSubtotalOere(cart.subtotalOere)
  if (cart.shippingOere !== expectedShipping) {
    throw new KustomInvariantError(
      'shipping-basis',
      `shipping=${cart.shippingOere} expected=${expectedShipping} for pre-discount subtotal ${cart.subtotalOere}`,
    )
  }
  if (cart.shippingOere === 0 && shippingLines.length !== 0) {
    throw new KustomInvariantError('free-shipping-line', 'free shipping must omit the line')
  }

  // ── Order total ──
  const summedLines = orderLines.reduce((sum, l) => sum + l.total_amount, 0)
  if (orderAmountOere !== summedLines) {
    throw new KustomInvariantError('order-amount-sum', `${orderAmountOere} ≠ ${summedLines}`)
  }
  const expectedTotal = cart.subtotalOere - trustedDiscount + cart.shippingOere
  if (orderAmountOere !== expectedTotal) {
    throw new KustomInvariantError('order-amount-formula', `${orderAmountOere} ≠ ${expectedTotal}`)
  }
  if (orderAmountOere < 0) {
    throw new KustomInvariantError('negative-order-amount', String(orderAmountOere))
  }

  // ── Tax ──
  const summedTax = orderLines.reduce((sum, l) => sum + l.total_tax_amount, 0)
  if (orderTaxAmountOere !== summedTax) {
    throw new KustomInvariantError('order-tax-sum', `${orderTaxAmountOere} ≠ ${summedTax}`)
  }
  if (orderTaxAmountOere < 0) {
    throw new KustomInvariantError('negative-order-tax', String(orderTaxAmountOere))
  }
  for (const [i, line] of orderLines.entries()) {
    const reference = kustomReferenceTaxOere(line.total_amount)
    if (Math.abs(line.total_tax_amount - reference) > 1) {
      throw new KustomInvariantError(
        'line-tax-tolerance',
        `line ${i} tax=${line.total_tax_amount} reference=${reference}`,
      )
    }
  }
}

/** The monetary shape the pending Payload order carries, for the parity check. */
export interface LocalOrderMoney {
  subtotal: number
  shipping: number
  total: number
  items: { variant?: number | null; lineTotal: number; discountAmount?: number | null }[]
  discount?: { discountAmount?: number | null } | null
}

/**
 * The local pending order and the Kustom order must describe the same money. Run before the
 * order is written; a mismatch means the customer would be charged one amount and we would
 * have recorded another.
 *
 * Note `lineTotal` is compared against the line's PRE-discount gross: the order keeps the
 * purchase price on the line and records the discount separately, which is what makes
 * `subtotal + shipping − total === discountAmount` hold for the receipt.
 */
export function assertLocalOrderParity(order: LocalOrderMoney, build: KustomOrderBuild): void {
  const toOere = (kr: number) => Math.round(kr * 100)

  if (toOere(order.subtotal) !== build.totals.subtotalOere) {
    throw new KustomInvariantError('parity-subtotal', `${order.subtotal} ≠ ${build.totals.subtotal}`)
  }
  if (toOere(order.shipping) !== build.totals.shippingOere) {
    throw new KustomInvariantError('parity-shipping', `${order.shipping} ≠ ${build.totals.shipping}`)
  }
  if (toOere(order.total) !== build.orderAmountOere) {
    throw new KustomInvariantError('parity-total', `${order.total} ≠ ${build.totals.total}`)
  }

  const snapshotDiscount = toOere(order.discount?.discountAmount ?? 0)
  if (snapshotDiscount !== build.totals.discountOere) {
    throw new KustomInvariantError(
      'parity-discount',
      `${order.discount?.discountAmount ?? 0} ≠ ${build.totals.discount}`,
    )
  }

  if (order.items.length !== build.productLines.length) {
    throw new KustomInvariantError(
      'parity-line-count',
      `${order.items.length} ≠ ${build.productLines.length}`,
    )
  }
  for (const [i, item] of order.items.entries()) {
    const line = build.productLines[i]
    if (toOere(item.lineTotal) !== line.grossOere) {
      throw new KustomInvariantError('parity-line-total', `line ${i}: ${item.lineTotal}`)
    }
    if (toOere(item.discountAmount ?? 0) !== line.discountOere) {
      throw new KustomInvariantError('parity-line-discount', `line ${i}: ${item.discountAmount ?? 0}`)
    }
  }
}
