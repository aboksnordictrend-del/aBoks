'use client'

import { useState } from 'react'

/**
 * B2B inquiry form for /bedrifter.
 *
 * NOTE ON SUBMISSION: the project has no contact-form backend (no server action, no
 * mail endpoint for anything other than transactional order mail), and building one was
 * outside the scope of this page. The form therefore validates fully but never claims to
 * have sent anything — on a valid submit it says so plainly and offers the same data as a
 * prefilled e-mail to post@aboks.no. Wiring a real endpoint means replacing `handleSubmit`
 * below; no other part of the page changes.
 */

const FONT = 'var(--font-manrope)'
const INK = '#1a1d17'
const MUTED = '#6b6f63'
const SOFT = '#3a3f33'
const BORDER = '#d9d2c4'
const OLIVE = '#39402c'
const ERROR = '#c0392b'

/** Address used across the site for customer and partnership enquiries. */
const CONTACT_EMAIL = 'post@aboks.no'

export const INTEREST_OPTIONS = [
  'Produkter til egen bedrift',
  'aBoks Special',
  'aBoks Office',
  'Større bestilling',
  'Forhandlersamarbeid',
  'Dropshipping',
  'Annet',
] as const

export type InterestOption = (typeof INTEREST_OPTIONS)[number]

const FIELD_SUMMARY = 'Forespørselen ble ikke sendt. Sjekk feltene som er markert med rødt.'

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT,
  fontSize: '14px',
  fontWeight: 600,
  color: INK,
  margin: '0 0 8px',
}

const optionalStyle: React.CSSProperties = {
  fontWeight: 500,
  color: MUTED,
  fontSize: '13px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: FONT,
  fontSize: '15px',
  color: INK,
  padding: '13px 14px',
  border: `1px solid ${BORDER}`,
  borderRadius: '10px',
  background: '#fdfcf9',
  outline: 'none',
  boxSizing: 'border-box',
}

const errorInputStyle: React.CSSProperties = { borderColor: ERROR, background: '#fdf3f2' }

const errorTextStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: '13px',
  color: ERROR,
  margin: '6px 0 0',
}

const fieldWrap: React.CSSProperties = { marginBottom: '22px' }

type FieldKey =
  | 'company'
  | 'orgNumber'
  | 'contactPerson'
  | 'email'
  | 'phone'
  | 'interest'
  | 'quantity'
  | 'message'

