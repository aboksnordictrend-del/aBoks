/**
 * The catalogue as the business pages read it.
 *
 * /bedrifter and every package page under /bedrifter/<slug> render the same editorial
 * product sections, so they resolve their products through this one module: the same
 * Payload query, the same mapping and the same order. A price, a photo or a description
 * edited in the CMS therefore appears in both places at once, and neither route holds its
 * own opinion about what a product is.
 *
 * Kept in `lib` rather than beside the components because both routes are server
 * components that need it before rendering, and `ProductSections.tsx` type-imports the
 * shape from here.
 */

import type { SaleInfo } from '@/lib/pricing'
import { getProducts } from '@/lib/payload'

/** One catalogue entry, as the business pages need it. */
export interface BedrifterProduct {
  title: string
  slug: string
  tagline: string
  description: string
  image: string
  imageAlt: string
  /** Catalogue price in kroner — the 1–n band of the quantity price table. */
  price: number
  /** The product's sale window, applied by the shared rule before any band is chosen. */
  sale: SaleInfo | null
}

/**
 * Order of the existing catalogue among the product sections. Products not listed
 * (a future launch) still render, after these — the pages follow the CMS, not this list.
 */
const PRODUCT_SLUG_ORDER = ['aboks', 'aboks-mini', 'aboks-nano', 'aboks-vegg']

/** Payload upload fields arrive either as an id string or as a populated media doc. */
function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val) return String((val as { url?: string }).url ?? '')
  return ''
}

/**
 * The published catalogue, in the order the product sections show it.
 *
 * `getProducts` is cached per request and revalidated on the hour, so a package page that
 * also reads single products by slug pays for one query, not one per product.
 *
 * A failure is logged and answered with an empty list: a business page that explains the
 * solution and takes an inquiry is better than a 500 because the CMS was unreachable.
 */
export async function getBedrifterProducts(): Promise<BedrifterProduct[]> {
  try {
    const docs = await getProducts()
    return [...docs]
      .sort((a, b) => {
        const ai = PRODUCT_SLUG_ORDER.indexOf(a.slug as string)
        const bi = PRODUCT_SLUG_ORDER.indexOf(b.slug as string)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      .map((doc) => {
        const firstImage = doc.images?.[0]
        return {
          title: doc.title as string,
          slug: doc.slug as string,
          tagline: doc.tagline ?? '',
          description: (doc.description as string) ?? '',
          image: firstImage ? mediaUrl(firstImage.image) : '',
          imageAlt: firstImage?.alt ?? (doc.title as string),
          // The catalogue price and its sale window, exactly as the product page reads them.
          // The quantity price table on these pages is built from these plus the shared tier
          // configuration — there is no B2B price list written into any route.
          price: doc.price ?? 0,
          sale: {
            salePrice: doc.salePrice ?? null,
            saleStartDate: doc.saleStartDate ?? null,
            saleEndDate: doc.saleEndDate ?? null,
          },
        }
      })
      // A product without a slug would render a broken link.
      .filter((product) => Boolean(product.slug))
  } catch (err) {
    console.error(
      '[BEDRIFTER] Failed to fetch products from Payload:',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}

/**
 * The products named by `slugs`, in the order `slugs` names them.
 *
 * A package page passes its own `configurator.productSlugs` — the one place that says which
 * products a package is made of — so the sections it shows and the configurator it offers
 * can never disagree. A slug that is not in the catalogue (unpublished, renamed) is simply
 * left out rather than rendering an empty section.
 */
export function selectBedrifterProducts(
  products: BedrifterProduct[],
  slugs: string[],
): BedrifterProduct[] {
  return slugs
    .map((slug) => products.find((product) => product.slug === slug))
    .filter((product): product is BedrifterProduct => product !== undefined)
}
