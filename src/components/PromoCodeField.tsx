'use client'

import { useEffect, useState } from 'react'
import { PROMO_TEXT, shouldSubmitOnKey } from '@/lib/promo/cartPromo'
import type { UsePromoCodeResult } from '@/lib/promo/usePromoCode'

/**
 * The `Rabattkode` field in the cart summary.
 *
 * Purely presentational: every decision — what a response means, when to revalidate, whether
 * a code survives a failure — belongs to `usePromoCode` / `cartPromo`. The only state here is
 * the text currently in the input.
 *
 * Styling follows the cart's existing inline-style language (Manrope, #1a1d17 ink, #6b6f63
 * muted, pill buttons); nothing about the surrounding summary is changed.
 */

const FIELD_ID = 'promo-code-input'
const STATUS_ID = 'promo-code-status'

const font = 'var(--font-manrope)'

export default function PromoCodeField({ promo }: { promo: UsePromoCodeResult }) {
  const [draft, setDraft] = useState('')
  // Narrows to the code string itself, so the applied branch below never has to re-check it.
  const appliedCode = promo.status === 'applied' && promo.code ? promo.code : null
  const applied = appliedCode !== null

  // Clearing the input once a code is applied keeps the "er aktivert" state unambiguous —
  // there is no leftover text suggesting something is still to be submitted.
  useEffect(() => {
    if (applied) setDraft('')
  }, [applied])

  const submit = () => {
    if (promo.busy) return // duplicate submissions are ignored while a check is running
    promo.apply(draft)
  }

  if (appliedCode) {
    return (
      <div style={{ marginBottom: '18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '14px',
            background: '#f1f4ec',
            border: '1px solid #d9e0cd',
          }}
        >
          <span
            id={STATUS_ID}
            role="status"
            aria-live="polite"
            style={{ fontFamily: font, fontSize: '13.5px', color: '#39402c', fontWeight: 600 }}
          >
            {PROMO_TEXT.applied(appliedCode)}
          </span>
          <button
            type="button"
            onClick={promo.remove}
            style={{
              flexShrink: 0,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: font,
              fontSize: '13px',
              color: '#b06a4a',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            {PROMO_TEXT.remove}
          </button>
        </div>
      </div>
    )
  }

  const hasMessage = Boolean(promo.message)
  const isError = promo.status === 'error'

  return (
    <div style={{ marginBottom: '18px' }}>
      <label
        htmlFor={FIELD_ID}
        style={{
          display: 'block',
          fontFamily: font,
          fontSize: '13px',
          fontWeight: 600,
          color: '#3a3f33',
          marginBottom: '8px',
        }}
      >
        {PROMO_TEXT.label}
      </label>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id={FIELD_ID}
          name="promoCode"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Validation happens on Enter or on the button — never per keystroke.
          onKeyDown={(e) => {
            if (!shouldSubmitOnKey(e.key)) return
            e.preventDefault()
            submit()
          }}
          placeholder={PROMO_TEXT.placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          disabled={promo.busy}
          aria-invalid={isError || undefined}
          aria-describedby={hasMessage ? STATUS_ID : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '12px 14px',
            borderRadius: '999px',
            border: `1.5px solid ${isError ? '#d09a86' : '#d6cfbd'}`,
            background: promo.busy ? '#f6f3ec' : '#fff',
            fontFamily: font,
            fontSize: '14px',
            color: '#1a1d17',
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={promo.busy || draft.trim() === ''}
          style={{
            flexShrink: 0,
            padding: '12px 20px',
            borderRadius: '999px',
            border: '1.5px solid #39402c',
            background: promo.busy || draft.trim() === '' ? 'transparent' : '#39402c',
            color: promo.busy || draft.trim() === '' ? '#39402c' : '#faf6ee',
            fontFamily: font,
            fontWeight: 600,
            fontSize: '13.5px',
            cursor: promo.busy || draft.trim() === '' ? 'default' : 'pointer',
            opacity: promo.busy || draft.trim() === '' ? 0.55 : 1,
            transition: 'background 0.2s ease, opacity 0.2s ease',
          }}
        >
          {promo.busy ? PROMO_TEXT.checking : PROMO_TEXT.apply}
        </button>
      </div>

      {/* Always rendered so assistive technology has a stable live region to announce into. */}
      <div
        id={STATUS_ID}
        role="status"
        aria-live="polite"
        style={{
          minHeight: hasMessage ? undefined : 0,
          marginTop: hasMessage ? '8px' : 0,
          fontFamily: font,
          fontSize: '12.5px',
          lineHeight: 1.45,
          color: isError ? '#b06a4a' : '#6b6057',
        }}
      >
        {promo.message}
      </div>
    </div>
  )
}
