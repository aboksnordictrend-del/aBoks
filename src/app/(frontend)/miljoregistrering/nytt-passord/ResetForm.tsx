'use client'

import { useState } from 'react'
import Link from 'next/link'
import { secondaryButton } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { PasswordFields } from '../min-side/PasswordFields'
import { Notice, SubmitButton, postJson, type ApiResult } from '../registrer/formParts'

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const res = await postJson('/api/miljo/konto/nytt-passord', { token, password, passwordConfirmation: confirmation })
    setResult(res)
    if (!res.ok) {
      setPassword('')
      setConfirmation('')
    }
    setBusy(false)
  }

  if (!token) return <Notice tone="error">Lenken mangler informasjon. Åpne lenken fra e-posten på nytt, eller be om en ny.</Notice>

  if (result?.ok) {
    return (
      <div>
        <Notice tone="success">{result.message}</Notice>
        <Link href={MILJO_PATHS.login} className="w-full px-8 sm:w-auto" style={{ ...secondaryButton }}>
          Logg inn
        </Link>
      </div>
    )
  }

  if (result?.code === 'invalid') {
    return (
      <div>
        <Notice tone="error">{result.message}</Notice>
        <Link href={MILJO_PATHS.forgot} className="w-full px-8 sm:w-auto" style={{ ...secondaryButton }}>
          Be om en ny lenke
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate>
      {result && !result.ok && result.field !== 'password' && <Notice tone="error">{result.message}</Notice>}
      <PasswordFields
        idPrefix="reset"
        password={password}
        confirmation={confirmation}
        onPassword={setPassword}
        onConfirmation={setConfirmation}
        error={result?.field === 'password' ? (result.message ?? null) : null}
      />
      <SubmitButton busy={busy}>Lagre nytt passord</SubmitButton>
    </form>
  )
}
