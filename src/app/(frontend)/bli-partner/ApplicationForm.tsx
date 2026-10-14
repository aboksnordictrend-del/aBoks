'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import {
  APPLICANT_TYPES,
  APPLICANT_TYPE_LABELS,
  APPLICATION_LABELS,
  firstInvalidApplicationField,
  isBusinessApplicant,
  validateApplicationInput,
  type ApplicationErrors,
  type ApplicationFieldKey,
} from '@/lib/partnerProgram/application'
import {
  APPLICATION_FIELD_SUMMARY,
  submitApplication,
} from '@/lib/partnerProgram/submitApplication'
import { APPLICATION_RESPONSE_MESSAGES } from '@/lib/partnerProgram/applicationResponses'

/**
 * The partner application form — one form for the whole programme and all three methods.
 *
 * Posts to `POST /api/bli-partner/soknad`, which e-mails post@aboks.no and the applicant and
 * succeeds only when both were accepted. Submitting creates nothing: no partner, no code, no
 * agreement — the confirmation copy says so, and the form makes the applicant acknowledge it.
 *
 * Mirrors the /bedrifter inquiry form: one shared validator for browser and server, the same
 * honeypot and optional Turnstile, focus moved to the first invalid field, a disabled button
 * while a request is in flight, and one polite live region for progress and outcome.
 */

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string | HTMLElement) => void }
  }
}

const FONT = 'var(--font-manrope)'
const INK = '#1a1d17'
const MUTED = '#6b6f63'
const BORDER = '#d9d2c4'
const OLIVE = '#39402c'
const OLIVE_BUSY = '#7a8266'
const ERROR = '#c0392b'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

const FIELD_IDS: Record<ApplicationFieldKey, string> = {
  applicantType: 'app-type-privatperson',
  fullName: 'app-name',
  companyName: 'app-company',
  orgNumber: 'app-orgnr',
  email: 'app-email',
  phone: 'app-phone',
  website: 'app-website',
  promotionPlan: 'app-plan',
  privacyAccepted: 'app-privacy',
  approvalAcknowledged: 'app-approval',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: FONT,
  fontSize: '14px',
  fontWeight: 600,
  color: INK,
  margin: '0 0 8px',
}
const optionalStyle: React.CSSProperties = { fontWeight: 500, color: MUTED, fontSize: '13px' }
const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: FONT,
  fontSize: '16px',
  color: INK,
  padding: '13px 14px',
  border: `1px solid ${BORDER}`,
  borderRadius: '10px',
  background: '#fdfcf9',
  boxSizing: 'border-box',
}
const errorInputStyle: React.CSSProperties = { borderColor: ERROR, background: '#fdf3f2' }
const errorTextStyle: React.CSSProperties = { fontFamily: FONT, fontSize: '13px', color: ERROR, margin: '6px 0 0' }
const fieldWrap: React.CSSProperties = { marginBottom: '22px' }

type Status = 'idle' | 'submitting' | 'success' | 'error'

/** U+00AD: invisible unless the browser breaks the word there, then shown as a hyphen. */
const SOFT_HYPHEN = String.fromCharCode(0xad)

/**
 * An applicant-type label, laid out to fit a narrow radio card: a parenthesised
 * abbreviation gets its own line («Enkeltpersonforetak» / «(ENK)»), and the long compound
 * gets a soft hyphen at its natural joint, so it breaks as «Enkeltperson-foretak» only when
 * the card is too narrow for the whole word. Display only — the label text itself (also
 * used in the e-mails) is unchanged, and screen readers ignore the soft hyphen.
 */
function CardLabel({ text }: { text: string }) {
  const open = text.indexOf(' (')
  const main = (open === -1 ? text : text.slice(0, open)).replace('personforetak', `person${SOFT_HYPHEN}foretak`)
  const abbr = open === -1 ? null : text.slice(open + 1)
  return (
    <span style={{ minWidth: 0, lineHeight: 1.3, overflowWrap: 'break-word', hyphens: 'manual' }}>
      {main}
      {abbr && <span style={{ display: 'block', fontWeight: 500 }}>{abbr}</span>}
    </span>
  )
}

