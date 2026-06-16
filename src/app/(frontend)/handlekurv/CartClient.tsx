'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/format'

export default function CartClient() {
  const { items, removeItem, incrementItem, decrementItem, subtotal } = useCartStore()
  const total = subtotal()
  const hasCart = items.length > 0

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
                {items.map((item) => (
                  <div
                    key={item.variantId}
                    style={{
                      display: 'flex',
                      gap: '20px',
                      padding: '24px 0',
                      borderBottom: '1px solid #e7e2d4',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flexShrink: 0, width: '96px', height: '96px', borderRadius: '16px', overflow: 'hidden', background: '#e7d9bd', position: 'relative' }}>
                      <Image src={item.colorImage} alt={item.colorName} fill style={{ objectFit: 'cover' }} sizes="96px" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: '22px', color: '#1a1d17', margin: '0 0 4px' }}>aBoks</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '999px', background: item.colorHex, boxShadow: '0 0 0 1px rgba(0,0,0,.15)', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6f63' }}>{item.colorName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1.5px solid #d6cfbd', borderRadius: '999px', overflow: 'hidden', background: '#fff' }}>
                          <button
                            onClick={() => decrementItem(item.variantId)}
                            aria-label="Færre"
                            style={{ width: '38px', height: '40px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#1a1d17' }}
                          >
                            −
                          </button>
                          <span style={{ minWidth: '34px', textAlign: 'center', fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '15px' }}>{item.qty}</span>
                          <button
                            onClick={() => incrementItem(item.variantId)}
                            aria-label="Flere"
                            style={{ width: '38px', height: '40px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#1a1d17' }}
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeItem(item.variantId)}
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
                ))}

                <Link
                  href="/produkt/aboks"
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63' }}>Delsum</span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#1a1d17' }}>{formatPrice(total)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', color: '#6b6f63' }}>Frakt</span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '15px', fontWeight: 600, color: '#5f8253' }}>Gratis</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '18px', borderTop: '1px solid #e7e2d4', marginBottom: '24px' }}>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', fontWeight: 700, color: '#1a1d17' }}>Totalt</span>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontSize: '20px', fontWeight: 700, color: '#1a1d17' }}>{formatPrice(total)}</span>
                </div>
                <Link
                  href="/kasse"
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
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '12.5px', color: '#8a8164', textAlign: 'center', margin: '14px 0 0' }}>
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
                href="/produkt/aboks"
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
