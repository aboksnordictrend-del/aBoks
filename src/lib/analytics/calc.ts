// Pure analytics calculations. No I/O, no Payload, no dates-from-now — every input
// is passed in, so this module is fully unit-testable (see calc.test.ts).

import { percentChange, round2 } from './money'
import {
  bucketFor,
  enumerateBuckets,
  type Grouping,
  type Period,
} from './period'
import type {
  AnalyticsLine,
  AnalyticsOrder,
  Comparison,
  OrderFinancialRow,
  ProductRow,
  RecentOrder,
  Summary,
  TimelinePoint,
  VariantRow,
} from './types'

// Paid statuses, mirrored from aggregate.ts's PAID_STATUSES. Duplicated here (rather than
// imported) to keep this module free of the I/O layer and avoid an import cycle — keep the
// two in sync if the order lifecycle ever changes.
const PAID_STATUS_SET = new Set(['confirmed', 'shipped', 'delivered'])

/** Net (excl. VAT) value of a gross amount at a given VAT rate in percent. */
export function toNet(gross: number, vatRate: number): number {
  if (!vatRate) return gross
  return gross / (1 + vatRate / 100)
}

/**
 * Revenue for a line is what was actually paid for it: the catalogue value less this line's
 * share of the promo discount, which was allocated and stored at purchase.
 *
 * The discount is applied here and nowhere else — every aggregate below is built from
 * `lineGross`, so it can never be subtracted twice. Cost is deliberately untouched: a
 * discount reduces what the customer paid, not what the goods cost us. Clamped at zero so a
 * malformed legacy row can never produce negative revenue.
 */
const lineGross = (l: AnalyticsLine): number =>
  Math.max(0, l.quantity * l.unitPrice - (l.discountAllocated ?? 0))
/** Catalogue value of the line before any discount — used only to report the discount. */
const lineGrossBeforeDiscount = (l: AnalyticsLine): number => l.quantity * l.unitPrice
const lineNet = (l: AnalyticsLine): number => toNet(lineGross(l), l.vatRate)
const lineCost = (l: AnalyticsLine): number => l.quantity * l.unitCost

/** Preferred human label for a variant: live displayName, else a composed fallback. */
function variantDisplay(line: AnalyticsLine, productName: string): string {
  if (line.variantDisplayName && line.variantDisplayName.trim()) return line.variantDisplayName.trim()
  const color = line.variantName?.trim() || line.colorName?.trim()
  return color ? `${productName} – ${color}` : productName
}

/** Colour/variant label ("Sort"), independent of the product name. */
function variantLabel(line: AnalyticsLine): string {
  return line.variantName?.trim() || line.colorName?.trim() || '(uten variant)'
}

const productKeyOf = (line: AnalyticsLine): string =>
  line.productId ? `id:${line.productId}` : `name:${line.productName}`

const variantKeyOf = (line: AnalyticsLine, productKey: string): string =>
  line.variantId ? `v:${line.variantId}` : `${productKey}::${variantLabel(line)}`

export interface SummaryExtras {
  /** Cancelled orders in the period (fetched separately — never part of the revenue set). */
  cancelledOrders?: number
  /** Ex-VAT marketing spend allocated to the period (Stage 4). */
  adSpend?: number
  /** New customers acquired in the period (Stage 4). */
  newCustomers?: number
}

/**
 * Aggregate a set of orders into the summary KPIs. `extras` carries figures that come
 * from outside the order set (cancelled count, marketing spend, new customers).
 */
