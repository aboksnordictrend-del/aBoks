/**
 * How many units one line may hold — the ONE authoritative answer, for the whole application.
 *
 * The product page's stepper, the solution configurator, "Legg løsningen i handlekurven", the
 * cart store, the persisted cart read back from localStorage, the checkout request and the
 * server-side pricer all read this. There is deliberately no second number anywhere.
 *
 * ── Why 9999 ──
 *
 * The shop sells to workplaces. A school ordering 120 aBoks Spesial, or a borettslag covering
 * 300 apartments, is an ordinary order at a published price — exactly what the quantity price
 * bands exist for — and it has to be able to go through the normal checkout.
 *
 * The limit used to be two different numbers: the solution configurator allowed 9999 while the
 * cart and `priceCart` allowed 99. A configuration above 99 was accepted into the cart and
 * then refused at the payment step with "Ugyldig antall i handlekurven". One number fixes that
 * by construction.
 *
 * ── Why not higher ──
 *
 * It is not an external constraint: the Kustom Checkout API types `quantity` as a plain
 * number, our integration imposes no ceiling, `orders.items.quantity` is an unbounded Payload
 * number with `min: 1`, and nothing in the promo, shipping or VAT arithmetic is bounded by it.
 * 9999 is a sanity bound — it keeps a slipped keystroke or a hand-rolled request from
 * producing an order nobody can fulfil, and it keeps every `quantity × unitPriceOere` product
 * far inside the safe-integer range (9999 × 999 999 øre is ~1e10).
 *
 * Raising it later is a change to this file and nothing else.
 */

/** Fewest units a real order line can hold. A line of zero is not a line. */
export const MIN_LINE_QUANTITY = 1

/** Most units one order line may hold. See the note above before changing it. */
export const MAX_LINE_QUANTITY = 9999

/**
 * A whole number in [MIN_LINE_QUANTITY, MAX_LINE_QUANTITY].
 *
 * Rejects NaN, Infinity, 0, negatives and fractions. This is the rule `priceCart` enforces at
 * the trust boundary, so it is the definition of a quantity the shop will actually sell.
 */
export function isValidLineQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity >= MIN_LINE_QUANTITY &&
    quantity <= MAX_LINE_QUANTITY
  )
}

/**
 * The nearest quantity the cart is allowed to hold.
 *
 * Used where a quantity is being *set* rather than checked — the steppers, `addItem`, and the
 * sanitising of a cart read back from localStorage. Anything unusable becomes the minimum, so
 * a corrupted stored value can never leave a line at NaN units.
 */
export function clampLineQuantity(quantity: unknown): number {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return MIN_LINE_QUANTITY
  return Math.max(MIN_LINE_QUANTITY, Math.min(MAX_LINE_QUANTITY, Math.floor(quantity)))
}
