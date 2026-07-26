'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import SquareImageCarousel from './SquareImageCarousel'

/**
 * Everything the section renders comes from Payload / Blob Storage — assembled on the
 * server in app/(frontend)/page.tsx so nothing about the product is duplicated here.
 */
export interface AboksVeggSectionData {
  /** Product name from Payload (`products.title`). */
  title: string
  /** `/produkter/{slug}` built from the Payload slug. */
  href: string
  /** Images read from the `aboks-vegg/` Blob folder, sorted by filename. */
  images: { src: string; alt: string }[]
}

// Pale sage — the same green family as the compartment pills in the section above,
// sitting between the warm beige before it and the cream after it.
const BG = '#e6ecdf'
const HAIRLINE = 'rgba(57,64,44,0.16)'
// The site's border token (tailwind `border`), used for the decorative frame.
const FRAME = '#e7e2d4'

/**
 * The section's two calls to action. Rendered at two places and swapped by breakpoint:
 * inside the card from `md` up, below the carousel on mobile. One definition, so the
 * button styling never drifts between the two — the same pattern the homepage hero uses
 * for its separate desktop and mobile blocks.
 */
function CtaLinks({
  href,
  title,
  placement,
}: {
  href: string
  title: string
  placement: 'card' | 'belowCarousel'
}) {
  const inCard = placement === 'card'
  return (
    <div
      className={inCard ? 'hidden md:flex' : 'flex md:hidden'}
      style={{
        flexDirection: inCard ? 'row' : 'column',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: inCard ? 'flex-start' : 'center',
        gap: 'clamp(16px,2vw,26px)',
        // Pins the row to the bottom of the stretched card; no effect on mobile, where
        // this copy is hidden and the card is content-height anyway.
        marginTop: inCard ? 'auto' : '32px',
      }}
    >
      <Link
        href={href}
        data-btn
        className="w-full justify-center sm:w-auto"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '17px 36px',
          borderRadius: '999px',
          background: '#39402c',
          color: '#faf6ee',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 600,
          fontSize: '15px',
          letterSpacing: '0.01em',
          textDecoration: 'none',
          transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease',
        }}
      >
        Se {title}
      </Link>
      <Link
        href="/produkter"
        className="w-full justify-center sm:w-auto"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 600,
          fontSize: '14.5px',
          color: '#39402c',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
        }}
      >
        Se alle produkter
      </Link>
    </div>
  )
}

