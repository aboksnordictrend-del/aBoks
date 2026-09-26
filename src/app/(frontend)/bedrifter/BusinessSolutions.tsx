'use client'

import { motion } from 'framer-motion'
import { BUSINESS_SOLUTIONS, type BusinessSolution } from '@/lib/bedrifterSolutions'
import type { BedrifterProduct } from './BedrifterClient'
import SolutionCard, { SOLUTION_CARD_CSS } from './SolutionCard'
import SolutionFlow from './SolutionFlow'
import {
  ANCHOR_OFFSET,
  CREAM,
  INK,
  OLIVE,
  PALE_SAGE,
  SANS,
  SECTION_PAD,
  SERIF,
  SOFT,
  eyebrowStyle,
  h2Style,
  introStyle,
  primaryButton,
} from './theme'
import type { RevealProps } from './useReveal'

/**
 * "Komplette batteriløsninger for arbeidsplassen" — the packages, shown above the
 * individual products further down /bedrifter.
 *
 * Every card is an introduction to its own page under /bedrifter/<slug>; the content comes
 * from `BUSINESS_SOLUTIONS`, so a new solution is a data entry and needs nothing here.
 */
export default function BusinessSolutions({
  products,
  reveal,
  onQuoteRequest,
  afterCards,
}: {
  /** The catalogue from Payload, as `page.tsx` resolved it. */
  products: BedrifterProduct[]
  reveal: (delay?: number) => RevealProps
  /**
   * Presets the inquiry form further down the page and takes over the scroll to it. Used
   * by the closing call to action, and by any solution with a `quote` action.
   */
  onQuoteRequest: (solution?: BusinessSolution) => React.MouseEventHandler<HTMLAnchorElement>
  /**
   * Rendered between the cards and the closing note, full width — the calculator answers
   * exactly the question the four cards leave behind, so it belongs inside this block
   * rather than after it. A full-bleed band cannot live inside the container the cards sit
   * in, which is why the block is two sections with the slot between them.
   */
  afterCards?: React.ReactNode
}) {
  // Keyed by slug so a card can reach its products without searching the array per chip.
  const cmsProducts: Record<string, BedrifterProduct> = Object.fromEntries(
    products.map((product) => [product.slug, product]),
  )

  return (
    <>
    <section
      id="bedriftslosninger"
      aria-labelledby="bedriftslosninger-heading"
      style={{
        background: CREAM,
        // A little tighter at the foot than a standalone section: what follows is the next
        // step in the same thought, not a new subject.
        padding: 'clamp(72px,9vw,120px) 0 clamp(56px,7vw,88px)',
        scrollMarginTop: ANCHOR_OFFSET,
      }}
    >
      <style>{SOLUTION_CARD_CSS}</style>

      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <motion.div {...reveal()} style={{ maxWidth: '760px' }}>
          <p style={eyebrowStyle}>aBoks Bedriftsløsninger</p>
          <h2 id="bedriftslosninger-heading" style={h2Style}>
            Komplette batteriløsninger for arbeidsplassen.
          </h2>
          <p style={introStyle}>
            Fra arbeidsplassen til felles innsamlingspunkt. aBoks kombinerer flere produkter i én
            helhetlig løsning tilpasset virksomhetens lokaler og behov.
          </p>
        </motion.div>

        <div style={{ margin: 'clamp(44px,5.5vw,72px) 0 0' }}>
          <SolutionFlow reveal={reveal} />
        </div>

        {/* ── The four packages ── */}
        {/* The hero's "Se løsningene" lands here rather than on the block above: the
            packages are what that button promises. `scrollMarginTop` keeps the heading
            clear of the fixed header for a direct /bedrifter#losninger hit; a click goes
            through `anchorClick`, which measures the header instead. */}
        <section
          id="losninger"
          aria-labelledby="losninger-heading"
          style={{ margin: 'clamp(64px,8vw,104px) 0 0', scrollMarginTop: ANCHOR_OFFSET }}
        >
          <motion.div {...reveal()} style={{ maxWidth: '720px' }}>
            <h3
              id="losninger-heading"
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 'clamp(27px,3.2vw,40px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: INK,
                margin: 0,
              }}
            >
              Finn løsningen som passer deres virksomhet.
            </h3>
            <p style={{ ...introStyle, fontSize: 'clamp(15.5px,1.3vw,17px)' }}>
              Velg en løsning som utgangspunkt. Antall og kombinasjon av aBoks-enheter tilpasses
              virksomhetens størrelse, lokaler og behov.
            </p>
          </motion.div>

          {/* One card per row — each one is a full-width panel, so two to a row would
              halve the space the floor plans need. */}
          <div
            className="mt-[clamp(36px,4.5vw,56px)] flex flex-col"
            style={{ gap: 'clamp(20px,2.4vw,28px)' }}
          >
            {BUSINESS_SOLUTIONS.map((solution) => (
              <SolutionCard
                key={solution.slug}
                solution={solution}
                cmsProducts={cmsProducts}
                reveal={reveal}
                onQuoteRequest={onQuoteRequest}
              />
            ))}
          </div>
        </section>
      </div>
    </section>

    {afterCards}

    {/* ── Closing note ── */}
    <section
      aria-labelledby="tilpasset-tilbud-heading"
      style={{ background: CREAM, padding: 'clamp(56px,7vw,88px) 0 clamp(72px,9vw,120px)' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <motion.div
          {...reveal()}
          className="grid grid-cols-1 lg:grid-cols-[1.4fr_auto]"
          style={{
            padding: 'clamp(30px,4vw,52px) clamp(26px,4vw,56px)',
            background: PALE_SAGE,
            borderRadius: '28px',
            columnGap: 'clamp(28px,4vw,56px)',
            rowGap: 'clamp(24px,3vw,32px)',
            alignItems: 'center',
          }}
        >
          <div>
            <h3
              id="tilpasset-tilbud-heading"
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 'clamp(25px,2.8vw,36px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.12,
                color: INK,
                margin: 0,
              }}
            >
              Ingen virksomheter er helt like.
            </h3>
            <p
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(15.5px,1.3vw,17px)',
                lineHeight: 1.7,
                color: SOFT,
                margin: '14px 0 0',
                maxWidth: '58ch',
              }}
            >
              Derfor tilpasses antall og kombinasjon av aBoks-enheter etter lokalene, antall
              arbeidsområder og behovet for innsamling. Vi hjelper dere med å finne en løsning som
              passer.
            </p>
          </div>

          <div className="flex lg:justify-end">
            <a
              href="#foresporsel"
              data-btn
              onClick={onQuoteRequest()}
              className="w-full justify-center px-9 sm:w-auto"
              style={{ ...primaryButton, background: OLIVE, color: CREAM }}
            >
              Be om et tilpasset tilbud
            </a>
          </div>
        </motion.div>
      </div>
    </section>
    </>
  )
}
