'use client'

import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/format'
import {
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

export interface RecommendationCardProps {
  product: RecommendationProduct
  /** The customer's colour pick, if they have made one. */
  selectedVariantId?: string
  /** True inside the post-add confirmation window: button reads «Lagt til» and is inert. */
  busy: boolean
  onSelectVariant: (variantId: string) => void
  onAdd: () => void
}

export default function RecommendationCard({
  product,
  selectedVariantId,
  busy,
  onSelectVariant,
  onAdd,
}: RecommendationCardProps) {
  const variant = resolveRecommendationVariant(product, selectedVariantId)
  // No resolvable variant means several colours and no pick yet — never a silent guess.
  const needsChoice = !variant
  const disabled = busy || needsChoice
  const label = busy
    ? RECOMMENDATION_LABELS.added
    : needsChoice
      ? RECOMMENDATION_LABELS.chooseVariant
      : RECOMMENDATION_LABELS.add

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: '#fff',
        borderRadius: '18px',
        padding: '14px',
        boxShadow: '0 2px 6px rgba(42,36,24,.05)',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Link
          href={product.href}
          data-btn
          aria-label={product.title}
          tabIndex={-1}
          style={{
            flexShrink: 0,
            width: '64px',
            height: '64px',
            borderRadius: '13px',
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
              sizes="64px"
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
              fontSize: '19px',
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
              gap: '7px',
              flexWrap: 'wrap',
              marginTop: '5px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-manrope)',
                fontWeight: 700,
                fontSize: '15px',
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
                  fontSize: '13px',
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
                fontSize: '12.5px',
                color: '#6b6f63',
                marginTop: '3px',
              }}
            >
              {product.variants[0].name}
            </span>
          )}
        </div>
      </div>

      {/* Several colours: choose inline rather than being sent to the product page. */}
      {product.variants.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                  width: '26px',
                  height: '26px',
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
          <span
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '12.5px',
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
          gap: '8px',
          padding: '11px 18px',
          borderRadius: '999px',
          border: 'none',
          background: disabled ? '#c8c0b0' : '#39402c',
          color: '#faf6ee',
          fontFamily: 'var(--font-manrope)',
          fontWeight: 600,
          fontSize: '14px',
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
            width="15"
            height="15"
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
