'use client'

import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/format'
import { cartLineTitle, type ProductTitlesBySlug } from '@/lib/cart/lineTitle'
import {
  cartLineHasVolumePrice,
  cartLineQuoteAvailable,
  cartLineTotal,
  cartLineUnitPrice,
} from '@/lib/cart/linePricing'
import { QUOTE_TEXT, quoteExplanationFor, quoteRequestHref } from '@/lib/quoteRequest'
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
 *
 * ── Prices ──
 *
 * Nothing here multiplies, compares or discounts. The effective unit price, the line total and
 * whether a quote is offered all come from @/lib/cart/linePricing, which reads the one
 * quantity-pricing table — so a `+` that crosses a band reprices the whole line on the next
 * render, and a `−` that crosses back reverses it, with no effect and no reload. There is
 * deliberately no `if (qty >= 10)` in this file.
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
  // One question each, answered by the shared engine.
  const unitPrice = cartLineUnitPrice(item)
  const lineTotal = cartLineTotal(item)
  const volumePriceActive = cartLineHasVolumePrice(item)
  // A CTA fact, not a price one: the line above is priced, totalled and charged identically
  // whether this is true or false.
  const quoteAvailable = cartLineQuoteAvailable(item)
  const quoteExplanation = quoteAvailable ? quoteExplanationFor({ slug: item.productSlug }) : null

  return (
    // The row itself is unchanged; the padding and the rule moved out to this wrapper so the
    // quote offer can sit under the line, inside the same bordered block.
    <div style={{ padding: '24px 0', borderBottom: '1px solid #e7e2d4' }}>
    <div
      style={{
        display: 'flex',
        gap: '20px',
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
      <div style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#1a1d17' }}>
          {formatPrice(lineTotal)}
        </div>
        {/* The effective unit price, under the line total. Omitted at a single unit, where the
            total already is the unit price and a second identical amount would be noise. */}
        {item.qty > 1 && (
          <div
            style={{
              fontFamily: 'var(--font-manrope)',
              fontSize: '13px',
              color: '#6b6f63',
              marginTop: '5px',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'flex-end',
              gap: '7px',
            }}
          >
            {/* The ordinary price, struck through, only while a volume band is active. */}
            {volumePriceActive && (
              <span style={{ color: '#9a9488', textDecoration: 'line-through' }}>
                {formatPrice(item.price)}
              </span>
            )}
            <span style={volumePriceActive ? { fontWeight: 600, color: '#5f8253' } : undefined}>
              {formatPrice(unitPrice)} per stk.
            </span>
          </div>
        )}
      </div>
    </div>

    {/*
      «Be om tilbud», from the quantity the customer has actually asked for.

      An addition, never a redirection: the price above still applies, the line still counts
      towards the subtotal and towards free shipping, and «Gå til kassen» is untouched. The
      link is an ordinary href to the B2B enquiry form that already exists on /bedrifter, with
      the product and the quantity carried across.
    */}
    {quoteAvailable && quoteExplanation && (
      <div
        style={{
          marginTop: '18px',
          padding: '16px 18px',
          background: '#f2efe4',
          borderRadius: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px 18px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: '13.5px',
            lineHeight: 1.6,
            color: '#5b5646',
            margin: 0,
            maxWidth: '46ch',
          }}
        >
          {quoteExplanation}{' '}
          <span style={{ color: '#6b6057' }}>{QUOTE_TEXT.note}</span>
        </p>
        <Link
          href={quoteRequestHref({ productSlug: item.productSlug, quantity: item.qty })}
          data-btn
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '11px 22px',
            borderRadius: '999px',
            border: '1.5px solid #39402c',
            background: 'transparent',
            color: '#39402c',
            fontFamily: 'var(--font-manrope)',
            fontWeight: 600,
            fontSize: '13.5px',
            textDecoration: 'none',
          }}
        >
          {QUOTE_TEXT.cta}
        </Link>
      </div>
    )}
    </div>
  )
}
