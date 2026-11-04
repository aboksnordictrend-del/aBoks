import type { Metadata } from 'next'
import { CREAM } from '../../bedrifter/theme'
import { turnstileSiteKey } from '@/lib/turnstile'
import RegistrationFlow from './RegistrationFlow'
import { PageTitle } from './formParts'
import { PAGE_SHELL } from '../pageShell'

export const metadata: Metadata = {
  title: 'Registrer bedriften i Miljøregistrering',
  description: 'Registrer organisasjonen i aBoks Miljøregistrering med ordrenummeret fra kjøpet.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
}

export default function RegistrerPage() {
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className={PAGE_SHELL} style={{ maxWidth: 640 }}>
        <PageTitle
          title="Registrer bedriften"
          intro="Har organisasjonen kjøpt aBoks? Registrer dere i aBoks Miljøregistrering. Ansatte trenger ingen konto – de registrerer batterier via QR-koden på beholderen."
        />
        <RegistrationFlow turnstileSiteKey={turnstileSiteKey()} />
      </div>
    </main>
  )
}
