import { round2 } from './money'

/**
 * Promo-code performance, aggregated from stored usage records and paid orders.
 *
 * Every figure comes from a snapshot: the discount from the usage row written at payment, the
 * revenue from the order's stored total. The current promo configuration is used only for
 * *labels* (is it active, what type is it, when does it expire) and never to derive a
 * historical amount — a code that has since been edited, deactivated, expired or deleted
 * still reports exactly what it earned.
 *
 * Pure: takes already-fetched rows and joins them in memory, so the endpoint issues a fixed
 * number of queries regardless of how many promo codes or usages exist.
 */

/** One stored usage row, as `promo-code-usages` holds it. Never carries customer data here. */
export interface PromoUsageInput {
  /** Relationship id, when it still resolves. */
  promoCodeId?: string | null
  /** Stable identity for deduplication — the UNIQUE `orderKey` from Stage 2. */
  orderKey?: string | null
  /** The order this usage belongs to. */
  orderId?: string | null
  orderNumber?: string | null
  kustomOrderId?: string | null
  discountAmount?: number | null
  /** When the payment was confirmed. Fallback for period attribution only. */
  usedAt?: string | null
}

/** The paid orders already loaded for the period, keyed by id. */
export interface PromoOrderInput {
  id: string
  orderNumber: string
  status: string
  /** Stored paid total, in kroner. */
  paidTotal: number
  /** Stored promo code snapshot, if any. */
  promoCode?: string
  /** paidAt, else createdAt — the same date the rest of the dashboard attributes by. */
  date: string
}

/** Current configuration, for display only. Absent when the code has been deleted. */
export interface PromoCodeMeta {
  id: string
  code: string
  active?: boolean | null
  discountType?: string | null
  discountValue?: number | null
  startsAt?: string | null
  expiresAt?: string | null
}

export interface PromoUsageDetailRow {
  orderNumber: string
  orderId: string
  kustomOrderId: string
  status: string
  discountAmount: number
  orderTotal: number
  usedAt: string
}

export interface PromoPerformanceRow {
  /** The stored code — falls back to the usage/order snapshot when the record is gone. */
  code: string
  promoCodeId?: string
  /** False when the promo record no longer exists; the history is still reported. */
  exists: boolean
  active: boolean
  discountType: string
  discountValue: number | null
  startsAt?: string
  expiresAt?: string
  /** Distinct paid usages in the period. */
  uses: number
  /** Σ stored usage discount amounts. */
  discountGranted: number
  /** Σ stored paid order totals. */
  revenue: number
  /** revenue / uses, 0 when there are no uses. */
  averageOrderValue: number
  firstUsedAt?: string
  lastUsedAt?: string
  usages: PromoUsageDetailRow[]
}

export interface PromoPerformance {
  rows: PromoPerformanceRow[]
  /** Distinct codes used in the period. */
  codesUsed: number
  totalUses: number
  totalDiscount: number
  /** Paid revenue on orders that carried a promo code. */
  revenueWithPromo: number
}

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const text = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value.trim() : ''

/**
 * Deduplication key for a usage row.
 *
 * Prefers the UNIQUE `orderKey` written at registration, which is derived from the Kustom
 * order id and is therefore stable across duplicate webhook deliveries and across a
 * reconstructed order landing under a different local id. Falls back to promo+order so a
 * legacy row without the key still counts once.
 */
function usageKey(usage: PromoUsageInput): string {
  const stored = text(usage.orderKey)
  if (stored) return stored
  return `${text(usage.promoCodeId) || '?'}:${text(usage.orderId) || text(usage.kustomOrderId) || '?'}`
}

/**
 * Joins usages to the paid orders of the period.
 *
 * Period attribution follows the ORDER's date (paidAt, else createdAt) — the same rule every
 * other card on the dashboard uses — because `orders` has already been filtered to the
 * period. `usedAt` is carried through for display and as the last-resort sort key, never as
 * the primary attribution. A usage whose order is not in the set (pending, cancelled,
 * outside the period, or orphaned) contributes nothing: no use, no discount, no revenue.
 */
