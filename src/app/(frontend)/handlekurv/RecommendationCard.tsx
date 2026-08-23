'use client'

import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/format'
import {
  needsVariantChoice,
  resolveRecommendationVariant,
  type RecommendationProduct,
} from '@/lib/cart/recommendations'

/**
 * One card in «Passer godt sammen med».
 *
 * Presentational only: it holds no state, fetches nothing and never touches the cart store.
 * Which variant is selected, whether the button is mid-confirmation and what happens on a
 * click all come from CartRecommendations, so the whole visual surface can be rendered and
 * asserted without a browser.
 *
 * Styling is the cart's own — Cormorant for names, Manrope for figures, the olive #39402c
 * pill, 999px radii and the same soft card shadow as the summary panel next to it.
 */

export const RECOMMENDATION_LABELS = {
  add: 'Legg til',
  added: 'Lagt til',
  chooseVariant: 'Velg farge',
} as const

/**
 * Which shape the card takes.
 *
 * `default` is the full-width card the /handlekurv page has always shown: a 64px thumbnail
 * beside the name. `cartGrid` is the compact, stacked card the drawer packs two to a row —
 * image on top, text under it, CTA pinned to the bottom edge. Only measurements and the
 * stacking direction differ; the controls on offer and what they do are identical.
 */
export type RecommendationCardLayout = 'default' | 'cartGrid'

/** Every measurement that differs between the two shapes, in one place. */
const SIZES = {
  default: {
    cardRadius: '18px',
    cardPadding: '14px',
    cardGap: '12px',
    headDirection: 'row',
    headAlign: 'center',
    headGap: '12px',
    imageRadius: '13px',
    imageSizes: '64px',
    titleSize: '19px',
    priceSize: '15px',
    compareSize: '13px',
    noteSize: '12.5px',
    swatch: '26px',
    swatchGap: '8px',
    ctaPadding: '11px 18px',
    ctaSize: '14px',
    ctaIcon: 15,
  },
  cartGrid: {
    cardRadius: '14px',
    cardPadding: '9px',
    cardGap: '8px',
    headDirection: 'column',
    headAlign: 'stretch',
    headGap: '8px',
    imageRadius: '10px',
    // Half a 440px drawer on desktop, a little under half the viewport on a phone.
    imageSizes: '(max-width: 520px) 45vw, 200px',
    titleSize: '15px',
    priceSize: '13.5px',
    compareSize: '11.5px',
    noteSize: '11px',
    swatch: '18px',
    swatchGap: '5px',
    ctaPadding: '9px 10px',
    ctaSize: '12.5px',
    ctaIcon: 13,
  },
} as const

export interface RecommendationCardProps {
  product: RecommendationProduct
  /** The customer's colour pick, if they have made one. */
  selectedVariantId?: string
  /** True inside the post-add confirmation window: button reads «Lagt til» and is inert. */
  busy: boolean
  /** Presentation only — see RecommendationCardLayout. Defaults to the cart page's card. */
  layout?: RecommendationCardLayout
  onSelectVariant: (variantId: string) => void
  onAdd: () => void
}

