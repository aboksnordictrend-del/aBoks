'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { AnimatePresence } from 'framer-motion'
import ImageLightbox from '@/components/ImageLightbox'
import Stars from '@/components/reviews/Stars'
import type { PublicReview } from '@/lib/reviewServer'

const FONT = 'var(--font-manrope)'
const INK = '#1a1d17'
const MUTED = '#6b6f63'
const ACCENT = '#5e6a48'
const PAGE_SIZE = 8

type RatingFilter = 'all' | '5' | '4' | '3' | '2' | '1'

const selectStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: '14px',
  color: INK,
  padding: '10px 14px',
  border: '1px solid #d9d2c4',
  borderRadius: '10px',
  background: '#fdfcf9',
  cursor: 'pointer',
}

export default function ReviewsClient({
  reviews,
  products,
  initialProduct,
  initialRating,
  initialWithPhotos,
}: {
  reviews: PublicReview[]
  products: { slug: string; title: string }[]
  initialProduct: string
  initialRating: RatingFilter
  initialWithPhotos: boolean
}) {
  const [product, setProduct] = useState(initialProduct)
  const [rating, setRating] = useState<RatingFilter>(initialRating)
  const [withPhotos, setWithPhotos] = useState(initialWithPhotos)
  const [visible, setVisible] = useState(PAGE_SIZE)

  // Keep URL search params in sync without a full reload (spec §12 "Фильтры").
  useEffect(() => {
    const params = new URLSearchParams()
    if (product !== 'all') params.set('product', product)
    if (rating !== 'all') params.set('rating', rating)
    if (withPhotos) params.set('withPhotos', '1')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `/anmeldelser?${qs}` : '/anmeldelser')
  }, [product, rating, withPhotos])

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (product !== 'all' && r.productSlug !== product) return false
      if (rating !== 'all' && Math.round(r.rating) !== Number(rating)) return false
      if (withPhotos && r.photos.length === 0) return false
      return true
    })
  }, [reviews, product, rating, withPhotos])

  useEffect(() => setVisible(PAGE_SIZE), [product, rating, withPhotos])

  const shown = filtered.slice(0, visible)

  // ── Gallery: all consented photos across approved reviews ──
  const galleryPhotos = useMemo(
    () =>
      reviews.flatMap((r) =>
        r.photos.map((p) => ({ src: p.url, alt: `aBoks hjemme hos ${r.displayName}` })),
      ),
    [reviews],
  )
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const openLightbox = useCallback((src: string) => {
    const idx = galleryPhotos.findIndex((g) => g.src === src)
    setLightboxIndex(idx >= 0 ? idx : 0)
  }, [galleryPhotos])

  return (
    <>
      {/* ── Filters ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          marginBottom: '28px',
        }}
      >
        {products.length > 1 && (
          <select aria-label="Filtrer etter produkt" style={selectStyle} value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="all">Alle produkter</option>
            {products.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>
        )}
        <select aria-label="Filtrer etter vurdering" style={selectStyle} value={rating} onChange={(e) => setRating(e.target.value as RatingFilter)}>
          <option value="all">Alle vurderinger</option>
          <option value="5">5 stjerner</option>
          <option value="4">4 stjerner</option>
          <option value="3">3 stjerner</option>
          <option value="2">2 stjerner</option>
          <option value="1">1 stjerne</option>
        </select>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: FONT, fontSize: '14px', color: INK, cursor: 'pointer' }}>
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} style={{ accentColor: ACCENT }} />
          Kun med bilder
        </label>
      </div>

      {/* ── Review cards ── */}
      {shown.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: '15px', color: MUTED }}>
          Ingen anmeldelser passer med filtrene dine.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
          {shown.map((r) => (
            <ReviewCard key={r.id} review={r} onPhotoClick={openLightbox} />
          ))}
        </div>
      )}

      {visible < filtered.length && (
        <div style={{ textAlign: 'center', marginTop: '36px' }}>
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: '14px',
              color: INK,
              background: 'transparent',
              border: `1px solid ${ACCENT}`,
              borderRadius: '999px',
              padding: '12px 28px',
              cursor: 'pointer',
            }}
          >
            Last flere ({filtered.length - visible})
          </button>
        </div>
      )}

      {/* ── Gallery: aBoks hjemme hos kundene ── */}
      {galleryPhotos.length > 0 && (
        <section style={{ marginTop: 'clamp(56px,8vw,88px)' }}>
          <h2
            style={{
              fontFamily: 'var(--font-cormorant)',
              fontWeight: 600,
              fontSize: 'clamp(24px,3vw,32px)',
              color: INK,
              margin: '0 0 20px',
            }}
          >
            aBoks hjemme hos kundene
          </h2>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))' }}>
            {galleryPhotos.map((g, i) => (
              <button
                key={`${g.src}-${i}`}
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label="Åpne bilde"
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  border: 'none',
                  padding: 0,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#efe9dd',
                }}
              >
                <Image src={g.src} alt={g.alt} fill sizes="(max-width:640px) 45vw, 200px" style={{ objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {lightboxIndex !== null && (
          <ImageLightbox
            images={galleryPhotos}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function ReviewCard({ review, onPhotoClick }: { review: PublicReview; onPhotoClick: (src: string) => void }) {
  const meta = [review.productTitle, review.variantName ?? review.color].filter(Boolean).join(' · ')
  return (
    <article
      style={{
        background: '#ffffff',
        border: '1px solid #e8e0d4',
        borderRadius: '16px',
        padding: 'clamp(20px,3vw,26px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <Stars value={review.rating} size={17} />
        {review.verifiedPurchase && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontFamily: FONT,
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: ACCENT,
              background: '#eef1e8',
              borderRadius: '999px',
              padding: '4px 10px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Verifisert kjøp
          </span>
        )}
      </div>

      {review.title && (
        <h3 style={{ fontFamily: FONT, fontSize: '16px', fontWeight: 700, color: INK, margin: 0 }}>{review.title}</h3>
      )}

      <p style={{ fontFamily: FONT, fontSize: '14.5px', lineHeight: 1.65, color: '#42463a', margin: 0, whiteSpace: 'pre-line' }}>
        {review.text}
      </p>

      {review.photos.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {review.photos.map((p, i) => (
            <button
              key={`${p.url}-${i}`}
              type="button"
              onClick={() => onPhotoClick(p.url)}
              aria-label={`Åpne bilde ${i + 1}`}
              style={{ position: 'relative', width: '68px', height: '68px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e0d8c9', padding: 0, cursor: 'pointer', flexShrink: 0, background: '#efe9dd' }}
            >
              <Image src={p.url} alt={`Kundebilde ${i + 1}`} fill sizes="68px" style={{ objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'baseline' }}>
        <span style={{ fontFamily: FONT, fontSize: '13.5px', fontWeight: 700, color: INK }}>{review.displayName}</span>
        {review.city && <span style={{ fontFamily: FONT, fontSize: '13px', color: MUTED }}>· {review.city}</span>}
        <span style={{ fontFamily: FONT, fontSize: '13px', color: MUTED, marginLeft: 'auto' }}>{review.dateLabel}</span>
      </div>
      {meta && <div style={{ fontFamily: FONT, fontSize: '12.5px', color: MUTED }}>{meta}</div>}
    </article>
  )
}