export function computePromoPerformance(
  usages: PromoUsageInput[],
  orders: PromoOrderInput[],
  codes: PromoCodeMeta[],
): PromoPerformance {
  const orderById = new Map(orders.map((order) => [order.id, order]))
  const metaById = new Map(codes.map((meta) => [meta.id, meta]))

  interface Bucket {
    row: PromoPerformanceRow
    seen: Set<string>
  }
  const buckets = new Map<string, Bucket>()

  for (const usage of usages) {
    const orderId = text(usage.orderId)
    const order = orderId ? orderById.get(orderId) : undefined
    // No resolvable paid order in the period → not a countable use.
    if (!order) continue

    const promoCodeId = text(usage.promoCodeId)
    const meta = promoCodeId ? metaById.get(promoCodeId) : undefined
    // Identity, in order of reliability: the live record, the order's snapshot, nothing.
    const code = text(meta?.code) || text(order.promoCode)
    if (!code) continue

    let bucket = buckets.get(code)
    if (!bucket) {
      bucket = {
        seen: new Set<string>(),
        row: {
          code,
          promoCodeId: promoCodeId || undefined,
          exists: Boolean(meta),
          active: meta?.active === true,
          discountType: text(meta?.discountType),
          discountValue: typeof meta?.discountValue === 'number' ? meta.discountValue : null,
          startsAt: text(meta?.startsAt) || undefined,
          expiresAt: text(meta?.expiresAt) || undefined,
          uses: 0,
          discountGranted: 0,
          revenue: 0,
          averageOrderValue: 0,
          usages: [],
        },
      }
      buckets.set(code, bucket)
    }

    // A duplicate webhook delivery cannot be counted twice, even if two rows somehow exist.
    const key = usageKey(usage)
    if (bucket.seen.has(key)) continue
    bucket.seen.add(key)

    const discount = num(usage.discountAmount)
    const usedAt = text(usage.usedAt) || order.date

    bucket.row.uses += 1
    bucket.row.discountGranted += discount
    bucket.row.revenue += order.paidTotal
    bucket.row.usages.push({
      orderNumber: order.orderNumber || text(usage.orderNumber),
      orderId: order.id,
      kustomOrderId: text(usage.kustomOrderId),
      status: order.status,
      discountAmount: round2(discount),
      orderTotal: round2(order.paidTotal),
      usedAt,
    })
  }

  const rows = [...buckets.values()].map(({ row }) => {
    const dates = row.usages.map((u) => u.usedAt).filter(Boolean).sort()
    return {
      ...row,
      discountGranted: round2(row.discountGranted),
      revenue: round2(row.revenue),
      averageOrderValue: row.uses > 0 ? round2(row.revenue / row.uses) : 0,
      firstUsedAt: dates[0],
      lastUsedAt: dates[dates.length - 1],
      // Newest first within a code.
      usages: [...row.usages].sort((a, b) => b.usedAt.localeCompare(a.usedAt)),
    }
  })

  // Deterministic: most revenue first, then most uses, then code — so two runs over the same
  // data always produce the same table.
  rows.sort((a, b) => b.revenue - a.revenue || b.uses - a.uses || a.code.localeCompare(b.code))

  return {
    rows,
    codesUsed: rows.length,
    totalUses: rows.reduce((sum, r) => sum + r.uses, 0),
    totalDiscount: round2(rows.reduce((sum, r) => sum + r.discountGranted, 0)),
    revenueWithPromo: round2(rows.reduce((sum, r) => sum + r.revenue, 0)),
  }
}

export const EMPTY_PROMO_PERFORMANCE: PromoPerformance = {
  rows: [],
  codesUsed: 0,
  totalUses: 0,
  totalDiscount: 0,
  revenueWithPromo: 0,
}
