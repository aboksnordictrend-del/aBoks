import { unstable_cache } from 'next/cache'
import { getPayloadClient } from '@/lib/payload'
import { getEffectivePrice, isSaleActive } from '@/lib/pricing'
import { productStock, variantStock } from '@/lib/stock'
import {
  EMPTY_CATALOGUE,
  isAddableRecommendation,
  normalizeRecommendationRefs,
  recommendationKey,
  type CartRecommendationCatalogue,
  type RecommendationProduct,
  type RecommendationVariant,
} from './recommendations'

/**
 * Server half of «Passer godt sammen med»: Payload documents → the compact catalogue the
 * cart renders.
 *
 * Three queries, always — regardless of how many products are in the cart or how many
 * recommendations they name:
 *
 *   1. the cart's own products, at depth 0, purely to read their recommendation id lists
 *   2. every recommended product at once, `id in (…)`, published only
 *   3. every variant of those products at once, `product in (…)`
 *
 * The alternative — resolving the relationship with `depth`, or fetching one recommendation
 * at a time — is what would make this N+1. Step 1 stays at depth 0 deliberately: it wants
 * ids, and letting Payload populate them would pull whole product documents (and their
 * media, and their own recommendations) for data that is then re-queried in step 2 anyway.
 */

/** Hard ceiling on how many cart slugs one request may ask about. A cart has a handful. */
const MAX_SLUGS = 20
/** Hard ceiling on recommended products resolved per request, before availability filtering. */
const MAX_RECOMMENDATIONS = 40

function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val)
    return String((val as { url?: string }).url ?? '')
  return ''
}

/**
 * Every product lives at /produkter/[slug], accessories included — they are the same
 * collection on the same route, and only the breadcrumb above the title differs (see
 * src/app/(frontend)/produkter/[slug]/page.tsx). Built here, once, rather than assembled in
 * the card, so a future split into two routes is a one-line change on the server.
 */
function productHref(slug: string): string {
  return `/produkter/${slug}`
}

/** Raw, time-independent product data. Sale *dates* are carried; the price is not resolved. */
interface RawRecommendationProduct {
  key: string
  collection: string
  id: string
  title: string
  slug: string
  section: 'products' | 'accessories'
  image: string
  imageAlt: string
  price: number
  salePrice: number | null
  saleStartDate: string | null
  saleEndDate: string | null
  /** Decided before sold-out colours are dropped, so "no colours" stays distinguishable. */
  hasVariants: boolean
  variants: RecommendationVariant[]
  /** The product's own stock — read only when `hasVariants` is false. */
  stock: number
}

interface RawCatalogue {
  recommendationsBySlug: Record<string, string[]>
  products: RawRecommendationProduct[]
}

const EMPTY_RAW: RawCatalogue = { recommendationsBySlug: {}, products: [] }

/**
 * Cached for an hour and tagged like every other catalogue read in this project, so editing a
 * product in Payload (which revalidates `products` and `product-variants`) drops this too.
 *
 * Only *time-independent* data is cached. A sale that starts or ends mid-window must not be
 * frozen for an hour, so the effective price is computed per request by the caller below.
 */