/** Field order used both for focus-on-error and for the e-mail fallback body. */
const FIELD_IDS: Record<FieldKey, string> = {
  company: 'inq-company',
  orgNumber: 'inq-orgnr',
  contactPerson: 'inq-contact',
  email: 'inq-email',
  phone: 'inq-phone',
  interest: 'inq-interest',
  quantity: 'inq-quantity',
  message: 'inq-message',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InquiryForm({
  interest,
  onInterestChange,
}: {
  /** Lifted so the "Meld interesse" buttons further up the page can preselect a product. */
  interest: string
  onInterestChange: (value: string) => void
}) {
  const [company, setCompany] = useState('')
  const [orgNumber, setOrgNumber] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [quantity, setQuantity] = useState('')
  const [message, setMessage] = useState('')

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [summary, setSummary] = useState('')
  /** Set once a valid submit has been attempted — never claims the enquiry was sent. */
  const [reviewed, setReviewed] = useState(false)

  function validate(): Partial<Record<FieldKey, string>> {
    const next: Partial<Record<FieldKey, string>> = {}

    if (!company.trim()) next.company = 'Fyll inn bedriftsnavn.'
    if (!contactPerson.trim()) next.contactPerson = 'Fyll inn navnet på kontaktpersonen.'
    if (!email.trim()) next.email = 'Fyll inn e-postadressen.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Skriv en gyldig e-postadresse.'
    if (!interest) next.interest = 'Velg hva dere er interessert i.'
    if (!message.trim()) next.message = 'Skriv en kort melding om behovet.'

    // Optional fields are only checked when they contain something.
    const digits = orgNumber.replace(/\s/g, '')
    if (digits && !/^\d{9}$/.test(digits)) next.orgNumber = 'Organisasjonsnummer består av 9 siffer.'
    if (phone.trim() && phone.replace(/\D/g, '').length < 8) next.phone = 'Skriv et gyldig telefonnummer.'
    if (quantity.trim() && !/^\d+$/.test(quantity.trim())) next.quantity = 'Oppgi antall som et tall.'

    return next
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setReviewed(false)
    const next = validate()
    setErrors(next)

    const firstInvalid = (Object.keys(FIELD_IDS) as FieldKey[]).find((key) => next[key])
    if (firstInvalid) {
      setSummary(FIELD_SUMMARY)
      document.getElementById(FIELD_IDS[firstInvalid])?.focus()
      return
    }

    setSummary('')
    setReviewed(true)
  }

  /** Everything the visitor typed, as a plain-text e-mail they send themselves. */
  function mailtoHref(): string {
    const lines = [
      `Bedriftsnavn: ${company.trim()}`,
      orgNumber.trim() ? `Organisasjonsnummer: ${orgNumber.trim()}` : null,
      `Kontaktperson: ${contactPerson.trim()}`,
      `E-post: ${email.trim()}`,
      phone.trim() ? `Telefon: ${phone.trim()}` : null,
      `Interessert i: ${interest}`,
      quantity.trim() ? `Omtrent antall produkter: ${quantity.trim()}` : null,
      '',
      'Melding:',
      message.trim(),
    ].filter((line) => line !== null)

    const subject = `Forespørsel fra ${company.trim()}`
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
  }

  function describedBy(key: FieldKey): string | undefined {
    return errors[key] ? `${FIELD_IDS[key]}-error` : undefined
  }

  function fieldStyle(key: FieldKey, extra?: React.CSSProperties): React.CSSProperties {
    return { ...inputStyle, ...(errors[key] ? errorInputStyle : null), ...extra }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        background: '#ffffff',
        border: '1px solid #e8e0d4',
        borderRadius: '24px',
        padding: 'clamp(26px,4vw,48px)',
      }}
    >
      {/* Company + org.nr */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ columnGap: '20px' }}>
        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.company} style={labelStyle}>
            Bedriftsnavn
          </label>
          <input
            id={FIELD_IDS.company}
            name="company"
            type="text"
            autoComplete="organization"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={describedBy('company')}
            style={fieldStyle('company')}
          />
          {errors.company && (
            <p id={`${FIELD_IDS.company}-error`} style={errorTextStyle}>
              {errors.company}
            </p>
          )}
        </div>

        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.orgNumber} style={labelStyle}>
            Organisasjonsnummer <span style={optionalStyle}>(valgfritt)</span>
          </label>
          <input
            id={FIELD_IDS.orgNumber}
            name="orgNumber"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="9 siffer"
            value={orgNumber}
            onChange={(e) => setOrgNumber(e.target.value)}
            aria-invalid={errors.orgNumber ? true : undefined}
            aria-describedby={describedBy('orgNumber')}
            style={fieldStyle('orgNumber')}
          />
          {errors.orgNumber && (
            <p id={`${FIELD_IDS.orgNumber}-error`} style={errorTextStyle}>
              {errors.orgNumber}
            </p>
          )}
        </div>
      </div>

      {/* Contact person + e-mail */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ columnGap: '20px' }}>
        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.contactPerson} style={labelStyle}>
            Kontaktperson
          </label>
          <input
            id={FIELD_IDS.contactPerson}
            name="contactPerson"
            type="text"
            autoComplete="name"
            required
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            aria-invalid={errors.contactPerson ? true : undefined}
            aria-describedby={describedBy('contactPerson')}
            style={fieldStyle('contactPerson')}
          />
          {errors.contactPerson && (
            <p id={`${FIELD_IDS.contactPerson}-error`} style={errorTextStyle}>
              {errors.contactPerson}
            </p>
          )}
        </div>

        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.email} style={labelStyle}>
            E-post
          </label>
          <input
            id={FIELD_IDS.email}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('email')}
            style={fieldStyle('email')}
          />
          {errors.email && (
            <p id={`${FIELD_IDS.email}-error`} style={errorTextStyle}>
              {errors.email}
            </p>
          )}
        </div>
      </div>

      {/* Phone + quantity */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ columnGap: '20px' }}>
        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.phone} style={labelStyle}>
            Telefonnummer <span style={optionalStyle}>(valgfritt)</span>
          </label>
          <input
            id={FIELD_IDS.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy('phone')}
            style={fieldStyle('phone')}
          />
          {errors.phone && (
            <p id={`${FIELD_IDS.phone}-error`} style={errorTextStyle}>
              {errors.phone}
            </p>
          )}
        </div>

        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.quantity} style={labelStyle}>
            Omtrent antall produkter <span style={optionalStyle}>(valgfritt)</span>
          </label>
          <input
            id={FIELD_IDS.quantity}
            name="quantity"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="F.eks. 25"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={errors.quantity ? true : undefined}
            aria-describedby={describedBy('quantity')}
            style={fieldStyle('quantity')}
          />
          {errors.quantity && (
            <p id={`${FIELD_IDS.quantity}-error`} style={errorTextStyle}>
              {errors.quantity}
            </p>
          )}
        </div>
      </div>

      {/* Interest */}
      <div style={fieldWrap}>
        <label htmlFor={FIELD_IDS.interest} style={labelStyle}>
          Hva er dere interessert i?
        </label>
        <select
          id={FIELD_IDS.interest}
          name="interest"
          required
          value={interest}
          onChange={(e) => onInterestChange(e.target.value)}
          aria-invalid={errors.interest ? true : undefined}
          aria-describedby={describedBy('interest')}
          style={fieldStyle('interest', { cursor: 'pointer', minHeight: '50px' })}
        >
          <option value="">Velg ett alternativ</option>
          {INTEREST_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errors.interest && (
          <p id={`${FIELD_IDS.interest}-error`} style={errorTextStyle}>
            {errors.interest}
          </p>
        )}
      </div>

      {/* Message */}
      <div style={fieldWrap}>
        <label htmlFor={FIELD_IDS.message} style={labelStyle}>
          Melding
        </label>
        <textarea
          id={FIELD_IDS.message}
          name="message"
          rows={5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Fortell kort om arbeidsplassen, antall steder og hva dere trenger."
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message')}
          style={fieldStyle('message', { resize: 'vertical', minHeight: '132px', lineHeight: 1.6 })}
        />
        {errors.message && (
          <p id={`${FIELD_IDS.message}-error`} style={errorTextStyle}>
            {errors.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        data-btn
        className="w-full sm:w-auto"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '17px 40px',
          borderRadius: '999px',
          border: 'none',
          background: OLIVE,
          color: '#faf6ee',
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: '15px',
          letterSpacing: '0.01em',
          cursor: 'pointer',
          minHeight: '54px',
        }}
      >
        Send forespørsel
      </button>

      <p
        style={{
          fontFamily: FONT,
          fontSize: '14px',
          lineHeight: 1.65,
          color: MUTED,
          margin: '18px 0 0',
        }}
      >
        Forespørselen er uforpliktende. Vi kontakter deg så snart som mulig.
      </p>

      {summary && (
        <p role="alert" style={{ ...errorTextStyle, fontSize: '14px', margin: '14px 0 0' }}>
          {summary}
        </p>
      )}

      {reviewed && (
        <div
          role="status"
          style={{
            marginTop: '24px',
            border: '1px solid #ddd2bb',
            borderRadius: '16px',
            background: '#faf6ee',
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
            Forespørselen er ikke sendt ennå
          </p>
          <p
            style={{
              fontFamily: FONT,
              fontSize: '14.5px',
              lineHeight: 1.65,
              color: SOFT,
              margin: '0 0 18px',
            }}
          >
            Skjemaet er ferdig utfylt, men automatisk innsending er ikke koblet på ennå. Send
            opplysningene direkte til oss i mellomtiden – knappen under åpner e-postprogrammet
            ditt med alt du har skrevet.
          </p>
          <a
            href={mailtoHref()}
            data-btn
            className="w-full sm:w-auto"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 30px',
              borderRadius: '999px',
              border: `1.5px solid ${OLIVE}`,
              color: OLIVE,
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: '14.5px',
              textDecoration: 'none',
              minHeight: '48px',
            }}
          >
            Send som e-post
          </a>
          <p
            style={{
              fontFamily: FONT,
              fontSize: '13.5px',
              lineHeight: 1.65,
              color: MUTED,
              margin: '14px 0 0',
            }}
          >
            Eller skriv til{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              style={{ color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px' }}
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      )}
    </form>
  )
}
