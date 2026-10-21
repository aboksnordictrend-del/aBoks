'use client'

import { useRef, useState } from 'react'
import Script from 'next/script'
import { PILOT_LIMITS, RATING_MAX, RATING_MIN, SUBMIT_LABEL, type PilotStatus } from '@/lib/pilot/constants'
import { answerFieldName } from '@/lib/pilot/answers'
import type { PublicQuestion, QuestionnaireSnapshot } from '@/lib/pilot/questionnaire'
import { isStoredResult } from '@/lib/pilot/submitResult'
import { submitPilotEvaluationAction } from './actions'
import styles from './pilot.module.css'

type Answers = Record<string, string | string[]>

const MSG_SUMMARY = 'Evalueringen ble ikke sendt. Se spørsmålene som er markert.'
const MSG_UNEXPECTED = 'Noe gikk galt. Prøv igjen om litt.'
const STATUS_LABEL: Record<PilotStatus, string> = {
  draft: 'Utkast',
  active: 'Aktiv',
  completed: 'Avsluttet',
  archived: 'Arkivert',
}

const isAnswered = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== ''

/** Client-side check for friendliness only; the server validates everything again. */
function clientErrors(questions: PublicQuestion[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const q of questions) {
    if (!q.required || isAnswered(answers[q.questionId])) continue
    errors[q.questionId] =
      q.type === 'rating'
        ? 'Velg en verdi fra 1 til 5.'
        : q.type === 'multipleChoice'
          ? 'Velg minst ett alternativ.'
          : 'Dette spørsmålet må besvares.'
  }
  return errors
}

