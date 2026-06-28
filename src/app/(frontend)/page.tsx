import type { Metadata } from 'next'
import HomeClient from './HomeClient'
import { getProductBySlug } from '@/lib/payload'
import type { SaleInfo } from '@/lib/pricing'

// Hero показывает countdown со свежими данными из Payload — страница не должна кэшироваться
export const dynamic = 'force-dynamic'

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
      console.log('[HOME] sale data from Payload:', JSON.stringify({ price, sale }))
    } else {
      console.warn('[HOME] getProductBySlug("aboks") returned null — no product found with this slug')
    }
  } catch (err) {
    console.error('[HOME] Failed to fetch product from Payload:', err instanceof Error ? err.message : String(err))
  }
  return <HomeClient sale={sale} price={price} />
}