export function computeSummary(orders: AnalyticsOrder[], extras: SummaryExtras = {}): Summary {
  const cancelledOrders = extras.cancelledOrders ?? 0
  const adSpendInput = extras.adSpend ?? 0
  const newCustomers = extras.newCustomers ?? 0
  let productGross = 0
  let productNet = 0
  let productCost = 0
  let unitsSold = 0
  let shippingCharged = 0
  let actualShippingCost = 0
  let paymentFees = 0
  let extraCosts = 0
  let paidOrders = 0
  let discountTotal = 0

  for (const order of orders) {
    if (PAID_STATUS_SET.has(order.status)) paidOrders += 1
    shippingCharged += order.shippingCharged
    actualShippingCost += order.actualShippingCost
    paymentFees += order.paymentFee
    extraCosts += order.extraCosts
    // Reported for the promo section only. It is NOT an expense — the discount has already
    // reduced revenue through lineGross, and subtracting it again would double-count it.
    discountTotal += order.discountAmount ?? 0
    for (const line of order.lines) {
      productGross += lineGross(line)
      productNet += lineNet(line)
      productCost += lineCost(line)
      unitsSold += line.quantity
    }
  }

  const orderCount = orders.length
  const revenueGross = productGross + shippingCharged
  // Shipping is treated as a VAT-free pass-through at its charged value for now.
  const revenueNet = productNet + shippingCharged
  const vatAmount = productGross - productNet
  const grossProfit = productNet - productCost
  const marginPercent = productNet > 0 ? (grossProfit / productNet) * 100 : 0
  const adSpend = adSpendInput // ex-VAT marketing spend allocated to the period (Stage 4)
  const contributionProfit =
    revenueNet - productCost - actualShippingCost - paymentFees - adSpend - extraCosts

  return {
    orderCount,
    paidOrders,
    cancelledOrders,
    revenueGross: round2(revenueGross),
    discountTotal: round2(discountTotal),
    revenueNet: round2(revenueNet),
    vatAmount: round2(vatAmount),
    averageOrderValue: orderCount > 0 ? round2(revenueGross / orderCount) : 0,
    unitsSold,
    avgUnitsPerOrder: orderCount > 0 ? round2(unitsSold / orderCount) : 0,
    avgUnitPrice: unitsSold > 0 ? round2(productGross / unitsSold) : 0,
    productCost: round2(productCost),
    grossProfit: round2(grossProfit),
    marginPercent: round2(marginPercent),
    shippingCharged: round2(shippingCharged),
    actualShippingCost: round2(actualShippingCost),
    shippingResult: round2(shippingCharged - actualShippingCost),
    paymentFees: round2(paymentFees),
    adSpend: round2(adSpend),
    newCustomers,
    contributionProfit: round2(contributionProfit),
  }
}

/** Pair current + previous summaries into per-metric comparison entries. */
export function computeComparison(current: Summary, previous: Summary): Comparison {
  const keys = Object.keys(current) as (keyof Summary)[]
  const out = {} as Comparison
  for (const key of keys) {
    const c = current[key]
    const p = previous[key]
    out[key] = { current: c, previous: p, changePercent: percentChange(c, p) }
  }
  return out
}

/** Gap-filled timeline over the period at the given grouping. */
export function computeTimeline(
  orders: AnalyticsOrder[],
  period: Period,
  grouping: Grouping,
): TimelinePoint[] {
  const buckets = enumerateBuckets(period, grouping)
  interface Acc extends TimelinePoint {
    _net: number
  }
  const map = new Map<string, Acc>()
  for (const b of buckets) {
    map.set(b.key, {
      key: b.key,
      label: b.label,
      orders: 0,
      unitsSold: 0,
      revenue: 0,
      net: 0,
      grossProfit: 0,
      marginPercent: 0,
      _net: 0,
    })
  }

  for (const order of orders) {
    const { key } = bucketFor(new Date(order.date), grouping)
    const point = map.get(key)
    if (!point) continue // outside enumerated range — skip defensively
    point.orders += 1
    for (const line of order.lines) {
      point.revenue += lineGross(line)
      point._net += lineNet(line)
      point.grossProfit += lineNet(line) - lineCost(line)
      point.unitsSold += line.quantity
    }
    point.revenue += order.shippingCharged
    point._net += order.shippingCharged
  }

  return buckets.map((b) => {
    const p = map.get(b.key)!
    const net = round2(p._net)
    const grossProfit = round2(p.grossProfit)
    return {
      key: p.key,
      label: p.label,
      orders: p.orders,
      unitsSold: p.unitsSold,
      revenue: round2(p.revenue),
      net,
      grossProfit,
      marginPercent: net > 0 ? round2((grossProfit / net) * 100) : 0,
    }
  })
}

