'use client'

import { useId, useState } from 'react'
import {
  PROMO_COMPACT_TEXT,
  promoDisclosureView,
  type PromoDisclosureView,
} from '@/lib/promo/cartPromo'
import PromoCodeField from './PromoCodeField'
import type { UsePromoCodeResult } from '@/lib/promo/usePromoCode'

/**
 * «Har du en rabattkode?» — the slide-out cart's promo row.
 *
 * A disclosure rather than an always-open field: the drawer's footer is sticky and, on a
 * phone, every row it costs pushes «Gå til kassen» closer to the fold. Collapsed it is a
 * single line of text; the field only exists once someone asks for it.
 *
 * It owns exactly one piece of state — whether the customer pressed the trigger. Every other
 * reason to be open (a check in flight, a rejected code and its message, a code already
 * applied) is derived from the shared promo state by `promoDisclosureView`, so an error can
 * never be collapsed out of sight, and reopening the drawer over an applied code shows it
 * straight away without anyone having to press anything.
 *
 * The field itself is the cart page's `PromoCodeField` in its compact variant — same
 * component, same `usePromoCode` result, same server-computed discount.
 */

const font = 'var(--font-manrope)'

/**
 * The markup, with the open/closed decision handed in.
 *
 * Split out so what the row *shows* in each of its three states can be asserted directly,
 * the way `PayoutModalBody` is: the decision itself is `promoDisclosureView`, tested as the
 * pure function it is.
 */
export function PromoDisclosureRow({
  view,
  promo,
  onToggle,
}: {
  view: PromoDisclosureView
  promo: UsePromoCodeResult
  onToggle: () => void
}) {
  const panelId = `promo-disclosure-${useId()}`

  if (view === 'applied') {
    return (
      <div style={{ marginBottom: '14px' }}>
        <PromoCodeField promo={promo} variant="compact" />
      </div>
    )
  }

  const open = view === 'expanded'

  return (
    <div style={{ marginBottom: '14px' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          padding: '2px 0',
          cursor: 'pointer',
          fontFamily: font,
          fontSize: '13.5px',
          fontWeight: 600,
          color: '#39402c',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
        }}
      >
        {PROMO_COMPACT_TEXT.trigger}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Mounted only while open: a closed disclosure costs the footer one line of text. */}
      {open && (
        <div id={panelId} style={{ marginTop: '10px' }}>
          <PromoCodeField promo={promo} variant="compact" />
        </div>
      )}
    </div>
  )
}

export default function PromoCodeDisclosure({ promo }: { promo: UsePromoCodeResult }) {
  const [toggled, setToggled] = useState(false)

  const view = promoDisclosureView({
    toggled,
    status: promo.status,
    code: promo.code,
    message: promo.message,
  })

  return (
    <PromoDisclosureRow
      view={view}
      promo={promo}
      onToggle={() => setToggled((was) => !was)}
    />
  )
}
