import type { Payload, PayloadRequest } from 'payload'
import { oereToKr, toOere } from '@/lib/cartPricing'
import {
  computePartnerBalance,
  type BalanceOrderInput,
  type BalancePayoutInput,
  type BalanceUsageInput,
  type PartnerBalance,
  type UsageExclusionReason,
} from './balance'
import type { CommissionBase } from './constants'

/**
 * Read-only partner statistics for the promo-code admin page.
 *
 * ── Relationship to the Stage 4 accounting module ──
 *
 * Every monetary total here comes from `computePartnerBalance` — the same frozen, tested
 * function the payout endpoint validates against. Nothing in this file re-decides what counts:
 * it asks the balance module which usages were included, and then presents them. If the two
 * ever disagreed, the payout endpoint would be right and this display would be wrong, so the
 * inclusion set is deliberately read from the balance result rather than recomputed.
 *
 * The one figure the balance module does not produce is `revenue` (the merchandise the
 * partner actually drove). It is summed here, in integer øre, over exactly the usages the
 * balance module included — never over a set this file decided for itself.
 *
 * ── Why the fetch is not shared with `./balanceQuery.ts` ──
 *
 * That module is part of the frozen Stage 4 payout path and is left untouched. This one reads
 * the same three row sets in the same three indexed queries, then feeds the pure balance
 * function. No accounting logic is duplicated — only the `payload.find` calls.
 */

/** Where a usage sits in the statistics, in the vocabulary the UI shows. */
export type PartnerRowStatus =
  /** Counted. The value is the order's own status. */
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  /** Not counted, each for a different reason. */
  | 'cancelled'
  | 'order_missing'
  | 'legacy'
  | 'excluded'

export interface PartnerSalesRow {
  usageId: string
  /** When the payment was confirmed. */
  usedAt: string | null
  orderNumber: string | null
  /** Null on a legacy row — never invented. */
  orderAmountBeforeDiscount: number | null
  discountAmount: number | null
  /** The merchandise amount the rate was applied to, per the stored base. */
  commissionBasis: number | null
  commissionAmount: number | null
  status: PartnerRowStatus
  /** True when this row contributed to the totals above. */
  counted: boolean
}

export interface PartnerPayoutRow {
  payoutId: string
  payoutDate: string | null
  amount: number | null
  paymentMethod: string | null
  reference: string | null
}

export interface PartnerStatistics {
  /** Authoritative totals, straight from the Stage 4 accounting module. */
  balance: PartnerBalance
  /**
   * The «Omsetning» summary card: Σ merchandise AFTER discount over the INCLUDED usages —
   * the actual value of goods sold. Shipping is never part of it.
   *
   * Note that the `Omsetning` COLUMN in Salgshistorikk is the per-row amount *before*
   * discount, and is deliberately left as it is: the table shows Omsetning, Rabatt and
   * Provisjonsgrunnlag side by side, so the before-discount figure is what makes that row
   * add up. The card answers a different question — what was actually sold.
   */
  revenue: number
  counts: {
    valid: number
    excluded: number
    cancelled: number
    missingOrder: number
    legacy: number
  }
  /** Newest first. */
  sales: PartnerSalesRow[]
  /** Newest first. */
  payouts: PartnerPayoutRow[]
}

const idOf = (value: unknown): string => String(value)

const relationshipId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}

const money = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * Maps an exclusion reason onto the status the table shows.
 *
 * `not_partner_usage` cannot occur here — the query already filters to partner usages — but
 * it is mapped rather than assumed away, so an unexpected row is labelled "not counted"
 * instead of silently appearing as a valid sale.
 */
function statusFromExclusion(
  reason: UsageExclusionReason,
  orderStatus: string | null,
): PartnerRowStatus {
  if (reason === 'legacy_no_snapshot') return 'legacy'
  if (reason === 'order_missing') return 'order_missing'
  if (reason === 'order_status_excluded') return orderStatus === 'cancelled' ? 'cancelled' : 'excluded'
  return 'excluded'
}

/**
 * The amount the commission rate was applied to, reconstructed from the stored snapshot.
 *
 * Reads the base that was frozen onto the row — never the promo code's current setting — so
 * this stays correct after the code is edited. Returns null when the row has no snapshot.
 */
function commissionBasisOf(
  base: unknown,
  before: number | null,
  after: number | null,
): number | null {
  if (base === ('orderBeforeDiscount' satisfies CommissionBase)) return before
  if (base === ('orderAfterDiscount' satisfies CommissionBase)) return after
  return null
}

/** Payload treats `limit: 0` as "no limit"; pagination off so nothing is truncated. */
const ALL = { limit: 0, pagination: false as const, depth: 0, overrideAccess: true }

