'use client'

import Image from 'next/image'
import { formatPrice } from '@/lib/format'
import { cartLineTitle, type ProductTitlesBySlug } from '@/lib/cart/lineTitle'
import type { CartItem } from '@/store/cart'

/**
 * One line of the cart: picture, product name, colour, quantity stepper, remove, line total.
 *
 * Lifted out of CartClient unchanged — same markup, same styles, same aria labels — for one
 * reason: the product name used to be a literal here, and a literal is exactly the kind of
 * thing that needs a test pointing at it. CartClient itself cannot be asserted on, because a
 * zustand-persisted store reports its *initial* (empty) state to React's server renderer, so
 * the page always renders the empty cart until it hydrates in the browser.
 *
 * Presentational only: no store access, no state. The title is resolved by the parent and
 * passed in, so this component has no way to invent one.
 */

export interface CartLineProps {
  item: CartItem
  /** Catalogue titles by slug; the title is resolved here through `cartLineTitle`. */
  productTitles?: ProductTitlesBySlug
  onDecrement: () => void
  onIncrement: () => void
  onRemove: () => void
}

export default function CartLine({
  item,
  productTitles,
  onDecrement,
  onIncrement,
  onRemove,
}: CartLineProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '20px',
        padding: '24px 0',
        borderBottom: '1px solid #e7e2d4',
        alignItems: 'center',
      }}
    >
      <div style={{ flexShrink: 0, width: '96px', height: '96px', borderRadius: '16px', overflow: 'hidden', background: '#e7d9bd', position: 'relative' }}>
        {/* A line with no picture keeps the tinted tile rather than rendering an empty src. */}
        {item.colorImage ? (
          <Image
            src={item.colorImage}
            alt={item.colorName || cartLineTitle(item, productTitles)}
            fill
            style={{ objectFit: 'cover' }}
            sizes="96px"
          />
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* The product that was actually added. The colour lives on its own line below and is
            never folded into this title. */}
        <h3 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: '22px', color: '#1a1d17', margin: '0 0 4px' }}>
          {cartLineTitle(item, productTitles)}
        </h3>
        {/* Colour row — omitted entirely for a product that has no variants, rather than
            rendering an empty swatch next to an empty name. */}
        {item.colorName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '999px', background: item.colorHex, boxShadow: '0 0 0 1px rgba(0,0,0,.15)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6f63' }}>{item.colorName}</span>
          </div>
        ) : (
          <div style={{ marginBottom: '14px' }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid #d6cfbd', borderRadius: '999px', overflow: 'hidden', background: '#fff' }}>
            <button
              onClick={onDecrement}
              aria-label="Færre"
              style={{ width: '38px', height: '40px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#1a1d17' }}
            >
              −
            </button>
            <span style={{ minWidth: '34px', textAlign: 'center', fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '15px' }}>{item.qty}</span>
            <button
              onClick={onIncrement}
              aria-label="Flere"
              style={{ width: '38px', height: '40px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#1a1d17' }}
            >
              +
            </button>
          </div>
          <button
            onClick={onRemove}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#b06a4a', textDecoration: 'underline', textUnderlineOffset: '3px' }}
          >
            Fjern
          </button>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#1a1d17', whiteSpace: 'nowrap' }}>
        {formatPrice(item.qty * item.price)}
      </div>
    </div>
  )
}
