'use client'

import { useState } from 'react'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { PasswordFields } from '../min-side/PasswordFields'
import { Field, Notice, SubmitButton, postJson, type ApiResult } from '../registrer/formParts'

export default function ChangeRequiredForm({ email }: { email: string }) {
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
    if (res.ok) {
      window.location.assign(res.signedIn ? MILJO_PATHS.dashboard : MILJO_PATHS.login)
      return
    }
    if (res.code === 'signed_out') {
      window.location.assign(MILJO_PATHS.login)
      return
    }
    setResult(res)
    setCurrent('')
    setPassword('')
    setConfirmation('')
    setBusy(false)
  }

  async function signOut() {
    await postJson('/api/miljo/konto/logg-ut', {})
    window.location.assign(MILJO_PATHS.login)
  }

  return (
    <form onSubmit={submit} noValidate>
      {/* Lets password managers attach the new password to the right login. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {result && !result.ok && result.field !== 'password' && result.field !== 'currentPassword' && <Notice tone="error">{result.message}</Notice>}
      <Field
        id="required-current"
        label="Midlertidig passord"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        maxLength={128}
        error={result?.field === 'currentPassword' ? (result.message ?? null) : null}
      />
      <PasswordFields
        idPrefix="required"
        password={password}
        confirmation={confirmation}
        onPassword={setPassword}
        onConfirmation={setConfirmation}
        error={result?.field === 'password' ? (result.message ?? null) : null}
      />
      <SubmitButton busy={busy}>Lagre og gå til Min side</SubmitButton>
      <p style={{ marginTop: 16 }}>
        <button type="button" onClick={() => void signOut()} style={{ background: 'none', border: 0, padding: 0, textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}>
          Logg ut
        </button>
      </p>
    </form>
  )
}
