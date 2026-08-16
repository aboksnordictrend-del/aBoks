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
 * `default` — the large three-up card used on /produkter.
 * `compact` — a denser card for catalogue pages that show many items per row
 * (/tilbehor). Same fonts, colours and hover behaviour, only smaller.
 */
export type ProductCardVariant = 'default' | 'compact'

/**
 * Catalogue card, shared by /produkter and /tilbehor. Accessories are ordinary
 * products with `section: 'accessories'`, so they link into the same /produkter/[slug]
 * page and need no card of their own.
 */
export default function ProductCard({
  product,
  variant = 'default',
}: {
  product: Product
  variant?: ProductCardVariant
}) {
  const firstImage = product.images?.[0]
  const imgUrl = firstImage ? mediaUrl(firstImage.image) : ''
  const imgAlt = firstImage?.alt ?? product.title
  const href = `/produkter/${product.slug}`
  const compact = variant === 'compact'

  return (
    <div className="group" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Image — clickable */}
      <Link
        href={href}
        data-btn
        style={{
          display: 'block',
          position: 'relative',
          aspectRatio: '1 / 1',
          background: '#ede8db',
          borderRadius: compact ? '16px' : '20px',
          overflow: 'hidden',
          marginBottom: compact ? '14px' : '20px',
          textDecoration: 'none',
        }}
      >
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={imgAlt}
            fill
            sizes={
              compact
                ? '(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw'
                : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            }
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
          fontSize: compact ? 'clamp(20px,1.6vw,24px)' : 'clamp(24px,2.2vw,32px)',
          letterSpacing: '-0.015em',
          lineHeight: compact ? 1.12 : 1.08,
          color: '#1a1d17',
          margin: compact ? '0 0 6px' : '0 0 8px',
        }}>
          {product.title}
        </h2>

        {product.tagline && (
          <p
            className={compact ? 'line-clamp-2' : undefined}
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: compact ? 'clamp(13px,1vw,14px)' : '14px',
              lineHeight: 1.6,
              color: '#6b6f63',
              margin: compact ? '0 0 14px' : '0 0 20px',
            }}
          >
            {product.tagline}
          </p>
        )}

        <div style={{
          marginTop: 'auto',
          paddingTop: product.tagline ? '0' : compact ? '12px' : '16px',
        }}>
          <Link
            href={href}
            data-btn
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 600,
              fontSize: compact ? '12px' : '13px',
              letterSpacing: '0.02em',
              padding: compact ? '8px 18px' : '10px 24px',
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

/**
 * The grid the cards sit in.
 * `default` — auto-fit columns of up to 340px, centred (/produkter).
 * `compact` — a fixed 2 → 3 → 4 → 5 column catalogue grid (/tilbehor). Cards stay
 * ~215–240px wide at every breakpoint, and `items-stretch` keeps rows aligned so
 * the "Se produkt" buttons land on the same baseline.
 */
export function ProductGrid({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: ProductCardVariant
}) {
  if (variant === 'compact') {
    return (
      <div className="grid grid-cols-2 items-stretch gap-x-5 gap-y-9 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4 lg:gap-y-12 xl:grid-cols-5 mb-[clamp(80px,10vw,128px)]">
        {children}
      </div>
    )
  }

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
