'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/format'
import { initKustomCheckout, fetchExistingCheckout } from './actions'

type CheckoutState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; kustomOrderId: string; htmlSnippet: string }

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
  const { items, subtotal, shipping, orderTotal } = useCartStore()
  const searchParams = useSearchParams()
  const existingOrderId = searchParams.get('order_id')

  const [state, setState] = useState<CheckoutState>({ phase: 'loading' })
  const containerRef = useRef<HTMLDivElement>(null)
  const initiated = useRef(false)

  const sub = subtotal()
  const shippingCost = shipping()
  const total = orderTotal()
  const hasCart = items.length > 0

  useEffect(() => {
    if (!hasCart || initiated.current) return
    initiated.current = true

    const run = async () => {
      try {
        const result = existingOrderId
          ? await fetchExistingCheckout(existingOrderId)
          : await initKustomCheckout(items)
        setState({ phase: 'ready', ...result })
      } catch {
        setState({ phase: 'error', message: 'Betalingstjenesten er ikke tilgjengelig akkurat nå. Prøv igjen om litt.' })
      }
    }

    run()
  }, [hasCart, items, existingOrderId])

  useEffect(() => {
    if (state.phase === 'ready' && containerRef.current) {
      renderSnippet(state.htmlSnippet, containerRef.current)
    }
  }, [state])

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

              {/* Kustom snippet is injected here */}
              <div ref={containerRef} style={{ display: state.phase === 'ready' ? 'block' : 'none' }} />
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
                {items.map((item) => (
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
                        aBoks · {item.colorName}
                      </div>
                      <div style={{ fontFamily: 'var(--font-manrope)', fontSize: '13px', color: '#6b6f63' }}>
                        Antall: {item.qty}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: '14px', color: '#1a1d17' }}>
                      {formatPrice(item.qty * item.price)}
                    </div>
                  </div>
                ))}
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
                  {formatPrice(sub)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: shippingCost > 0 ? '6px' : '18px' }}>
                <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63' }}>Frakt</span>
                {shippingCost === 0 ? (
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#5f8253' }}>Gratis</span>
                ) : (
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#1a1d17' }}>
                    {formatPrice(shippingCost)}
                  </span>
                )}
              </div>

              {shippingCost > 0 && (
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
                  {formatPrice(total)}
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
