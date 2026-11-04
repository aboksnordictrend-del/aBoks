import type { Metadata } from 'next'
import { CREAM } from '../../bedrifter/theme'
import { PageTitle } from '../registrer/formParts'
import { NO_INDEX } from '../konto'
import ForgotForm from './ForgotForm'
import { PAGE_SHELL } from '../pageShell'

export const metadata: Metadata = {
  title: 'Glemt passord – Miljøregistrering',
  robots: NO_INDEX,
}

export default function GlemtPassordPage() {
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className={PAGE_SHELL} style={{ maxWidth: 520 }}>
        <PageTitle title="Glemt passord" intro="Skriv inn e-postadressen dere logger inn med. Vi sender en lenke for å lage nytt passord." />
        <ForgotForm />
      </div>
    </main>
  )
}
