'use client'

import { useRef, useState } from 'react'
import Script from 'next/script'
import {
  INTEREST_OPTIONS,
  firstInvalidField,
  validateInquiryInput,
  type InquiryFieldKey,
} from '@/lib/bedrifter/inquiry'
import {
  FIELD_SUMMARY,
  clearsForm,
  submitInquiry,
  type InquiryFieldErrors,
} from '@/lib/bedrifter/submitInquiry'
import { InquirySubmitButton } from './InquirySubmitButton'
import { InquiryFeedbackPanel } from './InquiryFeedback'

/**
 * B2B inquiry form for /bedrifter.
 *
 * Submits to `POST /api/bedrifter/foresporsel`, which sends the internal notification and the
 * customer's confirmation and reports success only when both have been accepted. No mail
 * client is ever opened, and the customer is never asked to send anything themselves.
 *
 * The fields validate against the very same `validateInquiryInput` the endpoint runs, so the
 * browser and the server can never disagree about what is valid or about how a message is
 * worded. The client check is a courtesy; the server's is the one that counts.
 */

export { INTEREST_OPTIONS }
export type { InterestOption } from '@/lib/bedrifter/inquiry'

declare global {
  interface Window {
    /** Injected by the Turnstile script; absent when the widget is not configured. */
    turnstile?: { reset: (widget?: string | HTMLElement) => void }
  }
}

const FONT = 'var(--font-manrope)'
const INK = '#1a1d17'
const MUTED = '#6b6f63'
const BORDER = '#d9d2c4'
const OLIVE = '#39402c'
const ERROR = '#c0392b'

/** Address used across the site for customer and partnership enquiries. */
const CONTACT_EMAIL = 'post@aboks.no'

/** Rendered only when a site key is configured, exactly like the review form. */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

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

/** Field ids, in the order `firstInvalidField` walks them. */
const FIELD_IDS: Record<InquiryFieldKey, string> = {
  company: 'inq-company',
  orgNumber: 'inq-orgnr',
  contactPerson: 'inq-contact',
  email: 'inq-email',
  phone: 'inq-phone',
  interest: 'inq-interest',
  quantity: 'inq-quantity',
  message: 'inq-message',
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function InquiryForm({
  interest,
  onInterestChange,
}: {
  /** Lifted so the "Meld interesse" buttons further up the page can preselect a product. */
  interest: string
  onInterestChange: (value: string) => void
}) {
  const formRef = useRef<HTMLFormElement>(null)

  const [company, setCompany] = useState('')
  const [orgNumber, setOrgNumber] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [quantity, setQuantity] = useState('')
  const [message, setMessage] = useState('')

  const [errors, setErrors] = useState<InquiryFieldErrors>({})
  const [summary, setSummary] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  /** Server-supplied copy for the error panel, when it sent any. */
  const [serverMessage, setServerMessage] = useState('')

  const pending = status === 'submitting'

  function currentValues() {
    return { company, orgNumber, contactPerson, email, phone, interest, quantity, message }
  }

  function clearForm() {
    setCompany('')
    setOrgNumber('')
    setContactPerson('')
    setEmail('')
    setPhone('')
    setQuantity('')
    setMessage('')
    onInterestChange('')
  }

  /** Shows the field errors, focuses the first one and keeps everything the user typed. */
  function showFieldErrors(next: InquiryFieldErrors, summaryText: string) {
    setErrors(next)
    setSummary(summaryText)
    const first = firstInvalidField(next)
    if (first) document.getElementById(FIELD_IDS[first])?.focus()
  }

  /** Value of a hidden input the browser owns: the Turnstile token, or the honeypot. */
  function hiddenValue(name: string): string | undefined {
    const form = formRef.current
    if (!form) return undefined
    const value = new FormData(form).get(name)
    return typeof value === 'string' && value ? value : undefined
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Belt and braces alongside the disabled button: a second submit while one is in flight
    // never leaves this function.
    if (pending) return

    setStatus('idle')
    setServerMessage('')
    setSummary('')

    // Checked here as well as inside `submitInquiry`, so an incomplete form never flickers
    // the button into its sending state. Both calls run the one shared validator.
    const validation = validateInquiryInput(currentValues())
    if (!validation.ok) {
      showFieldErrors(validation.errors, FIELD_SUMMARY)
      return
    }
    setErrors({})
    setStatus('submitting')

    // The Turnstile widget writes its token into a hidden input inside this form, and the
    // honeypot lives there too — both are read off the DOM rather than mirrored into state.
    const outcome = await submitInquiry(currentValues(), {
      turnstileToken: hiddenValue('cf-turnstile-response'),
      honeypot: hiddenValue('referansekode'),
    })

    if (clearsForm(outcome)) {
      // Only now — the server has confirmed that both e-mails went out.
      clearForm()
      setErrors({})
      setSummary('')
      setStatus('success')
      // The token is single-use; without a reset a second inquiry would fail verification.
      window.turnstile?.reset()
      return
    }

    if (outcome.kind === 'field-errors') {
      setStatus('idle')
      showFieldErrors(outcome.errors, outcome.summary)
      return
    }

    setServerMessage(outcome.kind === 'error' ? outcome.message : '')
    setStatus('error')
  }

  function describedBy(key: InquiryFieldKey): string | undefined {
    return errors[key] ? `${FIELD_IDS[key]}-error` : undefined
  }

  function fieldStyle(key: InquiryFieldKey, extra?: React.CSSProperties): React.CSSProperties {
    return { ...inputStyle, ...(errors[key] ? errorInputStyle : null), ...extra }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      style={{
        background: '#ffffff',
        border: '1px solid #e8e0d4',
        borderRadius: '24px',
        padding: 'clamp(26px,4vw,48px)',
      }}
    >
      {/* Honeypot: visually hidden, off the tab order, and deliberately NOT named like an
          autofill target, so a real user's browser never fills it. Same field name as the
          review form. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <input
          type="text"
          name="referansekode"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          aria-label="La stå tom"
        />
      </div>

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

      {TURNSTILE_SITE_KEY && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js"
            strategy="lazyOnload"
          />
          <div
            className="cf-turnstile"
            data-sitekey={TURNSTILE_SITE_KEY}
            style={{ marginBottom: '22px' }}
          />
        </>
      )}

      <InquirySubmitButton pending={pending} />

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

      {/* Single live region for the whole submission lifecycle, so a screen reader hears the
          progress and the outcome without the focus moving. */}
      <div role="status" aria-live="polite">
        {pending && (
          <p
            style={{
              fontFamily: FONT,
              fontSize: '14px',
              lineHeight: 1.65,
              color: MUTED,
              margin: '14px 0 0',
            }}
          >
            Sender forespørselen …
          </p>
        )}
        {status === 'success' && <InquiryFeedbackPanel kind="success" />}
        {status === 'error' && <InquiryFeedbackPanel kind="error" message={serverMessage} />}
      </div>

      <p
        style={{
          fontFamily: FONT,
          fontSize: '13.5px',
          lineHeight: 1.65,
          color: MUTED,
          margin: '18px 0 0',
        }}
      >
        Du kan også skrive direkte til{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          style={{ color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px' }}
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </form>
  )
}
