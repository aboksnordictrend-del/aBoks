'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { INK, MUTED, SANS, secondaryButton } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { Field, Notice, SubmitButton, postJson, type ApiResult } from '../registrer/formParts'
import { PasswordFields } from './PasswordFields'

// The interactive parts of Min side. Each call goes to /api/miljo/konto/* with the session cookie;
// a 401 (session expired or access withdrawn) sends the browser back to sign-in.

const smallButton: React.CSSProperties = { ...secondaryButton, minHeight: 44, paddingTop: 10, paddingBottom: 10, fontSize: 14, cursor: 'pointer' }

function useSignedOutRedirect() {
  const router = useRouter()
  return (res: ApiResult) => {
    if (res.code === 'signed_out') {
      router.replace(MILJO_PATHS.login)
      router.refresh()
      return true
    }
    return false
  }
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function QrActions({ publicUrl, publicPath }: { publicUrl: string; publicPath: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a href="/api/miljo/konto/qr?format=png" download className="px-6" style={smallButton}>
          Last ned PNG
        </a>
        <a href="/api/miljo/konto/qr?format=pdf" download className="px-6" style={smallButton}>
          Last ned PDF
        </a>
        <button type="button" className="px-6" style={smallButton} onClick={async () => setCopied((await copy(publicUrl)) ? 'Lenken er kopiert.' : 'Kunne ikke kopiere. Merk og kopier lenken over.')}>
          Kopier lenke
        </button>
        <a href={publicPath} target="_blank" rel="noopener" className="px-6" style={smallButton}>
          Åpne registreringssiden
        </a>
      </div>
      <p role="status" aria-live="polite" style={{ fontFamily: SANS, fontSize: 14, color: MUTED, minHeight: 22, margin: '10px 0 0' }}>
        {copied}
      </p>
    </div>
  )
}

export function PinBlock() {
  const handleSignedOut = useSignedOutRedirect()
  const [pin, setPin] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function reveal() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    const res = await postJson('/api/miljo/konto/pin', {})
    setBusy(false)
    if (handleSignedOut(res)) return
    if (res.ok && typeof res.pin === 'string') setPin(res.pin)
    else setMessage(res.message ?? 'PIN-koden kan ikke vises.')
  }

  if (!pin) {
    return (
      <div>
        {message && <Notice tone="error">{message}</Notice>}
        <button type="button" onClick={reveal} disabled={busy} aria-busy={busy} className="px-6" style={{ ...smallButton, opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Vent litt …' : 'Vis PIN'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 32, letterSpacing: '0.2em', color: INK, margin: '0 0 14px' }} aria-label={`PIN: ${pin.split('').join(' ')}`}>
        {pin}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="px-6" style={smallButton} onClick={async () => setMessage((await copy(pin)) ? 'PIN-koden er kopiert.' : 'Kunne ikke kopiere PIN-koden.')}>
          Kopier PIN
        </button>
        <button
          type="button"
          className="px-6"
          style={smallButton}
          onClick={() => {
            setPin(null)
            setMessage(null)
          }}
        >
          Skjul PIN
        </button>
      </div>
      <p role="status" aria-live="polite" style={{ fontFamily: SANS, fontSize: 14, color: MUTED, minHeight: 22, margin: '10px 0 0' }}>
        {message}
      </p>
    </div>
  )
}

export function ChangePassword() {
  const handleSignedOut = useSignedOutRedirect()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const res = await postJson('/api/miljo/konto/endre-passord', { currentPassword: current, password, passwordConfirmation: confirmation })
    setBusy(false)
    if (handleSignedOut(res)) return
    setResult(res)
    setCurrent('')
    if (res.ok) {
      setPassword('')
      setConfirmation('')
      setOpen(false)
      if (res.signedIn === false) {
        router.replace(MILJO_PATHS.login)
        router.refresh()
      }
    }
  }

  if (!open) {
    return (
      <div>
        {result?.ok && <Notice tone="success">{result.message}</Notice>}
        <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.65, color: MUTED, margin: '0 0 16px' }}>
          Når passordet endres, blir organisasjonens konto logget ut på alle andre enheter.
        </p>
        <button
          type="button"
          className="px-6"
          style={smallButton}
          onClick={() => {
            setResult(null)
            setOpen(true)
          }}
        >
          Endre passord
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: 480 }}>
      {result && !result.ok && !result.field && <Notice tone="error">{result.message}</Notice>}
      <Field
        id="change-current"
        label="Nåværende passord"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        maxLength={128}
        error={result?.field === 'currentPassword' ? result.message : null}
      />
      <PasswordFields
        idPrefix="change"
        password={password}
        confirmation={confirmation}
        onPassword={setPassword}
        onConfirmation={setConfirmation}
        error={result?.field === 'password' ? (result.message ?? null) : null}
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton busy={busy}>Lagre nytt passord</SubmitButton>
        <button type="button" className="px-6" style={{ ...smallButton, minHeight: 54 }} onClick={() => setOpen(false)}>
          Avbryt
        </button>
      </div>
    </form>
  )
}

export function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      className="px-6"
      style={{ ...smallButton, alignSelf: 'flex-start', opacity: busy ? 0.7 : 1 }}
      onClick={async () => {
        setBusy(true)
        await postJson('/api/miljo/konto/logg-ut', {})
        router.replace(MILJO_PATHS.login)
        router.refresh()
      }}
    >
      Logg ut
    </button>
  )
}
