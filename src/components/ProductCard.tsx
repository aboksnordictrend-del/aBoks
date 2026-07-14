import Image from 'next/image'
import Link from 'next/link'
import type { Product } from '@/payload-types'

function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val)
    return String((val as { url?: string }).url ?? '')
  return ''
}

/**
 * Catalogue card, shared by /produkter and /tilbehor. Accessories are ordinary
 * products with `section: 'accessories'`, so they link into the same /produkter/[slug]
 * page and need no card of their own.
 */
export default function ProductCard({ product }: { product: Product }) {
  const firstImage = product.images?.[0]
  const imgUrl = firstImage ? mediaUrl(firstImage.image) : ''
  const imgAlt = firstImage?.alt ?? product.title
  const href = `/produkter/${product.slug}`

  return (
    <div className="group" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Image — clickable */}
      <Link
        href={href}
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
            href={href}
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
}

/** The grid the cards sit in — identical on both catalogue pages. */
export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 340px))',
      justifyContent: 'center',
      gap: 'clamp(24px,3vw,40px)',
      marginBottom: 'clamp(80px,10vw,128px)',
    }}>
      {children}
    </div>
  )
}
