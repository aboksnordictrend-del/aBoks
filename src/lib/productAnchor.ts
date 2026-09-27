/**
 * The in-page anchor of a product's full section.
 *
 * A package page under /bedrifter/<slug> renders the complete product sections above its
 * inquiry form, and its configurator links up to them. Both the section's `id` and the
 * link's `href` are built here, from the product's own Payload slug, so the two can never
 * be spelled differently — there is no product-to-anchor table anywhere.
 *
 * Deliberately free of imports: both a client component and a server component reach for
 * it.
 */

/** `produkt-aboks-office` — the `id` of that product's full section on a package page. */
export function productSectionAnchorId(slug: string): string {
  return `produkt-${slug}`
}

/** The same anchor as a link target: `#produkt-aboks-office`. */
export function productSectionHref(slug: string): string {
  return `#${productSectionAnchorId(slug)}`
}
