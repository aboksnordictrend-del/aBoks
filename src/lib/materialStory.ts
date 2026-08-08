/**
 * Which product pages may carry the "Fra planter til aBoks" material story.
 *
 * The section makes a concrete factual claim — 3D-printed in Norway from biobased PLA Matte
 * — so it is opt-in by slug rather than derived from a broad rule like `section !== 'accessories'`.
 * A new row in the CMS (an accessory, a label, a box, a product moulded from something else)
 * therefore never inherits the claim by accident; it has to be added here deliberately, once
 * someone has confirmed the material and where it is made.
 *
 * There is no material field on the `products` collection to key off, and adding one would be
 * a schema change; this list is the narrow, reviewable alternative.
 */
const PLA_MATTE_PRODUCT_SLUGS = new Set([
  'aboks',
  'aboks-vegg',
  'aboks-mini',
  'aboks-nano',
])

/** True when this product is confirmed to be 3D-printed in Norway from PLA Matte. */
export function showsMaterialStory(slug: string | null | undefined): boolean {
  return typeof slug === 'string' && PLA_MATTE_PRODUCT_SLUGS.has(slug)
}
