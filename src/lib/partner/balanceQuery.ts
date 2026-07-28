import type { Payload, PayloadRequest } from 'payload'
import {
  computePartnerBalance,
  type BalanceOrderInput,
  type BalancePayoutInput,
  type BalanceUsageInput,
  type PartnerBalance,
} from './balance'

/**
 * The database half of the partner balance. All arithmetic lives in `./balance.ts`; this file
 * only fetches rows and hands them over.
 *
 * ── Three queries, never N+1 ──
 *
 *   1. every partner usage for this promo code          (indexed on promo_code_id)
 *   2. the orders those usages point at, in one `in` query
 *   3. every payout for this promo code
 *
 * The order statuses are fetched separately rather than with `depth: 1` on the usages: depth 1
 * would populate a whole order document per usage — items, customer info, the lot — when the
 * only thing that matters is one enum column.
 *
 * ── Why `req` is threaded through ──
 *
 * Passing the request makes these reads join whatever transaction Payload has already opened
 * for it. Today that is only consistency-of-reads; it is also the seam a stronger guard would
 * use later (recalculate + insert inside one transaction) without any of the accounting rules
 * in `./balance.ts` changing. See the concurrency note in `registerPartnerPayout.ts`.
 */

export interface LoadBalanceOptions {
  /** Threaded into every read so they share the request's transaction, when there is one. */
  req?: PayloadRequest
}

/** Payload treats `limit: 0` as "no limit"; pagination is off so nothing is silently truncated. */
const ALL = { limit: 0, pagination: false as const, depth: 0, overrideAccess: true }

const relationshipId = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}

/**
 * Everything a partner has earned and been paid, recalculated from scratch.
 *
 * Always call this immediately before acting on a balance. It is deliberately not cached: a
 * figure that was true when a screen was rendered is not a figure that may be paid out.
 */
export async function loadPartnerBalance(
  payload: Payload,
  promoCodeId: string | number,
  options: LoadBalanceOptions = {},
): Promise<PartnerBalance> {
  const req = options.req

  const usageResult = await payload.find({
    collection: 'promo-code-usages',
    where: {
      and: [{ promoCode: { equals: promoCodeId } }, { isPartnerUsage: { equals: true } }],
    },
    ...ALL,
    ...(req ? { req } : {}),
  })

  const usages: BalanceUsageInput[] = usageResult.docs.map((doc) => ({
    id: doc.id,
    isPartnerUsage: doc.isPartnerUsage,
    commissionAmount: doc.commissionAmount,
    commissionBaseSnapshot: doc.commissionBaseSnapshot,
    orderAmountAfterDiscount: doc.orderAmountAfterDiscount,
    orderId: relationshipId(doc.order),
  }))

  // Only the orders actually referenced, and only their status.
  const orderIds = [...new Set(usages.map((u) => u.orderId).filter((id): id is string => !!id))]

  let orders: BalanceOrderInput[] = []
  if (orderIds.length > 0) {
    const orderResult = await payload.find({
      collection: 'orders',
      where: { id: { in: orderIds } },
      ...ALL,
      select: { status: true },
      ...(req ? { req } : {}),
    })
    orders = orderResult.docs.map((doc) => ({ id: doc.id, status: doc.status }))
  }

  const payoutResult = await payload.find({
    collection: 'partner-payouts',
    where: { promoCode: { equals: promoCodeId } },
    ...ALL,
    ...(req ? { req } : {}),
  })

  const payouts: BalancePayoutInput[] = payoutResult.docs.map((doc) => ({
    id: doc.id,
    amount: doc.amount,
  }))

  return computePartnerBalance({ usages, orders, payouts })
}
