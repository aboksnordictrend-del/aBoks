'use client'

import { BORDER_WARM, INK, MUTED, OLIVE, SANS, SERIF, primaryButton } from '../../bedrifter/theme'

// Shared pieces of the Miljøregistrering self-registration pages: field, button, notices, steps
// and the JSON call. Accessible by construction — every input has a <label>, errors are linked
// with aria-describedby and announced, the busy button is disabled.

export const ERROR_RED = '#a3341f'

export interface ApiResult {
  ok: boolean
  message?: string
  field?: string
  code?: string
  [key: string]: unknown
}

export async function postJson(url: string, body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => null)) as ApiResult | null
    return data ?? { ok: false, message: 'Noe gikk galt. Prøv igjen.' }
  } catch {
    return { ok: false, message: 'Får ikke kontakt med aBoks. Sjekk nettforbindelsen og prøv igjen.' }
  }
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  border: `1.5px solid ${BORDER_WARM}`,
  borderRadius: 10,
  background: '#fff',
  color: INK,
  fontFamily: SANS,
  fontSize: 16,
}

export function Field(props: {
  id: string
  label: string
  name: string
  type?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  value: string
  onChange: (v: string) => void
  error?: string | null
  hint?: string
  readOnly?: boolean
  maxLength?: number
}) {
  const { id, label, error, hint, onChange, ...rest } = props
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
      <label htmlFor={id} style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: INK }}>
        {label}
      </label>
      <input
        id={id}
        {...rest}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required
        style={{ ...inputStyle, ...(error ? { borderColor: ERROR_RED } : {}), ...(props.readOnly ? { background: '#f6f2ea' } : {}) }}
      />
      {hint && (
        <span id={`${id}-hint`} style={{ fontFamily: SANS, fontSize: 13, color: MUTED }}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} role="alert" style={{ fontFamily: SANS, fontSize: 13, color: ERROR_RED }}>
          {error}
        </span>
      )}
    </div>
  )
}

export function SubmitButton({
  busy,
  disabled = false,
  children,
  onClick,
  type = 'submit',
}: {
  busy: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
  type?: 'submit' | 'button'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy}
      className="w-full px-8 sm:w-auto"
      style={{ ...primaryButton, border: 0, cursor: busy ? 'progress' : disabled ? 'not-allowed' : 'pointer', opacity: busy || disabled ? 0.7 : 1 }}
    >
      {busy ? 'Vent litt …' : children}
    </button>
  )
}

export function Notice({ tone, children }: { tone: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const colors = { error: ['#fbeae5', ERROR_RED], info: ['#f2e7d7', INK], success: ['#e6ecdf', OLIVE] }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} style={{ background: colors[0], color: colors[1], borderRadius: 12, padding: '14px 16px', fontFamily: SANS, fontSize: 15, lineHeight: 1.55, marginBottom: 20 }}>
      {children}
    </div>
  )
}

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Kjøp', 'Organisasjon', 'Bekreft e-post']
  return (
    <ol aria-label="Steg i registreringen" style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: '0 0 28px', flexWrap: 'wrap' }}>
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3
        const active = n === current
        const done = n < current
        return (
          <li key={label} aria-current={active ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: SANS, fontSize: 14, color: active || done ? INK : MUTED, fontWeight: active ? 700 : 500 }}>
            <span aria-hidden="true" style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: active ? OLIVE : done ? '#cfd8c4' : '#ece4d6', color: active ? '#faf6ee' : INK, fontSize: 13 }}>
              {done ? '✓' : n}
            </span>
            <span>
              <span className="sr-only">Steg {n}: </span>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function PageTitle({ title, intro }: { title: string; intro: string }) {
  return (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(32px,5vw,44px)', lineHeight: 1.1, color: INK, margin: '0 0 12px' }}>{title}</h1>
      <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.65, color: MUTED, margin: 0, maxWidth: '60ch' }}>{intro}</p>
    </header>
  )
}
