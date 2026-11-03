import type { Metadata } from 'next'
import { CREAM } from '../../bedrifter/theme'
import { PageTitle } from '../registrer/formParts'
import ConfirmActivation from './ConfirmActivation'

export const metadata: Metadata = {
  title: 'Bekreft registreringen',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  // The token is in the URL: never leak it to another site through the Referer header.
  referrer: 'no-referrer',
}

export const dynamic = 'force-dynamic'

export default async function BekreftPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className="mx-auto" style={{ maxWidth: 640, padding: 'clamp(40px,7vw,80px) 16px' }}>
        <PageTitle title="Bekreft registreringen" intro="Siste steg: bekreft e-postadressen for å aktivere organisasjonens konto." />
        <ConfirmActivation token={token} />
      </div>
    </main>
  )
}
