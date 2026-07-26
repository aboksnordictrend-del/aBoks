import type { Metadata } from 'next'
import HomeClient from './HomeClient'
import { getProductBySlug, getPublishedProductByTitle } from '@/lib/payload'
import { listBlobFolderImages } from '@/lib/blobImages'
import type { AboksVeggSectionData } from '@/components/AboksVeggSection'
import type { SaleInfo } from '@/lib/pricing'
import { SITE_URL, SITE_NAME, LOGO_URL } from '@/lib/site'

export const revalidate = 3600

export const metadata: Metadata = {
  // absolute bypasses the layout template (%s | aBoks) to avoid duplication
  title: {
    absolute: 'aBoks – elegant oppbevaring for brukte batterier hjemme',
  },
  description:
    'aBoks gjør det enkelt å samle, sortere og levere brukte batterier til gjenvinning. En praktisk og elegant batteriboks designet i Norge for moderne hjem.',
  keywords: [
    'aBoks', 'batteriboks', 'oppbevaring batterier', 'brukte batterier',
    'resirkulering batterier', 'gjenvinning batterier', 'batteri oppbevaring',
    'sortere batterier', 'norsk design', 'miljøvennlig hjem',
  ],
  alternates: {
    canonical: 'https://aboks.no/',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: 'https://aboks.no/',
    title: 'aBoks – elegant batteriboks for hjemmet',
    description:
      'Samle brukte batterier på ett sted og lever dem enklere til gjenvinning. Norskdesignet batteriboks for moderne hjem.',
    images: [{ url: '/images/hero-desktop.webp', width: 1200, height: 630, alt: 'aBoks batteriboks' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'aBoks – elegant batteriboks for hjemmet',
    description:
      'Samle brukte batterier på ett sted og lever dem enklere til gjenvinning. Norskdesignet batteriboks for moderne hjem.',
    images: ['/images/hero-desktop.webp'],
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: LOGO_URL,
}

// Product name as it is written in Payload. The slug, images and link are all derived
// from the CMS doc, so renaming the URL in Payload needs no code change.
const VEGG_PRODUCT_TITLE = 'aBoks Vegg'
// Blob Storage folder the section's carousel reads. Adding a file there makes it show up
// on the next revalidation — the images are never listed in code.
const VEGG_BLOB_FOLDER = 'aboks-vegg/'

/**
 * Assembles the "aBoks Vegg" homepage section. Returns null (section not rendered) if the
 * product is missing from the CMS; an empty image list renders the section's own fallback.
 */
async function getVeggSection(): Promise<AboksVeggSectionData | null> {
  try {
    const product = await getPublishedProductByTitle(VEGG_PRODUCT_TITLE)
    if (!product?.slug) {
      console.warn(`[HOME] no published product found with title "${VEGG_PRODUCT_TITLE}"`)
      return null
    }
    const blobs = await listBlobFolderImages(VEGG_BLOB_FOLDER)
    return {
      title: product.title,
      href: `/produkter/${product.slug}`,
      images: blobs.map((blob, i) => ({
        src: blob.url,
        alt: `${product.title} – produktbilde ${i + 1} av ${blobs.length}`,
      })),
    }
  } catch (err) {
    console.error('[HOME] Failed to build aBoks Vegg section:', err instanceof Error ? err.message : String(err))
    return null
  }
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: 'nb-NO',
  publisher: { '@id': `${SITE_URL}/#organization` },
}

export default async function HomePage() {
  let sale: SaleInfo | null = null
  let price = 499
  try {
    const product = await getProductBySlug('aboks')
    if (product) {
      price = product.price ?? 499
      sale = {
        salePrice: product.salePrice ?? null,
        saleStartDate: product.saleStartDate ?? null,
        saleEndDate: product.saleEndDate ?? null,
      }
    } else {
      console.warn('[HOME] no product found with slug "aboks"')
    }
  } catch (err) {
    console.error('[HOME] Failed to fetch product from Payload:', err instanceof Error ? err.message : String(err))
  }
  const vegg = await getVeggSection()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <HomeClient sale={sale} price={price} vegg={vegg} />
    </>
  )
}