export default function RecommendationCard({
  product,
  selectedVariantId,
  busy,
  layout = 'default',
  onSelectVariant,
  onAdd,
}: RecommendationCardProps) {
  const variant = resolveRecommendationVariant(product, selectedVariantId)
  // Several colours and no pick yet — never a silent guess. A product with no colours at all
  // resolves to no variant too, but has nothing to choose, so it is addable immediately.
  const needsChoice = needsVariantChoice(product, selectedVariantId)
  const disabled = busy || needsChoice
  const label = busy
    ? RECOMMENDATION_LABELS.added
    : needsChoice
      ? RECOMMENDATION_LABELS.chooseVariant
      : RECOMMENDATION_LABELS.add

  const compact = layout === 'cartGrid'
  const size = SIZES[layout]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: size.cardGap,
        background: '#fff',
        borderRadius: size.cardRadius,
        padding: size.cardPadding,
        boxShadow: '0 2px 6px rgba(42,36,24,.05)',
        // As a grid child: never wider than its own track. Compact cards also take the full
        // height of their row, which is what lets the CTA below sit on the bottom edge and
        // line up with its neighbour's however much text the two carry.
        minWidth: 0,
        ...(compact ? { height: '100%' } : null),
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: size.headDirection,
          gap: size.headGap,
          alignItems: size.headAlign,
          minWidth: 0,
        }}
      >
        <Link
          href={product.href}
          data-btn
          aria-label={product.title}
          tabIndex={-1}
          style={{
            flexShrink: 0,
            // Stacked: the full width of the card at a fixed square ratio, so neighbouring
            // cards show the product at exactly the same size and nothing is stretched. Beside
            // the name: the 64px tile, unchanged.
            ...(compact
              ? { width: '100%', aspectRatio: '1 / 1' }
              : { width: '64px', height: '64px' }),
            borderRadius: size.imageRadius,
            overflow: 'hidden',
            background: '#ede8db',
            position: 'relative',
            display: 'block',
          }}
        >
          {/* No image is a tinted tile, the same fallback the catalogue cards use. */}
          {product.image ? (
            <Image
              src={product.image}
              alt={product.imageAlt || product.title}
              fill
              sizes={size.imageSizes}
              style={{ objectFit: 'cover' }}
            />
          ) : null}
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href={product.href}
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 600,
              fontSize: size.titleSize,
              lineHeight: 1.15,
              color: '#1a1d17',
              textDecoration: 'none',
              // Two lines maximum, then clipped — a long name never breaks the grid.
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}
          >
            {product.title}
          </Link>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: compact ? '5px' : '7px',
              flexWrap: 'wrap',
              marginTop: compact ? '4px' : '5px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-manrope)',
                fontWeight: 700,
                fontSize: size.priceSize,
                color: '#1a1d17',
                whiteSpace: 'nowrap',
              }}
            >
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice !== null && (
              <span
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontSize: size.compareSize,
                  color: '#6b6f63',
                  textDecoration: 'line-through',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>

          {/* One colour needs no choosing — name it and be done. */}
          {product.variants.length === 1 && product.variants[0].name && (
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-manrope)',
                fontSize: size.noteSize,
                color: '#6b6f63',
                marginTop: '3px',
                overflowWrap: 'anywhere',
              }}
            >
              {product.variants[0].name}
            </span>
          )}
        </div>
      </div>

      {/* Several colours: choose inline rather than being sent to the product page. */}
      {product.variants.length > 1 && (
        <div
          style={{
            display: 'flex',
            // A compact card has half a drawer to work with, so the chosen colour's name goes
            // on its own line under the swatches rather than competing with them for width.
            flexDirection: compact ? 'column' : 'row',
            alignItems: compact ? 'stretch' : 'center',
            gap: compact ? '5px' : '8px',
            // The row form still wraps the name below the swatches when it runs out of width,
            // exactly as it did when they were siblings.
            flexWrap: compact ? 'nowrap' : 'wrap',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: size.swatchGap,
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            {product.variants.map((option) => {
              const selected = option.id === selectedVariantId
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectVariant(option.id)}
                  aria-label={option.name}
                  aria-pressed={selected}
                  title={option.name}
                  style={{
                    width: size.swatch,
                    height: size.swatch,
                    flexShrink: 0,
                    borderRadius: '999px',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background: option.colorHex,
                    // A ring on every swatch, not just the dark ones, so a pale colour is
                    // still visible against the white card.
                    boxShadow: selected
                      ? '0 0 0 2px #fff, 0 0 0 3.5px #39402c'
                      : '0 0 0 1px rgba(0,0,0,.18)',
                    transition: 'box-shadow 0.2s ease',
                  }}
                />
              )
            })}
          </div>
          {/* Rendered whether or not a colour is picked, so choosing one never moves the card. */}
          <span
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: size.noteSize,
              color: '#6b6f63',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {variant ? variant.name : RECOMMENDATION_LABELS.chooseVariant}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-busy={busy}
        style={{
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? '6px' : '8px',
          // Compact only: pushed to the bottom of the card so the CTAs of two side-by-side
          // neighbours line up. The full-width card keeps its ordinary flow position.
          ...(compact ? { marginTop: 'auto' } : null),
          padding: size.ctaPadding,
          borderRadius: '999px',
          border: 'none',
          background: disabled ? '#c8c0b0' : '#39402c',
          color: '#faf6ee',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 600,
          fontSize: size.ctaSize,
          // Tight and single-line in the compact card, where the pill is only half a drawer
          // wide; untouched in the full-width one.
          ...(compact ? { lineHeight: 1.2, whiteSpace: 'nowrap' } : null),
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#2a3020'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = disabled ? '#c8c0b0' : '#39402c'
        }}
      >
        {busy && (
          <svg
            width={size.ctaIcon}
            height={size.ctaIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
        {label}
      </button>
    </div>
  )
}
