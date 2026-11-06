'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INK, SANS, primaryButton, secondaryButton } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { Notice, SubmitButton, postJson, type ApiResult } from '../registrer/formParts'

/**
 * The page the confirmation e-mail opens. Confirmation happens on the button — a POST — never on
 * merely opening the link, so a mail scanner that follows links confirms nothing. Confirming proves
 * the e-mail address and nothing else: the account is activated only when aBoks approves the
 * registration. Opening a used link again simply shows where the registration stands.
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

  if (result?.ok && result.state === 'activated') {
    const code = typeof result.publicCode === 'string' ? result.publicCode : null
    return (
      <div>
        <Notice tone="success">Bedriftskontoen er aktivert</Notice>
        <p style={{ fontFamily: SANS, fontSize: 16, color: INK, lineHeight: 1.6, margin: '0 0 24px' }}>Du kan nå logge inn og ta i bruk aBoks Miljøregistrering.</p>
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

  if (result?.ok && result.state === 'rejected') {
    return (
      <div>
        <Notice tone="error">Registreringen ble ikke godkjent</Notice>
        <p style={{ fontFamily: SANS, fontSize: 16, color: INK, lineHeight: 1.6, margin: 0 }}>
          Ingen konto er aktivert. Ta gjerne kontakt på{' '}
          <a href="mailto:post@aboks.no" style={{ color: INK, textDecoration: 'underline' }}>
            post@aboks.no
          </a>{' '}
          hvis du har spørsmål, eller hvis du mener at dette ikke stemmer.
        </p>
      </div>
    )
  }

  if (result?.ok) {
    return (
      <div>
        <Notice tone="success">E-postadressen er bekreftet</Notice>
        <p style={{ fontFamily: SANS, fontSize: 16, color: INK, lineHeight: 1.6, margin: 0 }}>
          Registreringen er mottatt og venter på godkjenning fra aBoks. Du får beskjed på e-post når bedriftskontoen er aktivert.
        </p>
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
          <p style={{ fontFamily: SANS, fontSize: 16, color: INK, lineHeight: 1.6, margin: '0 0 20px' }}>Trykk på knappen for å bekrefte e-postadressen.</p>
          <SubmitButton type="button" busy={busy} onClick={confirm}>
            Bekreft e-postadressen
          </SubmitButton>
        </>
      )}
    </div>
  )
}
