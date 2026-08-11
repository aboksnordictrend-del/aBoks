/**
 * Where a product's stock lives — the one rule, in one place.
 *
 * ── The rule ──
 *
 *   the product HAS variants  →  stock is the chosen variant's `inventory`
 *   the product has NO variants →  stock is the product's own `stock`
 *
 * Never both. A product with variants keeps its own `stock` column untouched and unread, so
 * every aBoks product on the shop today behaves exactly as it did before this field existed;
 * a variant-less product (an accessory such as a battery multipack) has no variant row at all
 * and is answered from `products.stock`.
 *
 * The functions below are the only place that rule is written down. Everything that needs to
 * know how many units are available — the product page, the cart recommendations, the trusted
 * cart pricing, the Merchant feed and the post-payment deduction — asks here rather than
 * reaching for `inventory` or `stock` directly.
 */

/** The part of a variant document this module reads. */
export interface StockVariant {
  inventory?: number | null
}

/** The part of a product document this module reads. */
export interface StockProduct {
  stock?: number | null
}

/**
 * A stored stock value as a usable count.
 *
 * Null, undefined, NaN and negatives all read as 0 — "nothing to sell" is the only safe
 * interpretation of a missing or broken value, and it is what every product row written
 * before the `stock` column existed will report. Fractions are floored: half a battery pack
 * is not sellable.
 */
export function normalizeStock(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

/** Stock for a line that has a chosen variant. */
export function variantStock(variant: StockVariant | null | undefined): number {
  return normalizeStock(variant?.inventory)
}

/** Stock for a variant-less product. Never call this for a product that has variants. */
export function productStock(product: StockProduct | null | undefined): number {
  return normalizeStock(product?.stock)
}

/**
 * The stock behind a buy button, resolved from the product and its full variant list.
 *
 * `variants` is what decides which side of the rule applies — an empty list means the product
 * genuinely has none and its own `stock` is authoritative. Passing the list rather than a
 * boolean is deliberate: the caller always has it (the product page fetches it, the cart
 * catalogue carries it), and it removes the one way this could be got wrong, namely reading
 * `product.stock` for a product that does have variants.
 *
 * A product with variants and nothing selected reports 0: there is no line to buy yet.
 */
export function availableStock(
  product: StockProduct | null | undefined,
  variants: readonly StockVariant[] | null | undefined,
  selectedVariant?: StockVariant | null,
): number {
  const hasVariants = (variants?.length ?? 0) > 0
  if (!hasVariants) return productStock(product)
  return selectedVariant ? variantStock(selectedVariant) : 0
}

/** Sold out — the «Utsolgt» state. */
export function isSoldOut(stock: number): boolean {
  return stock <= 0
}

/** Can this many units be bought right now? */
export function canFulfil(stock: number, quantity: number): boolean {
  return quantity > 0 && quantity <= stock
}

/**
 * The stock left after `quantity` units are taken, never below zero.
 *
 * The floor is what stops a race (two customers buying the last unit at once) or a corrupt
 * quantity from writing a negative stock into the database.
 */
export function stockAfterPurchase(stock: unknown, quantity: number): number {
  const current = normalizeStock(stock)
  const taken = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0
  return Math.max(0, current - taken)
}
