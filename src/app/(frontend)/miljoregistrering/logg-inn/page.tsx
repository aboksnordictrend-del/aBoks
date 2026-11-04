import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CREAM } from '../../bedrifter/theme'
import { PageTitle } from '../registrer/formParts'
import { NO_INDEX, signedInDestination } from '../konto'
import LoginForm from './LoginForm'
import { PAGE_SHELL } from '../pageShell'

export const metadata: Metadata = {
  title: 'Logg inn – Miljøregistrering',
  description: 'Logg inn på Min side i aBoks Miljøregistrering.',
  robots: NO_INDEX,
}

export const dynamic = 'force-dynamic'

export default async function LoggInnPage() {
  const destination = await signedInDestination()
  if (destination) redirect(destination)
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className={PAGE_SHELL} style={{ maxWidth: 520 }}>
        <PageTitle title="Logg inn" intro="Logg inn med organisasjonens konto i aBoks Miljøregistrering for å se QR-koden og PIN for levering." />
        <LoginForm />
      </div>
    </main>
  )
}
