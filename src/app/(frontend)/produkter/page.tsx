import type { Metadata } from 'next'
import Breadcrumbs from '@/components/Breadcrumbs'
import ProductCard, { ProductGrid } from '@/components/ProductCard'
import { getProducts } from '@/lib/payload'

export const revalidate = 3600

export const metadata: Metadata = {
  title: {
    absolute: 'aBoks-produkter | Smart oppbevaring av batterier',
  },
  description:
    'Se alle aBoks-produkter: batteribokser med egne rom for nye AA, nye AAA og brukte batterier. Norsk design, fri frakt over kr 650 og 100 dagers åpent kjøp.',
  alternates: {
    canonical: '/produkter',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/produkter',
    title: 'aBoks-produkter | Smart oppbevaring av batterier',
    description:
      'Hele aBoks-serien samlet: smarte batteribokser med tre adskilte rom, designet i Norge for et ryddigere hjem.',
  },
}

const PRODUCT_SLUG_ORDER = ['aboks', 'aboks-mini', 'aboks-nano']

export default async function ProductsPage() {
  const rawProducts = await getProducts()
  const products = [...rawProducts].sort((a, b) => {
    const ai = PRODUCT_SLUG_ORDER.indexOf(a.slug as string)
    const bi = PRODUCT_SLUG_ORDER.indexOf(b.slug as string)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Alle produkter' }]} />

        {/* Page heading — centered */}
        <div style={{ marginBottom: 'clamp(48px,6vw,72px)', textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#5e6a48',
            margin: '0 0 14px',
          }}>
            Sortiment
          </p>
          <h1 style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            fontSize: 'clamp(38px,5vw,68px)',
            letterSpacing: '-0.024em',
            lineHeight: 1.0,
            color: '#1a1d17',
            margin: '0 0 18px',
          }}>
            Alle produkter
          </h1>
          <p style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: 'clamp(15px,1.2vw,17px)',
            lineHeight: 1.6,
            color: '#6b6f63',
            margin: '0 auto',
            maxWidth: '480px',
          }}>
            Orden i batteriene – ett rom om gangen. Designet for hverdagen, laget for å vare.
          </p>
        </div>

        {/* Product grid */}
        {products.length === 0 ? (
          <div style={{
            padding: 'clamp(64px,8vw,96px) 0',
            textAlign: 'center',
            fontFamily: 'var(--font-manrope)',
            fontSize: '16px',
            color: '#696a62',
          }}>
            Ingen produkter tilgjengelig for øyeblikket.
          </div>
        ) : (
          <ProductGrid>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductGrid>
        )}
      </div>
    </main>
  )
}
