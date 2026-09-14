'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CarouselArrows } from '@/components/Carousel'

/**
 * One card's worth of a product. Deliberately narrower than the Payload doc — the page is
 * a client component, so only what the card draws crosses the boundary.
 */
export interface CarouselProduct {
  slug: string
  title: string
  tagline: string
  image: string
  imageAlt: string
}

/**
 * The card shell. Same chrome the section's cards have always had — white body, 22px
 * radius, `shadow-card`, the beige image bed with its dashed divider — only now it is a
 * flex column so cards of differing tagline length still line up in the row.
 */
const CARD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: '#fff',
  borderRadius: '22px',
  overflow: 'hidden',
  color: 'inherit',
  textDecoration: 'none',
}

/**
 * Hover/focus treatment: a 3px lift onto `shadow-card-hover` — no scaling of the card
 * itself, so nothing shifts inside a scroller. Reduced motion keeps the shadow alone.
 * `data-btn` (on the element) opts the card out of the global link-hover fade.
 */
const CARD_CLASS = [
  'group shadow-card',
  'transition-[transform,box-shadow] duration-300 ease-out',
  'hover:-translate-y-[3px] hover:shadow-card-hover',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e6a48]',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
].join(' ')

/** Square, because that is how the catalogue photos in Payload are shot and cropped. */
const IMAGE_BOX: React.CSSProperties = {
  aspectRatio: '1/1',
  background: '#efe6d3',
  borderBottom: '1px dashed #cdbf9f',
  position: 'relative',
}

/**
 * Roughly three cards on desktop, two on tablets and one plus a sliver of the next on
 * phones — the sliver is what tells a reader the row keeps going. The divisors are
 * fractional on purpose: a whole number would hide the next card completely.
 */
const ITEM_CLASS = [
  'shrink-0 snap-start',
  'w-[82%]',
  'sm:w-[calc((100%_-_var(--pc-gap))/2.25)]',
  'lg:w-[calc((100%_-_2_*_var(--pc-gap))/3.2)]',
].join(' ')

/**
 * A horizontally scrollable row of product cards.
 *
 * Native `overflow-x: auto` plus CSS scroll-snap does the work — touch swipe, trackpad
 * and keyboard all come for free, and no carousel library is pulled in. The arrows only
 * call `scrollBy`, so the snap points stay the single source of truth for where the row
 * comes to rest.
 */
export default function ProductCarousel({
  products,
  header,
}: {
  products: CarouselProduct[]
  /** The section's eyebrow + heading, laid out beside the arrows. */
  header: ReactNode
}) {
  const trackRef = useRef<HTMLUListElement>(null)
  // Both true before the first measurement, so neither arrow is offered on a row that
  // turns out not to scroll at all.
  const [edge, setEdge] = useState({ atStart: true, atEnd: true })

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // 1px of tolerance: sub-pixel widths never land on an exact 0 or max.
    setEdge({ atStart: el.scrollLeft <= 1, atEnd: max <= 1 || el.scrollLeft >= max - 1 })
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    // Covers resize, an orientation change and the card widths settling after fonts load
    // — anything that changes how much of the row fits.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure, products.length])

  /** One card plus one gap — the same distance a snap point sits from the next. */
  const scroll = useCallback((direction: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    const step = card ? card.getBoundingClientRect().width + gap : el.clientWidth
    el.scrollBy({
      left: direction * step,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [])

  if (products.length === 0) return null

  return (
    <>
      <div
        className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '24px',
          marginBottom: 'clamp(28px,3.4vw,44px)',
        }}
      >
        {header}
        {/* Hidden on the narrowest screens, where swiping is the natural gesture and the
            buttons would only crowd the heading. */}
        <div className="hidden sm:block">
          <CarouselArrows
            onPrev={() => scroll(-1)}
            onNext={() => scroll(1)}
            prevLabel="Forrige produkter"
            nextLabel="Neste produkter"
            prevDisabled={edge.atStart}
            nextDisabled={edge.atEnd}
          />
        </div>
      </div>

      <ul
        ref={trackRef}
        // Reuses the scrollbar-hiding rule in globals.css.
        data-carousel
        className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]"
        style={
          {
            '--pc-gap': 'clamp(20px,2.4vw,28px)',
            display: 'flex',
            gap: 'var(--pc-gap)',
            listStyle: 'none',
            margin: 0,
            overflowX: 'auto',
            // The row is clipped vertically, so the padding below is what gives the
            // hover lift, its shadow and the focus ring somewhere to show.
            overflowY: 'hidden',
            paddingTop: '8px',
            paddingBottom: '20px',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            // Matches the horizontal padding, so a snapped card sits flush under the heading.
            scrollPaddingLeft: 'clamp(20px,5vw,48px)',
            overscrollBehaviorX: 'contain',
          } as React.CSSProperties
        }
      >
        {products.map((p) => (
          <li key={p.slug} className={ITEM_CLASS}>
            {/* The whole card is the link — image, title, tagline and the space around
                them — and it is the only interactive element inside it. */}
            <Link href={`/produkter/${p.slug}`} data-btn className={CARD_CLASS} style={CARD}>
              <div style={IMAGE_BOX}>
                {p.image && (
                  <Image
                    src={p.image}
                    alt={p.imageAlt}
                    fill
                    sizes="(max-width: 640px) 82vw, (max-width: 1024px) 44vw, 30vw"
                    className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    style={{ objectFit: 'cover' }}
                  />
                )}
              </div>
              <div style={{ padding: '24px 26px 28px' }}>
                <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '19px', color: '#1a1d17', margin: '0 0 8px' }}>{p.title}</h3>
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', lineHeight: 1.55, color: '#6b6f63', margin: 0 }}>{p.tagline}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
