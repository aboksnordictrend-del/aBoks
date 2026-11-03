import type { Metadata } from 'next'
import { CREAM } from '../../bedrifter/theme'
import { PageTitle } from '../registrer/formParts'
import { NO_INDEX } from '../konto'
import ResetForm from './ResetForm'

export const metadata: Metadata = {
  title: 'Nytt passord – Miljøregistrering',
  robots: NO_INDEX,
  // The one-time token is in the URL: never leak it to another site through the Referer header.
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

export default async function NyttPassordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className="mx-auto" style={{ maxWidth: 520, padding: 'clamp(40px,7vw,80px) 16px' }}>
        <PageTitle title="Lag nytt passord" intro="Velg et nytt passord for organisasjonens konto. Du blir logget ut på alle enheter." />
        <ResetForm token={token} />
      </div>
    </main>
  )
}
