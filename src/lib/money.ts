/**
 * The project's money representation, in one place.
 *
 * Every price in this codebase is a decimal number of kroner where it is *stored* (Payload's
 * `products.price`, `orders.unitPrice`, `orders.total` …) and an integer number of **øre**
 * wherever it is *calculated*. These two functions are the only crossing between them.
 *
 * Nothing sums, multiplies or compares money in kroner. `0.1 + 0.2` is not `0.3`, and a cart
 * of twelve 349-kroner boxes must come to exactly 4 188 kr — not 4 187.999999999999.
 *
 * Lifted out of @/lib/cartPricing so the quantity-pricing engine can share it without
 * importing the server-side cart pricer (which would be a cycle, and would drag Payload into
 * client bundles). `cartPricing` re-exports both names, so every existing import is unchanged.
 */

/** Kroner → øre. The single rounding step between the catalogue and all arithmetic. */
export function toOere(kr: number): number {
  return Math.round(kr * 100)
}

/** Øre → kroner. Exact for any integer øre value (no 0.1 + 0.2 drift). */
export function oereToKr(oere: number): number {
  return oere / 100
}
