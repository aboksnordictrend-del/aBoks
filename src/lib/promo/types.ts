import type { DiscountType } from './constants'

/**
 * The result contract of the promo-code validator.
 *
 * A discriminated union on `valid`, with machine-readable `reason` codes that never change
 * (the UI branches on them) and Norwegian `message` strings that are safe to show a customer
 * verbatim. A failure never leaks anything about the code beyond why *this* attempt failed —
 * no configuration, no similar codes, no usage details.
 */

export type PromoFailureReason =
  /** Nothing submitted. */
  | 'empty_code'
  /** The cart is empty, so there is nothing to discount. */
  | 'cart_empty'
  /** No promo code with this (normalised) code exists. */
  | 'not_found'
  /** Exists, but the Aktiv checkbox is off. */
  | 'inactive'
  /** Exists, but `startsAt` is in the future. */
  | 'not_started'
  /** Exists, but `expiresAt` has passed. */
  | 'expired'
  /** Stored configuration is unusable (bad value, percentage > 100, limited without maxUses). */
  | 'invalid_configuration'
  /** The eligible subtotal is below the code's `minimumOrderAmount`. */
  | 'minimum_not_reached'
  /** The code is product-restricted and the cart contains none of those products. */
  | 'no_eligible_products'
  /** A `single_use_global` code that has already been used once. */
  | 'global_usage_consumed'
  /** A `limited` code that has reached `maxUses`. */
  | 'max_uses_reached'
  /** A `once_per_customer` code this email has already used. */
  | 'already_used_by_customer'
  /** A `once_per_customer` code submitted without an email to check against. */
  | 'email_required'
  /** The usage/code lookup itself failed — a transient error, worth retrying. */
  | 'lookup_failed'

/** One cart line's share of the discount. Present for eligible lines only. */
export interface PromoLineDiscount {
  variantId: string
  productId: string
  discountOere: number
  /** The same amount in kroner, for the stored order snapshot. */
  discountAmount: number
}

export interface PromoValidationSuccess {
  valid: true
  promoCodeId: string
  /** Always the normalised (trimmed, uppercased) code. */
  code: string
  discountType: DiscountType
  discountValue: number

  // ── Kroner, for display and for the stored order snapshot ──
  /** Sum of the lines the code applies to, before discount. */
  eligibleSubtotal: number
  /** The discount actually granted — capped, never more than the eligible subtotal. */
  discountAmount: number
  /** Whole-cart goods sum before discount (equals eligibleSubtotal for unrestricted codes). */
  subtotalBeforeDiscount: number
  subtotalAfterDiscount: number
  /** Shipping, unchanged by the discount and derived from the pre-discount subtotal. */
  shipping: number
  totalBeforeDiscount: number
  totalAfterDiscount: number

  // ── Integer øre, the arithmetic truth behind the numbers above ──
  eligibleSubtotalOere: number
  discountAmountOere: number
  subtotalBeforeDiscountOere: number
  subtotalAfterDiscountOere: number
  shippingOere: number
  totalBeforeDiscountOere: number
  totalAfterDiscountOere: number

  /** Per-line split; Σ discountOere === discountAmountOere, exactly. */
  lineDiscounts: PromoLineDiscount[]
}

export interface PromoValidationFailure {
  valid: false
  reason: PromoFailureReason
  /** Norwegian, customer-facing, safe to render as-is. */
  message: string
}

export type PromoValidationResult = PromoValidationSuccess | PromoValidationFailure