export interface LoadStatisticsOptions {
  req?: PayloadRequest
}

export async function loadPartnerStatistics(
  payload: Payload,
  promoCodeId: string | number,
  options: LoadStatisticsOptions = {},
): Promise<PartnerStatistics> {
  const req = options.req
  const withReq = req ? { req } : {}

  // 1 — every partner usage for this code.
  const usageResult = await payload.find({
    collection: 'promo-code-usages',
    where: {
      and: [{ promoCode: { equals: promoCodeId } }, { isPartnerUsage: { equals: true } }],
    },
    sort: '-usedAt',
    ...ALL,
    ...withReq,
  })

  const usages: BalanceUsageInput[] = usageResult.docs.map((doc) => ({
    id: doc.id,
    isPartnerUsage: doc.isPartnerUsage,
    commissionAmount: doc.commissionAmount,
    commissionBaseSnapshot: doc.commissionBaseSnapshot,
    orderAmountAfterDiscount: doc.orderAmountAfterDiscount,
    orderId: relationshipId(doc.order),
  }))

  // 2 — only the referenced orders, and only their status.
  const orderIds = [...new Set(usages.map((u) => u.orderId).filter((id): id is string => !!id))]
  let orders: BalanceOrderInput[] = []
  if (orderIds.length > 0) {
    const orderResult = await payload.find({
      collection: 'orders',
      where: { id: { in: orderIds } },
      select: { status: true },
      ...ALL,
      ...withReq,
    })
    orders = orderResult.docs.map((doc) => ({ id: doc.id, status: doc.status }))
  }

  // 3 — payouts.
  const payoutResult = await payload.find({
    collection: 'partner-payouts',
    where: { promoCode: { equals: promoCodeId } },
    sort: '-payoutDate',
    ...ALL,
    ...withReq,
  })

  const payouts: BalancePayoutInput[] = payoutResult.docs.map((doc) => ({
    id: doc.id,
    amount: doc.amount,
  }))

  // ── Authoritative totals ──
  const balance = computePartnerBalance({ usages, orders, payouts })

  const exclusionById = new Map(balance.excludedUsages.map((e) => [e.id, e.reason]))
  const orderStatusById = new Map(orders.map((o) => [idOf(o.id), o.status ?? null]))

  const counts = { valid: 0, excluded: 0, cancelled: 0, missingOrder: 0, legacy: 0 }
  let revenueOere = 0

  const sales: PartnerSalesRow[] = usageResult.docs.map((doc) => {
    const id = idOf(doc.id)
    const reason = exclusionById.get(id)
    const orderStatus = doc.order ? (orderStatusById.get(relationshipId(doc.order) ?? '') ?? null) : null

    const before = money(doc.orderAmountBeforeDiscount)
    const after = money(doc.orderAmountAfterDiscount)

    let status: PartnerRowStatus
    if (!reason) {
      // Included — the order's own status is a value the balance module has already accepted.
      status = (orderStatus as PartnerRowStatus) ?? 'confirmed'
      counts.valid += 1
      // After discount — see the note on `revenue`. An included row always has this value:
      // the balance module requires it before counting the usage at all.
      if (after != null) revenueOere += toOere(after)
    } else {
      status = statusFromExclusion(reason, orderStatus)
      counts.excluded += 1
      if (status === 'cancelled') counts.cancelled += 1
      if (status === 'order_missing') counts.missingOrder += 1
      if (status === 'legacy') counts.legacy += 1
    }

    return {
      usageId: id,
      usedAt: typeof doc.usedAt === 'string' ? doc.usedAt : null,
      orderNumber: typeof doc.orderNumber === 'string' ? doc.orderNumber : null,
      orderAmountBeforeDiscount: before,
      discountAmount: money(doc.discountAmount),
      commissionBasis: commissionBasisOf(doc.commissionBaseSnapshot, before, after),
      commissionAmount: money(doc.commissionAmount),
      status,
      counted: !reason,
    }
  })

  const payoutRows: PartnerPayoutRow[] = payoutResult.docs.map((doc) => ({
    payoutId: idOf(doc.id),
    payoutDate: typeof doc.payoutDate === 'string' ? doc.payoutDate : null,
    amount: money(doc.amount),
    paymentMethod: typeof doc.paymentMethod === 'string' ? doc.paymentMethod : null,
    reference: typeof doc.reference === 'string' ? doc.reference : null,
  }))

  return {
    balance,
    revenue: oereToKr(revenueOere),
    counts,
    sales,
    payouts: payoutRows,
  }
}
