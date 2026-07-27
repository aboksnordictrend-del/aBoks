import type { Payload } from 'payload'
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
  /**
   * Whether the referenced `promo-codes` row still exists.
   *
   * Defaults to false, and false means the `promoCode` relationship is left out of the patch
   * entirely. `orders.discount_promo_code_id` carries a foreign key, and Payload validates
   * only the *format* of a relationship id, never its existence — so writing an id for a
   * deleted promo reaches Postgres and is rejected, which would take the whole order write
   * down with it. Omitting is always safe; including is what has to be earned.
   */
  promoRecordExists = false,
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
        // Convenience only. The snapshot below is the historical truth and every renderer
        // reads `code`, so a deleted promo costs the order nothing but a clickable link.
        ...(promoRecordExists ? { promoCode: Number(promo.promoCodeId) } : {}),
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

/**
 * Does this `promo-codes` row still exist?
 *
 * A read-only existence probe, deliberately failing CLOSED: any lookup error is reported as
 * "does not exist", so a database hiccup makes the order write omit an optional relationship
 * rather than risk a foreign-key failure on a paid order.
 */
export async function promoRecordExists(
  payload: Payload,
  promoCodeId: string | number | null | undefined,
): Promise<boolean> {
  const id = typeof promoCodeId === 'string' || typeof promoCodeId === 'number' ? promoCodeId : null
  if (id == null || String(id).trim() === '') return false
  try {
    const doc = await payload.findByID({
      collection: 'promo-codes',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    return Boolean(doc)
  } catch {
    return false
  }
}

/**
 * The snapshot decision, with the promo relationship resolved against the database.
 *
 * This is what the webhook calls. `restorePromoSnapshotPatch` stays pure and directly
 * testable; this wrapper adds the one lookup needed to decide whether the optional
 * relationship may safely be written.
 */
export async function resolvePromoSnapshot(
  payload: Payload,
  kustomOrder: KustomOrder,
  order: OrderPromoSnapshotLike,
): Promise<SnapshotDecision> {
  // Cheap pre-check: only pay for the lookup when there is something to restore.
  const preview = restorePromoSnapshotPatch(kustomOrder, order, false)
  if (preview.action !== 'restore') return preview

  const paid = resolvePaidPromo(kustomOrder)
  const exists = paid.ok ? await promoRecordExists(payload, paid.promo.promoCodeId) : false
  return restorePromoSnapshotPatch(kustomOrder, order, exists)
}
