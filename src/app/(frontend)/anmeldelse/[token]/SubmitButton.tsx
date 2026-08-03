'use client'

/**
 * The review form's submit button, extracted so its disabled/label states can be asserted
 * without importing ReviewForm — which pulls in the `'use server'` actions module and, with
 * it, the whole Payload server runtime. Same reasoning as @/lib/reviewSubmitResult.
 *
 * Two independent reasons to lock the button: photos are still being resized in the browser
 * (`processing`), or the Server Action is in flight (`pending`). Either one must block a
 * second submit — sending mid-optimisation would post the raw camera files and hit Vercel's
 * 413, which is the bug this whole flow exists to prevent.
 */

const FONT = 'var(--font-manrope)'

export const SUBMIT_LABELS = {
  idle: 'Send anmeldelse',
  processing: 'Behandler bilder …',
  pending: 'Sender…',
} as const

export function submitLabel(processing: boolean, pending: boolean): string {
  if (processing) return SUBMIT_LABELS.processing
  if (pending) return SUBMIT_LABELS.pending
  return SUBMIT_LABELS.idle
}

export function SubmitButton({ processing, pending }: { processing: boolean; pending: boolean }) {
  const busy = processing || pending
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy}
      style={{
        width: '100%',
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: '15px',
        color: '#faf6ee',
        background: busy ? '#7a8266' : '#39402c',
        border: 'none',
        borderRadius: '10px',
        padding: '15px 20px',
        cursor: busy ? 'not-allowed' : 'pointer',
        transition: 'background 0.18s ease',
      }}
    >
      {submitLabel(processing, pending)}
    </button>
  )
}
