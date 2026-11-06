import type { Metadata } from 'next'
import { CREAM } from '../../bedrifter/theme'
import { PageTitle } from '../registrer/formParts'
import ConfirmActivation from './ConfirmActivation'
import { PAGE_SHELL } from '../pageShell'

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
      <div className={PAGE_SHELL} style={{ maxWidth: 640 }}>
        <PageTitle title="Bekreft registreringen" intro="Bekreft e-postadressen, så gjennomgår aBoks registreringen." />
        <ConfirmActivation token={token} />
      </div>
    </main>
  )
}
