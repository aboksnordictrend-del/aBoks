import type { Payload, Where } from 'payload'
import { formatPrice } from '@/lib/format'
import { oereToKr, toOere, type PricedCart, type PricedLine } from '@/lib/cartPricing'
import {
  DISCOUNT_TYPES,
  USAGE_MODES,
  normalizeCustomerEmail,
  normalizePromoCode,
  type DiscountType,
  type UsageMode,
} from './constants'
import { allocateDiscount } from './allocate'
import { PROMO_UNSUPPORTED_MESSAGE, checkPromoLaunchSupport } from './supportPolicy'
import type {
  PromoFailureReason,
  PromoLineDiscount,
  PromoValidationResult,
  PromoValidationSuccess,
} from './types'

/**
 * The promo-code validator — the single source of truth for whether a code applies and what
 * it is worth.
 *
 * Used by the public validation endpoint, by checkout creation and by any later server-side
 * revalidation. There is deliberately no second implementation anywhere: a discount shown in
 * the cart, a discount sent to Kustom and a discount stored on the order are all this
 * function's output, computed from the same trusted `PricedCart`.
 *
 * ── Advisory, not a reservation ──
 *
 * The usage checks below (single-use, limited, once-per-customer) READ existing usage rows.
 * They do not reserve, lock or register anything, and they are only ever a snapshot of the
 * moment they ran. A code that validates here can still lose a race: two customers can both
 * pass validation on the last remaining use, and both can go on to pay.
 *
 * The authoritative decision is made once, after payment is confirmed, by the atomic
 * registration step (Stage 9) — the UNIQUE indexes on `promo_code_usages.order_key` and
 * `.uniqueness_key` are what actually make "only once" true. Everything here is a courtesy
 * to the customer: it stops the overwhelmingly common case (a code that is plainly used up)
 * before they reach the payment screen. Nothing in this file may be treated as a guarantee.
 */

const FAILURE_MESSAGE: Record<Exclude<PromoFailureReason, 'minimum_not_reached'>, string> = {
  empty_code: 'Skriv inn en rabattkode.',
  cart_empty: 'Handlekurven er tom.',
  // Deliberately identical for "no such code" and "not active yet/anymore" would leak too
  // much; but an expired code is a real, useful thing to tell a customer, so these stay
  // distinct. None of them reveal anything about codes the customer did not type.
  not_found: 'Ukjent rabattkode.',
  inactive: 'Denne rabattkoden er ikke aktiv.',
  not_started: 'Denne rabattkoden er ikke gyldig ennå.',
  expired: 'Denne rabattkoden er utløpt.',
  invalid_configuration: 'Denne rabattkoden kan ikke brukes. Ta gjerne kontakt med oss.',
  not_supported: PROMO_UNSUPPORTED_MESSAGE,
  no_eligible_products: 'Rabattkoden gjelder ikke produktene i handlekurven.',
  global_usage_consumed: 'Denne rabattkoden er allerede brukt.',
  max_uses_reached: 'Denne rabattkoden er brukt opp.',
  already_used_by_customer: 'Du har allerede brukt denne rabattkoden.',
  email_required: 'Denne rabattkoden krever at du oppgir e-postadressen din.',
  lookup_failed: 'Vi klarte ikke å sjekke rabattkoden akkurat nå. Prøv igjen.',
}

function fail(reason: Exclude<PromoFailureReason, 'minimum_not_reached'>): PromoValidationResult {
  return { valid: false, reason, message: FAILURE_MESSAGE[reason] }
}

function failMinimum(minimumKr: number): PromoValidationResult {
  return {
    valid: false,
    reason: 'minimum_not_reached',
    message: `Rabattkoden krever en varesum på minst ${formatPrice(minimumKr)}.`,
  }
}

export interface PromoValidationInput {
  /** Exactly what the customer typed. Normalised here — never normalise it at the caller. */
  code: string
  /** Server-priced cart. Client prices must never reach this function. */
  cart: PricedCart
  /** Customer email when known. Normalised here. Required for once-per-customer codes. */
  email?: string | null
  /**
   * The order being (re)validated, when one already exists. Its own usage row is excluded
   * from the usage counts, so revalidating an order that already consumed the code does not
   * report the code as used up by itself.
   */
  orderId?: string | number | null
}

/** The subset of the promo-code document this function reads. */
type PromoCodeDoc = {
  id: number | string
  code?: string | null
  active?: boolean | null
  discountType?: string | null
  discountValue?: number | null
  usageMode?: string | null
  maxUses?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  minimumOrderAmount?: number | null
  /** At depth 0 this is a list of product ids. */
  applicableProducts?: (number | string | { id: number | string })[] | null
}

const productIdOf = (rel: number | string | { id: number | string }): string =>
  typeof rel === 'object' ? String(rel.id) : String(rel)

