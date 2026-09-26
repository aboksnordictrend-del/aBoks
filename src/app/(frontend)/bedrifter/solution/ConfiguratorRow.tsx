'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ConfigurableProduct, ConfigurableVariant } from '@/lib/solutions/types'
import { formatPrice } from '@/lib/format'
import ColorSwatchPicker from './ColorSwatchPicker'
import QuantityStepper from './QuantityStepper'
import { BORDER_WARM, INK, MUTED, OLIVE, SAGE, SANS, SERIF, SOFT } from '../theme'

/**
 * One product inside the configurator: its photo, what it costs, its colours, how many of
 * it, what that line comes to, and what the next quantity band would cost.
 *
 * Presentational — every value comes from the parent, which owns the whole configuration and
 * asks the shared quantity-pricing engine. There is no pricing arithmetic in this file: no
 * multiplication, no comparison against a threshold, no tier table. The two `<`s below only
 * decide whether a figure is worth striking through.
 */
export default function ConfiguratorRow({
  product,
  variant,
  quantity,
  basePrice,
  unitPrice,
  lineTotal,
  nextTier,
  onVariantChange,
  onQuantityChange,
}: {
  product: ConfigurableProduct
  /** The chosen colour. Undefined only for a product with no variants at all. */
  variant?: ConfigurableVariant
  quantity: number
  /**
   * What one of these costs on its own — the catalogue price through the sale window. This is
   * the card's headline price, and the figure the per-unit line below strikes through once a
   * volume band brings the price down.
   */
  basePrice: number
  /**
   * The effective price for THIS product at THIS quantity, worked out once by the parent
   * through the shared quantity-pricing engine. Never recomputed here.
   */
  unitPrice: number
  /** quantity × unitPrice, from the same engine. Never multiplied here. */
  lineTotal: number
  /**
   * The next band down, or null when there is no cheaper automatic price left. Resolved by
   * the parent from the engine; a quote threshold is never one of these.
   */
  nextTier: { minQuantity: number; unitPrice: number } | null
  onVariantChange: (variantId: string) => void
  onQuantityChange: (quantity: number) => void
}) {
  // A genuine sale on the headline price. The volume band is shown on its own line under the
  // stepper instead, where the quantity that caused it is.
  const onSale = basePrice < product.price
  // Is a volume band actually active at this quantity?
  const volumePriceActive = unitPrice < basePrice
  const image = variant?.image || product.image

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-[132px_1fr]"
      style={{
        gap: 'clamp(18px,2.4vw,28px)',
        padding: 'clamp(20px,2.4vw,28px)',
        background: '#fff',
        border: `1px solid ${BORDER_WARM}99`,
        borderRadius: '22px',
      }}
    >
      <Link
        href={`/produkter/${product.slug}`}
        data-btn
        aria-label={`Se produktdetaljer for ${product.title}`}
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          maxWidth: '132px',
          aspectRatio: '1 / 1',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#f4f0e6',
        }}
      >
        {image && (
          <Image
            src={image}
            alt={variant ? `${product.title} – ${variant.name}` : product.imageAlt}
            fill
            sizes="132px"
            style={{ objectFit: 'cover' }}
          />
        )}
      </Link>

      <div style={{ minWidth: 0 }}>
        {/* Name + price */}
        <div
          className="flex flex-wrap items-baseline"
          style={{ gap: '6px 14px', marginBottom: '4px' }}
        >
          <h3
            style={{
              fontFamily: SERIF,
              fontWeight: 500,
              fontSize: 'clamp(22px,2.2vw,28px)',
              letterSpacing: '-0.015em',
              lineHeight: 1.15,
              color: INK,
              margin: 0,
            }}
          >
            {product.title}
          </h3>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: '8px',
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: '16px',
              color: INK,
            }}
          >
            {formatPrice(basePrice)}
            {onSale && (
              <span
                style={{
                  fontWeight: 500,
                  fontSize: '14px',
                  color: MUTED,
                  textDecoration: 'line-through',
                }}
              >
                {formatPrice(product.price)}
              </span>
            )}
          </span>
        </div>

        {product.tagline && (
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14.5px',
              lineHeight: 1.6,
              color: SOFT,
              margin: '0 0 10px',
              maxWidth: '46ch',
            }}
          >
            {product.tagline}
          </p>
        )}

        <Link
          href={`/produkter/${product.slug}`}
          style={{
            fontFamily: SANS,
            fontWeight: 600,
            fontSize: '13.5px',
            color: SAGE,
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          Se produktdetaljer
        </Link>

        {/* Colour */}
        {product.variants.length > 0 && (
          <div style={{ marginTop: 'clamp(18px,2vw,22px)' }}>
            <p
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 8px',
                fontFamily: SANS,
                fontSize: '13.5px',
                color: MUTED,
                margin: '0 0 12px',
              }}
            >
              <span style={{ fontWeight: 700, color: INK }}>Farge:</span>
              <span>{variant?.name ?? 'Velg farge'}</span>
            </p>
            <ColorSwatchPicker
              variants={product.variants}
              selectedId={variant?.id ?? ''}
              onSelect={onVariantChange}
              label={`Farge på ${product.title}`}
            />
          </div>
        )}

        {/* Quantity + line total */}
        <div
          className="flex flex-wrap items-center"
          style={{ gap: '14px 20px', marginTop: 'clamp(18px,2vw,22px)' }}
        >
          <QuantityStepper
            value={quantity}
            onChange={onQuantityChange}
            label={`Antall ${product.title}`}
          />
          <span
            style={{
              fontFamily: SANS,
              fontSize: '15px',
              color: quantity > 0 ? INK : MUTED,
            }}
          >
            {quantity > 0 ? (
              <>
                <span style={{ fontWeight: 700 }}>{formatPrice(lineTotal)}</span>
                <span style={{ color: MUTED }}> for {quantity} stk.</span>
              </>
            ) : (
              'Ikke med i løsningen'
            )}
          </span>
        </div>

        {/*
          Quantity-price guidance — the same three pieces the product page shows, in the same
          order: what a unit costs at this quantity, what it costs without the band, and what
          the next band down would cost.

          It sits under the stepper and the line total on purpose, so the hierarchy stays
          quantity → total → guidance, and it is one wrapping row rather than a block, so a
          card grows by a line of text at most and the controls above it never reflow.

          `nextTier` comes from the pricing engine and is null once a product is in its last
          price band, so nothing here can promote a quote threshold as if it were a discount.
        */}
        {quantity > 0 && (
          <p
            className="flex flex-wrap items-baseline"
            style={{
              gap: '2px 10px',
              fontFamily: SANS,
              fontSize: '13.5px',
              lineHeight: 1.5,
              color: MUTED,
              margin: '10px 0 0',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '7px' }}>
              <span style={volumePriceActive ? { fontWeight: 700, color: OLIVE } : undefined}>
                {formatPrice(unitPrice)} per stk.
              </span>
              {volumePriceActive && (
                <span style={{ textDecoration: 'line-through' }}>{formatPrice(basePrice)}</span>
              )}
            </span>
            {nextTier && (
              <span>
                <span aria-hidden="true" style={{ paddingRight: '10px' }}>
                  ·
                </span>
                Kjøp {nextTier.minQuantity} stk. og betal {formatPrice(nextTier.unitPrice)} per stk.
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
