import type { Metadata } from 'next'
import BedrifterClient, { type BedrifterProduct } from './BedrifterClient'
import { getProducts } from '@/lib/payload'

export const revalidate = 3600

export const metadata: Metadata = {
  // absolute bypasses the layout template (%s | aBoks) — the title already carries it
  title: {
    absolute: 'For bedrifter | aBoks',
  },
  description:
    'Praktiske løsninger for trygg innsamling, oppbevaring og organisering av batterier på kontor, verksted, lager og andre arbeidsplasser.',
  alternates: {
    canonical: '/bedrifter',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/bedrifter',
    title: 'For bedrifter | aBoks',
    description:
      'Praktiske løsninger for trygg innsamling, oppbevaring og organisering av batterier på kontor, verksted, lager og andre arbeidsplasser.',
  },
}

/**
 * Order of the existing catalogue among the product sections. Products not listed
 * (a future launch) still render, after these — the page follows the CMS, not this list.
 */
const PRODUCT_SLUG_ORDER = ['aboks', 'aboks-mini', 'aboks-nano', 'aboks-vegg']

/** Payload upload fields arrive either as an id string or as a populated media doc. */
function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val) return String((val as { url?: string }).url ?? '')
  return ''
}

async function getExistingProducts(): Promise<BedrifterProduct[]> {
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

export default async function BedrifterPage() {
  const products = await getExistingProducts()
  return <BedrifterClient products={products} />
}
