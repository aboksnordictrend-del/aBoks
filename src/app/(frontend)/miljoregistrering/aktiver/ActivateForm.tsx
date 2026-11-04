'use client'

import { useState } from 'react'
import Link from 'next/link'
import { secondaryButton } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { PasswordFields } from '../min-side/PasswordFields'
import { Notice, SubmitButton, postJson, type ApiResult } from '../registrer/formParts'

export default function ActivateForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    const res = await postJson('/api/miljo/konto/aktiver', { token, password, passwordConfirmation: confirmation })
    if (res.ok && res.signedIn) {
      window.location.assign(MILJO_PATHS.dashboard)
      return
    }
    setResult(res)
    if (!res.ok) {
      setPassword('')
      setConfirmation('')
    }
    setBusy(false)
  }

  if (!token) return <Notice tone="error">Lenken mangler informasjon. Åpne lenken fra e-posten på nytt.</Notice>

  if (result?.ok) {
    return (
      <div>
        <Notice tone="success">{result.message} Logg inn med e-postadressen og passordet du valgte.</Notice>
        <Link href={MILJO_PATHS.login} className="w-full px-8 sm:w-auto" style={{ ...secondaryButton }}>
          Logg inn
        </Link>
      </div>
    )
  }

  if (result?.code === 'invalid' || result?.code === 'expired') return <Notice tone="error">{result.message}</Notice>

  return (
    <form onSubmit={submit} noValidate>
      {result && !result.ok && result.field !== 'password' && <Notice tone="error">{result.message}</Notice>}
      <PasswordFields
        idPrefix="activate"
        password={password}
        confirmation={confirmation}
        onPassword={setPassword}
        onConfirmation={setConfirmation}
        error={result?.field === 'password' ? (result.message ?? null) : null}
      />
      <SubmitButton busy={busy}>Aktiver kontoen</SubmitButton>
    </form>
  )
}
