'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { INK, MUTED, SANS } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { Field, Notice, SubmitButton, postJson } from '../registrer/formParts'

export const linkStyle: React.CSSProperties = { color: INK, textDecoration: 'underline', textUnderlineOffset: 3 }

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await postJson('/api/miljo/konto/logg-inn', { email, password })
    if (res.ok) {
      router.replace(MILJO_PATHS.dashboard)
      router.refresh()
      return
    }
    setPassword('')
    setError(res.message ?? 'Innloggingen mislyktes.')
    setBusy(false)
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <Field id="login-email" label="E-postadresse" name="email" type="email" autoComplete="username" value={email} onChange={setEmail} maxLength={254} />
      <Field id="login-password" label="Passord" name="password" type="password" autoComplete="current-password" value={password} onChange={setPassword} maxLength={128} />
      <SubmitButton busy={busy}>Logg inn</SubmitButton>
      <p style={{ fontFamily: SANS, fontSize: 15, color: MUTED, lineHeight: 1.7, margin: '24px 0 0' }}>
        <Link href={MILJO_PATHS.forgot} style={linkStyle}>
          Glemt passord?
        </Link>
        <br />
        Ikke registrert ennå?{' '}
        <Link href={MILJO_PATHS.register} style={linkStyle}>
          Registrer bedriften
        </Link>
      </p>
    </form>
  )
}
