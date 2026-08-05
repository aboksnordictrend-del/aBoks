/**
 * «Passer godt sammen med» — the cross-sell list shown under the cart lines.
 *
 * Everything with a decision in it lives here, as pure functions over plain data: no React,
 * no fetch, no Payload. The server module (./recommendationsServer.ts) turns Payload
 * documents into the `CartRecommendationCatalogue` below; the cart component feeds that plus
 * the live cart into `buildCartRecommendations` and renders the result.
 *
 * The split matters for one reason beyond testability: the catalogue is fetched over the
 * network, but the *filtering* has to react to the cart instantly. When a customer adds a
 * recommendation, it must leave the list on the same tick — not after a round trip.
 */

/** Never show more than this many, however many are configured across the cart. */
export const CART_RECOMMENDATION_LIMIT = 4

/**
 * The collection recommendations point at. Tilbehør is not a separate collection —
 * accessories are `products` rows with `section: 'accessories'` — so one slug covers both
 * catalogues. Kept as a constant rather than a literal so the polymorphic-shaped key format
 * below stays honest about what it is keying.
 */
export const RECOMMENDATION_COLLECTION = 'products'

/**
 * Identity of a recommended document: collection **and** id, never id alone.
 *
 * Today every recommendation is a product, so the collection half is constant. It is still
 * part of the key because a relationship that later gains a second `relationTo` would
 * otherwise silently collapse `products:7` and `accessories:7` into one entry — a bug that
 * looks like a missing recommendation and is very hard to trace back to here.
 */
export function recommendationKey(collection: string, id: string | number): string {
  return `${collection}:${id}`
}

export interface RecommendationRef {
  relationTo: string
  value: string
}

/**
 * Reads whatever Payload put in a relationship field into a flat list of refs.
 *
 * Payload hands the same field back in four different shapes depending on `depth` and on
 * whether the relationship is polymorphic, and a value written before a schema change can be
 * a fifth. All of them are accepted:
 *
 *   7                          — id, depth 0
 *   '7'                        — id as a string (some adapters, and JSON round-trips)
 *   { id: 7, … }               — populated document, depth ≥ 1
 *   { relationTo, value: 7 }   — polymorphic, depth 0
 *   { relationTo, value: {…} } — polymorphic, populated
 *
 * Anything unrecognisable (null, a deleted relation, a stray object) is dropped rather than
 * guessed at, so a broken row costs one recommendation instead of the whole block.
 */
