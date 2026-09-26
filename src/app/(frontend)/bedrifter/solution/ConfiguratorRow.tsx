'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ConfigurableProduct, ConfigurableVariant } from '@/lib/solutions/types'
import { formatPrice } from '@/lib/format'
import ColorSwatchPicker from './ColorSwatchPicker'
import QuantityStepper from './QuantityStepper'
import { BORDER_WARM, INK, MUTED, SAGE, SANS, SERIF, SOFT } from '../theme'

/**
 * One product inside the configurator: its photo, what it costs, its colours, how many of
 * it, and what that line comes to.
 *
 * Presentational — every value comes from the parent, which owns the whole configuration.
 */
export default function ConfiguratorRow({
  product,
  variant,
  quantity,
  unitPrice,
  onVariantChange,
  onQuantityChange,
}: {
  product: ConfigurableProduct
  /** The chosen colour. Undefined only for a product with no variants at all. */
  variant?: ConfigurableVariant
  quantity: number
  /** The effective price, worked out once by the parent. */
  unitPrice: number
  onVariantChange: (variantId: string) => void
  onQuantityChange: (quantity: number) => void
}) {
  const onSale = unitPrice < product.price
  const image = variant?.image || product.image
  const lineTotal = unitPrice * quantity

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
            {formatPrice(unitPrice)}
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
      </div>
    </div>
  )
}