/* ------------------------------ Products & variants ------------------------------ */

interface VariantAgg {
  key: string
  variantId?: string
  displayName: string
  variantName: string
  colorHex?: string
  orderCount: number
  unitsSold: number
  revenueGross: number
  revenueNet: number
  cost: number
  costEstimated: boolean
  _seenOrder: string
}

interface ProductAgg {
  key: string
  productId?: string
  productName: string
  orderCount: number
  unitsSold: number
  revenueGross: number
  revenueNet: number
  cost: number
  costEstimated: boolean
  _seenOrder: string
  variants: Map<string, VariantAgg>
}

/**
 * Per-product sales table with nested per-variant rows. Products are grouped by stable
 * Product id when available (old lines without a relationship fall back to the product
 * name), variants by stable variant id (else product+colour label). Shares are computed
 * against period-wide totals; `parentUnitsShare` against the product's own units.
 */
export function computeProducts(orders: AnalyticsOrder[]): ProductRow[] {
  const products = new Map<string, ProductAgg>()
  let totalGross = 0
  let totalUnits = 0

  for (const order of orders) {
    for (const line of order.lines) {
      const gross = lineGross(line)
      const net = lineNet(line)
      const cost = lineCost(line)
      totalGross += gross
      totalUnits += line.quantity

      const pKey = productKeyOf(line)
      let p = products.get(pKey)
      if (!p) {
        p = {
          key: pKey,
          productId: line.productId,
          productName: line.productName,
          orderCount: 0,
          unitsSold: 0,
          revenueGross: 0,
          revenueNet: 0,
          cost: 0,
          costEstimated: false,
          _seenOrder: '',
          variants: new Map(),
        }
        products.set(pKey, p)
      }
      if (p._seenOrder !== order.id) {
        p.orderCount += 1
        p._seenOrder = order.id
      }
      p.unitsSold += line.quantity
      p.revenueGross += gross
      p.revenueNet += net
      p.cost += cost
      p.costEstimated = p.costEstimated || line.costEstimated

      const vKey = variantKeyOf(line, pKey)
      let v = p.variants.get(vKey)
      if (!v) {
        v = {
          key: vKey,
          variantId: line.variantId,
          displayName: variantDisplay(line, p.productName),
          variantName: variantLabel(line),
          colorHex: line.colorHex,
          orderCount: 0,
          unitsSold: 0,
          revenueGross: 0,
          revenueNet: 0,
          cost: 0,
          costEstimated: false,
          _seenOrder: '',
        }
        p.variants.set(vKey, v)
      }
      if (!v.colorHex && line.colorHex) v.colorHex = line.colorHex
      if (v._seenOrder !== order.id) {
        v.orderCount += 1
        v._seenOrder = order.id
      }
      v.unitsSold += line.quantity
      v.revenueGross += gross
      v.revenueNet += net
      v.cost += cost
      v.costEstimated = v.costEstimated || line.costEstimated
    }
  }

  const rows: ProductRow[] = [...products.values()].map((p) => {
    const grossProfit = p.revenueNet - p.cost
    const variants: VariantRow[] = [...p.variants.values()]
      .map((v) => {
        const vProfit = v.revenueNet - v.cost
        return {
          key: v.key,
          variantId: v.variantId,
          displayName: v.displayName,
          variantName: v.variantName,
          parentProductId: p.productId,
          parentProductName: p.productName,
          colorHex: v.colorHex,
          orderCount: v.orderCount,
          unitsSold: v.unitsSold,
          revenueGross: round2(v.revenueGross),
          revenueNet: round2(v.revenueNet),
          cost: round2(v.cost),
          grossProfit: round2(vProfit),
          marginPercent: round2(v.revenueNet > 0 ? (vProfit / v.revenueNet) * 100 : 0),
          parentUnitsShare: round2(p.unitsSold > 0 ? (v.unitsSold / p.unitsSold) * 100 : 0),
          unitsShare: round2(totalUnits > 0 ? (v.unitsSold / totalUnits) * 100 : 0),
          revenueShare: round2(totalGross > 0 ? (v.revenueGross / totalGross) * 100 : 0),
          costEstimated: v.costEstimated,
        }
      })
      .sort((a, b) => b.revenueGross - a.revenueGross)

    return {
      key: p.key,
      productId: p.productId,
      productName: p.productName,
      orderCount: p.orderCount,
      unitsSold: p.unitsSold,
      revenueGross: round2(p.revenueGross),
      revenueNet: round2(p.revenueNet),
      cost: round2(p.cost),
      grossProfit: round2(grossProfit),
      marginPercent: round2(p.revenueNet > 0 ? (grossProfit / p.revenueNet) * 100 : 0),
      revenueShare: round2(totalGross > 0 ? (p.revenueGross / totalGross) * 100 : 0),
      avgUnitPrice: round2(p.unitsSold > 0 ? p.revenueGross / p.unitsSold : 0),
      avgUnitsPerOrder: round2(p.orderCount > 0 ? p.unitsSold / p.orderCount : 0),
      costEstimated: p.costEstimated,
      variants,
    }
  })

  rows.sort((a, b) => b.revenueGross - a.revenueGross)
  return rows
}

