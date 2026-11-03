import type { Metadata } from 'next'
import { CREAM } from '../../bedrifter/theme'
import { PageTitle } from '../registrer/formParts'
import { NO_INDEX } from '../konto'
import ForgotForm from './ForgotForm'

export const metadata: Metadata = {
  title: 'Glemt passord – Miljøregistrering',
  robots: NO_INDEX,
}

export default function GlemtPassordPage() {
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className="mx-auto" style={{ maxWidth: 520, padding: 'clamp(40px,7vw,80px) 16px' }}>
        <PageTitle title="Glemt passord" intro="Skriv inn e-postadressen dere logger inn med. Vi sender en lenke for å lage nytt passord." />
        <ForgotForm />
      </div>
    </main>
  )
}
