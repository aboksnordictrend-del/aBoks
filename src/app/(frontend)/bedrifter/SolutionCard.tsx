'use client'

import { Fragment } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { BusinessSolution, SolutionProduct } from '@/lib/bedrifterSolutions'
import { solutionHref } from '@/lib/bedrifterSolutions'
import type { BedrifterProduct } from './BedrifterClient'
import {
  BORDER_WARM,
  INK,
  MUTED,
  OLIVE,
  SAGE,
  SANS,
  SERIF,
  SOFT,
  cardLabelStyle,
  primaryButton,
  secondaryButton,
} from './theme'
import type { RevealProps } from './useReveal'

/**
 * Product photography is held back until the solution illustrations are ready, so the
 * chips are name-only. Turning this on is all that is needed to show the catalogue photo
 * beside each name — the chip already receives the CMS product, and the layout reserves
 * the room for it.
 */
const SHOW_PRODUCT_IMAGES: boolean = false

/**
 * Rules the cards need that inline styles cannot express: the hover lift, the focus ring,
 * and the overlay that makes the whole card a click target for its "Se løsningen" link.
 * Rendered once by `BusinessSolutions` for all of the cards.
 */
export const SOLUTION_CARD_CSS = `
  html[data-site="frontend"] .abx-solution-card {
    transition: box-shadow .35s ease, transform .35s ease;
  }
  @media (hover: hover) {
    html[data-site="frontend"] .abx-solution-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 14px 34px rgba(42,36,24,.10);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    html[data-site="frontend"] .abx-solution-card,
    html[data-site="frontend"] .abx-solution-card:hover {
      transition: none;
      transform: none;
    }
  }
  /* The card is one click target: the primary link's overlay covers the whole card. It is
     measured against the card because nothing between the two is positioned — the button
     row raises itself with z-index alone, which works on a flex item and would otherwise
     become the overlay's containing block and shrink it to the row. */
  html[data-site="frontend"] .abx-solution-actions {
    z-index: 2;
  }
  html[data-site="frontend"] .abx-solution-cta::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    /* The card's radius, not the pill's: an inherited 999px would round the hit area away
       from the card's corners. */
    border-radius: 28px;
  }
  html[data-site="frontend"] .abx-solution-cta:focus-visible {
    outline: 2px solid ${SAGE};
    outline-offset: 3px;
  }
`

/**
 * The illustration area. A solution with no drawing yet renders a placeholder of exactly
 * the size the finished floor plan will take, so adding the image later is a data change
 * and never a layout change.
 */
