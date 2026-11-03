import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CREAM } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { PageTitle } from '../registrer/formParts'
import { NO_INDEX, pageSession } from '../konto'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Logg inn – Miljøregistrering',
  description: 'Logg inn på Min side i aBoks Miljøregistrering.',
  robots: NO_INDEX,
}

export const dynamic = 'force-dynamic'

export default async function LoggInnPage() {
  if (await pageSession()) redirect(MILJO_PATHS.dashboard)
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className="mx-auto" style={{ maxWidth: 520, padding: 'clamp(40px,7vw,80px) 16px' }}>
        <PageTitle title="Logg inn" intro="Logg inn med organisasjonens konto i aBoks Miljøregistrering for å se QR-koden og PIN for levering." />
        <LoginForm />
      </div>
    </main>
  )
}
