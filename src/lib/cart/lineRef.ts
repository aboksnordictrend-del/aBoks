/**
 * The identity of one cart / order line.
 *
 * Until now a line was always a **variant**, so its bare variant id served as the identity
 * everywhere: the cart store's key, the checkout request, the Kustom `reference`, the promo
 * allocation key and the order's `variant` relationship. A product without variants has no
 * variant id, and inventing one — a placeholder Product Variant row, or a made-up number —
 * would put a lie in the catalogue and in every historical order.
 *
 * So a line reference is one of exactly two things:
 *
 *   "12"          a variant line   — unchanged, byte for byte, from what it has always been
 *   "product-34"  a product line   — a product that has no variants at all
 *
 * Keeping the variant form bare is what makes this backward compatible: every cart already in
 * a customer's localStorage, every Kustom order already in flight and every historical order
 * line keeps parsing exactly as before, and `parseLineRef` reads them as variant references
 * without any migration.
 *
 * The prefix is a literal that can never collide with the other form — variant ids are
 * database integers, so they never start with a letter.
 */

export const PRODUCT_LINE_REF_PREFIX = 'product-'

export type CartLineRef =
  | { kind: 'variant'; variantId: string }
  | { kind: 'product'; productId: string }

/** The reference for a variant-less product line. */
export function productLineRef(productId: string | number): string {
  return `${PRODUCT_LINE_REF_PREFIX}${String(productId).trim()}`
}

/**
 * Reads a stored reference back into what it points at.
 *
 * Returns null for anything unusable (empty, a bare prefix, a non-string) rather than
 * guessing — a caller that cannot identify a line must skip it, not act on the wrong row.
 */
export function parseLineRef(raw: unknown): CartLineRef | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const value = String(raw).trim()
  if (!value) return null

  if (value.startsWith(PRODUCT_LINE_REF_PREFIX)) {
    const productId = value.slice(PRODUCT_LINE_REF_PREFIX.length).trim()
    return productId ? { kind: 'product', productId } : null
  }

  return { kind: 'variant', variantId: value }
}

/**
 * The reference for a line described by its two possible identifiers.
 *
 * The variant wins whenever there is one — that is the rule of this project stated as code:
 * a line that has a variant is a variant line, and its product's own stock is irrelevant.
 * Returns null when neither identifier is usable.
 */
export function lineRefFor(line: {
  variantId?: string | number | null
  productId?: string | number | null
}): string | null {
  const variantId = line?.variantId != null ? String(line.variantId).trim() : ''
  if (variantId) return variantId

  const productId = line?.productId != null ? String(line.productId).trim() : ''
  if (productId) return productLineRef(productId)

  return null
}

/**
 * The same thing for a line that is already known to be resolvable — a server-priced line, a
 * built order line, a cart item that came from the product page. Every one of those carries a
 * product id, so the reference always exists.
 */
export function resolvedLineRef(line: {
  variantId?: string | number | null
  productId?: string | number | null
}): string {
  return lineRefFor(line) ?? ''
}

/** True when this reference belongs to a product that has no variants. */
export function isProductLineRef(ref: string): boolean {
  return parseLineRef(ref)?.kind === 'product'
}