export default function PilotForm({
  projectId,
  projectName,
  snapshot,
  preview,
  previewStatus,
  turnstileSiteKey,
}: {
  projectId: number
  projectName: string
  snapshot: QuestionnaireSnapshot
  preview: boolean
  previewStatus: PilotStatus | 'notFound' | null
  turnstileSiteKey: string
}) {
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  if (done !== null) {
    return (
      <div ref={topRef} className={`${styles.card} ${styles.center}`} role="status" aria-live="polite">
        <span className={styles.check} aria-hidden>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className={styles.title}>Takk!</h1>
        <p className={styles.body}>{done}</p>
      </div>
    )
  }

  const setValue = (id: string, value: string | string[]) => {
    setAnswers((a) => ({ ...a, [id]: value }))
    if (errors[id]) {
      const next = { ...errors }
      delete next[id]
      setErrors(next)
      // The summary only describes field errors; once the last one is fixed it is no longer true.
      if (Object.keys(next).length === 0 && formError === MSG_SUMMARY) setFormError('')
    }
  }

  const focusFirstError = (errs: Record<string, string>) => {
    const first = snapshot.questions.find((q) => errs[q.questionId])
    if (!first) return
    const el = document.getElementById(`question-${first.questionId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const focusable = el?.querySelector<HTMLElement>('input, textarea, select')
    focusable?.focus({ preventScroll: true })
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (preview || pending) return
    setFormError('')

    const local = clientErrors(snapshot.questions, answers)
    if (Object.keys(local).length > 0) {
      setErrors(local)
      setFormError(MSG_SUMMARY)
      focusFirstError(local)
      return
    }

    setPending(true)
    try {
      const result = await submitPilotEvaluationAction(new FormData(e.currentTarget))
      if (isStoredResult(result)) {
        setDone(result.closingMessage || 'Tusen takk for tilbakemeldingen! Din evaluering er registrert.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const fieldErrors = result.errors ?? {}
      setErrors(fieldErrors)
      setFormError(result.message || (Object.keys(fieldErrors).length > 0 ? MSG_SUMMARY : MSG_UNEXPECTED))
      focusFirstError(fieldErrors)
    } catch {
      setFormError(MSG_UNEXPECTED)
    } finally {
      setPending(false)
    }
  }

  return (
    <div ref={topRef}>
      {preview && (
        <div className={styles.preview} role="note">
          <strong>Forhåndsvisning.</strong> Svar kan ikke sendes inn herfra
          {previewStatus ? ` · Status: ${STATUS_LABEL[previewStatus as PilotStatus] ?? previewStatus}` : ''}. Deltakere ser
          skjemaet bare når prosjektet er aktivt.
        </div>
      )}

      <header className={styles.card}>
        <p className={styles.eyebrow}>aBoks pilotevaluering</p>
        <h1 className={styles.title}>{projectName}</h1>
        {snapshot.intro && <p className={styles.body}>{snapshot.intro}</p>}
      </header>

      <form ref={formRef} onSubmit={onSubmit} noValidate aria-describedby={formError ? 'pilot-form-error' : undefined}>
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="questionnaireVersion" value={snapshot.version} />
        <div className={styles.honeypot} aria-hidden="true">
          <label>
            Ikke fyll ut dette feltet
            <input type="text" name="referansekode" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <div className={styles.questions}>
          {snapshot.questions.map((q, index) => (
            <QuestionCard
              key={q.questionId}
              question={q}
              number={index + 1}
              value={answers[q.questionId]}
              error={errors[q.questionId]}
              onChange={(v) => setValue(q.questionId, v)}
            />
          ))}
        </div>

        {turnstileSiteKey && (
          <>
            <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} style={{ marginTop: '20px' }} />
          </>
        )}

        {formError && (
          <p id="pilot-form-error" className={styles.formError} role="alert">
            {formError}
          </p>
        )}

        <div className={styles.submitRow}>
          <button type="submit" className={styles.submit} disabled={pending || preview} aria-busy={pending}>
            {preview ? 'Forhåndsvisning – kan ikke sendes' : pending ? 'Sender …' : SUBMIT_LABEL}
          </button>
          <p className={styles.privacy}>Undersøkelsen er anonym. Vi lagrer ikke navn, e-post eller IP-adresse.</p>
        </div>
      </form>
    </div>
  )
}

function QuestionCard({
  question: q,
  number,
  value,
  error,
  onChange,
}: {
  question: PublicQuestion
  number: number
  value: string | string[] | undefined
  error?: string
  onChange: (value: string | string[]) => void
}) {
  const id = q.questionId
  const name = answerFieldName(id)
  const errorId = `error-${id}`
  const helpId = `help-${id}`
  const describedBy = [q.helpText ? helpId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  const legend = (
    <>
      <span className={styles.number}>{number}.</span>
      {q.label}
      {q.required ? (
        <span className={styles.required} aria-hidden>
          *
        </span>
      ) : (
        <span className={styles.optional}>(valgfritt)</span>
      )}
      {q.required && <span className="sr-only"> (obligatorisk)</span>}
    </>
  )
  const text = typeof value === 'string' ? value : ''
  const list = Array.isArray(value) ? value : []
  const cardClass = `${styles.question} ${error ? styles.questionInvalid : ''}`
  const help = q.helpText ? (
    <p id={helpId} className={styles.help}>
      {q.helpText}
    </p>
  ) : null
  const errorEl = error ? (
    <p id={errorId} className={styles.error}>
      {error}
    </p>
  ) : null

  if (q.type === 'shortText' || q.type === 'longText' || q.type === 'dropdown') {
    const inputId = `input-${id}`
    const max = q.type === 'shortText' ? PILOT_LIMITS.shortTextMax : PILOT_LIMITS.longTextMax
    const common = {
      id: inputId,
      name,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy,
      'aria-required': q.required || undefined,
    } as const
    return (
      <div id={`question-${id}`} className={cardClass}>
        <label htmlFor={inputId} className={styles.legend}>
          {legend}
        </label>
        {help}
        <div className={styles.control}>
          {q.type === 'shortText' && (
            <input
              {...common}
              type="text"
              className={`${styles.input} ${error ? styles.inputInvalid : ''}`}
              placeholder={q.placeholder || undefined}
              maxLength={max}
              value={text}
              autoComplete="off"
              onChange={(e) => onChange(e.target.value)}
            />
          )}
          {q.type === 'longText' && (
            <>
              <textarea
                {...common}
                className={`${styles.textarea} ${error ? styles.inputInvalid : ''}`}
                placeholder={q.placeholder || undefined}
                maxLength={max}
                rows={4}
                value={text}
                onChange={(e) => onChange(e.target.value)}
              />
              {text.length > max * 0.8 && (
                <p className={styles.counter}>
                  {text.length} / {max}
                </p>
              )}
            </>
          )}
          {q.type === 'dropdown' && (
            <select
              {...common}
              className={`${styles.select} ${error ? styles.inputInvalid : ''}`}
              value={text}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">{q.placeholder || 'Velg …'}</option>
              {q.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {errorEl}
      </div>
    )
  }

  // Radio / checkbox groups: a real fieldset + legend, so screen readers announce the question.
  return (
    <fieldset
      id={`question-${id}`}
      className={cardClass}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      aria-required={q.required || undefined}
    >
      <legend className={styles.legend}>{legend}</legend>
      {help}
      <div className={styles.control}>
        {q.type === 'rating' && (
          <>
            <div className={styles.rating}>
              {Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => String(RATING_MIN + i)).map((v) => {
                const checked = text === v
                const aria =
                  v === String(RATING_MIN) && q.scaleMinLabel
                    ? `${v} – ${q.scaleMinLabel}`
                    : v === String(RATING_MAX) && q.scaleMaxLabel
                      ? `${v} – ${q.scaleMaxLabel}`
                      : v
                return (
                  <label key={v} className={`${styles.ratingButton} ${checked ? styles.ratingChecked : ''}`}>
                    <input
                      type="radio"
                      name={name}
                      value={v}
                      checked={checked}
                      aria-label={aria}
                      onChange={() => onChange(v)}
                    />
                    <span aria-hidden>{v}</span>
                  </label>
                )
              })}
            </div>
            {(q.scaleMinLabel || q.scaleMaxLabel) && (
              <div className={styles.scaleLabels} aria-hidden>
                <span>1 – {q.scaleMinLabel}</span>
                <span>5 – {q.scaleMaxLabel}</span>
              </div>
            )}
          </>
        )}

        {(q.type === 'singleChoice' || q.type === 'yesNo') && (
          <div className={`${q.type === 'yesNo' ? styles.yesNo : styles.choices}`}>
            {q.options.map((o) => {
              const checked = text === o.value
              return (
                <label key={o.value} className={`${styles.choice} ${checked ? styles.choiceChecked : ''}`}>
                  <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} />
                  <span>{o.label}</span>
                </label>
              )
            })}
          </div>
        )}

        {q.type === 'multipleChoice' && (
          <div className={styles.choices}>
            {q.options.map((o) => {
              const checked = list.includes(o.value)
              return (
                <label key={o.value} className={`${styles.choice} ${checked ? styles.choiceChecked : ''}`}>
                  <input
                    type="checkbox"
                    name={name}
                    value={o.value}
                    checked={checked}
                    onChange={(e) =>
                      onChange(e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value))
                    }
                  />
                  <span>{o.label}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>
      {errorEl}
    </fieldset>
  )
}
