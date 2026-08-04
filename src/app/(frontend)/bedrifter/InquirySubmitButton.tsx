'use client'

/**
 * The inquiry form's submit button, extracted for the same reason as the review form's
 * SubmitButton: its label and disabled state can then be asserted without pulling the whole
 * form (and its fetch) into a test.
 *
 * Natively disabled while a submission is in flight — that, plus the server-side duplicate
 * guard, is what stops a double-click from producing two inquiries.
 *
 * Styling is unchanged from the button this replaces: same olive pill, same size, same
 * `data-btn` hook and the same responsive width class.
 */

const FONT = 'var(--font-manrope)'
const OLIVE = '#39402c'
/** Muted olive, matching the review form's busy button. */
const OLIVE_BUSY = '#7a8266'

export const INQUIRY_SUBMIT_LABELS = {
  idle: 'Send forespørsel',
  pending: 'Sender…',
} as const

export function inquirySubmitLabel(pending: boolean): string {
  return pending ? INQUIRY_SUBMIT_LABELS.pending : INQUIRY_SUBMIT_LABELS.idle
}

export function InquirySubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-btn
      className="w-full sm:w-auto"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '17px 40px',
        borderRadius: '999px',
        border: 'none',
        background: pending ? OLIVE_BUSY : OLIVE,
        color: '#faf6ee',
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: '15px',
        letterSpacing: '0.01em',
        cursor: pending ? 'not-allowed' : 'pointer',
        minHeight: '54px',
        transition: 'background 0.18s ease',
      }}
    >
      {inquirySubmitLabel(pending)}
    </button>
  )
}