const loadRawCatalogue = unstable_cache(
  async (slugs: string[]): Promise<RawCatalogue> => {
    if (slugs.length === 0) return EMPTY_RAW
    const payload = await getPayloadClient()

    // ── 1. The cart's products — ids and their recommendation lists, nothing else. ────────
    const sources = await payload.find({
      collection: 'products',
      where: { slug: { in: slugs } },
      depth: 0,
      limit: slugs.length,
      pagination: false,
    })

    const recommendationsBySlug: Record<string, string[]> = {}
    const wantedIds: string[] = []
    const wantedSeen = new Set<string>()

    for (const source of sources.docs) {
      const slug = typeof source.slug === 'string' ? source.slug : ''
      if (!slug) continue
      const refs = normalizeRecommendationRefs((source as { cartRecommendations?: unknown }).cartRecommendations)
      // Self-references are dropped here as well as in the admin picker: a row written before
      // `filterOptions` existed would otherwise survive as a permanently filtered-out entry.
      const keys: string[] = []
      for (const ref of refs) {
        if (ref.relationTo === 'products' && ref.value === String(source.id)) continue
        keys.push(recommendationKey(ref.relationTo, ref.value))
        if (!wantedSeen.has(ref.value) && wantedIds.length < MAX_RECOMMENDATIONS) {
          wantedSeen.add(ref.value)
          wantedIds.push(ref.value)
        }
      }
      recommendationsBySlug[slug] = keys
    }

    if (wantedIds.length === 0) return { recommendationsBySlug, products: [] }

    // ── 2. Every recommended product in one query. Unpublished ones simply do not come
    //       back, which is also how a deleted id resolves to nothing. ───────────────────────
    const recommended = await payload.find({
      collection: 'products',
      where: { id: { in: wantedIds }, published: { equals: true } },
      depth: 1, // populates images[].image → media, for the URL
      limit: wantedIds.length,
      pagination: false,
    })

    if (recommended.docs.length === 0) return { recommendationsBySlug, products: [] }

    // ── 3. Every variant of those products in one query. ─────────────────────────────────
    const variantDocs = await payload.find({
      collection: 'product-variants',
      where: { product: { in: recommended.docs.map((doc) => doc.id) } },
      sort: 'sortOrder',
      depth: 1, // populates image → media
      pagination: false,
    })

    const variantsByProduct = new Map<string, RecommendationVariant[]>()
    // Every product that has at least one variant row, sold out or not. Recorded before the
    // filter below, because "all colours sold out" and "no colours at all" are different
    // states that must not collapse into the same empty list.
    const productsWithVariants = new Set<string>()
    for (const variant of variantDocs.docs) {
      const rawProduct = (variant as { product?: unknown }).product
      const productId =
        rawProduct && typeof rawProduct === 'object'
          ? String((rawProduct as { id?: unknown }).id ?? '')
          : String(rawProduct ?? '')
      if (!productId) continue
      productsWithVariants.add(productId)

      // Sold-out variants are dropped, matching the product page, where inventory 0 disables
      // the button and reads «Utsolgt». A card whose every colour is gone is then left with
      // no variants and fails isAddableRecommendation — it is not shown at all.
      if (variantStock(variant) <= 0) continue
      const list = variantsByProduct.get(productId) ?? []
      list.push({
        id: String(variant.id),
        name: variant.name ?? '',
        colorHex: variant.colorHex ?? '#000000',
        image: mediaUrl((variant as { image?: unknown }).image),
        inventory: variantStock(variant),
      })
      variantsByProduct.set(productId, list)
    }

    const products: RawRecommendationProduct[] = recommended.docs.map((doc) => {
      const variants = variantsByProduct.get(String(doc.id)) ?? []
      const firstImage = doc.images?.[0]
      // The product's own first image is the primary; a variant image is the fallback for a
      // product that has colours but no gallery yet. Cards without either render the same
      // tinted placeholder the catalogue uses.
      const image = (firstImage ? mediaUrl(firstImage.image) : '') || variants[0]?.image || ''
      return {
        key: recommendationKey('products', doc.id),
        collection: 'products',
        id: String(doc.id),
        title: doc.title ?? '',
        slug: doc.slug ?? '',
        section: doc.section === 'accessories' ? 'accessories' : 'products',
        image,
        imageAlt: firstImage?.alt || doc.title || '',
        price: doc.price ?? 0,
        salePrice: doc.salePrice ?? null,
        saleStartDate: doc.saleStartDate ?? null,
        saleEndDate: doc.saleEndDate ?? null,
        hasVariants: productsWithVariants.has(String(doc.id)),
        variants,
        stock: productStock(doc),
      }
    })

    return { recommendationsBySlug, products }
  },
  ['cart-recommendations'],
  { revalidate: 3600, tags: ['products', 'product-variants'] },
)

/**
 * The catalogue for a set of cart product slugs.
 *
 * `slugs` is the caller's raw input — deduped, trimmed and capped here rather than trusted,
 * because it arrives from a public endpoint. Sorting before the cached call means two
 * customers with the same products in a different order share one cache entry; per-slug
 * ordering is the client's business and is applied by `buildCartRecommendations`.
 */
export async function loadCartRecommendations(
  slugs: readonly string[],
): Promise<CartRecommendationCatalogue> {
  const clean = Array.from(
    new Set(
      (Array.isArray(slugs) ? slugs : [])
        .filter((slug): slug is string => typeof slug === 'string')
        .map((slug) => slug.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_SLUGS)

  if (clean.length === 0) return EMPTY_CATALOGUE

  const raw = await loadRawCatalogue([...clean].sort())

  const products: Record<string, RecommendationProduct> = {}
  for (const item of raw.products) {
    // Prices are resolved now, not at cache time, so a sale that starts or expires inside the
    // revalidation window is reflected immediately — same rule the product page applies.
    const price = getEffectivePrice(item.price, {
      salePrice: item.salePrice,
      saleStartDate: item.saleStartDate,
      saleEndDate: item.saleEndDate,
    })
    const onSale = isSaleActive(item.price, {
      salePrice: item.salePrice,
      saleStartDate: item.saleStartDate,
      saleEndDate: item.saleEndDate,
    })

    const product: RecommendationProduct = {
      key: item.key,
      collection: item.collection,
      id: item.id,
      title: item.title,
      slug: item.slug,
      href: productHref(item.slug),
      section: item.section,
      image: item.image,
      imageAlt: item.imageAlt,
      price,
      compareAtPrice: onSale ? item.price : null,
      hasVariants: item.hasVariants,
      variants: item.variants,
      stock: item.stock,
      // A single colour is the only case where the choice is unambiguous. With several, the
      // card shows swatches and adds nothing until the customer picks one. A product with no
      // colours has nothing to default to and needs no choice at all.
      defaultVariantId: item.variants.length === 1 ? item.variants[0].id : null,
    }

    if (isAddableRecommendation(product)) products[product.key] = product
  }

  return { recommendationsBySlug: raw.recommendationsBySlug, products }
}
