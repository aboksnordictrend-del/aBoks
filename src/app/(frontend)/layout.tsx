import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: {
    default: 'aBoks – Smart batteriorganisering',
    template: '%s | aBoks',
  },
  description:
    'aBoks organiserer nye, brukte, AA- og AAA-batterier i én smart boks. Tre rom. Full oversikt. Designet i Norge.',
  keywords: ['batteriorganisator', 'aBoks', 'batteriboks', 'AA batterier', 'AAA batterier', 'norsk design'],
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    title: 'aBoks – Smart batteriorganisering',
    description: 'Én smart boks med tre rom – for AA, AAA og brukte batterier. Designet i Norge.',
    images: [{ url: '/images/hero-desktop.png', width: 1200, height: 630, alt: 'aBoks' }],
  },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div style={{ overflowX: 'clip' }}>
        {children}
      </div>
      <Footer />
    </>
  )
}
