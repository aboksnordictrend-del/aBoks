import { formatVariantDisplayName } from '@/collections/hooks/variantDisplayName'

/**
 * "What is this cart line called?" — the cart-side counterpart to @/lib/orderLineName.
 *
 * That module exists because an *order* line must never have a product name guessed for it.
 * The same rule applies before the order exists: a cart line shows the title of the product
 * that was actually added, and when that genuinely cannot be established it says «Produkt» —
 * never a brand name that happens to be the most common product.
 *
 * Resolution order, most to least authoritative:
 *
 *   1. the live catalogue, by slug — always current, so a rename in Payload shows up
 *      immediately, and it is what repairs carts persisted before `CartItem.productTitle`
 *      existed;
 *   2. the title stored on the line when it was added — covers a product that has since been
 *      unpublished or deleted, where the catalogue can no longer answer;
 *   3. «Produkt» — the same neutral fallback `orderLineDisplayName` uses.
 *
 * Nothing here composes the colour into the product title. `cartLineLabel` builds the
 * combined string for the one place that wants it, using the shared formatter.
 */

/** The neutral last resort, matching @/lib/orderLineName. */
export const CART_LINE_TITLE_FALLBACK = 'Produkt'

/** The part of a cart line this module reads. Structurally satisfied by `CartItem`. */
export interface CartLineTitleSource {
  productSlug: string
  productTitle?: string | null
  colorName?: string | null
}

/** Product slug → current title, as fetched on the server. */
export type ProductTitlesBySlug = Record<string, string>

export function cartLineTitle(
  item: CartLineTitleSource,
  titlesBySlug?: ProductTitlesBySlug | null,
): string {
  const fromCatalogue = item?.productSlug ? titlesBySlug?.[item.productSlug]?.trim() : ''
  if (fromCatalogue) return fromCatalogue

  const stored = item?.productTitle?.trim()
  if (stored) return stored

  return CART_LINE_TITLE_FALLBACK
}

/**
 * The single-line "Produkt – Farge" label, for surfaces that show one string per line rather
 * than a title with the colour beneath it (the checkout summary, before the server's trusted
 * line names arrive). Uses the same formatter as the variant's stored Visningsnavn, so the
 * placeholder and the value that replaces it read identically.
 */
export function cartLineLabel(
  item: CartLineTitleSource,
  titlesBySlug?: ProductTitlesBySlug | null,
): string {
  const title = cartLineTitle(item, titlesBySlug)
  const color = item?.colorName?.trim()
  return color ? formatVariantDisplayName(title, color) : title
}

/** Builds the lookup from whatever product documents the server already has to hand. */
export function productTitlesBySlug(
  products: readonly { slug?: string | null; title?: string | null }[],
): ProductTitlesBySlug {
  const titles: ProductTitlesBySlug = {}
  for (const product of products) {
    const slug = product?.slug?.trim()
    const title = product?.title?.trim()
    if (slug && title) titles[slug] = title
  }
  return titles
}
