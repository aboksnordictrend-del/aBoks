'use client'

import { useEffect, useRef, useState } from 'react'
import type { BatteryCategory } from '@/lib/miljo/constants'
import type { RegistrationLine } from '@/lib/miljo/validation'
import { anchorClick } from '@/lib/anchorScroll'
import SafetyInstructions from '../../miljo/[code]/SafetyInstructions'
import real from '../../miljo/[code]/miljo.module.css'
import { DEMO_CATEGORIES, DEMO_ORG_NAME, DEMO_POLICY, checkDemoRegistration } from './demoModel'
import { useDemo } from './DemoProvider'
import DemoBadge from './DemoBadge'
import styles from './demo.module.css'

type Counts = Partial<Record<BatteryCategory, string>>

const toNumber = (v: string | undefined): number => (v && /^\d+$/.test(v) ? Number(v) : 0)

/**
 * «Registrer batterier» as an employee sees it after scanning the QR code — the real form's
 * markup, classes and limits (see ../../miljo/[code]/RegistrationForm.tsx). Instead of the
 * server action, the production validator runs here and the result goes into the demo state.
 * Turnstile, the honeypot and the duplicate check guard the real endpoint and have no job here.
 */
export default function RegistrationDemo() {
  const { register } = useDemo()
  const { maxPerCategory, maxPerSubmission, confirmAbove } = DEMO_POLICY
  const [counts, setCounts] = useState<Counts>({})
  const [confirmed, setConfirmed] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<{ total: number; lines: RegistrationLine[] } | null>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (done) doneRef.current?.focus()
  }, [done])

  const total = DEMO_CATEGORIES.reduce((s, c) => s + toNumber(counts[c.value]), 0)
  const needsConfirm = total > confirmAbove
  const overTotal = total > maxPerSubmission

  const setCount = (category: BatteryCategory, raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    const value = digits === '' ? '' : String(Math.min(Number(digits), maxPerCategory))
    setCounts((c) => ({ ...c, [category]: value }))
    setErrors({})
    setMessage('')
  }
  const step = (category: BatteryCategory, delta: number) => {
    const next = Math.max(0, Math.min(maxPerCategory, toNumber(counts[category]) + delta))
    setCount(category, next === 0 ? '' : String(next))
  }

  const submit = () => {
    if (total < 1) {
      setMessage('Legg inn minst ett batteri før du registrerer.')
      return
    }
    const result = checkDemoRegistration(counts, confirmed)
    if (!result.ok) {
      setErrors(result.errors)
      setMessage(result.message)
      return
    }
    register(result.lines, result.total)
    setDone({ total: result.total, lines: result.lines })
  }

  const startOver = () => {
    setDone(null)
    setCounts({})
    setConfirmed(false)
    setErrors({})
    setMessage('')
  }

  const top = (
    <div className={styles.cardTop}>
      <DemoBadge />
      <span className={styles.roleTag}>Ansatt · uten innlogging</span>
    </div>
  )

  if (done) {
    const label = (c: BatteryCategory) => DEMO_CATEGORIES.find((x) => x.value === c)?.label ?? c
    return (
      <div className={`${real.card} ${real.success}`} role="status">
        {top}
        <span className={real.check} aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h3 className={real.title} ref={doneRef} tabIndex={-1}>
          Takk! {done.total} {done.total === 1 ? 'batteri' : 'batterier'} er registrert
        </h3>
        <p className={real.lead}>
          I demoen er registreringen lagt til i eksempelstatistikken for {DEMO_ORG_NAME}. Ingenting er lagret i det virkelige
          systemet.
        </p>
        <ul className={real.summaryList} aria-label="Registrert">
          {done.lines.map((l) => (
            <li key={l.category}>
              {label(l.category)}: {l.quantity}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className={real.secondary} onClick={startOver}>
            Registrer flere batterier
          </button>
          <a href="#demo-statistikk" className={styles.statsLink} onClick={anchorClick('demo-statistikk')}>
            Se oppdatert statistikk
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <form
        className={real.card}
        noValidate
        aria-labelledby="demo-registrer-tittel"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {top}
        <h3 className={real.title} id="demo-registrer-tittel">
          Registrer brukte batterier
        </h3>
        <p className={real.lead}>Tell batteriene du legger i aBoks-beholderen, og registrer antallet. Det er anonymt.</p>

        <fieldset className={real.rows}>
          <legend className={real.srOnly}>Antall batterier per type</legend>
          {DEMO_CATEGORIES.map((c) => {
            const value = counts[c.value] ?? ''
            const n = toNumber(value)
            const inputId = `demo-antall-${c.value}`
            const err = errors[c.value]
            return (
              <div key={c.value} className={`${real.row} ${err ? real.rowInvalid : ''}`}>
                <div>
                  <label htmlFor={inputId} className={real.rowLabel}>
                    {c.label}
                  </label>
                </div>
                <div className={real.stepper}>
                  <button type="button" className={real.stepButton} onClick={() => step(c.value, -1)} disabled={n === 0} aria-label={`Færre ${c.label}`}>
                    −
                  </button>
                  <input
                    id={inputId}
                    className={real.qty}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    placeholder="0"
                    value={value}
                    onChange={(e) => setCount(c.value, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    aria-invalid={err ? true : undefined}
                  />
                  <button type="button" className={real.stepButton} onClick={() => step(c.value, 1)} disabled={n >= maxPerCategory} aria-label={`Flere ${c.label}`}>
                    +
                  </button>
                </div>
                {err && <p className={real.fieldError}>{err}</p>}
              </div>
            )
          })}
        </fieldset>

        <p className={real.total} aria-live="polite" aria-atomic="true">
          <span>Totalt</span>
          <span>
            <span className={real.totalValue}>{total}</span> {total === 1 ? 'batteri' : 'batterier'}
          </span>
        </p>
        {overTotal && (
          <p className={real.formError} role="alert">
            Du kan registrere maks {maxPerSubmission} batterier om gangen.
          </p>
        )}

        {needsConfirm && !overTotal && (
          <label className={real.confirm}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>Jeg bekrefter at {total} batterier er riktig antall.</span>
          </label>
        )}

        <button type="submit" className={real.submit} disabled={total < 1 || overTotal || (needsConfirm && !confirmed)}>
          Registrer batterier
        </button>

        {message && (
          <p className={real.formError} role="alert">
            {message}
          </p>
        )}
        <p className={real.small}>
          I det virkelige systemet lagres bare antall batterier og tidspunkt — ingen navn, e-post eller IP-adresse. I demoen
          lagres ingenting.
        </p>
      </form>

      <SafetyInstructions categories={DEMO_CATEGORIES} />
    </>
  )
}
