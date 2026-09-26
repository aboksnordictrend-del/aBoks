/**
 * The quantity rules a solution configurator obeys, in one pure module.
 *
 * They live here rather than in the stepper because the server route needs the same rules to
 * read a quantity out of a URL, and a server component must not import a client component to
 * borrow a constant. `QuantityStepper` re-exports them, so its callers are unchanged.
 */

import { MAX_LINE_QUANTITY } from '@/lib/quantityLimits'

/**
 * The range a solution configurator allows. A B2B order can be hundreds of units.
 *
 * The maximum is the shared cart/order limit, not a number of its own: a configuration the
 * page accepts has to be one "Legg løsningen i handlekurven" can actually add and the
 * checkout can actually price. The minimum is 0 — the configurator's way of saying "not this
 * product" — which is why it is still written here rather than taken from the same module.
 */
export const SOLUTION_QTY_MIN = 0
export const SOLUTION_QTY_MAX = MAX_LINE_QUANTITY

/**
 * Reads whatever is in the field and returns the quantity it means.
 *
 * Everything that is not a digit is dropped before parsing, so a minus sign, a decimal
 * point, an exponent or pasted text can never reach the state — a negative is impossible to
 * express rather than clamped after the fact. An empty field means `min`, and anything above
 * `max` is capped.
 */
export function normalizeQuantity(
  raw: string,
  min = SOLUTION_QTY_MIN,
  max = SOLUTION_QTY_MAX,
): number {
  const digits = raw.replace(/[^\d]/g, '')
  if (digits === '') return min
  // `digits` is all digits, so parseInt cannot return NaN here; the guard is for a string so
  // long it overflows to Infinity.
  const parsed = Number.parseInt(digits, 10)
  if (!Number.isFinite(parsed)) return max
  return Math.max(min, Math.min(max, parsed))
}

/**
 * A starting quantity read from a URL query parameter, or null when the parameter says
 * nothing usable — in which case the caller keeps the solution's own default.
 *
 * Deliberately stricter than the field: a URL is written by a machine or pasted by hand, so
 * only a plain run of digits counts. `-10`, `hello`, `1.5`, `1e3` and an empty value are all
 * refused rather than coerced into a quantity nobody asked for. A value above the maximum is
 * capped, exactly as typing it into the field would be, and a repeated parameter uses its
 * first value.
 */
export function parseQuantityParam(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null

  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed)) return SOLUTION_QTY_MAX
  return Math.max(SOLUTION_QTY_MIN, Math.min(SOLUTION_QTY_MAX, parsed))
}
