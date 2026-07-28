import { oereToKr } from '@/lib/cartPricing'
import {
  COMMISSION_BASES,
  COMMISSION_RATE_SCALE,
  DEFAULT_COMMISSION_BASE,
  MAX_COMMISSION_RATE,
  MAX_COMMISSION_RATE_BASIS_POINTS,
  MIN_COMMISSION_RATE,
  type CommissionBase,
} from './constants'

/**
 * Partner commission — the single source of truth for what a partner code earns on a paid
 * order, and the only place that arithmetic exists.
 *
 * ── Two layers, deliberately separate ──
 *
 * 1. `validateCommissionRate` / `isCommissionBase` — **admin input validation.** These are for
 *    the promo-code form (Stage 2). They REJECT bad input with a Norwegian message, which is
 *    the right behaviour when a human is typing and can be told to fix it.
 *
 * 2. `calculateCommission` — **runtime defensive normalisation.** This runs on the paid-order
 *    path, inside the Kustom webhook, after money has already changed hands. Rejecting is not
 *    an option there: throwing would turn a promo-configuration problem into a failed usage
 *    registration on a genuinely paid order. So it never throws for any input at all — it
 *    normalises, and reports every normalisation it had to make in `adjustments` so the caller
 *    can log the anomaly instead of it vanishing.
 *
 * The two must not be confused. Layer 2 is not a validator; layer 1 is not safe to call on the
 * webhook path.
 *
 * ── Fail-closed, never fail-generous ──
 *
 * Every defensive fallback in layer 2 resolves DOWNWARDS. A missing rate, a non-finite rate,
 * a negative rate and a rate above 100 % all produce **zero commission**, not a clamp to the
 * maximum — an unreadable configuration must never be able to invent a payout. An
 * unrecognised base degrades to `orderAfterDiscount`, the smaller of the two. A discount
 * larger than the merchandise it applies to yields a base of zero, never a negative one.
 *
 * ── Money ──
 *
 * All arithmetic is integer øre, as everywhere else in this project. The rate is converted to
 * integer basis points first (10 % → 1000), so `base × rateBp` is an exact integer product and
 * there is exactly ONE rounding step, at the very end. No sum, product or base is ever
 * accumulated in decimal kroner. Kroner appear only at the storage boundary, via
 * `toCommissionSnapshotKr`.
 *
 * See `./constants.ts` for why the base is merchandise-only, shipping-free and VAT-inclusive.
 */

/* ------------------------------ admin input validation ------------------------------ */

export type CommissionRateProblem =
  /** Nothing entered, on a code that requires a rate. */
  | 'missing'
  /** Present, but not a usable number (NaN, Infinity, a string …). */
  | 'not_a_number'
  | 'below_minimum'
  | 'above_maximum'

export type CommissionRateValidation =
  | { ok: true; rate: number }
  | { ok: false; problem: CommissionRateProblem; message: string }

const RATE_MESSAGE: Record<CommissionRateProblem, string> = {
  missing: 'Provisjon (%) må fylles ut for en partnerkode.',
  not_a_number: 'Provisjon (%) må være et tall.',
  below_minimum: 'Provisjon (%) kan ikke være negativ.',
  above_maximum: `Provisjon (%) kan ikke være høyere enn ${MAX_COMMISSION_RATE}.`,
}

const rateFailure = (problem: CommissionRateProblem): CommissionRateValidation => ({
  ok: false,
  problem,
  message: RATE_MESSAGE[problem],
})

/**
 * Validates a commission rate as typed into the admin form.
 *
 * `required` reflects whether the code is a partner code: an ordinary promo code may leave the
 * field empty, a partner code may not. An empty value on a non-required field passes with a
 * rate of 0 — a code with no rate earns nothing, which is exactly what an ordinary code should
 * do if it is ever read by the calculation.
 */
export function validateCommissionRate(
  value: unknown,
  options: { required?: boolean } = {},
): CommissionRateValidation {
  const required = options.required === true

  if (value == null || value === '') {
    return required ? rateFailure('missing') : { ok: true, rate: 0 }
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) return rateFailure('not_a_number')
  if (value < MIN_COMMISSION_RATE) return rateFailure('below_minimum')
  if (value > MAX_COMMISSION_RATE) return rateFailure('above_maximum')

  return { ok: true, rate: value }
}

/** Type guard for the stored/select value. Used by admin validation, not by the calculation. */
export function isCommissionBase(value: unknown): value is CommissionBase {
  return typeof value === 'string' && (COMMISSION_BASES as readonly string[]).includes(value)
}

/* ------------------------------ runtime calculation ------------------------------ */

/**
 * Everything the calculation reads. All amounts are integer øre, taken from server-derived,
 * already-verified values — on the paid-order path that is the cross-checked
 * `TrustedPromoSnapshot`, never anything a browser sent.
 */
