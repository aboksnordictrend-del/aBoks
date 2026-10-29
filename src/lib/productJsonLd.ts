/**
 * Product structured data for /produkter/[slug].
 *
 * The offer price is the price the page shows right now: `getEffectivePrice` applies the
 * sale only inside its start/end window, exactly as the product page and the Google
 * Merchant feed (/google-feed.xml) do. A sale that has not started or has ended therefore
 * never leaks into the structured data.
 *
 * `brand` comes from @/lib/productIdentity — the same mapping the Merchant feed uses, so GP
 * batteries are GP's and everything else aBoks's. No `sku` is stated: SKUs live on the colour variants,
 * and this Offer describes the product as a whole.
 */

import { getEffectivePrice, type SaleInfo } from './pricing'
import { productBrand } from './productIdentity'
import { absoluteUrl } from './site'

export interface ProductJsonLdInput {
  title: string
  description: string
  slug: string
  /** The Payload `section`. */
  section?: string | null
  /** First product image, if any. */
  image?: string
  price: number
  sale: SaleInfo
  /** A product with variants keeps a flat InStock; its availability is per colour. */
  hasVariants: boolean
  stock: number
  reviewSummary: { count: number; average: number }
}

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const url = absoluteUrl(`/produkter/${input.slug}`)

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.title,
    description: input.description,
    url,
    ...(input.image ? { image: input.image } : {}),
    brand: { '@type': 'Brand', name: productBrand({ title: input.title, section: input.section }) },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'NOK',
      price: getEffectivePrice(input.price, input.sale).toString(),
      availability:
        !input.hasVariants && input.stock <= 0
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      url,
    },
    // Only when real approved reviews exist — never a fabricated rating.
    ...(input.reviewSummary.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: input.reviewSummary.average.toFixed(1),
            reviewCount: input.reviewSummary.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
}
