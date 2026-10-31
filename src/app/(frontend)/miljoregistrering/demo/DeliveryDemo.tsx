'use client'

import { useEffect, useRef, useState } from 'react'
import { DELIVERY_LIMITS, DELIVERY_UNIT_LABELS, type DeliveryUnit } from '@/lib/miljo/constants'
import { formatDayKey } from '@/lib/miljo/period'
import { osloDateKey } from '@/lib/analytics/period'
import { anchorClick } from '@/lib/anchorScroll'
import { formatNo } from '../../miljo/[code]/clientUtils'
import real from '../../miljo/[code]/miljo.module.css'
import { DEMO_ORG_NAME, DEMO_PIN, checkDemoDelivery } from './demoModel'
import { useDemo } from './DemoProvider'
import DemoBadge from './DemoBadge'
import styles from './demo.module.css'

type Done = { deliveryDate: string; quantity: number; unit: DeliveryUnit; operator: string; documented: boolean }

/**
 * «Registrer faktisk levering» for the responsible employee — the real form's fields, labels,
 * units and validation (see ../../miljo/[code]/DeliveryForm.tsx), with the PIN typed again for
 * every delivery and cleared after each attempt, as in production. The PIN is the fictional
 * {@link DEMO_PIN}, compared in the browser; a chosen attachment is never read or sent — it only
 * decides the documentation status, as it does in the real system.
 */
