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
 * `default` — the large three-up card used on /produkter. Below `lg` it borrows the
 * compact card's tighter type and spacing, because /produkter shows two cards per
 * row on phones and tablets alike.
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
    <div
      className={compact ? 'group' : 'group min-w-0'}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Image — clickable */}
      <Link
        href={href}
        data-btn
        // The default card keeps its radius/spacing in classes so the two-up grid can
        // tighten them; the desktop values from `lg` up are unchanged.
        className={compact ? undefined : 'rounded-2xl mb-3.5 lg:rounded-[20px] lg:mb-5'}
        style={{
          display: 'block',
          position: 'relative',
          aspectRatio: '1 / 1',
          background: '#ede8db',
          overflow: 'hidden',
          textDecoration: 'none',
          ...(compact ? { borderRadius: '16px', marginBottom: '14px' } : null),
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
                : '(max-width: 1024px) 50vw, 33vw'
            }
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: '#e4dfd2' }} />
        )}
      </Link>

      {/* Product details — not clickable */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h2
          className={
            compact
              ? undefined
              : 'text-[20px] leading-[1.12] mb-1.5 lg:text-[clamp(24px,2.2vw,32px)] lg:leading-[1.08] lg:mb-2'
          }
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 600,
            letterSpacing: '-0.015em',
            color: '#1a1d17',
            ...(compact
              ? {
                  fontSize: 'clamp(20px,1.6vw,24px)',
                  lineHeight: 1.12,
                  margin: '0 0 6px',
                }
              : { overflowWrap: 'anywhere' }),
          }}
        >
          {product.title}
        </h2>

        {product.tagline && (
          <p
            className={
              compact
                ? 'line-clamp-2'
                : 'line-clamp-2 text-[13px] mb-3.5 lg:line-clamp-none lg:text-[14px] lg:mb-5'
            }
            style={{
              fontFamily: 'var(--font-manrope)',
              lineHeight: 1.6,
              color: '#6b6f63',
              ...(compact
                ? { fontSize: 'clamp(13px,1vw,14px)', margin: '0 0 14px' }
                : null),
            }}
          >
            {product.tagline}
          </p>
        )}

        <div
          className={
            compact || product.tagline ? undefined : 'pt-3 lg:pt-4'
          }
          style={{
            marginTop: 'auto',
            ...(compact ? { paddingTop: product.tagline ? '0' : '12px' } : null),
          }}
        >
          <Link
            href={href}
            data-btn
            className={
              compact
                ? 'text-[#39402c] hover:bg-[#39402c] hover:text-[#faf6ee]'
                : 'text-[#39402c] hover:bg-[#39402c] hover:text-[#faf6ee] text-[12px] px-[18px] py-2 lg:text-[13px] lg:px-6 lg:py-2.5'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: 'var(--font-manrope)',
              fontWeight: 600,
              letterSpacing: '0.02em',
              borderRadius: '999px',
              border: '1.5px solid #39402c',
              textDecoration: 'none',
              transition: 'background 0.2s ease, color 0.2s ease',
              whiteSpace: 'nowrap',
              ...(compact ? { fontSize: '12px', padding: '8px 18px' } : null),
            }}
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
 * `default` — two columns up to `lg`, then auto-fit columns of up to 340px, centred,
 * from `lg` up (/produkter). `lg` is the breakpoint at which the auto-fit track —
 * which counts repetitions against the 340px max, not the 260px min — first fits two
 * columns on its own, so the handover happens with no jump in cards per row.
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

  // Phones and tablets get the same two-up track as /tilbehor; from `lg` up this is
  // the original auto-fit grid (repeat(auto-fit,minmax(260px,340px)), centred, clamped gap).
  return (
    <div className="grid grid-cols-2 items-stretch gap-x-5 gap-y-9 lg:[grid-template-columns:repeat(auto-fit,minmax(260px,340px))] lg:justify-center lg:gap-x-[clamp(24px,3vw,40px)] lg:gap-y-[clamp(24px,3vw,40px)] mb-[clamp(80px,10vw,128px)]">
      {children}
    </div>
  )
}
