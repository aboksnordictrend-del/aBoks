/**
 * Shared promo-code vocabulary: the two enum value sets, their Norwegian admin labels, and
 * the normalisation rules every part of the system must agree on.
 *
 * Deliberately dependency-free (no Payload import), so the collections, the validation
 * service and the usage writer can all import it without pulling the CMS — and so the
 * normalisation rules exist in exactly one place. A code entered as " welcome10 " in the
 * cart and a code saved as "Welcome10" in the admin must resolve to the same string.
 */

export const DISCOUNT_TYPES = ['percentage', 'fixed'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

export const DISCOUNT_TYPE_OPTIONS: { label: string; value: DiscountType }[] = [
  { label: 'Prosent', value: 'percentage' },
  { label: 'Fast beløp', value: 'fixed' },
]

export const USAGE_MODES = [
  'unlimited',
  'single_use_global',
  'once_per_customer',
  'limited',
] as const
export type UsageMode = (typeof USAGE_MODES)[number]

export const USAGE_MODE_OPTIONS: { label: string; value: UsageMode }[] = [
  { label: 'Ubegrenset', value: 'unlimited' },
  { label: 'Kun én gang totalt', value: 'single_use_global' },
  { label: 'Én gang per kunde', value: 'once_per_customer' },
  { label: 'Begrenset antall ganger', value: 'limited' },
]

/** The only currency the shop sells in. Snapshotted on every usage record. */
export const PROMO_CURRENCY = 'NOK'

/** Trim + uppercase. The stored form of every code, and the form every lookup uses. */
export function normalizePromoCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

/** Trim + lowercase. The stored form of the email on a usage record. */
export function normalizeCustomerEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/**
 * Per-order key — UNIQUE in the database, so one order can never register the same promo
 * code twice however many times the Kustom webhook is delivered.
 */
export function usageOrderKey(promoCodeId: number | string, orderId: number | string): string {
  return `order:${promoCodeId}:${orderId}`
}

/**
 * Mode-dependent key — also UNIQUE, which is what enforces the two "only once" rules at the
 * database level rather than in application logic:
 *
 *   single_use_global  → one row per promo code, ever
 *   once_per_customer  → one row per (promo code, normalised email)
 *   unlimited/limited  → null; Postgres allows unlimited NULLs under a unique index, so
 *                        these modes are simply not constrained by it
 *
 * `limited` cannot be expressed as a constraint (the ceiling lives in another table), so it
 * is enforced by a counted insert under a row lock when the usage is registered.
 *
 * Returns null for a once-per-customer code with no email: the validation service refuses
 * that combination up front, so this only ever degrades to "no extra DB guard", never to a
 * key that would collide with a different customer.
 */
export function usageUniquenessKey(
  usageMode: UsageMode,
  promoCodeId: number | string,
  normalizedEmail: string,
): string | null {
  if (usageMode === 'single_use_global') return `global:${promoCodeId}`
  if (usageMode === 'once_per_customer') {
    return normalizedEmail ? `email:${promoCodeId}:${normalizedEmail}` : null
  }
  return null
}
