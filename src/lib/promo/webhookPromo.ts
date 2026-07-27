import type { KustomOrder } from '@/lib/kustom'
import { normalizePromoCode } from './constants'
import { resolvePaidPromo } from './usageRegistration'

/**
 * Repairing a paid order's promo snapshot from the Kustom order.
 *
 * The pending order is written best-effort at checkout, so a paid order can reach the webhook
 * with its `discount` group missing or half-written. The promo identity survives in
 * `merchant_data`, and the amounts survive on the order lines, so the snapshot can be
 * restored — but only when everything agrees.
 *
 * Pure: it decides *what* to patch and returns it; the caller performs the write.
 */

export type SnapshotDecision =
  | { action: 'none'; reason: 'no_promo' | 'already_complete' | 'unusable_promo_data' }
  /** The stored code differs from the paid one — never overwritten, always surfaced. */
  | { action: 'conflict'; storedCode: string; paidCode: string }
  | { action: 'restore'; patch: Record<string, unknown> }

/** The parts of a stored order this decision reads. */
export interface OrderPromoSnapshotLike {
  discount?: {
    code?: string | null
    discountAmount?: number | null
  } | null
}

/**
 * Works out whether a confirmed order needs its promo snapshot filled in.
 *
 * Restores only when the order has no usable snapshot AND the promo data cross-checks against
 * the paid amounts (`resolvePaidPromo` does that verification). A snapshot that is already
 * complete is left exactly as it is, and a snapshot naming a different code is reported as a
 * conflict rather than silently replaced.
 */
export function restorePromoSnapshotPatch(
  kustomOrder: KustomOrder,
  order: OrderPromoSnapshotLike,
): SnapshotDecision {
  const resolved = resolvePaidPromo(kustomOrder)
  if (!resolved.ok) {
    return {
      action: 'none',
      reason: resolved.reason === 'no_merchant_data' ? 'no_promo' : 'unusable_promo_data',
    }
  }

  const promo = resolved.promo
  const storedCode = normalizePromoCode(order.discount?.code ?? '')

  if (storedCode && storedCode !== promo.code) {
    return { action: 'conflict', storedCode, paidCode: promo.code }
  }

  const hasAmount =
    typeof order.discount?.discountAmount === 'number' && order.discount.discountAmount > 0
  if (storedCode && hasAmount) {
    return { action: 'none', reason: 'already_complete' }
  }

  // Same shape the normal pending-order path writes, so a repaired order is indistinguishable
  // from one created the ordinary way.
  return {
    action: 'restore',
    patch: {
      discount: {
        promoCode: Number(promo.promoCodeId),
        code: promo.code,
        discountType: promo.type,
        discountValue: promo.value,
        discountAmount: promo.discountAmountOere / 100,
        subtotalBeforeDiscount: promo.subtotalBeforeDiscountOere / 100,
        subtotalAfterDiscount: (promo.subtotalBeforeDiscountOere - promo.discountAmountOere) / 100,
        totalBeforeDiscount: (promo.subtotalBeforeDiscountOere + promo.shippingOere) / 100,
        totalAfterDiscount: promo.totalAfterDiscountOere / 100,
      },
    },
  }
}