export function normalizeRecommendationRefs(
  raw: unknown,
  defaultCollection: string = RECOMMENDATION_COLLECTION,
): RecommendationRef[] {
  if (!Array.isArray(raw)) return []

  const refs: RecommendationRef[] = []

  for (const entry of raw) {
    if (entry === null || entry === undefined) continue

    if (typeof entry === 'number' || typeof entry === 'string') {
      const value = String(entry).trim()
      if (value) refs.push({ relationTo: defaultCollection, value })
      continue
    }

    if (typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>

    // Polymorphic: { relationTo, value }. `value` is itself either an id or a document.
    if ('relationTo' in obj && 'value' in obj) {
      const relationTo = typeof obj.relationTo === 'string' ? obj.relationTo : defaultCollection
      const inner = obj.value
      const value =
        inner && typeof inner === 'object'
          ? String((inner as Record<string, unknown>).id ?? '').trim()
          : String(inner ?? '').trim()
      if (value) refs.push({ relationTo, value })
      continue
    }

    // Populated document.
    if ('id' in obj) {
      const value = String(obj.id ?? '').trim()
      if (value) refs.push({ relationTo: defaultCollection, value })
    }
  }

  return refs
}

export interface RecommendationVariant {
  id: string
  name: string
  colorHex: string
  image: string
  /** Sold-out variants are kept out of the DTO entirely — see isAddableRecommendation. */
  inventory: number
}

/**
 * The compact shape the cart renders. Deliberately not a Payload document: descriptions,
 * FAQs, features, cost prices and SEO fields never leave the server.
 */
export interface RecommendationProduct {
  /** `${collection}:${id}` — the dedupe identity. */
  key: string
  collection: string
  id: string
  title: string
  slug: string
  /** Real route for this product. Accessories share /produkter/[slug]; see the server module. */
  href: string
  section: 'products' | 'accessories'
  image: string
  imageAlt: string
  /** Effective price in kr — the sale price when a sale is running, else the ordinary one. */
  price: number
  /** Ordinary price, present only while it is struck through by an active sale. */
  compareAtPrice: number | null
  /** In stock, in admin order. Empty means nothing is addable and the product is skipped. */
  variants: RecommendationVariant[]
  /** Set only when the choice is unambiguous — a single variant. Else the card asks. */
  defaultVariantId: string | null
}

export interface CartRecommendationCatalogue {
  /** Product slug → the recommendation keys configured on it, in admin order. */
  recommendationsBySlug: Record<string, string[]>
  /** Recommendation key → the product, for every key that is still addable. */
  products: Record<string, RecommendationProduct>
}

export const EMPTY_CATALOGUE: CartRecommendationCatalogue = {
  recommendationsBySlug: {},
  products: {},
}

/**
 * The part of a cart line this module needs. Structurally satisfied by `CartItem`.
 *
 * Only the slug is read. A cart line's variant no longer takes part in any decision here:
 * a recommendation stays on screen whether or not the customer already owns one of its
 * colours, precisely so they can add a second one from the same card.
 */
export interface CartRecommendationLine {
  productSlug: string
  variantId?: string
}

/**
 * Can this product be put in the cart from a card, right now?
 *
 * A `false` here is why a recommendation silently disappears: no price, no image-independent
 * identity, or every variant sold out. The server applies this before sending, and the
 * client applies it again — cheap, and it keeps a stale cached response from rendering a
 * card whose button could not work.
 */
export function isAddableRecommendation(product: RecommendationProduct | undefined | null): boolean {
  if (!product) return false
  if (!product.slug || !product.title) return false
  if (!Number.isFinite(product.price) || product.price <= 0) return false
  return product.variants.length > 0
}

export interface BuildCartRecommendationsOptions {
  limit?: number
}

/**
 * The list to render, from the cart and the fetched catalogue.
 *
 * Order is the product of two orderings, both of which the admin controls: cart lines are
 * walked in the order the customer added them, and within each line its product's
 * recommendations are walked in the order they were dragged into the Payload field. The
 * first appearance of a key wins its position; later duplicates are dropped, not moved.
 *
 * Excluded, in this order of cheapness: anything already emitted (the same product suggested
 * by two cart products appears once); a product recommending *itself*; anything missing from
 * the catalogue (deleted, unpublished, or filtered out server-side); anything not addable.
 *
 * Deliberately NOT excluded: a product that is already in the cart. Having bought one aBoks
 * is the best possible reason to be shown a second colour of it, and a card that vanished the
 * moment it was used made the block feel broken — the customer's own click deleted the thing
 * they were looking at. A recommendation now leaves the list only when the cart product that
 * suggested it leaves, when nothing else suggests it, or when it stops being sellable.
 */
export function buildCartRecommendations(
  cartItems: readonly CartRecommendationLine[],
  catalogue: CartRecommendationCatalogue | null | undefined,
  options: BuildCartRecommendationsOptions = {},
): RecommendationProduct[] {
  const limit = options.limit ?? CART_RECOMMENDATION_LIMIT
  if (!catalogue || !Array.isArray(cartItems) || cartItems.length === 0 || limit <= 0) return []

  const seenKeys = new Set<string>()
  const result: RecommendationProduct[] = []

  // Source products in cart order, each considered once however many lines it has.
  const visitedSources = new Set<string>()

  for (const item of cartItems) {
    const slug = item?.productSlug
    if (!slug || visitedSources.has(slug)) continue
    visitedSources.add(slug)

    const keys = catalogue.recommendationsBySlug[slug]
    if (!Array.isArray(keys)) continue

    for (const key of keys) {
      if (seenKeys.has(key)) continue

      const product = catalogue.products[key]
      if (!isAddableRecommendation(product)) continue
      // A product never recommends itself. The server strips self-references too, but a row
      // written before that existed would otherwise surface here as "buy the thing you are
      // already looking at".
      //
      // Note this is per source, which is why a key is marked seen only once it is actually
      // emitted: A recommending itself must not stop B from recommending A.
      if (product.slug === slug) continue

      seenKeys.add(key)
      result.push(product)
      if (result.length >= limit) return result
    }
  }

  return result
}

/**
 * The variant a card should add, or null when the customer has to choose first.
 *
 * Never guesses. One variant means there is nothing to choose; more than one means the
 * colours are a real decision and picking silently would put the wrong thing in the cart.
 * `selectedId` is the customer's own pick from the card's swatches.
 */
export function resolveRecommendationVariant(
  product: RecommendationProduct,
  selectedId?: string | null,
): RecommendationVariant | null {
  if (selectedId) {
    const picked = product.variants.find((variant) => variant.id === selectedId)
    if (picked) return picked
  }
  if (product.defaultVariantId) {
    const fallback = product.variants.find((variant) => variant.id === product.defaultVariantId)
    if (fallback) return fallback
  }
  return product.variants.length === 1 ? product.variants[0] : null
}

/**
 * The cart line to write for a recommendation, in the store's own `CartItem` shape.
 *
 * Deliberately the exact same fields the product page fills in — recommendations must not
 * become a second kind of cart line, or the summary, the promo revalidation and the Kustom
 * checkout would each need to learn about them. Typed structurally rather than importing
 * `CartItem`, which lives in a `'use client'` module.
 */
export function recommendationCartItem(
  product: RecommendationProduct,
  variant: RecommendationVariant,
): {
  variantId: string
  productSlug: string
  productTitle: string
  colorName: string
  colorHex: string
  colorImage: string
  price: number
} {
  return {
    variantId: variant.id,
    productSlug: product.slug,
    // Carried through from the catalogue, so a product added from the cart block is named
    // exactly as it is on its own page.
    productTitle: product.title,
    colorName: variant.name,
    colorHex: variant.colorHex,
    colorImage: variant.image,
    price: product.price,
  }
}

/**
 * The cart slugs a catalogue request should cover, deduped and in cart order.
 *
 * Empty in, empty out — the caller uses that to skip the request entirely while the cart is
 * empty, which is the whole of the "don't fetch until there is a cart" rule.
 */
export function cartRecommendationSlugs(cartItems: readonly CartRecommendationLine[]): string[] {
  if (!Array.isArray(cartItems)) return []
  const slugs: string[] = []
  const seen = new Set<string>()
  for (const item of cartItems) {
    const slug = item?.productSlug
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    slugs.push(slug)
  }
  return slugs
}
