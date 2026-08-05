'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { getOrderConfirmation } from '../actions'
import { formatPrice } from '@/lib/format'
import { trackPurchase } from '@/lib/analytics'
import type { OrderSummaryRow } from '@/lib/orders/renderOrderSummary'

interface Confirmation {
  status: string
  orderNumber: string
  email: string
  totalKr: number
  shippingKr: number
  /** Delsum / Frakt / Rabatt (CODE) / Totalt, from the stored order snapshot. */
  summary: OrderSummaryRow[]
  orderItems: Array<{
    itemId: string
    itemName: string
    itemVariant: string
    price: number
    /** Promo-code discount per unit, present only on discounted lines. */
    discount?: number
    quantity: number
  }>
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

    // The Kustom push webhook runs server-to-server before the redirect, but
    // can lag by a few seconds. Retry up to 4 times (0 s, 2 s, 4 s, 6 s) so
    // the order number is shown even when the webhook is slightly delayed.
    let attempts = 0
    const MAX_ATTEMPTS = 4

    const fetchConfirmation = () => {
      getOrderConfirmation(orderId)
        .then((data) => {
          // purchase fires on the FIRST successful answer, before any retry decision. The
          // retries exist only to fill in an order number for the page; waiting for one would
          // mean a customer who closes the tab in those six seconds is never counted, and
          // `orderNumber` is read from Kustom's own merchant_reference anyway, so it is
          // normally present immediately. Deduplication is keyed on the Kustom order id, so a
          // refresh cannot fire a second event whichever way this resolved.
          trackPurchase({
            kustomOrderId: orderId,
            transactionId: data.orderNumber || orderId,
            value: data.totalKr,
            shipping: data.shippingKr,
            items: data.orderItems.map((item) => ({
              item_id: item.itemId,
              item_name: item.itemName,
              item_variant: item.itemVariant || undefined,
              price: item.price,
              ...(item.discount ? { discount: item.discount } : {}),
              quantity: item.quantity,
              item_category: 'Battery Organizer',
            })),
          })

          if (!data.orderNumber && attempts < MAX_ATTEMPTS - 1) {
            attempts++
            setTimeout(fetchConfirmation, 2000)
            return
          }

          setConfirmation(data)
          setLoading(false)
        })
        .catch(() => {
          setError('Kunne ikke hente ordredetaljer.')
          setLoading(false)
        })
    }

    fetchConfirmation()
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

              {/* Delsum / Frakt / Rabatt (CODE) / Totalt, straight from the stored order —
                  nothing here is recalculated, so the page, the e-mail and the receipt agree. */}
              {confirmation?.summary?.length ? (
                <div
                  style={{
                    maxWidth: '320px',
                    margin: '0 auto 32px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-manrope)',
                    fontSize: '14px',
                  }}
                >
                  {confirmation.summary.map((row) => (
                    <div
                      key={row.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px',
                        padding: row.strong ? '10px 0 0' : '4px 0',
                        marginTop: row.strong ? '6px' : 0,
                        borderTop: row.strong ? '1px solid #e0d9c7' : undefined,
                        fontWeight: row.strong ? 700 : 400,
                        color: row.strong ? '#1a1d17' : '#6b6057',
                      }}
                    >
                      <span>{row.label}</span>
                      {row.free ? (
                        <span style={{ fontWeight: 600, color: '#5f8253' }}>Gratis</span>
                      ) : (
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            fontWeight: row.strong ? 700 : 600,
                            color: row.key === 'discount' ? '#5f8253' : '#39402c',
                          }}
                        >
                          {row.amount < 0
                            ? `−${formatPrice(Math.abs(row.amount))}`
                            : formatPrice(row.amount)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                confirmation?.totalKr != null && (
                  <p style={{ fontFamily: 'var(--font-manrope)', fontSize: '14px', color: '#6b6057', margin: '0 0 32px' }}>
                    Totalbeløp: <span style={{ fontWeight: 700, color: '#39402c' }}>{formatPrice(confirmation.totalKr)}</span>
                  </p>
                )
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
