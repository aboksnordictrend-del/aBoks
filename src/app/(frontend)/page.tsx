import type { Metadata } from 'next'
import HomeClient from './HomeClient'

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

export default function HomePage() {
  return <HomeClient />
}