export default function AboksVeggSection({ data }: { data: AboksVeggSectionData | null }) {
  const reduceMotion = useReducedMotion()

  // No product in the CMS (renamed, unpublished, fetch failed) — the rest of the
  // homepage is unaffected.
  if (!data) return null

  // The props must be identical on the server and on the client — dropping them under
  // reduced motion would leave the SSR-rendered `initial` styles stuck at opacity 0,
  // since React does not patch up mismatched attributes. Only the timing changes: with
  // reduced motion the content appears in place, with no travel.
  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-80px' },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.7, delay, ease: [0.22, 0.61, 0.36, 1] as const },
  })

  return (
    <section
      aria-labelledby="aboks-vegg-heading"
      style={{ background: BG, padding: 'clamp(72px,9vw,120px) 0', overflowX: 'clip' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        {/* Text first in the DOM: it is the left column from `md` up, and the first block
            on mobile — no CSS `order` anywhere, so reading order and visual order agree. */}
        <div
          className="grid grid-cols-1 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.15fr)]"
          style={{
            // Row gap only applies to the stacked mobile layout, column gap only from
            // `md` up — so mobile gets generous air under the text while the tablet
            // columns stay tight.
            rowGap: 'clamp(52px,9vw,72px)',
            columnGap: 'clamp(32px,4.5vw,72px)',
            // `stretch` makes both columns share one row box: the card's top edge lands on
            // the carousel's top edge, and its bottom edge on the bottom of the carousel's
            // control row. No vertical offset on either side.
            alignItems: 'stretch',
          }}
        >
          {/* ── Info card ── */}
          <motion.div
            {...reveal()}
            className="mx-auto w-full max-w-[560px] md:mx-0 md:max-w-none"
            style={{
              background: '#faf6ee',
              border: `1px solid ${HAIRLINE}`,
              borderRadius: '28px',
              padding: 'clamp(30px,3.4vw,52px)',
              // Column flow so the CTA row can be pinned to the bottom of the stretched
              // card. Every child has a zero top margin, so no collapsed margin changes
              // value in flex flow and the vertical rhythm is exactly as before.
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                // Keeps the pill at its content width now that it is a flex item.
                alignSelf: 'flex-start',
                alignItems: 'center',
                gap: '9px',
                padding: '7px 16px 7px 13px',
                borderRadius: '999px',
                border: `1px solid ${HAIRLINE}`,
                fontFamily: 'var(--font-manrope)',
                fontWeight: 700,
                fontSize: '11.5px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: '#5e6a48',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '999px',
                  background: '#c9a76a',
                  flexShrink: 0,
                }}
              />
              Nyhet
            </span>

            <h2
              id="aboks-vegg-heading"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 500,
                fontSize: 'clamp(34px,4vw,54px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                color: '#1a1d17',
                margin: '22px 0 14px',
              }}
            >
              {data.title}
            </h2>

            <p
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(21px,2.1vw,29px)',
                lineHeight: 1.28,
                letterSpacing: '-0.01em',
                color: '#39402c',
                margin: '0 0 26px',
              }}
            >
              På veggen når du vil spare plass. Stående når det passer bedre.
            </p>

            <div style={{ height: '1px', background: HAIRLINE, margin: '0 0 26px' }} />

            <p
              style={{
                fontFamily: 'var(--font-manrope)',
                fontSize: 'clamp(15.5px,1.3vw,17px)',
                lineHeight: 1.68,
                color: '#3a3f33',
                margin: '0 0 26px',
              }}
            >
              aBoks Vegg gir deg den samme oversiktlige oppbevaringen for AA-, AAA- og brukte
              batterier, nå med enda større frihet. Monter den på veggen for å frigjøre plass,
              eller bruk den stående på en hylle, benk eller i et skap.
            </p>

            {/* On mobile this is the card's last element, so it carries no bottom margin —
                the card padding closes it off right after the line. */}
            <p
              className="m-0 md:mb-[clamp(28px,3vw,38px)]"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                fontFamily: 'var(--font-manrope)',
                fontWeight: 600,
                fontSize: '14.5px',
                letterSpacing: '0.01em',
                color: '#39402c',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: '26px',
                  height: '1.5px',
                  background: '#c9a76a',
                  flexShrink: 0,
                  alignSelf: 'flex-start',
                  marginTop: '11px',
                }}
              />
              Én løsning. To måter å bruke den på.
            </p>

            {/* From `md` up the CTAs sit inside the card, pinned to its bottom edge. */}
            <CtaLinks href={data.href} title={data.title} placement="card" />
          </motion.div>

          {/* ── Visual: square carousel inside a concentric architectural frame ── */}
          <motion.div
            {...reveal(0.12)}
            className="mx-auto w-full max-w-[560px] md:mx-0 md:max-w-none"
          >
            <div style={{ position: 'relative' }}>
              {/* Left/right are pinned to the square and the 1:1 ratio derives the height,
                  so the frame sits at one uniform inset on all four sides: 12px on mobile,
                  24px from `md` up. No transform, no per-side offsets. The carousel below
                  is positioned, so it paints over the frame. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[12px] -right-[12px] -top-[12px] rounded-[26px] md:-left-[24px] md:-right-[24px] md:-top-[24px] md:rounded-[32px]"
                style={{ aspectRatio: '1 / 1', border: `1px solid ${FRAME}` }}
              />
              <div style={{ position: 'relative' }}>
                {data.images.length > 0 ? (
                  <SquareImageCarousel
                    images={data.images}
                    label={`Bilder av ${data.title}`}
                    background="#dde3d4"
                    sizes="(max-width: 640px) 92vw, (max-width: 1024px) 560px, 700px"
                  />
                ) : (
                  <div
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: '26px',
                      background: '#faf6ee',
                      border: `1px solid ${HAIRLINE}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-manrope)',
                        fontSize: '13px',
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: '#6b6f63',
                      }}
                    >
                      Bilder kommer snart
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile only: the CTAs leave the card and land directly under the carousel
                controls, centred. Hidden from `md` up, where the card's copy is used. */}
            <CtaLinks href={data.href} title={data.title} placement="belowCarousel" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
