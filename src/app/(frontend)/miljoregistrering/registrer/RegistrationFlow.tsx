'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { INK, MUTED, SANS, secondaryButton } from '../../bedrifter/theme'
import { Field, Notice, Steps, SubmitButton, postJson, type ApiResult } from './formParts'

/**
 * Miljøregistrering Bedrift — self-registration, three steps:
 *
 *   1. Kjøp           order number + the e-mail used for the order       → /api/miljo/registrering/kjop
 *   2. Organisasjon   organisation number (official name from Enhetsregisteret), contact person,
 *                     login e-mail and password                          → …/organisasjon, …/registrering
 *   3. Bekreft e-post «check your inbox», with «send again»               → …/send-pa-nytt
 *
 * The purchase details from step 1 stay in this page's memory only and are re-checked by the
 * server on every later step. The password is sent once and then cleared from the page.
 */

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string | HTMLElement) => void }
  }
}

type Errors = Record<string, string | null>

function turnstileToken(form: HTMLFormElement | null): string | undefined {
  const el = form?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')
  return el?.value || undefined
}

export default function RegistrationFlow({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<ApiResult | null>(null)
  const [errors, setErrors] = useState<Errors>({})

  const [orderNumber, setOrderNumber] = useState('')
  const [purchaseEmail, setPurchaseEmail] = useState('')
  const [organizationNumber, setOrganizationNumber] = useState('')
  const [officialName, setOfficialName] = useState<string | null>(null)
  const [contactName, setContactName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')

  const [resendKey, setResendKey] = useState<string | null>(null)
  const [emailHint, setEmailHint] = useState('')
  const [resendAvailableAt, setResendAvailableAt] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const step1Form = useRef<HTMLFormElement>(null)
  const step2Form = useRef<HTMLFormElement>(null)
  const heading = useRef<HTMLDivElement>(null)

  useEffect(() => {
    heading.current?.focus()
  }, [step])
  useEffect(() => {
    if (step !== 3) return
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [step])

  const showResult = (result: ApiResult) => {
    setNotice(result.ok ? null : result)
    setErrors(result.ok || !result.field ? {} : { [result.field]: result.message ?? null })
  }

  async function submitPurchase(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const result = await postJson('/api/miljo/registrering/kjop', { orderNumber, email: purchaseEmail, turnstileToken: turnstileToken(step1Form.current) })
    setBusy(false)
    window.turnstile?.reset()
    showResult(result)
    if (result.ok) {
      setOrderNumber(String(result.orderNumber ?? orderNumber))
      setLoginEmail((v) => v || purchaseEmail.trim())
      setStep(2)
    }
  }

  async function fetchOrganization() {
    if (busy) return
    setBusy(true)
    const result = await postJson('/api/miljo/registrering/organisasjon', { orderNumber, email: purchaseEmail, organizationNumber })
    setBusy(false)
    if (result.ok) {
      setOfficialName(String(result.officialName))
      setOrganizationNumber(String(result.organizationNumber))
      setNotice(null)
      setErrors({})
    } else {
      setOfficialName(null)
      showResult(result.field ? result : { ...result, field: 'organizationNumber' })
    }
  }

  async function submitRegistration(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!officialName) {
      setErrors({ organizationNumber: 'Hent organisasjonen fra Enhetsregisteret først.' })
      return
    }
    setBusy(true)
    const result = await postJson('/api/miljo/registrering', {
      orderNumber,
      email: purchaseEmail,
      organizationNumber,
      contactName,
      loginEmail,
      password,
      passwordConfirmation,
      turnstileToken: turnstileToken(step2Form.current),
    })
    setBusy(false)
    window.turnstile?.reset()
    showResult(result)
    if (result.ok) {
      setPassword('')
      setPasswordConfirmation('')
      setResendKey(String(result.resendKey))
      setEmailHint(String(result.emailHint ?? ''))
      setResendAvailableAt(Date.now() + 60_000)
      if (result.emailSent === false) setNotice({ ok: false, message: 'Registreringen er lagret, men e-posten ble ikke sendt. Prøv «Send e-posten på nytt» om litt.' })
      setStep(3)
    }
  }

  async function resend() {
    if (busy || !resendKey) return
    setBusy(true)
    const result = await postJson('/api/miljo/registrering/send-pa-nytt', { resendKey })
    setBusy(false)
    setResendAvailableAt(Date.now() + 60_000)
    setNotice(result.ok ? { ok: true, message: `Ny e-post er sendt til ${String(result.emailHint ?? emailHint)}.` } : result)
  }

  const waitSeconds = Math.max(0, Math.ceil((resendAvailableAt - nowMs) / 1000))

  return (
    <div>
      <Steps current={step} />
      <div ref={heading} tabIndex={-1} style={{ outline: 'none' }} />
      {notice && <Notice tone={notice.ok ? 'success' : 'error'}>{notice.message}</Notice>}

      {step === 1 && (
        <form ref={step1Form} onSubmit={submitPurchase} noValidate>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: INK, margin: '0 0 6px' }}>Bekreft kjøpet</h2>
          <p style={{ fontFamily: SANS, fontSize: 15, color: MUTED, margin: '0 0 20px', lineHeight: 1.6 }}>
            Registreringen krever et kjøp av en aBoks-modell. Bruk ordrenummeret (f.eks. AB-012345) og e-postadressen fra ordrebekreftelsen.
          </p>
          <Field id="orderNumber" name="orderNumber" label="Ordrenummer" value={orderNumber} onChange={setOrderNumber} autoComplete="off" maxLength={20} error={errors.orderNumber} />
          <Field id="purchaseEmail" name="purchaseEmail" type="email" label="E-post brukt ved bestilling" value={purchaseEmail} onChange={setPurchaseEmail} autoComplete="email" maxLength={254} error={errors.email} />
          {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} style={{ marginBottom: 18 }} />}
          <SubmitButton busy={busy}>Fortsett</SubmitButton>
        </form>
      )}

      {step === 2 && (
        <form ref={step2Form} onSubmit={submitRegistration} noValidate>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: INK, margin: '0 0 6px' }}>Organisasjon og innlogging</h2>
          <p style={{ fontFamily: SANS, fontSize: 15, color: MUTED, margin: '0 0 20px', lineHeight: 1.6 }}>
            Kjøpet er bekreftet ({orderNumber}). Én organisasjon får én konto, med én ansvarlig person.
          </p>
          <Field
            id="organizationNumber"
            name="organizationNumber"
            label="Organisasjonsnummer"
            inputMode="numeric"
            value={organizationNumber}
            onChange={(v) => {
              setOrganizationNumber(v)
              setOfficialName(null)
            }}
            autoComplete="off"
            maxLength={20}
            hint="9 sifre. Navnet hentes fra Enhetsregisteret."
            error={errors.organizationNumber}
          />
          <div style={{ margin: '-6px 0 18px' }}>
            <button type="button" onClick={fetchOrganization} disabled={busy} className="w-full px-6 sm:w-auto" style={{ ...secondaryButton, minHeight: 44, paddingTop: 10, paddingBottom: 10, cursor: busy ? 'progress' : 'pointer' }}>
              Hent fra Enhetsregisteret
            </button>
          </div>
          {officialName && (
            <Field id="officialName" name="officialName" label="Bedriftsnavn (fra Enhetsregisteret)" value={officialName} onChange={() => undefined} readOnly />
          )}
          <Field id="contactName" name="contactName" label="Kontaktperson" value={contactName} onChange={setContactName} autoComplete="name" maxLength={120} error={errors.contactName} />
          <Field id="loginEmail" name="loginEmail" type="email" label="E-post for innlogging" value={loginEmail} onChange={setLoginEmail} autoComplete="email" maxLength={254} hint="Kan være en annen adresse enn den brukt ved bestillingen. Vi sender en bekreftelseslenke hit." error={errors.loginEmail} />
          <Field id="password" name="password" type="password" label="Passord" value={password} onChange={setPassword} autoComplete="new-password" maxLength={128} hint="Minst 10 tegn, med minst én bokstav og ett tall." error={errors.password} />
          <Field id="passwordConfirmation" name="passwordConfirmation" type="password" label="Bekreft passord" value={passwordConfirmation} onChange={setPasswordConfirmation} autoComplete="new-password" maxLength={128} />
          {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} style={{ marginBottom: 18 }} />}
          <SubmitButton busy={busy}>Registrer organisasjonen</SubmitButton>
        </form>
      )}

      {step === 3 && (
        <div>
          <h2 style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, color: INK, margin: '0 0 6px' }}>Sjekk e-posten</h2>
          <p style={{ fontFamily: SANS, fontSize: 15, color: MUTED, margin: '0 0 20px', lineHeight: 1.6 }}>
            Vi har sendt en bekreftelseslenke til <strong style={{ color: INK }}>{emailHint}</strong>. Kontoen aktiveres når du åpner lenken og bekrefter. Lenken gjelder i 24 timer.
          </p>
          <SubmitButton type="button" busy={busy} disabled={waitSeconds > 0} onClick={resend}>
            {waitSeconds > 0 ? `Send e-posten på nytt (om ${waitSeconds} s)` : 'Send e-posten på nytt'}
          </SubmitButton>
          <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: '16px 0 0', lineHeight: 1.6 }}>
            Finner du ikke e-posten? Sjekk søppelpost. Den nyeste lenken er den som gjelder.
          </p>
        </div>
      )}

      {turnstileSiteKey && step !== 3 && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />}
    </div>
  )
}
