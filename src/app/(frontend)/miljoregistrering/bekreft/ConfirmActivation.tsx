'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INK, MUTED, SANS, primaryButton, secondaryButton } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { Notice, SubmitButton, postJson, type ApiResult } from '../registrer/formParts'

/**
 * The page the confirmation e-mail opens. Activation happens on the button — a POST — never on
 * merely opening the link, so a mail scanner that follows links activates nothing. Opening an
 * already used link again simply says the account is active.
 */
export default function ConfirmActivation({ token }: { token: string }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)

  async function confirm() {
    if (busy) return
    setBusy(true)
    setResult(await postJson('/api/miljo/registrering/bekreft', { token }))
    setBusy(false)
  }

  if (!token) return <Notice tone="error">Lenken mangler informasjon. Åpne lenken fra e-posten på nytt.</Notice>

  if (result?.ok) {
    const code = typeof result.publicCode === 'string' ? result.publicCode : null
    return (
      <div>
        <Notice tone="success">
          {result.alreadyActivated ? 'Kontoen er allerede aktivert.' : 'Takk! E-postadressen er bekreftet, og kontoen er aktivert.'}
        </Notice>
        <p style={{ fontFamily: SANS, fontSize: 16, color: INK, lineHeight: 1.6, margin: '0 0 12px' }}>
          <strong>{String(result.organizationName)}</strong> er nå registrert i aBoks Miljøregistrering.
        </p>
        <p style={{ fontFamily: SANS, fontSize: 15, color: MUTED, lineHeight: 1.6, margin: '0 0 24px' }}>
          Organisasjonen har fått sin egen QR-kode for registrering av brukte batterier. Logg inn på Min side for å laste ned QR-koden og se PIN for leveranser.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={MILJO_PATHS.login} className="w-full px-8 sm:w-auto" style={{ ...primaryButton }}>
            Logg inn
          </Link>
          {code && (
            <Link href={`/miljo/${code}`} className="w-full px-8 sm:w-auto" style={{ ...secondaryButton }}>
              Åpne organisasjonens registreringsside
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {result && !result.ok && <Notice tone="error">{result.message}</Notice>}
      {result?.code === 'expired' || result?.code === 'invalid' ? (
        <Link href="/miljoregistrering/registrer" className="w-full px-8 sm:w-auto" style={{ ...secondaryButton }}>
          Start registreringen på nytt
        </Link>
      ) : (
        <>
          <p style={{ fontFamily: SANS, fontSize: 16, color: INK, lineHeight: 1.6, margin: '0 0 20px' }}>
            Trykk på knappen for å bekrefte e-postadressen og aktivere organisasjonens konto i aBoks Miljøregistrering.
          </p>
          <SubmitButton type="button" busy={busy} onClick={confirm}>
            Bekreft og aktiver
          </SubmitButton>
        </>
      )}
    </div>
  )
}