/** Flat list of every variant across all products, sorted by units sold desc. */
export function flattenVariants(products: ProductRow[]): VariantRow[] {
  const rows = products.flatMap((p) => p.variants)
  rows.sort((a, b) => b.unitsSold - a.unitsSold)
  return rows
}

/** Convenience: per-variant sales derived from the product aggregation. */
export function computeVariants(orders: AnalyticsOrder[]): VariantRow[] {
  return flattenVariants(computeProducts(orders))
}

/* ------------------------------ Order-level ------------------------------ */

/** Full financial breakdown for a single order (CSV export row). */
export function computeOrderFinancials(order: AnalyticsOrder): OrderFinancialRow {
  let unitsSold = 0
  let productGross = 0
  let productGrossBefore = 0
  let productNet = 0
  let productCost = 0
  for (const line of order.lines) {
    unitsSold += line.quantity
    productGross += lineGross(line)
    productGrossBefore += lineGrossBeforeDiscount(line)
    productNet += lineNet(line)
    productCost += lineCost(line)
  }
  const revenueGross = productGross + order.shippingCharged
  const revenueNet = productNet + order.shippingCharged
  const grossProfit = productNet - productCost
  const contributionProfit =
    revenueNet - productCost - order.actualShippingCost - order.paymentFee - order.extraCosts

  return {
    orderNumber: order.orderNumber,
    date: order.date,
    status: order.status,
    // Snapshot values, blank/zero for an order without a promo.
    promoCode: order.promoCode ?? '',
    discountAmount: round2(order.discountAmount ?? 0),
    revenueBeforeDiscount: round2(productGrossBefore + order.shippingCharged),
    unitsSold,
    revenueGross: round2(revenueGross),
    revenueNet: round2(revenueNet),
    vatAmount: round2(productGross - productNet),
    productCost: round2(productCost),
    shippingCharged: round2(order.shippingCharged),
    actualShippingCost: round2(order.actualShippingCost),
    paymentFee: round2(order.paymentFee),
    extraCosts: round2(order.extraCosts),
    grossProfit: round2(grossProfit),
    contributionProfit: round2(contributionProfit),
  }
}

/** Most recent orders with just the fields the dashboard list shows (name is the only PII). */
export function computeRecentOrders(orders: AnalyticsOrder[], limit = 8): RecentOrder[] {
  return [...orders]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)
    .map((order) => {
      let unitsSold = 0
      let revenueGross = order.shippingCharged
      let net = order.shippingCharged
      let cost = 0
      for (const line of order.lines) {
        unitsSold += line.quantity
        revenueGross += lineGross(line)
        net += lineNet(line)
        cost += lineCost(line)
      }
      const grossProfit = net - cost
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        date: order.date,
        status: order.status,
        unitsSold,
        revenueGross: round2(revenueGross),
        cost: round2(cost),
        grossProfit: round2(grossProfit),
        marginPercent: round2(net > 0 ? (grossProfit / net) * 100 : 0),
      }
    })
}
