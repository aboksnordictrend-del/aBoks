import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Breadcrumbs from '@/components/Breadcrumbs'
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

function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val)
    return String((val as { url?: string }).url ?? '')
  return ''
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 340px))',
            justifyContent: 'center',
            gap: 'clamp(24px,3vw,40px)',
            marginBottom: 'clamp(80px,10vw,128px)',
          }}>
            {products.map((product) => {
              const firstImage = (product.images as any[])?.[0]
              const imgUrl = firstImage ? mediaUrl(firstImage.image) : ''
              const imgAlt = firstImage?.alt ?? product.title

              return (
                <div key={product.id} className="group" style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Image — clickable */}
                  <Link
                    href={`/produkter/${product.slug}`}
                    data-btn
                    style={{
                      display: 'block',
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      background: '#ede8db',
                      borderRadius: '20px',
                      overflow: 'hidden',
                      marginBottom: '20px',
                      textDecoration: 'none',
                    }}
                  >
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={imgAlt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: '#e4dfd2' }} />
                    )}
                  </Link>

                  {/* Product details — not clickable */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{
                      fontFamily: 'var(--font-cormorant)',
                      fontWeight: 600,
                      fontSize: 'clamp(24px,2.2vw,32px)',
                      letterSpacing: '-0.015em',
                      lineHeight: 1.08,
                      color: '#1a1d17',
                      margin: '0 0 8px',
                    }}>
                      {product.title}
                    </h2>

                    {product.tagline && (
                      <p style={{
                        fontFamily: 'var(--font-manrope)',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        color: '#6b6f63',
                        margin: '0 0 20px',
                      }}>
                        {product.tagline}
                      </p>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: product.tagline ? '0' : '16px' }}>
                      <Link
                        href={`/produkter/${product.slug}`}
                        data-btn
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontFamily: 'var(--font-manrope)',
                          fontWeight: 600,
                          fontSize: '13px',
                          letterSpacing: '0.02em',
                          padding: '10px 24px',
                          borderRadius: '999px',
                          border: '1.5px solid #39402c',
                          textDecoration: 'none',
                          transition: 'background 0.2s ease, color 0.2s ease',
                          whiteSpace: 'nowrap',
                        }}
                        className="text-[#39402c] hover:bg-[#39402c] hover:text-[#faf6ee]"
                      >
                        Se produkt
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
