'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { getOrderConfirmation } from '../actions'
import { formatPrice } from '@/lib/format'

interface Confirmation {
  status: string
  orderNumber: string
  email: string
  totalKr: number
}

export default function BekreftlseClient() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const clearCart = useCartStore((s) => s.clearCart)
  const cleared = useRef(false)

  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!cleared.current) {
      clearCart()
      cleared.current = true
    }

    if (!orderId) {
      setError('Ingen ordre-ID funnet i URL.')
      setLoading(false)
      return
    }

    getOrderConfirmation(orderId)
      .then(setConfirmation)
      .catch(() => setError('Kunne ikke hente ordredetaljer.'))
      .finally(() => setLoading(false))
  }, [orderId, clearCart])

  if (loading) {
    return (
      <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee', minHeight: '100vh' }}>
        <section
          style={{
            padding: 'clamp(60px,10vw,120px) 0',
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </section>
      </main>
    )
  }

  return (
    <main style={{ paddingTop: 'clamp(96px,12vh,132px)', background: '#faf6ee', minHeight: '100vh' }}>
      <section
        style={{
          padding: 'clamp(60px,10vw,120px) 0',
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '520px', padding: '0 24px' }}>
          {error ? (
            <>
              <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '16px', color: '#6b6057', marginBottom: '24px' }}>
                {error}
              </p>
              <Link
                href="/"
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
                Tilbake til forsiden
              </Link>
            </>
          ) : (
            <>
              <div
                style={{
                  width: '88px',
                  height: '88px',
                  borderRadius: '999px',
                  background: '#e6ecdf',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 28px',
                }}
              >
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#5f8253"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <h1
                style={{
                  fontFamily: 'var(--font-cormorant)',
                  fontWeight: 500,
                  fontSize: 'clamp(34px,4.4vw,54px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.05,
                  color: '#1a1d17',
                  margin: '0 0 14px',
                }}
              >
                Takk for bestillingen!
              </h1>

              <p
                style={{
                  fontFamily: 'var(--font-manrope)',
                  fontSize: '17px',
                  lineHeight: 1.6,
                  color: '#3a3f33',
                  margin: '0 0 8px',
                }}
              >
                {confirmation?.email
                  ? `Vi har sendt en bekreftelse til ${confirmation.email}.`
                  : 'Vi har sendt en bekreftelse på e-post.'}
              </p>

              {confirmation?.orderNumber && (
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6057', margin: '0 0 6px' }}>
                  Ordrenummer:{' '}
                  <span style={{ fontWeight: 700, color: '#39402c' }}>{confirmation.orderNumber}</span>
                </p>
              )}

              {confirmation?.totalKr != null && (
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6057', margin: '0 0 32px' }}>
                  Totalbeløp: <span style={{ fontWeight: 700, color: '#39402c' }}>{formatPrice(confirmation.totalKr)}</span>
                </p>
              )}

              {!confirmation?.orderNumber && !confirmation?.totalKr && (
                <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6057', margin: '0 0 32px' }}>
                  Din aBoks er snart på vei.
                </p>
              )}

              <Link
                href="/"
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
                Tilbake til butikken
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
