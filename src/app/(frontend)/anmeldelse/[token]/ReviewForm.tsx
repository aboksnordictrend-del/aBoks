'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import type { ReviewFormDTO, ReviewableProduct } from '@/lib/reviews'
import { submitReviewAction } from './actions'
import { feedbackFromResult } from '@/lib/reviewSubmitResult'
import { REVIEW_LIMITS } from '@/lib/reviewValidation'

// Per-file cap mirrors the server-side limit in @/lib/reviewPhotos (PHOTO_LIMITS.maxBytes).
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MSG_TOO_MANY = 'Du kan laste opp maksimalt 5 bilder.'
const MSG_TOO_LARGE = 'Hvert bilde kan være maksimalt 8 MB.'
const MSG_NO_RATING = 'Gi en vurdering mellom 1 og 5 stjerner.'
const MSG_UNEXPECTED = 'Noe gikk galt. Prøv igjen senere.'
// Form-level summary shown under the Send button whenever submission is blocked by one or
// more field-level errors (the specific messages stay inline next to each field).
const FIELD_SUMMARY = 'Anmeldelsen ble ikke sendt. Sjekk feltene som er markert med rødt.'

const FONT = 'var(--font-manrope)'
const INK = '#1a1d17'
const MUTED = '#6b6f63'
const BORDER = '#d9d2c4'
const ACCENT = '#5e6a48'

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e8e0d4',
  borderRadius: '16px',
  padding: 'clamp(28px,5vw,48px)',
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT,
  fontSize: '14px',
  fontWeight: 600,
  color: INK,
  margin: '0 0 8px',
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: FONT,
  fontSize: '15px',
  color: INK,
  padding: '12px 14px',
  border: `1px solid ${BORDER}`,
  borderRadius: '10px',
  background: '#fdfcf9',
  outline: 'none',
  boxSizing: 'border-box',
}
const errorStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: '13px',
  color: '#c0392b',
  margin: '6px 0 0',
}
const fieldWrap: React.CSSProperties = { marginBottom: '22px' }
const errorInputStyle: React.CSSProperties = { borderColor: '#c0392b', background: '#fdf3f2' }

function productKey(p: ReviewableProduct): string {
  return `${p.productId}::${p.variantName ?? ''}`
}

function productLabel(p: ReviewableProduct): string {
  const parts = [p.title]
  if (p.variantName) parts.push(p.variantName)
  return parts.join(' – ')
}

