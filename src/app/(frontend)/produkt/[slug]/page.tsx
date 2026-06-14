import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductClient from './ProductClient'

const PRODUCT_DATA = {
  title: 'aBoks',
  slug: 'aboks',
  tagline: 'Smart batteriorganisator med tre rom',
  description:
    'Hold orden på nye og brukte batterier i én elegant boks. Tre adskilte rom for AA, AAA og brukte celler – alltid full oversikt, alltid klar for gjenvinning.',
  price: 499,
}

const VARIANTS_DATA = [
  { id: 'v-olive', name: 'Olivengrønn', colorHex: '#5b6347', image: '/images/aboks-olive.png', sku: 'ABOKS-OLIVE', inventory: 100, sortOrder: 0 },
  { id: 'v-blue', name: 'Mørk blå', colorHex: '#243153', image: '/images/aboks-blue.png', sku: 'ABOKS-BLUE', inventory: 100, sortOrder: 1 },
  { id: 'v-black', name: 'Sort', colorHex: '#1d1d1f', image: '/images/aboks-black.png', sku: 'ABOKS-BLACK', inventory: 100, sortOrder: 2 },
]

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (slug !== 'aboks') return {}

  return {
    title: 'aBoks – Smart batteriorganisator',
    description:
      'aBoks organiserer nye, brukte, AA- og AAA-batterier i én smart boks. Tre rom. Full oversikt. Designet i Norge.',
    openGraph: {
      title: 'aBoks – Smart batteriorganisator',
      description: 'Tre rom. Full oversikt. Designet i Norge.',
      images: [{ url: '/images/aboks-olive.png', width: 1200, height: 1200, alt: 'aBoks' }],
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (slug !== 'aboks') {
    notFound()
  }

  return (
    <ProductClient
      product={PRODUCT_DATA}
      variants={VARIANTS_DATA}
    />
  )
}