export interface CommissionInput {
  /** False/absent for an ordinary promo code — the overwhelmingly common case. */
  isPartnerCode?: boolean | null
  /** Percent, e.g. 10 for 10 %. */
  commissionRate?: number | null
  commissionBase?: string | null
  /** Goods subtotal BEFORE discount, gross incl. VAT, shipping excluded. */
  subtotalBeforeDiscountOere?: number | null
  discountAmountOere?: number | null
  /**
   * Accepted so a caller can pass the whole verified snapshot without picking it apart.
   * Deliberately never read into any base — see `./constants.ts`.
   */
  shippingOere?: number | null
}

/**
 * A normalisation the calculation had to perform. Every one of these means the stored
 * configuration or the snapshot was not what it should have been; none of them are errors the
 * customer or the payment flow can see, and all of them are worth logging.
 */
export type CommissionAdjustment =
  /** A partner code with no rate configured → 0 %. */
  | 'rate_missing'
  /** NaN, Infinity, or a non-number where a rate belonged → 0 %. */
  | 'rate_not_finite'
  /** Negative, or above 100 % → 0 %. Never clamped upwards. */
  | 'rate_out_of_range'
  /** An unrecognised base → `orderAfterDiscount`. */
  | 'base_unrecognised'
  /** The merchandise subtotal was missing, negative or not whole øre → treated as 0. */
  | 'subtotal_invalid'
  /** The discount was negative or not whole øre → treated as 0. */
  | 'discount_invalid'
  /** The discount exceeded the merchandise it applies to → after-discount base floored at 0. */
  | 'discount_exceeds_merchandise'

export interface CommissionResult {
  /** True only for a partner code. False means every commission figure below is 0. */
  isPartnerCommission: boolean

  /** Goods before discount, gross incl. VAT, shipping excluded. */
  merchandiseBeforeDiscountOere: number
  /** `max(before − discount, 0)`. Same basis; still no shipping. */
  merchandiseAfterDiscountOere: number
  /** The normalised discount actually used above. */
  discountAmountOere: number
  /**
   * Shipping, echoed through for the audit snapshot ONLY. It is never read into any base — the
   * two merchandise figures above are computed without it, and this field exists so the
   * storage-boundary conversion below can stay the single place øre become kroner.
   *
   * Normalised to 0 if it is not whole, non-negative øre, and deliberately without an
   * `adjustments` entry: it cannot influence a payout, and on the paid-order path it has
   * already been checked against the shipping lines Kustom actually charged.
   */
  shippingOere: number

  /** The base that was applied. Always a valid value, even when the input was not. */
  commissionBase: CommissionBase
  /** The rate that was applied, in percent. 0 for an ordinary code. */
  commissionRate: number
  /** The merchandise amount the rate was applied to. 0 for an ordinary code. */
  commissionBasisOere: number
  commissionAmountOere: number

  /** Empty in the normal case. See `CommissionAdjustment`. */
  adjustments: CommissionAdjustment[]
}

/** Whole, non-negative øre. Anything else is not money we are willing to multiply. */
const isOere = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/**
 * Percent → integer basis points, or null when the rate is unusable.
 *
 * `Math.round` on the way in absorbs the float representation of a typed decimal (12.3 × 100
 * is 1229.999… in IEEE-754, and must become 1230). Beyond two decimals of a percent the value
 * is rounded, not rejected — that precision has no meaning in a partner agreement.
 */
function toBasisPoints(rate: number): number | null {
  const bp = Math.round(rate * COMMISSION_RATE_SCALE)
  if (!Number.isFinite(bp) || bp < 0 || bp > MAX_COMMISSION_RATE_BASIS_POINTS) return null
  return bp
}

/** The one rounding step in the whole module: exact integer product, then nearest øre. */
function applyRate(baseOere: number, rateBasisPoints: number): number {
  return Math.round((baseOere * rateBasisPoints) / MAX_COMMISSION_RATE_BASIS_POINTS)
}

/**
 * Works out what a paid usage earns. Never throws, for any input.
 *
 * The merchandise figures are computed for EVERY code, partner or not — they are the financial
 * snapshot of the order and are worth storing either way. Only the commission figures depend
 * on the code being a partner code.
 */
