'use client'

/**
 * The panel shown under the inquiry form once a submission has resolved.
 *
 * Success is reached from exactly one place — a 200 with `{ ok: true }`, which the server
 * returns only after both e-mails have been accepted by the transport. There is no path that
 * shows it optimistically, and none that asks the customer to send anything themselves.
 *
 * Kept in its own module so both states can be rendered and asserted without the form.
 */

const FONT = 'var(--font-manrope)'
const INK = '#1a1d17'
const SOFT = '#3a3f33'

export const INQUIRY_FEEDBACK = {
  success: {
    title: 'Takk for forespørselen!',
    body:
      'Vi har mottatt opplysningene dine og sendt en bekreftelse til e-postadressen du oppga. ' +
      'Vi tar kontakt så snart som mulig.',
  },
  error: {
    title: 'Forespørselen kunne ikke sendes',
    body: 'Prøv igjen om litt, eller kontakt oss på post@aboks.no.',
  },
} as const

export type InquiryFeedbackKind = 'success' | 'error'

const TONE: Record<InquiryFeedbackKind, { border: string; background: string }> = {
  success: { border: '#ddd2bb', background: '#faf6ee' },
  error: { border: '#e6c7c2', background: '#fdf3f2' },
}

export function InquiryFeedbackPanel({
  kind,
  /** Server-supplied text, used in place of the default body when present. */
  message,
}: {
  kind: InquiryFeedbackKind
  message?: string
}) {
  const copy = INQUIRY_FEEDBACK[kind]
  const tone = TONE[kind]

  return (
    <div
      style={{
        marginTop: '24px',
        border: `1px solid ${tone.border}`,
        borderRadius: '16px',
        background: tone.background,
        padding: 'clamp(20px,2.6vw,28px)',
      }}
    >
      <p
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: '15px',
          color: INK,
          margin: '0 0 8px',
        }}
      >
        {copy.title}
      </p>
      <p
        style={{
          fontFamily: FONT,
          fontSize: '14.5px',
          lineHeight: 1.65,
          color: SOFT,
          margin: 0,
        }}
      >
        {message || copy.body}
      </p>
    </div>
  )
}
