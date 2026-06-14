'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCartStore } from '@/store/cart'
import { formatPrice, generateOrderNumber } from '@/lib/format'

interface FormData {
  email: string
  firstName: string
  lastName: string
  address: string
  postalCode: string
  city: string
  phone: string
}

export default function CheckoutClient() {
  const { items, subtotal, clearCart } = useCartStore()
  const [placed, setPlaced] = useState(false)
  const [orderNo, setOrderNo] = useState('')
  const [form, setForm] = useState<FormData>({
    email: '',
    firstName: '',
    lastName: '',
    address: '',
    postalCode: '',
    city: '',
    phone: '',
  })

  const total = subtotal()
  const hasCart = items.length > 0

  const handlePlace = () => {
    const no = generateOrderNumber(items.reduce((s, i) => s + i.qty, 0) * 13)
    setOrderNo(no)
    clearCart()
    setPlaced(true)
    window.scrollTo(0, 0)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    border: '1.5px solid #e0d9c7',
    borderRadius: '14px',
    background: '#fff',
    fontFamily: 'var(--font-manrope)',
    fontSize: '15px',
    color: '#1a1d17',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-manrope)',
    fontSize: '13px',
    fontWeight: 600,
    color: '#3a3f33',
    margin: '0 0 7px',
  }

  if (placed) {
    return (
      <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee', minHeight: '100vh' }}>
        <section style={{ padding: 'clamp(60px,10vw,120px) 0', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '520px', padding: '0 24px' }}>
            <div style={{ width: '88px', height: '88px', borderRadius: '999px', background: '#e6ecdf', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5f8253" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(34px,4.4vw,54px)', letterSpacing: '-0.02em', lineHeight: 1.05, color: '#1a1d17', margin: '0 0 14px' }}>
              Takk for bestillingen!
            </h1>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '17px', lineHeight: 1.6, color: '#3a3f33', margin: '0 0 8px' }}>
              Vi har sendt en bekreftelse på e-post. Din aBoks er snart på vei.
            </p>
            <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#8a8164', margin: '0 0 32px' }}>
              Ordrenummer: <span style={{ fontWeight: 700, color: '#39402c' }}>{orderNo}</span>
            </p>
            <Link
              href="/"
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
              Tilbake til butikken
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee', minHeight: '100vh' }}>
      <section style={{ padding: 'clamp(32px,5vw,56px) 0 clamp(80px,10vw,120px)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 clamp(20px,5vw,48px)' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 500, fontSize: 'clamp(38px,4.6vw,60px)', letterSpacing: '-0.022em', lineHeight: 1.02, color: '#1a1d17', margin: '0 0 8px' }}>
            Kasse
          </h1>
          <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#8a8164', margin: '0 0 clamp(28px,4vw,44px)' }}>
            Dette er en demo – ingen betaling gjennomføres.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'clamp(28px,4vw,52px)', alignItems: 'start' }}>
            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
              {/* Contact */}
              <div>
                <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '17px', color: '#1a1d17', margin: '0 0 18px' }}>Kontaktinformasjon</h2>
                <label style={labelStyle}>E-post</label>
                <input
                  type="email"
                  placeholder="din@epost.no"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* Address */}
              <div>
                <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '17px', color: '#1a1d17', margin: '0 0 18px' }}>Leveringsadresse</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Fornavn</label>
                    <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Etternavn</label>
                    <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Adresse</label>
                  <input placeholder="Gateadresse" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={labelStyle}>Postnr.</label>
                    <input placeholder="0000" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Sted</label>
                    <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Telefon</label>
                  <input placeholder="+47" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
                </div>
              </div>

              {/* Payment */}
              <div>
                <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '17px', color: '#1a1d17', margin: '0 0 18px' }}>Betaling</h2>
                <div style={{ border: '1.5px solid #e0d9c7', borderRadius: '16px', background: '#fff', overflow: 'hidden' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid #f0ebdd' }}>
                    <input placeholder="Kortnummer" style={{ width: '100%', border: 'none', fontFamily: 'var(--font-manrope)', fontSize: '15px', outline: 'none', background: 'none' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div style={{ padding: '16px', borderRight: '1px solid #f0ebdd' }}>
                      <input placeholder="MM/ÅÅ" style={{ width: '100%', border: 'none', fontFamily: 'var(--font-manrope)', fontSize: '15px', outline: 'none', background: 'none' }} />
                    </div>
                    <div style={{ padding: '16px' }}>
                      <input placeholder="CVC" style={{ width: '100%', border: 'none', fontFamily: 'var(--font-manrope)', fontSize: '15px', outline: 'none', background: 'none' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div style={{ background: '#fff', borderRadius: '22px', padding: '32px', boxShadow: '0 2px 6px rgba(42,36,24,.05)', position: 'sticky', top: '120px' }}>
              <h2 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '18px', color: '#1a1d17', margin: '0 0 22px' }}>Din bestilling</h2>

              {hasCart ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '22px' }}>
                  {items.map((item) => (
                    <div key={item.variantId} style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div style={{ flexShrink: 0, width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', background: '#e7d9bd', position: 'relative' }}>
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
              ) : (
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6f63', margin: '0 0 22px' }}>
                  Ingen varer i bestillingen ennå.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingTop: '18px', borderTop: '1px solid #e7e2d4' }}>
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

              <button
                onClick={handlePlace}
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
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2a3020' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#39402c' }}
              >
                Betal {formatPrice(total)}
              </button>
              <Link
                href="/handlekurv"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  marginTop: '12px',
                  fontFamily: 'var(--font-manrope)',
                  fontSize: '14px',
                  color: '#6b6f63',
                  textDecoration: 'none',
                  padding: '8px',
                }}
              >
                Tilbake til handlekurv
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