export default function ReviewForm({
  token,
  dto,
  turnstileSiteKey,
}: {
  token: string
  dto: ReviewFormDTO
  turnstileSiteKey: string
}) {
  // Submission is driven by an explicit handler, not <form action>, so we control exactly
  // when success is shown: only when the Server Action resolves with { success: true }.
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // Shown under the Send button after a blocked/failed attempt. Empty until the first
  // submit, and cleared at the start of every new attempt and on success.
  const [submitSummary, setSubmitSummary] = useState('')

  // Every user-editable field is controlled by React state, so a failed submit never wipes
  // what was typed — the user only fixes the flagged field and presses Send again.
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState(
    dto.products.length > 0 ? productKey(dto.products[0]!) : '',
  )
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [customerName, setCustomerName] = useState(dto.firstName ?? '')
  const [customerCity, setCustomerCity] = useState('')
  const [consentName, setConsentName] = useState(true)
  const [consentPhotos, setConsentPhotos] = useState(false)
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [photoError, setPhotoError] = useState('')

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.url))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Thank-you page is shown EXCLUSIVELY when a review was actually created (success === true
  // → setSubmitted(true)). No other path can reach it.
  if (submitted) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 600,
            fontSize: 'clamp(26px,3.4vw,38px)',
            color: INK,
            margin: '0 0 14px',
          }}
        >
          Tusen takk for tilbakemeldingen!
        </h1>
        <p style={{ fontFamily: FONT, fontSize: '16px', lineHeight: 1.7, color: '#4a4e41', margin: 0 }}>
          Anmeldelsen din er sendt inn og vil bli publisert etter en kort gjennomgang.
        </p>
      </div>
    )
  }

  const err = fieldErrors

  const onPickPhotos = (input: HTMLInputElement) => {
    setPhotoError('')
    const list = input.files
    if (list) {
      const accepted: { file: File; url: string }[] = [...photos]
      for (const file of Array.from(list)) {
        if (accepted.length >= REVIEW_LIMITS.photosMax) {
          setPhotoError(MSG_TOO_MANY)
          break
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          setPhotoError('Kun JPEG, PNG eller WebP er tillatt.')
          continue
        }
        if (file.size > MAX_PHOTO_BYTES) {
          setPhotoError(MSG_TOO_LARGE)
          continue
        }
        accepted.push({ file, url: URL.createObjectURL(file) })
      }
      setPhotos(accepted)
    }
    // Clear the native picker: state is the single source of truth for both previews and
    // submission, so the input never needs to hold files (and can't be cleared out from
    // under us by the post-action form reset).
    input.value = ''
  }

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photos[idx]!.url)
    setPhotos(photos.filter((_, i) => i !== idx))
    setPhotoError('')
  }

  // Client guard before dispatching the Server Action: block invalid photo sets so the
  // large multipart POST is never sent, and surface the error inline (no silent 413).
  const guardPhotos = (): boolean => {
    if (photos.length > REVIEW_LIMITS.photosMax) {
      setPhotoError(MSG_TOO_MANY)
      return false
    }
    if (photos.some((p) => p.file.size > MAX_PHOTO_BYTES)) {
      setPhotoError(MSG_TOO_LARGE)
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return // guard against double-submit
    // Clear the summary before running checks so a fixed error doesn't leave a stale banner.
    setSubmitSummary('')
    setFieldErrors({})

    // Client-side UX guard (server still validates strictly): never dispatch the action
    // when no rating is chosen — show the error under the stars AND summarise under the
    // button, since the user is likely standing at the bottom of the form.
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setFieldErrors({ rating: MSG_NO_RATING })
      setSubmitSummary(FIELD_SUMMARY)
      return
    }
    if (!guardPhotos()) {
      setSubmitSummary(FIELD_SUMMARY)
      return
    }

    // Build the payload from React state — photos included from state (not the reset-prone
    // file input), so the exact selection the user sees is submitted every retry.
    const formData = new FormData(e.currentTarget)
    formData.set('rating', String(rating))
    formData.set('product', selectedProduct)
    formData.delete('photos')
    for (const p of photos) formData.append('photos', p.file, p.file.name)

    setPending(true)
    try {
      const result = await submitReviewAction(formData)

      // Success page is shown EXCLUSIVELY when result.success === true. Field errors and a
      // general message never imply success.
      const feedback = feedbackFromResult(result)
      if (feedback.submitted) {
        setSubmitted(true)
        return
      }
      setFieldErrors(feedback.fieldErrors)
      // Field-level errors → the generic "check the highlighted fields" summary. An
      // unexpected server error (a message with no field errors) → show that message.
      const hasFieldErrors = Object.keys(feedback.fieldErrors).length > 0
      setSubmitSummary(hasFieldErrors ? FIELD_SUMMARY : feedback.generalError || MSG_UNEXPECTED)
    } catch {
      // A thrown/rejected Server Action is NOT success — keep the form open.
      setSubmitSummary(MSG_UNEXPECTED)
    } finally {
      // Only the busy flag is cleared here — `submitted` is never set in finally.
      setPending(false)
    }
  }

  const displayedRating = hover || rating

  return (
    <form onSubmit={handleSubmit} style={cardStyle} noValidate>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="product" value={selectedProduct} />
      {/* Honeypot: visually hidden, off the tab order, and deliberately NOT named like an
          autofill target (no "company"/"email"/"firma" label) so a real user's browser
          never fills it. A filled value is treated as a bot and rejected as success:false. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
        <input
          type="text"
          name="referansekode"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          aria-label="La stå tom"
        />
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-cormorant)',
          fontWeight: 600,
          fontSize: 'clamp(26px,3.4vw,38px)',
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
          color: INK,
          margin: '0 0 8px',
        }}
      >
        Hva synes du om aBoks?
      </h1>
      <p style={{ fontFamily: FONT, fontSize: '15px', lineHeight: 1.6, color: MUTED, margin: '0 0 28px' }}>
        Din tilbakemelding hjelper andre kunder. Det tar bare et par minutter.
      </p>

      {/* Product selection — only shown when more than one distinct product was bought. */}
      {dto.products.length > 1 && (
        <fieldset style={{ ...fieldWrap, border: 'none', padding: 0, margin: '0 0 22px' }}>
          <legend style={labelStyle}>Hvilket produkt anmelder du?</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dto.products.map((p) => {
              const key = productKey(p)
              const active = key === selectedProduct
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    border: `1px solid ${active ? ACCENT : BORDER}`,
                    borderRadius: '10px',
                    background: active ? '#f3f5ee' : '#fdfcf9',
                    cursor: 'pointer',
                    fontFamily: FONT,
                    fontSize: '15px',
                    color: INK,
                  }}
                >
                  <input
                    type="radio"
                    name="product-choice"
                    checked={active}
                    onChange={() => setSelectedProduct(key)}
                    style={{ accentColor: ACCENT }}
                  />
                  {productLabel(p)}
                  {p.quantity > 1 && <span style={{ color: MUTED, fontSize: '13px' }}>· {p.quantity} stk</span>}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}
      {err.productId && <p style={errorStyle}>{err.productId}</p>}

      {/* Rating */}
      <div style={fieldWrap}>
        <span style={labelStyle}>Din vurdering</span>
        <input type="hidden" name="rating" value={rating || ''} />
        <div role="radiogroup" aria-label="Vurdering fra 1 til 5 stjerner" style={{ display: 'flex', gap: '4px' }}>
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= displayedRating
            return (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} av 5 stjerner`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onFocus={() => setHover(star)}
                onBlur={() => setHover(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  lineHeight: 0,
                  color: filled ? '#e0a92e' : '#d4cebf',
                  transition: 'color 0.12s ease',
                }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21.5l1.2-6.5L2.5 9.4l6.6-.9z" />
                </svg>
              </button>
            )
          })}
        </div>
        {err.rating && <p style={errorStyle}>{err.rating}</p>}
      </div>

      {/* Title */}
      <div style={fieldWrap}>
        <label htmlFor="rv-title" style={labelStyle}>
          Tittel <span style={{ color: MUTED, fontWeight: 400 }}>(valgfritt)</span>
        </label>
        <input
          id="rv-title"
          name="title"
          type="text"
          maxLength={REVIEW_LIMITS.titleMax}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={err.title ? { ...inputStyle, ...errorInputStyle } : inputStyle}
          placeholder="Kort oppsummering"
        />
        {err.title && <p style={errorStyle}>{err.title}</p>}
      </div>

      {/* Text */}
      <div style={fieldWrap}>
        <label htmlFor="rv-text" style={labelStyle}>
          Anmeldelse
        </label>
        <textarea
          id="rv-text"
          name="text"
          required
          minLength={REVIEW_LIMITS.textMin}
          maxLength={REVIEW_LIMITS.textMax}
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={
            err.text
              ? { ...inputStyle, ...errorInputStyle, resize: 'vertical', minHeight: '120px' }
              : { ...inputStyle, resize: 'vertical', minHeight: '120px' }
          }
          placeholder="Fortell hvordan du bruker aBoks, og hva du synes."
        />
        {err.text && <p style={errorStyle}>{err.text}</p>}
      </div>

      {/* Name + city */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '16px', ...fieldWrap }}>
        <div>
          <label htmlFor="rv-name" style={labelStyle}>
            Navn som vises
          </label>
          <input
            id="rv-name"
            name="customerName"
            type="text"
            required
            maxLength={REVIEW_LIMITS.nameMax}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={err.customerName ? { ...inputStyle, ...errorInputStyle } : inputStyle}
          />
          {err.customerName && <p style={errorStyle}>{err.customerName}</p>}
        </div>
        <div>
          <label htmlFor="rv-city" style={labelStyle}>
            Sted <span style={{ color: MUTED, fontWeight: 400 }}>(valgfritt)</span>
          </label>
          <input
            id="rv-city"
            name="customerCity"
            type="text"
            maxLength={REVIEW_LIMITS.cityMax}
            value={customerCity}
            onChange={(e) => setCustomerCity(e.target.value)}
            style={err.customerCity ? { ...inputStyle, ...errorInputStyle } : inputStyle}
            placeholder="F.eks. Oslo"
          />
          {err.customerCity && <p style={errorStyle}>{err.customerCity}</p>}
        </div>
      </div>

      {/* Photos */}
      <div style={fieldWrap}>
        <span style={labelStyle}>
          Bilder <span style={{ color: MUTED, fontWeight: 400 }}>(valgfritt, maks {REVIEW_LIMITS.photosMax})</span>
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => onPickPhotos(e.target)}
          style={{ fontFamily: FONT, fontSize: '14px', color: MUTED }}
        />
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
            {photos.map((p, i) => (
              <div
                key={p.url}
                style={{ position: 'relative', width: '84px', height: '84px', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${BORDER}`, flexShrink: 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Forhåndsvisning ${i + 1}`} width={84} height={84} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`Fjern bilde ${i + 1}`}
                  style={{
                    position: 'absolute',
                    top: '3px',
                    right: '3px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'rgba(20,18,14,0.72)',
                    color: '#fff',
                    cursor: 'pointer',
                    lineHeight: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        {(photoError || err.photos) && <p style={errorStyle}>{photoError || err.photos}</p>}
      </div>

      {/* Consent */}
      <div style={{ ...fieldWrap, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontFamily: FONT, fontSize: '14px', color: '#4a4e41', lineHeight: 1.5 }}>
          <input
            type="checkbox"
            name="consentToPublishName"
            value="true"
            checked={consentName}
            onChange={(e) => setConsentName(e.target.checked)}
            style={{ accentColor: ACCENT, marginTop: '2px' }}
          />
          Jeg samtykker til at navnet mitt publiseres med anmeldelsen.
        </label>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontFamily: FONT, fontSize: '14px', color: '#4a4e41', lineHeight: 1.5 }}>
          <input
            type="checkbox"
            name="consentToPublishPhotos"
            value="true"
            checked={consentPhotos}
            onChange={(e) => setConsentPhotos(e.target.checked)}
            style={{ accentColor: ACCENT, marginTop: '2px' }}
          />
          Jeg samtykker til at bildene mine kan publiseres med anmeldelsen.
        </label>
      </div>

      <p style={{ fontFamily: FONT, fontSize: '12.5px', color: MUTED, lineHeight: 1.6, margin: '0 0 22px' }}>
        Ved å sende inn anmeldelsen samtykker du til at selve anmeldelsen kan publiseres på
        aboks.no. Navn og bilder publiseres bare dersom du velger dette.
      </p>

      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} style={{ marginBottom: '22px' }} />
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          width: '100%',
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: '15px',
          color: '#faf6ee',
          background: pending ? '#7a8266' : '#39402c',
          border: 'none',
          borderRadius: '10px',
          padding: '15px 20px',
          cursor: pending ? 'not-allowed' : 'pointer',
          transition: 'background 0.18s ease',
        }}
      >
        {pending ? 'Sender…' : 'Send anmeldelse'}
      </button>

      {/* Form-level status directly under the button. The user is usually standing here
          after pressing Send, so this tells them the review was NOT sent and points them to
          the fields marked in red. We deliberately do NOT scroll the page. */}
      {submitSummary && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            fontFamily: FONT,
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#8a2a1e',
            background: '#fbeae7',
            border: '1px solid #f0c9c2',
            borderRadius: '10px',
            padding: '12px 14px',
            marginTop: '14px',
          }}
        >
          {submitSummary}
        </div>
      )}
    </form>
  )
}
