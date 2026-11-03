'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SANS } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { Field, Notice, SubmitButton, postJson, type ApiResult } from '../registrer/formParts'
import { linkStyle } from '../logg-inn/LoginForm'

export default function ForgotForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setResult(await postJson('/api/miljo/konto/glemt-passord', { email }))
    setBusy(false)
  }

  if (result?.ok) {
    return (
      <div>
        <Notice tone="success">{result.message}</Notice>
        <Link href={MILJO_PATHS.login} style={{ ...linkStyle, fontFamily: SANS, fontSize: 15 }}>
          Tilbake til innlogging
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      {result && !result.ok && <Notice tone="error">{result.message}</Notice>}
      <Field id="forgot-email" label="E-postadresse" name="email" type="email" autoComplete="username" value={email} onChange={setEmail} maxLength={254} />
      <SubmitButton busy={busy}>Send lenke</SubmitButton>
    </form>
  )
}