const EMPTY = {
  applicantType: '',
  fullName: '',
  companyName: '',
  orgNumber: '',
  email: '',
  phone: '',
  website: '',
  promotionPlan: '',
  privacyAccepted: false,
  approvalAcknowledged: false,
}

export default function ApplicationForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<ApplicationErrors>({})
  const [summary, setSummary] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [serverMessage, setServerMessage] = useState('')
  const pending = status === 'submitting'
  const business = isBusinessApplicant(values.applicantType)

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  function showFieldErrors(next: ApplicationErrors, text: string) {
    setErrors(next)
    setSummary(text)
    const first = firstInvalidApplicationField(next)
    if (first) document.getElementById(FIELD_IDS[first])?.focus()
  }

  function hiddenValue(name: string): string | undefined {
    const form = formRef.current
    if (!form) return undefined
    const value = new FormData(form).get(name)
    return typeof value === 'string' && value ? value : undefined
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    setStatus('idle')
    setServerMessage('')
    setSummary('')

    const validation = validateApplicationInput(values)
    if (!validation.ok) {
      showFieldErrors(validation.errors, APPLICATION_FIELD_SUMMARY)
      return
    }
    setErrors({})
    setStatus('submitting')

    const outcome = await submitApplication(values, {
      turnstileToken: hiddenValue('cf-turnstile-response'),
      honeypot: hiddenValue('referansekode'),
    })

    if (outcome.kind === 'success') {
      setValues(EMPTY)
      setStatus('success')
      window.turnstile?.reset()
      return
    }
    if (outcome.kind === 'field-errors') {
      setStatus('idle')
      showFieldErrors(outcome.errors, outcome.summary)
      return
    }
    setServerMessage(outcome.message)
    setStatus('error')
  }

  const describedBy = (key: ApplicationFieldKey, extra?: string) =>
    [errors[key] ? `${FIELD_IDS[key]}-error` : '', extra ?? ''].filter(Boolean).join(' ') || undefined
  const fieldStyle = (key: ApplicationFieldKey, extra?: React.CSSProperties): React.CSSProperties => ({
    ...inputStyle,
    ...(errors[key] ? errorInputStyle : null),
    ...extra,
  })
  const errorFor = (key: ApplicationFieldKey) =>
    errors[key] ? (
      <p id={`${FIELD_IDS[key]}-error`} style={errorTextStyle}>
        {errors[key]}
      </p>
    ) : null

  if (status === 'success') {
    return (
      <div
        role="status"
        tabIndex={-1}
        ref={(node) => node?.focus()}
        style={{ background: '#ffffff', border: '1px solid #e8e0d4', borderRadius: '24px', padding: 'clamp(26px,4vw,48px)', outline: 'none' }}
      >
        <p style={{ fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: 'clamp(26px,3vw,34px)', color: INK, margin: '0 0 12px', lineHeight: 1.15 }}>
          Søknaden er sendt
        </p>
        <p style={{ fontFamily: FONT, fontSize: '16px', lineHeight: 1.7, color: '#3a3f33', margin: 0 }}>
          {APPLICATION_RESPONSE_MESSAGES.success}
        </p>
        <p style={{ fontFamily: FONT, fontSize: '14px', lineHeight: 1.65, color: MUTED, margin: '14px 0 0' }}>
          Du får også en bekreftelse på e-post. Søknaden er ikke en godkjenning eller en avtale.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          style={{ marginTop: '20px', background: 'none', border: 'none', padding: 0, fontFamily: FONT, fontWeight: 600, fontSize: '14px', color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer' }}
        >
          Send en ny søknad
        </button>
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      aria-describedby="app-required-note"
      style={{ background: '#ffffff', border: '1px solid #e8e0d4', borderRadius: '24px', padding: 'clamp(24px,4vw,48px)', position: 'relative' }}
    >
      {/* Honeypot — same name and treatment as the review and inquiry forms. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
        <input type="text" name="referansekode" tabIndex={-1} autoComplete="off" aria-hidden="true" aria-label="La stå tom" />
      </div>

      <p id="app-required-note" style={{ fontFamily: FONT, fontSize: '13px', color: MUTED, margin: '0 0 20px' }}>
        Alle felt må fylles ut, med mindre de er merket som valgfrie.
      </p>

      {/* Applicant type */}
      <fieldset
        style={{ border: 'none', padding: 0, margin: '0 0 22px' }}
        aria-describedby={errors.applicantType ? `${FIELD_IDS.applicantType}-error` : undefined}
      >
        <legend style={labelStyle}>{APPLICATION_LABELS.applicantType}</legend>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {APPLICANT_TYPES.map((type) => {
            const checked = values.applicantType === type
            return (
              <label
                key={type}
                className="flex h-full min-w-0 cursor-pointer items-center gap-3"
                style={{
                  minHeight: '52px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1.5px solid ${checked ? OLIVE : errors.applicantType ? ERROR : BORDER}`,
                  background: checked ? '#f1f3ec' : '#fdfcf9',
                  fontFamily: FONT,
                  fontSize: '14.5px',
                  fontWeight: 600,
                  color: INK,
                }}
              >
                <input
                  id={`app-type-${type}`}
                  type="radio"
                  name="applicantType"
                  value={type}
                  checked={checked}
                  onChange={() => set('applicantType', type)}
                  style={{ width: '18px', height: '18px', flexShrink: 0, accentColor: OLIVE }}
                />
                <CardLabel text={APPLICANT_TYPE_LABELS[type]} />
              </label>
            )
          })}
        </div>
        {errorFor('applicantType')}
      </fieldset>

      <div style={fieldWrap}>
        <label htmlFor={FIELD_IDS.fullName} style={labelStyle}>
          {APPLICATION_LABELS.fullName}
        </label>
        <input
          id={FIELD_IDS.fullName}
          type="text"
          autoComplete="name"
          required
          value={values.fullName}
          onChange={(e) => set('fullName', e.target.value)}
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={describedBy('fullName')}
          style={fieldStyle('fullName')}
        />
        {errorFor('fullName')}
      </div>

      {business && (
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ columnGap: '20px' }}>
          <div style={fieldWrap}>
            <label htmlFor={FIELD_IDS.companyName} style={labelStyle}>
              {APPLICATION_LABELS.companyName}{' '}
              {values.applicantType === 'enk' && <span style={optionalStyle}>(valgfritt)</span>}
            </label>
            <input
              id={FIELD_IDS.companyName}
              type="text"
              autoComplete="organization"
              value={values.companyName}
              onChange={(e) => set('companyName', e.target.value)}
              aria-invalid={errors.companyName ? true : undefined}
              aria-describedby={describedBy('companyName')}
              style={fieldStyle('companyName')}
            />
            {errorFor('companyName')}
          </div>
          <div style={fieldWrap}>
            <label htmlFor={FIELD_IDS.orgNumber} style={labelStyle}>
              {APPLICATION_LABELS.orgNumber}{' '}
              {values.applicantType === 'enk' && <span style={optionalStyle}>(valgfritt)</span>}
            </label>
            <input
              id={FIELD_IDS.orgNumber}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="9 siffer"
              value={values.orgNumber}
              onChange={(e) => set('orgNumber', e.target.value)}
              aria-invalid={errors.orgNumber ? true : undefined}
              aria-describedby={describedBy('orgNumber')}
              style={fieldStyle('orgNumber')}
            />
            {errorFor('orgNumber')}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ columnGap: '20px' }}>
        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.email} style={labelStyle}>
            {APPLICATION_LABELS.email}
          </label>
          <input
            id={FIELD_IDS.email}
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('email')}
            style={fieldStyle('email')}
          />
          {errorFor('email')}
        </div>
        <div style={fieldWrap}>
          <label htmlFor={FIELD_IDS.phone} style={labelStyle}>
            {APPLICATION_LABELS.phone} <span style={optionalStyle}>(valgfritt)</span>
          </label>
          <input
            id={FIELD_IDS.phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy('phone')}
            style={fieldStyle('phone')}
          />
          {errorFor('phone')}
        </div>
      </div>

      <div style={fieldWrap}>
        <label htmlFor={FIELD_IDS.website} style={labelStyle}>
          {APPLICATION_LABELS.website} <span style={optionalStyle}>(valgfritt)</span>
        </label>
        <input
          id={FIELD_IDS.website}
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="F.eks. nettside, Instagram eller LinkedIn"
          value={values.website}
          onChange={(e) => set('website', e.target.value)}
          aria-invalid={errors.website ? true : undefined}
          aria-describedby={describedBy('website')}
          style={fieldStyle('website')}
        />
        {errorFor('website')}
      </div>

      <div style={fieldWrap}>
        <label htmlFor={FIELD_IDS.promotionPlan} style={labelStyle}>
          {APPLICATION_LABELS.promotionPlan}
        </label>
        <textarea
          id={FIELD_IDS.promotionPlan}
          rows={5}
          required
          value={values.promotionPlan}
          onChange={(e) => set('promotionPlan', e.target.value)}
          placeholder="Fortell for eksempel om nettverket ditt og kanalene du bruker, og om du ser for deg promokode, bedriftssalg, forhandlersalg eller en kombinasjon."
          aria-invalid={errors.promotionPlan ? true : undefined}
          aria-describedby={describedBy('promotionPlan')}
          style={fieldStyle('promotionPlan', { resize: 'vertical', minHeight: '132px', lineHeight: 1.6 })}
        />
        {errorFor('promotionPlan')}
      </div>

      <p style={{ fontFamily: FONT, fontSize: '13px', lineHeight: 1.6, color: MUTED, margin: '0 0 18px' }}>
        Ikke send fødselsnummer, kontonummer eller andre sensitive opplysninger i dette skjemaet.
        Det vi trenger for utbetaling, avtales etter en eventuell godkjenning.
      </p>

      {(
        [
          [
            'privacyAccepted',
            <>
              Jeg har lest{' '}
              <Link href="/personvernerklaering" style={{ color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                personvernerklæringen
              </Link>{' '}
              og samtykker til at ABOKS AS behandler opplysningene for å vurdere søknaden.
            </>,
          ],
          [
            'approvalAcknowledged',
            <>
              Jeg forstår at søknaden ikke gir automatisk godkjenning, og at et partnerskap først
              starter når ABOKS AS har godkjent søknaden og partneravtalen er signert.
            </>,
          ],
        ] as const
      ).map(([key, text]) => (
        <div key={key} style={{ marginBottom: '16px' }}>
          <label className="flex cursor-pointer items-start gap-3" style={{ fontFamily: FONT, fontSize: '14.5px', lineHeight: 1.55, color: INK }}>
            <input
              id={FIELD_IDS[key]}
              type="checkbox"
              checked={values[key]}
              onChange={(e) => set(key, e.target.checked)}
              aria-invalid={errors[key] ? true : undefined}
              aria-describedby={describedBy(key)}
              style={{ width: '20px', height: '20px', marginTop: '1px', flexShrink: 0, accentColor: OLIVE }}
            />
            <span>{text}</span>
          </label>
          {errorFor(key)}
        </div>
      ))}

      {TURNSTILE_SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
          <div className="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} style={{ margin: '8px 0 22px' }} />
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        data-btn
        className="mt-3 w-full sm:w-auto"
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
          cursor: pending ? 'not-allowed' : 'pointer',
          minHeight: '54px',
          transition: 'background 0.18s ease',
        }}
      >
        {pending ? 'Sender…' : 'Send søknad'}
      </button>

      {summary && (
        <p role="alert" style={{ ...errorTextStyle, fontSize: '14px', margin: '14px 0 0' }}>
          {summary}
        </p>
      )}

      <div role="status" aria-live="polite">
        {pending && (
          <p style={{ fontFamily: FONT, fontSize: '14px', color: MUTED, margin: '14px 0 0' }}>Sender søknaden …</p>
        )}
        {status === 'error' && (
          <div style={{ marginTop: '20px', border: '1px solid #e6c7c2', background: '#fdf3f2', borderRadius: '16px', padding: '18px 20px' }}>
            <p style={{ fontFamily: FONT, fontWeight: 700, fontSize: '15px', color: INK, margin: '0 0 6px' }}>
              Søknaden kunne ikke sendes
            </p>
            <p style={{ fontFamily: FONT, fontSize: '14.5px', lineHeight: 1.6, color: '#3a3f33', margin: 0 }}>
              {serverMessage || APPLICATION_RESPONSE_MESSAGES.serverError}
            </p>
          </div>
        )}
      </div>
    </form>
  )
}
