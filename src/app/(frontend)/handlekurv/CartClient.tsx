'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { cartLineRef, useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/format'
import { trackViewCart, trackBeginCheckout } from '@/lib/analytics'
import PromoCodeField from '@/components/PromoCodeField'
import CartRecommendations from './CartRecommendations'
import CartLine from './CartLine'
import { type ProductTitlesBySlug } from '@/lib/cart/lineTitle'
import { usePromoCode } from '@/lib/promo/usePromoCode'
import { buildSummaryRows } from '@/lib/promo/cartPromo'

/**
 * `productTitles` is the catalogue's slug → title map, supplied by the server component.
 * Optional so the component still renders on its own (tests, and any caller that has no
 * catalogue to hand); each line then falls back to the title stored on it.
 */
export default function CartClient({ productTitles }: { productTitles?: ProductTitlesBySlug }) {
  const { items, removeItem, incrementItem, decrementItem, subtotal, shipping, orderTotal } = useCartStore()
  const sub = subtotal()
  const shippingCost = shipping()
  const total = orderTotal()
  const hasCart = items.length > 0

  const promo = usePromoCode()
  // With a code applied these figures come from the server (computed from live catalogue
  // prices); without one they are the cart's own, exactly as before. The client never
  // derives a discount — see src/lib/promo/cartPromo.ts.
  const summaryRows = buildSummaryRows(
    { subtotal: sub, shipping: shippingCost, total },
    promo.totals,
  )
  // The checkout total is still the undiscounted one until the Kustom stage lands; tracking
  // keeps using it so analytics stays consistent with what is actually charged today.
  const checkoutTotal = total

  /**
   * view_cart — once per view of this page, and only for a cart that actually has something
   * in it.
   *
   * Why this cannot read `items`/`total` from the render above: zustand subscribes through
   * `useSyncExternalStore`, whose *third* argument (`getServerSnapshot`, the store's initial
   * state) is what React uses for the client's hydration render too — not just on the server.
   * So on the first render `items` is `[]` however full the persisted cart is, and a
   * mount-only effect closing over it saw `hasCart === false` and sent nothing. The persisted
   * cart was already in the store by then; only the snapshot React handed the component was
   * empty. That is the bug: on an ordinary load of /handlekurv, view_cart never fired.
   *
   * So the cart is read from the store directly, after hydration. `persist.hydrate()` runs at
   * store-creation time and localStorage is synchronous, so `hasHydrated()` is normally
   * already true when this effect runs; `onFinishHydration` is the honest fallback for the
   * case where it is not, and is unsubscribed on unmount.
   *
   * `sent` makes it exactly once per mount: quantity changes, removals, promo edits and
   * StrictMode's second effect pass all find it already set. Remounting the page — a fresh
   * load or a client-side navigation back to it — is a new view and starts over.
   */
  const sent = useRef(false)
  useEffect(() => {
    const send = () => {
      if (sent.current) return
      const state = useCartStore.getState()
      if (state.items.length === 0) return
      sent.current = true
      // The same payload as before: the cart's own lines and its undiscounted order total.
      trackViewCart(state.items, state.orderTotal())
    }

    if (useCartStore.persist.hasHydrated()) {
      send()
      return
    }
    return useCartStore.persist.onFinishHydration(send)
  }, [])

  return (
    <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee', minHeight: '100vh' }}>
      <section style={{ padding: 'clamp(32px,5vw,56px) 0 clamp(80px,10vw,120px)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(38px,4.6vw,60px)',
              letterSpacing: '-0.022em',
              lineHeight: 1.02,
              color: '#1a1d17',
              margin: '0 0 clamp(28px,4vw,44px)',
            }}
          >
            Handlekurv
          </h1>

          {hasCart ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: 'clamp(28px,4vw,52px)',
                alignItems: 'start',
              }}
            >
              {/* Cart items */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {items.map((item) => {
                  // The line's own reference, not its variant id: a product with no variants
                  // has none, and every one of them would otherwise share the same key.
                  const ref = cartLineRef(item)
                  return (
                    <CartLine
                      key={ref}
                      item={item}
                      productTitles={productTitles}
                      onDecrement={() => decrementItem(ref)}
                      onIncrement={() => incrementItem(ref)}
                      onRemove={() => removeItem(ref)}
                    />
                  )
                })}

                <Link
                  href="/produkter/aboks"
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: '24px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    textDecoration: 'none',
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#39402c',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  Fortsett å handle
                </Link>

                {/* «Passer godt sammen med» — under the cart lines, before the summary in both
                    the DOM and the stacked mobile layout. Renders nothing when the products in
                    the cart have no recommendations configured. */}
                <CartRecommendations />
              </div>

              {/* Order summary */}
              <div
                style={{
                  background: '#fff',
                  borderRadius: '22px',
                  padding: '32px',
                  boxShadow: '0 2px 6px rgba(42,36,24,.05)',
                  position: 'sticky',
                  top: '120px',
                }}
              >
                <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#1a1d17', margin: '0 0 22px' }}>Oppsummering</h2>

                <PromoCodeField promo={promo} />

                {summaryRows
                  .filter((row) => row.key !== 'total')
                  .map((row) => (
                    <div
                      key={row.key}
                      style={{ display: 'flex', justifyContent: 'space-between', marginBottom: row.key === 'shipping' ? '18px' : '14px' }}
                    >
                      <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63' }}>{row.label}</span>
                      {row.free ? (
                        <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#5f8253' }}>Gratis</span>
                      ) : (
                        <span
                          style={{
                            fontFamily: 'var(--font-manrope)',
                            fontSize: '15px',
                            fontWeight: 600,
                            color: row.key === 'discount' ? '#5f8253' : '#1a1d17',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.value < 0 ? `−${formatPrice(Math.abs(row.value))}` : formatPrice(row.value)}
                        </span>
                      )}
                    </div>
                  ))}

                {shippingCost > 0 && (
                  <div style={{ marginBottom: '14px', marginTop: '-10px' }}>
                    <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#6b6057' }}>
                      Gratis frakt ved kjøp over kr 650
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '18px', borderTop: '1px solid #e7e2d4', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', fontWeight: 700, color: '#1a1d17' }}>Totalt</span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '20px', fontWeight: 700, color: '#1a1d17' }}>
                    {formatPrice(summaryRows.find((row) => row.key === 'total')!.value)}
                  </span>
                </div>
                <Link
                  href="/kasse"
                  data-btn
                  onClick={() => trackBeginCheckout(items, checkoutTotal)}
                  style={{
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '9px',
                    padding: '17px',
                    borderRadius: '999px',
                    background: '#39402c',
                    color: '#faf6ee',
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 600,
                    fontSize: '15px',
                    textDecoration: 'none',
                    transition: 'transform 0.15s ease, filter 0.15s ease, background 0.2s ease',
                  }}
                >
                  Gå til kassen
                </Link>
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12.5px', color: '#6b6057', textAlign: 'center', margin: '14px 0 0' }}>
                  100 dagers åpent kjøp · Sikker betaling
                </p>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 'clamp(48px,8vw,96px) 0' }}>
              <div style={{ width: '84px', height: '84px', borderRadius: '999px', background: '#f2e7d7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', color: '#a99a76' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="20" r="1.1" />
                  <circle cx="18" cy="20" r="1.1" />
                  <path d="M2.2 3.2h2.1l2.3 11.8a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.3L21 6.3H5.3" />
                </svg>
              </div>
              <h2 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(28px,3.4vw,40px)', color: '#1a1d17', margin: '0 0 12px' }}>
                Handlekurven din er tom
              </h2>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', color: '#6b6f63', margin: '0 0 30px' }}>
                Finn din aBoks i favorittfargen.
              </p>
              <Link
                href="/produkter/aboks"
                data-btn
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px 36px',
                  borderRadius: '999px',
                  background: '#39402c',
                  color: '#faf6ee',
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 600,
                  fontSize: '15px',
                  textDecoration: 'none',
                }}
              >
                Se produktet
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
