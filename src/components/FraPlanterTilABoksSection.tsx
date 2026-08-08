'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import FraPlanterTilABoksImage from './FraPlanterTilABoksImage'

export default function FraPlanterTilABoksSection() {
  const reduceMotion = useReducedMotion()

  // Same reveal the homepage's `fadeUp` helper applies to every other section — matched
  // duration and easing so this block enters exactly like Problemet and Løsningen. The
  // props stay identical on the server and the client (only the duration changes under
  // reduced motion), so the SSR markup is never left stranded at opacity 0.
  const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] as const },
  })

  return (
    // Cream between the beige of Løsningen above and the sage of aBoks Vegg below, so the
    // page keeps its alternating rhythm. Section padding is the homepage standard.
    <section aria-labelledby="fra-planter-heading" style={{ background: '#faf6ee', padding: 'clamp(72px,9vw,120px) 0' }}>
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        {/* Left-aligned intro at the width the other full-width sections use for their
            heading block (Hvorfor aBoks, Historien), with the eyebrow → heading → body
            hierarchy and spacing taken from Problemet. */}
        <motion.div {...reveal()} style={{ maxWidth: '680px', marginBottom: 'clamp(40px,5vw,64px)' }}>
          <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 18px' }}>
            Materialet
          </p>
          <h2
            id="fra-planter-heading"
            style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(32px,4vw,52px)', letterSpacing: '-0.02em', lineHeight: 1.07, color: '#1a1d17', margin: '0 0 24px' }}
          >
            Fra planter til aBoks
          </h2>
          <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '18px', lineHeight: 1.65, color: '#3a3f33', margin: 0 }}>
            aBoks er laget av biobasert PLA Matte – et materiale basert på fornybare, plantebaserte
            råvarer. Produktet designes og 3D-printes lokalt i Norge, med fokus på funksjon, design
            og lang levetid.
          </p>
        </motion.div>

        {/* Same treatment as the Problemet visual — 22px radius, hidden overflow, warm
            placeholder behind the image, no shadow or border — but spanning the container
            instead of one grid column, since the text sits above it rather than beside it. */}
        <motion.div {...reveal(0.1)}>
          <FraPlanterTilABoksImage />
        </motion.div>

        {/* Primary CTA, centred under the image. Same pill the hero and the aBoks Vegg
            section use — `data-btn` opts it out of the generic link hover in globals.css and
            into the shared press feedback, so hover, focus and transition behave exactly like
            every other primary button on the page. Left at its intrinsic width rather than
            full-bleed on mobile, since it stands alone here. */}
        <motion.div
          {...reveal(0.2)}
          style={{ display: 'flex', justifyContent: 'center', marginTop: 'clamp(32px,4vw,44px)' }}
        >
          <Link
            href="/inspirasjon/fra-planter-til-aboks"
            data-btn
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            Les mer om materialet
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
