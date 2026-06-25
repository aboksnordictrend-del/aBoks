import type { Metadata } from 'next'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import '../globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import TouchPressManager from '@/components/TouchPressManager'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL ?? 'https://aboks.no'),
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
    images: [{ url: '/images/hero-desktop.webp', width: 1200, height: 630, alt: 'aBoks' }],
  },
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb" className={`${cormorant.variable} ${manrope.variable}`} data-site="frontend" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <TouchPressManager />
        <Header />
        <div>
          {children}
        </div>
        <Footer />
      </body>
    </html>
  )
}
