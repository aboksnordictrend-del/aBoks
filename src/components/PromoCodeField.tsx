'use client'

import { useEffect, useId, useState } from 'react'
import { PROMO_COMPACT_TEXT, PROMO_TEXT, shouldSubmitOnKey } from '@/lib/promo/cartPromo'
import type { UsePromoCodeResult } from '@/lib/promo/usePromoCode'

/**
 * The `Rabattkode` field — used by the cart summary and, in its compact form, by the slide-out
 * cart (see @/components/PromoCodeDisclosure).
 *
 * Purely presentational: every decision — what a response means, when to revalidate, whether
 * a code survives a failure — belongs to `usePromoCode` / `cartPromo`. The only state here is
 * the text currently in the input. The two variants differ in wording and spacing and in
 * nothing else; both drive the one shared promo state.
 *
 * Styling follows the cart's existing inline-style language (Manrope, #1a1d17 ink, #6b6f63
 * muted, pill buttons); nothing about the surrounding summary is changed.
 */

const font = 'var(--font-manrope)'

/** `panel` is the cart page's labelled field; `compact` is the drawer's one-line row. */
export type PromoCodeFieldVariant = 'panel' | 'compact'

interface Props {
  promo: UsePromoCodeResult
  variant?: PromoCodeFieldVariant
}

export default function PromoCodeField({ promo, variant = 'panel' }: Props) {
  const [draft, setDraft] = useState('')
  // Ids are per-instance: the cart page's field and an open drawer's exist in the same
  // document, and a duplicated `htmlFor` / `aria-describedby` target would resolve to the
  // wrong one.
  const instanceId = useId()
  const fieldId = `promo-code-input-${instanceId}`
  const statusId = `promo-code-status-${instanceId}`

  const compact = variant === 'compact'
  const text = compact ? PROMO_COMPACT_TEXT : PROMO_TEXT

  // Narrows to the code string itself, so the applied branch below never has to re-check it.
  const appliedCode = promo.status === 'applied' && promo.code ? promo.code : null
  const applied = appliedCode !== null

  // Clearing the input once a code is applied keeps the applied state unambiguous — there is
  // no leftover text suggesting something is still to be submitted.
  useEffect(() => {
    if (applied) setDraft('')
  }, [applied])

  const submit = () => {
    if (promo.busy) return // duplicate submissions are ignored while a check is running
    promo.apply(draft)
  }

  if (appliedCode) {
    return (
      <div style={{ marginBottom: compact ? 0 : '18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: compact ? '9px 12px' : '12px 14px',
            borderRadius: compact ? '12px' : '14px',
            background: '#f1f4ec',
            border: '1px solid #d9e0cd',
          }}
        >
          <span
            id={statusId}
            role="status"
            aria-live="polite"
            style={{
              fontFamily: font,
              fontSize: compact ? '13px' : '13.5px',
              color: '#39402c',
              fontWeight: 600,
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {text.applied(appliedCode)}
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
            {text.remove}
          </button>
        </div>

        {/* The confirmation. The amount itself is the summary's `Rabatt` row — a server figure,
            never restated here from something this component worked out. */}
        {compact && (
          <p style={{ fontFamily: font, fontSize: '12px', color: '#5f8253', margin: '6px 0 0' }}>
            {PROMO_COMPACT_TEXT.appliedNote}
          </p>
        )}
      </div>
    )
  }

  const isError = promo.status === 'error'
  /**
   * The compact button keeps its label so the row's width never jumps mid-check; progress is
   * announced in the status line beneath instead. The panel variant swaps the label, as it
   * always has.
   */
  const message = compact && promo.busy ? PROMO_COMPACT_TEXT.checking : promo.message
  const hasMessage = Boolean(message)
  const buttonLabel = compact
    ? PROMO_COMPACT_TEXT.apply
    : promo.busy
      ? PROMO_TEXT.checking
      : PROMO_TEXT.apply
  const inert = promo.busy || draft.trim() === ''

  return (
    <div style={{ marginBottom: compact ? 0 : '18px' }}>
      {!compact && (
        <label
          htmlFor={fieldId}
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
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id={fieldId}
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
          placeholder={text.placeholder}
          // The compact field has no visible label of its own — the disclosure's trigger is
          // the line above it — so it carries its name itself.
          aria-label={compact ? PROMO_TEXT.label : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          disabled={promo.busy}
          aria-invalid={isError || undefined}
          aria-describedby={hasMessage ? statusId : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            padding: compact ? '11px 14px' : '12px 14px',
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
          disabled={inert}
          style={{
            flexShrink: 0,
            padding: compact ? '11px 18px' : '12px 20px',
            borderRadius: '999px',
            border: '1.5px solid #39402c',
            background: inert ? 'transparent' : '#39402c',
            color: inert ? '#39402c' : '#faf6ee',
            fontFamily: font,
            fontWeight: 600,
            fontSize: '13.5px',
            cursor: inert ? 'default' : 'pointer',
            opacity: inert ? 0.55 : 1,
            transition: 'background 0.2s ease, opacity 0.2s ease',
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Always rendered so assistive technology has a stable live region to announce into. */}
      <div
        id={statusId}
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
        {message}
      </div>
    </div>
  )
}