function SolutionIllustration({
  solution,
  aspect,
  sizes,
}: {
  solution: BusinessSolution
  aspect: string
  sizes: string
}) {
  const illustration = solution.illustration

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspect,
        borderRadius: '20px',
        overflow: 'hidden',
        background: '#f4f0e6',
        border: illustration ? `1px solid ${BORDER_WARM}` : `1px dashed ${BORDER_WARM}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {illustration ? (
        <Image
          src={illustration.src}
          alt={illustration.alt ?? solution.plannedIllustration}
          fill
          sizes={sizes}
          style={{ objectFit: 'cover' }}
        />
      ) : (
        <span
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: '11.5px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: MUTED,
            opacity: 0.75,
          }}
        >
          Illustrasjon kommer
        </span>
      )}
    </div>
  )
}

/** One product in the solution, as a chip. */
function ProductChip({ product, cmsProduct }: { product: SolutionProduct; cmsProduct?: BedrifterProduct }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: SHOW_PRODUCT_IMAGES && cmsProduct?.image ? '8px 16px 8px 8px' : '10px 16px',
        borderRadius: '14px',
        border: `1px solid ${BORDER_WARM}`,
        background: 'rgba(255,255,255,.6)',
      }}
    >
      {SHOW_PRODUCT_IMAGES && cmsProduct?.image && (
        <span
          style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            overflow: 'hidden',
            background: '#f4f0e6',
            flexShrink: 0,
          }}
        >
          <Image src={cmsProduct.image} alt="" fill sizes="38px" style={{ objectFit: 'cover' }} />
        </span>
      )}
      <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: '14.5px', color: INK }}>
          {product.name}
        </span>
        {product.note && (
          <span style={{ fontFamily: SANS, fontSize: '12.5px', color: MUTED }}>{product.note}</span>
        )}
      </span>
    </li>
  )
}

/** The products of the solution, joined by "+" so they read as one combination. */
function ProductCombination({
  products,
  cmsProducts,
}: {
  products: SolutionProduct[]
  cmsProducts: Record<string, BedrifterProduct>
}) {
  return (
    <div>
      <p style={{ ...cardLabelStyle, margin: '0 0 12px' }}>Inngår i løsningen</p>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {products.map((product, i) => (
          <Fragment key={product.name}>
            {i > 0 && (
              <li
                aria-hidden="true"
                style={{ fontFamily: SANS, fontWeight: 600, fontSize: '15px', color: MUTED }}
              >
                +
              </li>
            )}
            <ProductChip
              product={product}
              cmsProduct={product.slug ? cmsProducts[product.slug] : undefined}
            />
          </Fragment>
        ))}
      </ul>
    </div>
  )
}

/**
 * One complete solution, as an introduction to its own page under /bedrifter/<slug>.
 *
 * The card carries only as much as it takes to choose a direction — category, what the
 * solution does, which products it combines — and leaves the detail to that page. Extra
 * buttons (a product sheet, an offer PDF, "Be om tilbud") come from `solution.actions`,
 * which is empty for every solution today.
 */
export default function SolutionCard({
  solution,
  cmsProducts,
  reveal,
  delay = 0,
  onQuoteRequest,
}: {
  solution: BusinessSolution
  /** The catalogue from Payload, keyed by slug. */
  cmsProducts: Record<string, BedrifterProduct>
  reveal: (delay?: number) => RevealProps
  delay?: number
  /** Presets the inquiry form's dropdown and takes over the scroll down to it. */
  onQuoteRequest: (solution: BusinessSolution) => React.MouseEventHandler<HTMLAnchorElement>
}) {
  const illustration = (
    <SolutionIllustration
      solution={solution}
      aspect="16 / 10"
      sizes="(max-width: 1023px) 100vw, 46vw"
    />
  )

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
      <p
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: '11.5px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: SAGE,
          margin: 0,
        }}
      >
        {solution.category}
      </p>

      <h3
        style={{
          fontFamily: SERIF,
          fontWeight: 500,
          fontSize: 'clamp(26px,2.6vw,34px)',
          letterSpacing: '-0.02em',
          lineHeight: 1.12,
          color: INK,
          margin: '14px 0 0',
        }}
      >
        {solution.name}
      </h3>

      {solution.headline && (
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontWeight: 500,
            fontSize: 'clamp(19px,1.8vw,23px)',
            lineHeight: 1.3,
            color: OLIVE,
            margin: '12px 0 0',
          }}
        >
          {solution.headline}
        </p>
      )}

      <p
        style={{
          fontFamily: SANS,
          fontSize: '15.5px',
          lineHeight: 1.7,
          color: SOFT,
          margin: '16px 0 0',
          maxWidth: '54ch',
        }}
      >
        {solution.description}
      </p>

      {solution.note && (
        <p
          style={{
            fontFamily: SANS,
            fontSize: '14.5px',
            lineHeight: 1.65,
            color: MUTED,
            margin: '16px 0 0',
            paddingTop: '16px',
            borderTop: `1px solid ${BORDER_WARM}`,
            maxWidth: '54ch',
          }}
        >
          {solution.note}
        </p>
      )}

      <div style={{ margin: 'clamp(24px,2.6vw,30px) 0 0' }}>
        <ProductCombination products={solution.products} cmsProducts={cmsProducts} />
      </div>

      {/* Pushed to the bottom so the buttons line up across two cards of unequal length. */}
      <div
        className="abx-solution-actions mt-auto flex flex-wrap gap-3"
        style={{ paddingTop: 'clamp(24px,2.6vw,32px)' }}
      >
        <Link
          href={solutionHref(solution)}
          data-btn
          className="abx-solution-cta w-full justify-center px-8 sm:w-auto"
          style={primaryButton}
        >
          Se løsningen
        </Link>

        {/* Empty today. A product sheet, an offer PDF or "Be om tilbud" is one entry in
            `solution.actions` — see `lib/bedrifterSolutions.ts`. */}
        {solution.actions.map((action) =>
          action.kind === 'quote' ? (
            <a
              key={action.label}
              href="#foresporsel"
              data-btn
              onClick={onQuoteRequest(solution)}
              className="w-full justify-center px-8 sm:w-auto"
              style={secondaryButton}
            >
              {action.label}
            </a>
          ) : (
            <a
              key={action.label}
              href={action.href}
              data-btn
              download={action.action === 'download' ? '' : undefined}
              target={action.action === 'download' ? undefined : '_blank'}
              rel={action.action === 'download' ? undefined : 'noopener noreferrer'}
              className="w-full justify-center px-8 sm:w-auto"
              style={secondaryButton}
            >
              {action.label}
            </a>
          ),
        )}
      </div>
    </div>
  )

  return (
    <motion.article
      {...reveal(delay)}
      className="abx-solution-card"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: '28px',
        border: `1px solid ${BORDER_WARM}99`,
        boxShadow: '0 2px 8px rgba(42,36,24,.05)',
        padding: 'clamp(22px,2.6vw,32px)',
      }}
    >
      {/* Every card takes the full width of the section, so illustration and copy sit side
          by side from `lg` — where the card is actually wide enough for two columns. Below
          that the grid collapses to one column: illustration first, copy under it. */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]"
        style={{ columnGap: 'clamp(28px,3.4vw,52px)', rowGap: 'clamp(24px,3vw,32px)', flexGrow: 1 }}
      >
        {illustration}
        {body}
      </div>
    </motion.article>
  )
}