export default function DeliveryDemo() {
  const { deliver } = useDemo()
  const formRef = useRef<HTMLFormElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const [unit, setUnit] = useState<DeliveryUnit>('kg')
  const [pin, setPin] = useState('')
  const [fileName, setFileName] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Done | null>(null)
  const [today, setToday] = useState('')

  useEffect(() => setToday(osloDateKey(new Date())), [])
  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  const top = (
    <div className={styles.cardTop}>
      <DemoBadge />
      <span className={styles.roleTag}>Ansvarlig medarbeider · PIN</span>
    </div>
  )

  if (done) {
    return (
      <div className={`${real.card} ${real.success}`} role="status">
        {top}
        <span className={real.check} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3 className={real.title} ref={doneRef} tabIndex={-1}>
          Leveransen er registrert
        </h3>
        <p className={real.lead}>
          {formatNo(done.quantity, done.unit === 'kg' ? 2 : 0)} {DELIVERY_UNIT_LABELS[done.unit]} levert til {done.operator} den{' '}
          {formatDayKey(done.deliveryDate)}.
          <br />
          Status: <strong>{done.documented ? 'Dokumentert med kvittering' : 'Oppgitt av ansvarlig'}</strong>
        </p>
        <p className={real.small} style={{ marginTop: 0, marginBottom: 16 }}>
          Dette er en demonstrasjon. Ingen faktisk levering registreres.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
          <button
            type="button"
            className={real.secondary}
            onClick={() => {
              setDone(null)
              setFileName('')
              setUnit('kg')
            }}
          >
            Registrer en ny levering
          </button>
          <a href="#demo-statistikk" className={styles.statsLink} onClick={anchorClick('demo-statistikk')}>
            Se oppdatert statistikk
          </a>
        </div>
      </div>
    )
  }

  const submit = () => {
    if (!formRef.current) return
    const data = new FormData(formRef.current)
    const text = (k: string) => String(data.get(k) ?? '')
    const now = new Date()
    const result = checkDemoDelivery(
      {
        deliveryDate: text('deliveryDate'),
        quantity: text('quantity'),
        unit,
        operator: text('operator'),
        reference: text('reference'),
        pin,
        hasAttachment: fileName !== '',
      },
      now,
    )
    setPin('')
    if (!result.ok) {
      setErrors(result.errors)
      setMessage(result.message)
      return
    }
    const d = result.delivery
    deliver(d, `Levering på ${formatNo(d.quantity, d.unit === 'kg' ? 2 : 0)} ${DELIVERY_UNIT_LABELS[d.unit]} registrert i demoen`)
    setErrors({})
    setMessage('')
    setDone({ deliveryDate: d.deliveryDate, quantity: d.quantity, unit: d.unit, operator: d.operator, documented: d.documentationStatus === 'documented' })
    formRef.current.reset()
  }

  const err = (k: string) => errors[k] || ''

  return (
    <form
      ref={formRef}
      className={real.card}
      noValidate
      aria-labelledby="demo-levering-tittel"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {top}
      <h3 className={real.title} id="demo-levering-tittel">
        Registrer faktisk levering
      </h3>
      <p className={real.lead}>
        For den som er ansvarlig for å levere batteriene fra {DEMO_ORG_NAME} til et mottak. Krever PIN-kode fra ABOKS AS — for
        hver registrering.
      </p>

      <div className={real.fieldRow}>
        <label className={real.field}>
          <span className={real.label}>Dato for levering</span>
          <input
            type="date"
            name="deliveryDate"
            required
            max={today || undefined}
            defaultValue=""
            className={`${real.input} ${err('deliveryDate') ? real.inputInvalid : ''}`}
            aria-invalid={err('deliveryDate') ? true : undefined}
            aria-describedby={err('deliveryDate') ? 'demo-feil-dato' : undefined}
          />
          {err('deliveryDate') && (
            <span className={real.fieldError} id="demo-feil-dato">
              {err('deliveryDate')}
            </span>
          )}
        </label>
        <label className={real.field}>
          <span className={real.label}>Levert mengde</span>
          <input
            type="text"
            name="quantity"
            required
            inputMode={unit === 'kg' ? 'decimal' : 'numeric'}
            autoComplete="off"
            placeholder={unit === 'kg' ? 'f.eks. 12,5' : 'f.eks. 340'}
            className={`${real.input} ${err('quantity') ? real.inputInvalid : ''}`}
            aria-invalid={err('quantity') ? true : undefined}
            aria-describedby={err('quantity') ? 'demo-feil-mengde' : undefined}
          />
          {err('quantity') && (
            <span className={real.fieldError} id="demo-feil-mengde">
              {err('quantity')}
            </span>
          )}
        </label>
      </div>

      <fieldset className={real.field} style={{ border: 0, padding: 0, margin: '14px 0 0' }}>
        <legend className={real.label} style={{ marginBottom: 6 }}>
          Enhet
        </legend>
        <div className={real.units}>
          {(['kg', 'stk'] as const).map((u) => (
            <label key={u} className={`${real.unit} ${unit === u ? real.unitChecked : ''}`}>
              <input type="radio" name="unitChoice" value={u} checked={unit === u} onChange={() => setUnit(u)} />
              {u === 'kg' ? 'kg (vekt)' : 'stk. (antall)'}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={real.field}>
        <span className={real.label}>Mottak / avfallsselskap</span>
        <input
          type="text"
          name="operator"
          required
          maxLength={DELIVERY_LIMITS.operatorMax}
          autoComplete="off"
          placeholder="f.eks. Demo Miljømottak"
          className={`${real.input} ${err('operator') ? real.inputInvalid : ''}`}
          aria-invalid={err('operator') ? true : undefined}
          aria-describedby={err('operator') ? 'demo-feil-mottak' : undefined}
        />
        {err('operator') && (
          <span className={real.fieldError} id="demo-feil-mottak">
            {err('operator')}
          </span>
        )}
      </label>

      <label className={real.field}>
        <span className={real.label}>
          Kvittering / referanse <span className={real.optional}>valgfritt</span>
        </span>
        <input type="text" name="reference" maxLength={DELIVERY_LIMITS.referenceMax} autoComplete="off" className={real.input} />
      </label>

      <label className={real.field}>
        <span className={real.label}>
          Vedlegg (kvittering) <span className={real.optional}>valgfritt — PDF eller bilde</span>
        </span>
        {/* No `name`: the file is not part of any form data and is never read. */}
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className={real.input}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
          aria-describedby="demo-vedlegg-hjelp"
        />
        <span className={real.small} id="demo-vedlegg-hjelp" style={{ marginTop: 0 }}>
          Med vedlegg registreres leveransen som «Dokumentert med kvittering». Uten vedlegg: «Oppgitt av ansvarlig». I demoen
          forlater filen aldri enheten din.
        </span>
      </label>

      <div className={real.pinBox}>
        <p className={styles.pinHint}>
          Demo-PIN: <strong>{DEMO_PIN}</strong>
        </p>
        <label className={real.field} style={{ marginTop: 0 }}>
          <span className={real.label}>PIN-kode</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className={real.input}
            aria-describedby="demo-pin-hjelp"
          />
          <span className={real.small} id="demo-pin-hjelp" style={{ marginTop: 0 }}>
            PIN-koden lagres ikke på enheten og må skrives inn hver gang.
          </span>
        </label>
      </div>

      <button type="submit" className={real.submit} disabled={pin.length < 6}>
        Registrer levering
      </button>
      {message && (
        <p className={real.formError} role="alert">
          {message}
        </p>
      )}
      <p className={real.small}>Dette er en demonstrasjon. Ingen faktisk levering registreres.</p>
    </form>
  )
}
