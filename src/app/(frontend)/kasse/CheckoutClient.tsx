'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/format'
import { initKustomCheckout, fetchExistingCheckout } from './actions'
import type { CheckoutTotals } from '@/lib/promo/checkoutFlow'
import {
  checkoutStateFromResult,
  displayTotalsFor,
  shouldRenderWidget,
  toCheckoutRequest,
  type CheckoutViewState,
} from '@/lib/promo/checkoutView'
import { trackAddShippingInfo, trackAddPaymentInfo } from '@/lib/analytics'

function renderSnippet(htmlSnippet: string, container: HTMLElement) {
  container.innerHTML = htmlSnippet
  const scripts = Array.from(container.querySelectorAll('script'))
  for (const script of scripts) {
    const newScript = document.createElement('script')
    newScript.type = script.type || 'text/javascript'
    if (script.src) {
      newScript.src = script.src
      newScript.async = script.async
    } else {
      newScript.text = script.textContent ?? ''
    }
    script.parentNode?.replaceChild(newScript, script)
  }
}

export default function CheckoutClient() {
  const { items, promoCode, subtotal, shipping, orderTotal } = useCartStore()
  const searchParams = useSearchParams()
  const existingOrderId = searchParams.get('order_id')
  // Only used server-side to rebuild Meta's `_fbc` when the pixel never set the cookie (it
  // was blocked, or marketing consent was declined). Never touches pricing.
  const fbclid = searchParams.get('fbclid')

  const [state, setState] = useState<CheckoutViewState>({ phase: 'loading' })
  const containerRef = useRef<HTMLDivElement>(null)
  const initiated = useRef(false)

  const hasCart = items.length > 0

  // Local figures are shown only until the server answers; from then on the summary uses the
  // server's own, which are the ones the customer will actually be charged.
  const localTotals: CheckoutTotals = {
    subtotal: subtotal(),
    discount: 0,
    shipping: shipping(),
    total: orderTotal(),
  }
  const displayTotals = displayTotalsFor(state, localTotals)
  const trustedLines = state.phase === 'ready' ? state.lines : null
  const appliedPromoCode = state.phase === 'ready' ? state.promoCode : promoCode

  useEffect(() => {
    if (!hasCart || initiated.current) return
    initiated.current = true

    const run = async () => {
      try {
        const result = existingOrderId
          ? await fetchExistingCheckout(existingOrderId)
          // Identifiers and quantities only — no price, name, colour or total crosses to the
          // server, which prices everything from the catalogue itself.
          : await initKustomCheckout(
              toCheckoutRequest(items, promoCode),
              fbclid ? { fbclid } : undefined,
            )
        setState(checkoutStateFromResult(result))
      } catch {
        // A thrown server action (network drop, sanitised production error) never carries a
        // usable message, so it becomes the fixed Norwegian one.
        setState({
          phase: 'error',
          message: 'Betalingstjenesten er ikke tilgjengelig akkurat nå. Prøv igjen om litt.',
        })
      }
    }

    run()
  }, [hasCart, items, promoCode, existingOrderId, fbclid])

  useEffect(() => {
    // Gated on the same predicate the container's visibility uses, so a rejected promo or a
    // stale cart can never end up with a payment widget injected behind the message.
    if (shouldRenderWidget(state) && state.phase === 'ready' && containerRef.current) {
      renderSnippet(state.htmlSnippet, containerRef.current)
    }
  }, [state])

  // add_shipping_info + add_payment_info: fire once when the Kustom widget loads, using the
  // server's trusted total rather than the cart's local one.
  useEffect(() => {
    if (state.phase !== 'ready') return
    const shippingTier = state.totals.shipping === 0 ? 'Free' : 'Standard'
    trackAddShippingInfo(items, state.totals.total, shippingTier)
    trackAddPaymentInfo(items, state.totals.total)
  }, [state.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasCart) {
    return (
      <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee', minHeight: '100vh' }}>
        <section style={{ padding: 'clamp(60px,10vw,120px) 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '480px', padding: '0 24px' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', color: '#6b6f63', marginBottom: '24px' }}>
              Handlekurven er tom.
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
        </section>
      </main>
    )
  }

  return (
    <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee', minHeight: '100vh' }}>
      <section style={{ padding: 'clamp(32px,5vw,56px) 0 clamp(80px,10vw,120px)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 500,
              fontSize: 'clamp(38px,4.6vw,60px)',
              letterSpacing: '-0.022em',
              lineHeight: 1.02,
              color: '#1a1d17',
              margin: '0 0 clamp(28px,4vw,40px)',
            }}
          >
            Kasse
          </h1>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'clamp(28px,4vw,52px)',
              alignItems: 'start',
            }}
          >
            {/* Kustom Checkout widget */}
            <div>
              {state.phase === 'loading' && (
                <div
                  style={{
                    minHeight: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    background: '#fff',
                    borderRadius: '22px',
                    padding: '40px',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '3px solid #e0d9c7',
                      borderTopColor: '#39402c',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6057' }}>
                    Laster betalingsløsning…
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {state.phase === 'error' && (
                <div
                  style={{
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    background: '#fff',
                    borderRadius: '22px',
                    padding: '40px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '999px',
                      background: '#fdf0ed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b06a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#3a3f33', maxWidth: '320px' }}>
                    {state.message}
                  </p>
                  <button
                    onClick={() => {
                      initiated.current = false
                      setState({ phase: 'loading' })
                    }}
                    style={{
                      padding: '12px 28px',
                      borderRadius: '999px',
                      background: '#39402c',
                      color: '#faf6ee',
                      fontFamily: 'var(--font-manrope)',
                      fontWeight: 600,
                      fontSize: '14px',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Prøv igjen
                  </button>
                </div>
              )}

              {(state.phase === 'promo_rejected' || state.phase === 'cart_invalid') && (
                <div
                  style={{
                    minHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    background: '#fff',
                    borderRadius: '22px',
                    padding: '40px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '999px',
                      background: '#fdf6ed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b08a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>

                  <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '17px', color: '#1a1d17', margin: 0 }}>
                    {state.phase === 'promo_rejected' ? 'Rabattkoden kan ikke brukes' : 'Handlekurven må oppdateres'}
                  </h2>

                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#3a3f33', maxWidth: '360px', margin: 0, lineHeight: 1.55 }}>
                    {state.message}
                  </p>

                  {state.phase === 'promo_rejected' && (
                    <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6057', maxWidth: '360px', margin: 0, lineHeight: 1.5 }}>
                      Du er ikke belastet. Gå tilbake til handlekurven for å fjerne eller endre koden.
                    </p>
                  )}

                  <Link
                    href="/handlekurv"
                    data-btn
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '13px 30px',
                      borderRadius: '999px',
                      background: '#39402c',
                      color: '#faf6ee',
                      fontFamily: 'var(--font-manrope)',
                      fontWeight: 600,
                      fontSize: '14px',
                      textDecoration: 'none',
                    }}
                  >
                    Tilbake til handlekurv
                  </Link>
                </div>
              )}

              {/* Kustom snippet is injected here — never for a rejected promo or a stale cart */}
              <div ref={containerRef} style={{ display: shouldRenderWidget(state) ? 'block' : 'none' }} />
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
              <h2
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontWeight: 700,
                  fontSize: '18px',
                  color: '#1a1d17',
                  margin: '0 0 22px',
                }}
              >
                Din bestilling
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '22px' }}>
                {items.map((item) => {
                  // Once the server has answered, the amount shown is the one it priced.
                  const trustedLine = trustedLines?.find((l) => l.variantId === item.variantId)
                  const lineTotal = trustedLine ? trustedLine.lineTotal : item.qty * item.price
                  return (
                    <div key={item.variantId} style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div
                        style={{
                          flexShrink: 0,
                          width: '56px',
                          height: '56px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          background: '#e7d9bd',
                          position: 'relative',
                        }}
                      >
                        <Image src={item.colorImage} alt={item.colorName} fill style={{ objectFit: 'cover' }} sizes="56px" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '15px', color: '#1a1d17' }}>
                          {trustedLine ? trustedLine.displayName : `aBoks · ${item.colorName}`}
                        </div>
                        <div style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63' }}>
                          Antall: {trustedLine ? trustedLine.quantity : item.qty}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px', color: '#1a1d17' }}>
                        {formatPrice(lineTotal)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                  paddingTop: '18px',
                  borderTop: '1px solid #e7e2d4',
                }}
              >
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63' }}>Delsum</span>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#1a1d17' }}>
                  {formatPrice(displayTotals.subtotal)}
                </span>
              </div>

              {displayTotals.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63' }}>
                    {appliedPromoCode ? `Rabatt ${appliedPromoCode}` : 'Rabatt'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#5f8253', whiteSpace: 'nowrap' }}>
                    −{formatPrice(displayTotals.discount)}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: displayTotals.shipping > 0 ? '6px' : '18px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63' }}>Frakt</span>
                {displayTotals.shipping === 0 ? (
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#5f8253' }}>Gratis</span>
                ) : (
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#1a1d17' }}>
                    {formatPrice(displayTotals.shipping)}
                  </span>
                )}
              </div>

              {displayTotals.shipping > 0 && (
                <div style={{ marginBottom: '18px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#6b6057' }}>
                    Gratis frakt ved kjøp over kr 650
                  </span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '18px',
                  borderTop: '1px solid #e7e2d4',
                  marginBottom: '20px',
                }}
              >
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', fontWeight: 700, color: '#1a1d17' }}>Totalt</span>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '20px', fontWeight: 700, color: '#1a1d17' }}>
                  {formatPrice(displayTotals.total)}
                </span>
              </div>

              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12px', color: '#6b6057', margin: '0 0 16px', lineHeight: 1.5 }}>
                inkl. 25% MVA
              </p>

              <Link
                href="/handlekurv"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontFamily: 'var(--font-manrope)',
                  fontSize: '14px',
                  color: '#6b6f63',
                  textDecoration: 'none',
                  padding: '8px',
                }}
              >
                Tilbake til handlekurv
              </Link>

              <p
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontSize: '12.5px',
                  color: '#6b6057',
                  textAlign: 'center',
                  margin: '10px 0 0',
                }}
              >
                100 dagers åpent kjøp · Sikker betaling
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