/** A finite timestamp, or null for an unset/unparseable date. */
function timestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/** Rows in `promo-code-usages` matching `where`, counted without fetching them. */
async function countUsages(payload: Payload, where: Where): Promise<number> {
  const result = await payload.find({
    collection: 'promo-code-usages',
    where,
    depth: 0,
    limit: 1,
    pagination: true,
    overrideAccess: true,
  })
  return result.totalDocs
}

/** `promoCode = id`, plus "not this order" when an order id was supplied. */
function usageWhere(promoCodeId: string, orderId?: string | number | null): Where {
  const clauses: Where[] = [{ promoCode: { equals: promoCodeId } }]
  if (orderId != null && String(orderId).trim() !== '') {
    clauses.push({ order: { not_equals: String(orderId) } })
  }
  return clauses.length === 1 ? clauses[0] : { and: clauses }
}

/**
 * Checks whether the code's usage allowance is already spent. Read-only — see the "advisory"
 * note in the file header. Returns a failure reason, or null when there is room left.
 */
async function checkUsage(
  payload: Payload,
  promoCodeId: string,
  usageMode: UsageMode,
  maxUses: number | null,
  normalizedEmail: string,
  orderId?: string | number | null,
): Promise<PromoFailureReason | null> {
  if (usageMode === 'unlimited') return null

  if (usageMode === 'single_use_global') {
    const used = await countUsages(payload, usageWhere(promoCodeId, orderId))
    return used > 0 ? 'global_usage_consumed' : null
  }

  if (usageMode === 'limited') {
    // Configuration was already checked; maxUses is a positive integer here.
    const used = await countUsages(payload, usageWhere(promoCodeId, orderId))
    return used >= (maxUses as number) ? 'max_uses_reached' : null
  }

  // once_per_customer — the email IS the identity, so without one there is nothing to check
  // and the code cannot be honoured.
  if (!normalizedEmail) return 'email_required'

  const base = usageWhere(promoCodeId, orderId)
  const where: Where = {
    and: [...('and' in base && base.and ? base.and : [base]), { email: { equals: normalizedEmail } }],
  }
  const used = await countUsages(payload, where)
  return used > 0 ? 'already_used_by_customer' : null
}

/**
 * The gross discount the code asks for, before capping, in øre.
 *
 * Percentage: applied to the eligible subtotal only, never to shipping. `value` may be
 * fractional (12.5 %); the multiplication happens on an integer øre amount and is rounded
 * once, at the end — so 10 % of 449 kr is 4490 øre, not 4489.999….
 *
 * Fixed: a kroner amount, converted with the same single rounding step everything else uses.
 */
function grossDiscountOere(
  discountType: DiscountType,
  discountValue: number,
  eligibleSubtotalOere: number,
): number {
  if (discountType === 'percentage') {
    return Math.round((eligibleSubtotalOere * discountValue) / 100)
  }
  return toOere(discountValue)
}

