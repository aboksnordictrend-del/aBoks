'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicOrganization } from '@/lib/miljo/service'
import type { BatteryCategory } from '@/lib/miljo/constants'
import { quantityFieldName } from '@/lib/miljo/validation'
import { registerBatteriesAction } from './actions'
import { newSubmissionKey, resetTurnstile } from './clientUtils'
import SafetyInstructions from './SafetyInstructions'
import styles from './miljo.module.css'

type Counts = Partial<Record<BatteryCategory, string>>

const toNumber = (v: string | undefined): number => (v && /^\d+$/.test(v) ? Number(v) : 0)

/**
 * «Registrer batterier»: one row per category the organisation offers, each with − / + buttons
 * and an editable number. The total updates live (announced politely to screen readers). The
 * server validates everything again; this form only keeps people from obvious mistakes.
 */
export default function RegistrationForm({ organization, turnstileSiteKey }: { organization: PublicOrganization; turnstileSiteKey: string }) {
  const { categories, maxPerCategory, maxPerSubmission, confirmAbove } = organization
  const [counts, setCounts] = useState<Counts>({})
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicate, setDuplicate] = useState(false)
  const [done, setDone] = useState<{ total: number; lines: { category: BatteryCategory; quantity: number }[] } | null>(null)
  const [submissionKey, setSubmissionKey] = useState('')
  const doneRef = useRef<HTMLHeadingElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => setSubmissionKey(newSubmissionKey()), [])
  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  const total = categories.reduce((s, c) => s + toNumber(counts[c.value]), 0)
  const needsConfirm = total > confirmAbove
  const overTotal = total > maxPerSubmission

  const setCount = (category: BatteryCategory, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    const value = digits === '' ? '' : String(Math.min(Number(digits), maxPerCategory))
    setCounts((c) => ({ ...c, [category]: value }))
    setErrors({})
    setMessage('')
    setDuplicate(false)
  }
  const step = (category: BatteryCategory, delta: number) => {
    const next = Math.max(0, Math.min(maxPerCategory, toNumber(counts[category]) + delta))
    setCount(category, next === 0 ? '' : String(next))
  }

  const submit = async (confirmDuplicate: boolean) => {
    if (pending || total < 1 || overTotal || (needsConfirm && !confirmed) || !formRef.current) return
    setPending(true)
    setMessage('')
    const data = new FormData(formRef.current)
    data.set('submissionKey', submissionKey)
    if (confirmDuplicate) data.set('bekreftDuplikat', '1')
    try {
      const result = await registerBatteriesAction(data)
      if (result.success === true) {
        setDone({ total: result.total, lines: result.lines })
        return
      }
      setDuplicate(result.reason === 'possible-duplicate')
      setErrors(result.errors ?? {})
      setMessage(result.message)
    } catch {
      setMessage('Noe gikk galt. Sjekk nettforbindelsen og prøv igjen.')
    } finally {
      setPending(false)
      resetTurnstile()
    }
  }

  const startOver = () => {
    setDone(null)
    setCounts({})
    setConfirmed(false)
    setErrors({})
    setMessage('')
    setDuplicate(false)
    setSubmissionKey(newSubmissionKey())
  }

  if (done) {
    const label = (c: BatteryCategory) => categories.find((x) => x.value === c)?.label ?? c
    return (
      <div className={`${styles.card} ${styles.success}`} role="status">
        <span className={styles.check} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h2 className={styles.title} ref={doneRef} tabIndex={-1}>
          Takk! {done.total} {done.total === 1 ? 'batteri' : 'batterier'} er registrert
        </h2>
        <p className={styles.lead}>Registreringen er lagret for {organization.name}.</p>
        <ul className={styles.summaryList} aria-label="Registrert">
          {done.lines.map((l) => (
            <li key={l.category}>
              {label(l.category)}: {l.quantity}
            </li>
          ))}
        </ul>
        <button type="button" className={styles.secondary} onClick={startOver}>
          Registrer flere batterier
        </button>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.title}>Registrer brukte batterier</h2>
        <p className={styles.lead}>Ingen batterityper er satt opp for registrering ennå. Kontakt den som har ansvaret for batteriinnsamlingen.</p>
      </div>
    )
  }

  return (
    <>
      <form
        ref={formRef}
        className={styles.card}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit(false)
        }}
      >
        <h2 className={styles.title}>Registrer brukte batterier</h2>
        <p className={styles.lead}>Tell batteriene du legger i aBoks-beholderen, og registrer antallet. Det er anonymt.</p>

        <input type="hidden" name="code" value={organization.code} />
        <div className={styles.honeypot} aria-hidden="true">
          <label>
            Referansekode
            <input type="text" name="referansekode" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <fieldset className={styles.rows}>
          <legend className={styles.srOnly}>Antall batterier per type</legend>
          {categories.map((c) => {
            const value = counts[c.value] ?? ''
            const n = toNumber(value)
            const inputId = `antall-${c.value}`
            const err = errors[c.value]
            return (
              <div key={c.value} className={`${styles.row} ${err ? styles.rowInvalid : ''}`}>
                <div>
                  <label htmlFor={inputId} className={styles.rowLabel}>
                    {c.label}
                  </label>
                  {c.description && (
                    <p className={styles.rowHelp} id={`${inputId}-hjelp`}>
                      {c.description}
                    </p>
                  )}
                </div>
                <div className={styles.stepper}>
                  <button type="button" className={styles.stepButton} onClick={() => step(c.value, -1)} disabled={n === 0} aria-label={`Færre ${c.label}`}>
                    −
                  </button>
                  <input
                    id={inputId}
                    name={quantityFieldName(c.value)}
                    className={styles.qty}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder="0"
                    value={value}
                    onChange={(e) => setCount(c.value, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    aria-describedby={c.description ? `${inputId}-hjelp` : undefined}
                    aria-invalid={err ? true : undefined}
                  />
                  <button
                    type="button"
                    className={styles.stepButton}
                    onClick={() => step(c.value, 1)}
                    disabled={n >= maxPerCategory}
                    aria-label={`Flere ${c.label}`}
                  >
                    +
                  </button>
                </div>
                {err && <p className={styles.fieldError}>{err}</p>}
              </div>
            )
          })}
        </fieldset>

        <p className={styles.total} aria-live="polite" aria-atomic="true">
          <span>Totalt</span>
          <span>
            <span className={styles.totalValue}>{total}</span> {total === 1 ? 'batteri' : 'batterier'}
          </span>
        </p>
        {overTotal && (
          <p className={styles.formError} role="alert">
            Du kan registrere maks {maxPerSubmission} batterier om gangen.
          </p>
        )}

        {needsConfirm && !overTotal && (
          <label className={styles.confirm}>
            <input type="checkbox" name="bekreftAntall" value="1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>Jeg bekrefter at {total} batterier er riktig antall.</span>
          </label>
        )}

        {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} style={{ marginTop: 16 }} />}

        <button type="submit" className={styles.submit} disabled={pending || total < 1 || overTotal || (needsConfirm && !confirmed)}>
          {pending ? 'Registrerer …' : 'Registrer batterier'}
        </button>

        {message && !duplicate && (
          <p className={styles.formError} role="alert">
            {message}
          </p>
        )}
        {duplicate && (
          <div className={styles.notice} role="alert">
            <p style={{ margin: 0 }}>{message}</p>
            <div className={styles.noticeActions}>
              <button type="button" className={styles.secondary} onClick={() => void submit(true)} disabled={pending}>
                Ja, registrer likevel
              </button>
              <button type="button" className={styles.secondary} onClick={startOver}>
                Nei, start på nytt
              </button>
            </div>
          </div>
        )}
        <p className={styles.small}>Vi lagrer bare antall batterier og tidspunkt — ingen navn, e-post eller IP-adresse.</p>
      </form>

      <SafetyInstructions categories={categories} />
    </>
  )
}