export function calculateCommission(input: CommissionInput): CommissionResult {
  const adjustments: CommissionAdjustment[] = []

  // ── Merchandise base (shipping is not read at all) ──
  let merchandiseBeforeDiscountOere = 0
  if (isOere(input.subtotalBeforeDiscountOere)) {
    merchandiseBeforeDiscountOere = input.subtotalBeforeDiscountOere
  } else if (input.subtotalBeforeDiscountOere != null) {
    adjustments.push('subtotal_invalid')
  }

  let discountAmountOere = 0
  if (isOere(input.discountAmountOere)) {
    discountAmountOere = input.discountAmountOere
  } else if (input.discountAmountOere != null) {
    adjustments.push('discount_invalid')
  }

  // Audit passthrough. Read nowhere below this line.
  const shippingOere = isOere(input.shippingOere) ? input.shippingOere : 0

  if (discountAmountOere > merchandiseBeforeDiscountOere) {
    adjustments.push('discount_exceeds_merchandise')
  }
  const merchandiseAfterDiscountOere = Math.max(
    merchandiseBeforeDiscountOere - discountAmountOere,
    0,
  )

  // ── Ordinary promo code: a complete snapshot, and no commission ──
  // No rate/base adjustments are reported here: an ordinary code having no rate is normal, not
  // an anomaly, and reporting it would make every WELCOME10 order look misconfigured.
  if (input.isPartnerCode !== true) {
    return {
      isPartnerCommission: false,
      merchandiseBeforeDiscountOere,
      merchandiseAfterDiscountOere,
      discountAmountOere,
      shippingOere,
      commissionBase: DEFAULT_COMMISSION_BASE,
      commissionRate: 0,
      commissionBasisOere: 0,
      commissionAmountOere: 0,
      adjustments,
    }
  }

  // ── Base ──
  let commissionBase: CommissionBase = DEFAULT_COMMISSION_BASE
  if (isCommissionBase(input.commissionBase)) {
    commissionBase = input.commissionBase
  } else if (input.commissionBase != null && input.commissionBase !== '') {
    // An absent base is simply the field's default; a *wrong* one is worth surfacing.
    adjustments.push('base_unrecognised')
  }

  const commissionBasisOere =
    commissionBase === 'orderBeforeDiscount'
      ? merchandiseBeforeDiscountOere
      : merchandiseAfterDiscountOere

  // ── Rate ──
  const rawRate = input.commissionRate
  let rateBasisPoints: number | null = null

  if (rawRate == null) {
    adjustments.push('rate_missing')
  } else if (typeof rawRate !== 'number' || !Number.isFinite(rawRate)) {
    adjustments.push('rate_not_finite')
  } else {
    rateBasisPoints = toBasisPoints(rawRate)
    if (rateBasisPoints == null) adjustments.push('rate_out_of_range')
  }

  if (rateBasisPoints == null) {
    // Fail closed: an unusable rate earns nothing, and the adjustment says why.
    return {
      isPartnerCommission: true,
      merchandiseBeforeDiscountOere,
      merchandiseAfterDiscountOere,
      discountAmountOere,
      shippingOere,
      commissionBase,
      commissionRate: 0,
      commissionBasisOere,
      commissionAmountOere: 0,
      adjustments,
    }
  }

  return {
    isPartnerCommission: true,
    merchandiseBeforeDiscountOere,
    merchandiseAfterDiscountOere,
    discountAmountOere,
    shippingOere,
    commissionBase,
    commissionRate: rateBasisPoints / COMMISSION_RATE_SCALE,
    commissionBasisOere,
    commissionAmountOere: applyRate(commissionBasisOere, rateBasisPoints),
    adjustments,
  }
}

/* ------------------------------ storage boundary ------------------------------ */

/**
 * The commission result in decimal kroner — the project's storage convention for money
 * (`numeric` columns holding kroner; see `@/lib/analytics/money`).
 *
 * Field names match the snapshot columns Stage 3 will add to `promo-code-usages`, so the
 * conversion from øre to kroner happens exactly once, here, rather than at each call site.
 */
export interface CommissionSnapshotKr {
  orderAmountBeforeDiscount: number
  /**
   * Populates the EXISTING `promo-code-usages.discountAmount` column. There is deliberately no
   * second discount field: this is the same verified figure that column has always held.
   */
  discountAmount: number
  orderAmountAfterDiscount: number
  /** Audit only — no commission is ever derived from it. */
  shippingAmount: number
  commissionRateSnapshot: number
  commissionBaseSnapshot: CommissionBase
  commissionAmount: number
}

/** Øre → kroner, using the project's single conversion helper. Exact for integer øre. */
export function toCommissionSnapshotKr(result: CommissionResult): CommissionSnapshotKr {
  return {
    orderAmountBeforeDiscount: oereToKr(result.merchandiseBeforeDiscountOere),
    discountAmount: oereToKr(result.discountAmountOere),
    orderAmountAfterDiscount: oereToKr(result.merchandiseAfterDiscountOere),
    shippingAmount: oereToKr(result.shippingOere),
    commissionRateSnapshot: result.commissionRate,
    commissionBaseSnapshot: result.commissionBase,
    commissionAmount: oereToKr(result.commissionAmountOere),
  }
}
