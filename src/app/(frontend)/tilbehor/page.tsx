import type { Metadata } from 'next'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
import ProductCard, { ProductGrid } from '@/components/ProductCard'
import { getAccessories } from '@/lib/payload'

export const revalidate = 3600

export const metadata: Metadata = {
  title: {
    absolute: 'Tilbehør til aBoks | Praktiske løsninger',
  },
  description:
    'Oppdag tilbehør til aBoks. Vi utvikler praktiske løsninger som gjør oppbevaring og sortering av batterier enda enklere.',
  alternates: {
    canonical: '/tilbehor',
  },
  openGraph: {
    type: 'website',
    locale: 'nb_NO',
    siteName: 'aBoks',
    url: '/tilbehor',
    title: 'Tilbehør til aBoks | Praktiske løsninger',
    description:
      'Oppdag tilbehør til aBoks. Vi utvikler praktiske løsninger som gjør oppbevaring og sortering av batterier enda enklere.',
  },
}

export default async function TilbehorPage() {
  // Accessories are ordinary products with section: 'accessories'. Publishing one in
  // Payload is all it takes for it to appear here — the placeholder below disappears
  // by itself as soon as the list is non-empty.
  const accessories = await getAccessories()

  return (
    <main style={{ background: '#faf6ee', minHeight: '100vh', paddingTop: 'clamp(96px,12vh,132px)' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">

        <Breadcrumbs items={[{ label: 'Hjem', href: '/' }, { label: 'Tilbehør' }]} />

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
            Tilbehør til aBoks
          </h1>
        </div>

        {accessories.length === 0 ? (
          /* Coming soon — shown until the first accessory is published */
          <div style={{
            background: '#f2e7d7',
            borderRadius: '24px',
            padding: 'clamp(48px,7vw,96px) clamp(24px,5vw,64px)',
            textAlign: 'center',
            marginBottom: 'clamp(80px,10vw,128px)',
          }}>
            <p style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(16px,1.4vw,19px)',
              lineHeight: 1.65,
              color: '#4a4f42',
              margin: '0 auto 16px',
              maxWidth: '540px',
            }}>
              Vi jobber med praktisk tilbehør som gjør aBoks enda enklere å plassere og bruke.
              Nye produkter kommer snart.
            </p>
            <p style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: 'clamp(14px,1.1vw,15px)',
              lineHeight: 1.65,
              color: '#6b6f63',
              margin: '0 auto clamp(28px,3vw,40px)',
              maxWidth: '540px',
            }}>
              Følg med – vi oppdaterer siden så snart tilbehøret er klart.
            </p>
            <Link
              href="/produkter"
              data-btn
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontFamily: 'var(--font-manrope)',
                fontWeight: 600,
                fontSize: '14px',
                letterSpacing: '0.02em',
                padding: '13px 32px',
                borderRadius: '999px',
                border: '1.5px solid #39402c',
                textDecoration: 'none',
                transition: 'background 0.2s ease, color 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              className="text-[#39402c] hover:bg-[#39402c] hover:text-[#faf6ee]"
            >
              Se alle produkter
            </Link>
          </div>
        ) : (
          <ProductGrid>
            {accessories.map((accessory) => (
              <ProductCard key={accessory.id} product={accessory} />
            ))}
          </ProductGrid>
        )}
      </div>
    </main>
  )
}
