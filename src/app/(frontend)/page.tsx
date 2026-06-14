import type { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: 'aBoks – Smart batteriorganisering',
  description:
    'aBoks organiserer nye, brukte, AA- og AAA-batterier i én smart boks. Tre rom. Full oversikt. Designet i Norge.',
}

export default function HomePage() {
  return <HomeClient />
}
