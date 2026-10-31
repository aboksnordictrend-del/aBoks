'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicOrganization } from '@/lib/miljo/service'
import { DELIVERY_LIMITS, DELIVERY_UNIT_LABELS, type DeliveryUnit } from '@/lib/miljo/constants'
import { formatDayKey } from '@/lib/miljo/period'
import { optimizeImage } from '@/lib/imageOptimize'
import { registerDeliveryAction } from './actions'
import { formatNo, newSubmissionKey, resetTurnstile } from './clientUtils'
import styles from './miljo.module.css'

type Done = { deliveryDate: string; quantity: number; unit: DeliveryUnit; operator: string; documented: boolean }

const osloToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(new Date())

/**
 * «Registrer faktisk levering» — for the organisation's responsible person. Everyone can see the
 * form; saving needs the organisation's PIN, typed again for every delivery (no session, no
 * «remember me»). The PIN field is cleared after every attempt. Photos of receipts are shrunk in
 * the browser first (Vercel's request limit), then re-encoded and stripped of metadata on the server.
 */
export default function DeliveryForm({ organization, turnstileSiteKey }: { organization: PublicOrganization; turnstileSiteKey: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const [unit, setUnit] = useState<DeliveryUnit>('kg')
  const [pin, setPin] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileNote, setFileNote] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Done | null>(null)
  const [submissionKey, setSubmissionKey] = useState('')
  const [today, setToday] = useState('')

  useEffect(() => {
    setSubmissionKey(newSubmissionKey())
    setToday(osloToday())
  }, [])
  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  if (!organization.deliveryEnabled) {
    return (
      <div className={styles.card}>
        <h2 className={styles.title}>Registrer faktisk levering</h2>
        <p className={styles.lead}>
          Registrering av leveranser er ikke aktivert for {organization.name}. Den ansvarlige får en PIN-kode fra ABOKS AS.
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className={`${styles.card} ${styles.success}`} role="status">
        <span className={styles.check} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 className={styles.title} ref={doneRef} tabIndex={-1}>
          Leveransen er registrert
        </h2>
        <p className={styles.lead}>
          {formatNo(done.quantity, done.unit === 'kg' ? 2 : 0)} {DELIVERY_UNIT_LABELS[done.unit]} levert til {done.operator} den{' '}
          {formatDayKey(done.deliveryDate)}.
          <br />
          Status: <strong>{done.documented ? 'Dokumentert med kvittering' : 'Oppgitt av ansvarlig'}</strong>
        </p>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            setDone(null)
            setFile(null)
            setFileNote('')
            setSubmissionKey(newSubmissionKey())
          }}
        >
          Registrer en ny levering
        </button>
      </div>
    )
  }

  const pickFile = async (f: File | null) => {
    setErrors((e) => ({ ...e, document: '' }))
    setFileNote('')
    if (!f) return setFile(null)
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    if (isPdf) {
      if (f.size > DELIVERY_LIMITS.documentMaxBytes) {
        setFile(null)
        setErrors((e) => ({ ...e, document: 'PDF-filen er for stor. Maks 3,5 MB.' }))
        return
      }
      setFile(f)
      return
    }
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)) {
      setFile(null)
      setErrors((e) => ({ ...e, document: 'Velg en PDF eller et bilde (JPG, PNG eller WebP).' }))
      return
    }
    try {
      setFileNote('Forbereder bildet …')
      const optimized = await optimizeImage(f)
      setFile(optimized.file)
      setFileNote('')
    } catch {
      setFile(null)
      setFileNote('')
      setErrors((e) => ({ ...e, document: 'Bildet kunne ikke leses. Prøv et annet bilde eller en PDF.' }))
    }
  }

  const submit = async () => {
    if (pending || !formRef.current) return
    setPending(true)
    setMessage('')
    setErrors({})
    const data = new FormData(formRef.current)
    data.set('submissionKey', submissionKey)
    data.set('unit', unit)
    data.set('pin', pin)
    data.delete('vedlegg')
    if (file) data.set('vedlegg', file, file.name)
    try {
      const result = await registerDeliveryAction(data)
      if (result.success === true) {
        setDone(result.delivery)
        formRef.current?.reset()
        return
      }
      setErrors(result.errors ?? {})
      setMessage(result.message)
    } catch {
      setMessage('Noe gikk galt. Sjekk nettforbindelsen og prøv igjen. Store vedlegg kan ta tid.')
    } finally {
      setPin('')
      setPending(false)
      resetTurnstile()
    }
  }

  const err = (k: string) => errors[k] || ''

  return (
    <form
      ref={formRef}
      className={styles.card}
      noValidate
      encType="multipart/form-data"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h2 className={styles.title}>Registrer faktisk levering</h2>
      <p className={styles.lead}>
        For den som er ansvarlig for å levere batteriene fra {organization.name} til et mottak. Krever PIN-kode fra ABOKS AS — for
        hver registrering.
      </p>

      <input type="hidden" name="code" value={organization.code} />
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Referansekode
          <input type="text" name="referansekode" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span className={styles.label}>Dato for levering</span>
          <input
            type="date"
            name="deliveryDate"
            required
            max={today || undefined}
            defaultValue=""
            className={`${styles.input} ${err('deliveryDate') ? styles.inputInvalid : ''}`}
            aria-invalid={err('deliveryDate') ? true : undefined}
            aria-describedby={err('deliveryDate') ? 'feil-dato' : undefined}
          />
          {err('deliveryDate') && (
            <span className={styles.fieldError} id="feil-dato">
              {err('deliveryDate')}
            </span>
          )}
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Levert mengde</span>
          <input
            type="text"
            name="quantity"
            required
            inputMode={unit === 'kg' ? 'decimal' : 'numeric'}
            autoComplete="off"
            placeholder={unit === 'kg' ? 'f.eks. 12,5' : 'f.eks. 340'}
            className={`${styles.input} ${err('quantity') ? styles.inputInvalid : ''}`}
            aria-invalid={err('quantity') ? true : undefined}
            aria-describedby={err('quantity') ? 'feil-mengde' : undefined}
          />
          {err('quantity') && (
            <span className={styles.fieldError} id="feil-mengde">
              {err('quantity')}
            </span>
          )}
        </label>
      </div>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
        <legend className={styles.label} style={{ marginBottom: 6 }}>
          Enhet
        </legend>
        <div className={styles.units}>
          {(['kg', 'stk'] as const).map((u) => (
            <label key={u} className={`${styles.unit} ${unit === u ? styles.unitChecked : ''}`}>
              <input type="radio" name="unitChoice" value={u} checked={unit === u} onChange={() => setUnit(u)} />
              {u === 'kg' ? 'kg (vekt)' : 'stk. (antall)'}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span className={styles.label}>Mottak / avfallsselskap</span>
        <input
          type="text"
          name="operator"
          required
          maxLength={DELIVERY_LIMITS.operatorMax}
          autoComplete="organization"
          className={`${styles.input} ${err('operator') ? styles.inputInvalid : ''}`}
          aria-invalid={err('operator') ? true : undefined}
          aria-describedby={err('operator') ? 'feil-mottak' : undefined}
        />
        {err('operator') && (
          <span className={styles.fieldError} id="feil-mottak">
            {err('operator')}
          </span>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          Kvittering / referanse <span className={styles.optional}>valgfritt</span>
        </span>
        <input type="text" name="reference" maxLength={DELIVERY_LIMITS.referenceMax} autoComplete="off" className={styles.input} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          Vedlegg (kvittering) <span className={styles.optional}>valgfritt — PDF eller bilde</span>
        </span>
        <input
          type="file"
          name="vedlegg"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className={styles.input}
          onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
          aria-describedby="vedlegg-hjelp"
        />
        <span className={styles.small} id="vedlegg-hjelp" style={{ marginTop: 0 }}>
          Med vedlegg registreres leveransen som «Dokumentert med kvittering». Uten vedlegg: «Oppgitt av ansvarlig».
        </span>
        {fileNote && <span className={styles.small}>{fileNote}</span>}
        {err('document') && <span className={styles.fieldError}>{err('document')}</span>}
      </label>

      <div className={styles.pinBox}>
        <label className={styles.field} style={{ marginTop: 0 }}>
          <span className={styles.label}>PIN-kode</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className={styles.input}
            aria-describedby="pin-hjelp"
          />
          <span className={styles.small} id="pin-hjelp" style={{ marginTop: 0 }}>
            PIN-koden lagres ikke på enheten og må skrives inn hver gang.
          </span>
        </label>
      </div>

      {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} style={{ marginTop: 16 }} />}

      <button type="submit" className={styles.submit} disabled={pending || pin.length < 6 || fileNote !== ''}>
        {pending ? 'Lagrer …' : 'Registrer levering'}
      </button>
      {message && (
        <p className={styles.formError} role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