export async function validatePromoCode(
  payload: Payload,
  input: PromoValidationInput,
): Promise<PromoValidationResult> {
  const code = normalizePromoCode(input.code)
  if (!code) return fail('empty_code')

  const cart = input.cart
  if (!cart || !Array.isArray(cart.lines) || cart.lines.length === 0) return fail('cart_empty')

  const normalizedEmail = normalizeCustomerEmail(input.email)

  // ── Look the code up (case-insensitive by construction: codes are stored uppercase) ──
  let doc: PromoCodeDoc | undefined
  try {
    const result = await payload.find({
      collection: 'promo-codes',
      where: { code: { equals: code } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    doc = result.docs[0] as unknown as PromoCodeDoc | undefined
  } catch (err) {
    payload.logger?.error?.(
      `[promo] code lookup failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return fail('lookup_failed')
  }

  if (!doc) return fail('not_found')
  const promoCodeId = String(doc.id)

  // ── State ──
  if (doc.active !== true) return fail('inactive')

  const now = Date.now()
  const startsAt = timestamp(doc.startsAt)
  if (startsAt != null && now < startsAt) return fail('not_started')

  const expiresAt = timestamp(doc.expiresAt)
  if (expiresAt != null && now >= expiresAt) return fail('expired')

  // ── Configuration ──
  // Admin validation should make all of this impossible, but a code is money: a row edited
  // directly in the database must fail closed rather than grant an unbounded discount.
  const discountType = doc.discountType as DiscountType
  if (!DISCOUNT_TYPES.includes(discountType)) return fail('invalid_configuration')

  const discountValue = doc.discountValue
  if (typeof discountValue !== 'number' || !Number.isFinite(discountValue) || discountValue <= 0) {
    return fail('invalid_configuration')
  }
  if (discountType === 'percentage' && discountValue > 100) return fail('invalid_configuration')

  const usageMode = doc.usageMode as UsageMode
  if (!USAGE_MODES.includes(usageMode)) return fail('invalid_configuration')

  const maxUses = typeof doc.maxUses === 'number' ? doc.maxUses : null
  if (usageMode === 'limited' && (maxUses == null || !Number.isInteger(maxUses) || maxUses < 1)) {
    return fail('invalid_configuration')
  }

  // ── First-launch policy ──
  // Enforced here, in the authoritative validator, so it holds for the public endpoint, for
  // checkout and for any future internal caller alike — not just for the admin form. A row
  // that predates the policy, or was written straight to the database, is refused too.
  const support = checkPromoLaunchSupport({ usageMode: doc.usageMode, maxUses: doc.maxUses })
  if (!support.supported) {
    payload.logger?.warn?.(
      `[promo] code ${promoCodeId} refused: ${support.reason} (usageMode=${doc.usageMode ?? 'null'}, maxUses=${doc.maxUses ?? 'null'})`,
    )
    return fail('not_supported')
  }

  // ── Which lines the code applies to ──
  const restrictedTo = new Set((doc.applicableProducts ?? []).map(productIdOf))
  const eligibleLines: PricedLine[] =
    restrictedTo.size === 0 ? cart.lines : cart.lines.filter((l) => restrictedTo.has(l.productId))

  const eligibleSubtotalOere = eligibleLines.reduce((sum, l) => sum + l.lineTotalOere, 0)
  if (eligibleSubtotalOere <= 0) return fail('no_eligible_products')

  // Minimum is measured against the *eligible* lines, before discount and before shipping —
  // for an unrestricted code (the normal case) that is simply the cart subtotal.
  const minimumKr = doc.minimumOrderAmount
  if (typeof minimumKr === 'number' && minimumKr > 0) {
    if (eligibleSubtotalOere < toOere(minimumKr)) return failMinimum(minimumKr)
  }

  // ── Usage allowance (advisory — see the file header) ──
  let usageFailure: PromoFailureReason | null
  try {
    usageFailure = await checkUsage(
      payload,
      promoCodeId,
      usageMode,
      maxUses,
      normalizedEmail,
      input.orderId,
    )
  } catch (err) {
    payload.logger?.error?.(
      `[promo] usage lookup failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return fail('lookup_failed')
  }
  if (usageFailure) return fail(usageFailure as Exclude<PromoFailureReason, 'minimum_not_reached'>)

  // ── Amounts ──
  // Capped twice over: never more than the eligible lines can absorb, never negative.
  const requestedOere = grossDiscountOere(discountType, discountValue, eligibleSubtotalOere)
  const discountAmountOere = Math.max(0, Math.min(requestedOere, eligibleSubtotalOere))

  const allocation = allocateDiscount(
    eligibleLines.map((l) => ({ key: l.variantId, amountOere: l.lineTotalOere })),
    discountAmountOere,
  )
  const discountByVariant = new Map(allocation.entries.map((e) => [e.key, e.discountOere]))

  const lineDiscounts: PromoLineDiscount[] = eligibleLines.map((line) => {
    const discountOere = discountByVariant.get(line.variantId) ?? 0
    return {
      variantId: line.variantId,
      productId: line.productId,
      discountOere,
      discountAmount: oereToKr(discountOere),
    }
  })

  // Shipping is never touched, and was decided from the pre-discount subtotal upstream in
  // priceCart — a promo code can neither buy free shipping nor take it away.
  const subtotalBeforeDiscountOere = cart.subtotalOere
  const subtotalAfterDiscountOere = subtotalBeforeDiscountOere - allocation.totalAllocatedOere
  const totalBeforeDiscountOere = cart.totalOere
  const totalAfterDiscountOere = totalBeforeDiscountOere - allocation.totalAllocatedOere

  const success: PromoValidationSuccess = {
    valid: true,
    promoCodeId,
    code,
    discountType,
    discountValue,

    eligibleSubtotal: oereToKr(eligibleSubtotalOere),
    discountAmount: oereToKr(allocation.totalAllocatedOere),
    subtotalBeforeDiscount: oereToKr(subtotalBeforeDiscountOere),
    subtotalAfterDiscount: oereToKr(subtotalAfterDiscountOere),
    shipping: oereToKr(cart.shippingOere),
    totalBeforeDiscount: oereToKr(totalBeforeDiscountOere),
    totalAfterDiscount: oereToKr(totalAfterDiscountOere),

    eligibleSubtotalOere,
    discountAmountOere: allocation.totalAllocatedOere,
    subtotalBeforeDiscountOere,
    subtotalAfterDiscountOere,
    shippingOere: cart.shippingOere,
    totalBeforeDiscountOere,
    totalAfterDiscountOere,

    lineDiscounts,
  }

  return success
}
