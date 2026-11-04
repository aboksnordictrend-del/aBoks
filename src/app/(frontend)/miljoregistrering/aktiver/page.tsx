import type { Metadata } from 'next'
import { CREAM } from '../../bedrifter/theme'
import { PageTitle } from '../registrer/formParts'
import { NO_INDEX } from '../konto'
import ActivateForm from './ActivateForm'
import { PAGE_SHELL } from '../pageShell'

export const metadata: Metadata = {
  title: 'Aktiver konto – Miljøregistrering',
  robots: NO_INDEX,
  // The one-time token is in the URL: never leak it to another site through the Referer header.
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

/** Invitation from aBoks (Stage 2.5): the recipient chooses a password; nothing changes by opening the page. */
export default async function AktiverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className={PAGE_SHELL} style={{ maxWidth: 520 }}>
        <PageTitle title="Aktiver kontoen" intro="aBoks har opprettet en konto for organisasjonen din i Miljøregistrering. Velg et passord for å ta den i bruk." />
        <ActivateForm token={token} />
      </div>
    </main>
  )
}
