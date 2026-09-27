import type { Metadata } from 'next'
import BedrifterClient from './BedrifterClient'
import { getBedrifterProducts } from '@/lib/bedrifterProducts'

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

export default async function BedrifterPage() {
  // The same catalogue, in the same order, that the package pages build their product
  // sections from — see `lib/bedrifterProducts`.
  const products = await getBedrifterProducts()
  return <BedrifterClient products={products} />
}
