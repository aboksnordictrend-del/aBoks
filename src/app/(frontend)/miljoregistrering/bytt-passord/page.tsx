import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { CREAM } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { PageTitle } from '../registrer/formParts'
import { NO_INDEX, pageSession } from '../konto'
import { PAGE_SHELL } from '../pageShell'
import ChangeRequiredForm from './ChangeRequiredForm'

export const metadata: Metadata = {
  title: 'Bytt passord – Miljøregistrering',
  robots: NO_INDEX,
}

export const dynamic = 'force-dynamic'

/**
 * The forced password change after signing in with a temporary password from aBoks (Stage 2.5).
 * The only page such a session may open; every other Min side page and API refuses it server-side
 * (@/lib/miljo/account/session). Without a session → sign-in; without the requirement → Min side.
 */
export default async function ByttPassordPage() {
  const session = await pageSession('password-change')
  if (!session) redirect(MILJO_PATHS.login)
  if (!session.passwordChangeRequired) redirect(MILJO_PATHS.dashboard)
  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className={PAGE_SHELL} style={{ maxWidth: 520 }}>
        <PageTitle
          title="Velg ditt eget passord"
          intro="Du er logget inn med et midlertidig passord fra aBoks. Velg et nytt passord før du går videre til Min side."
        />
        <ChangeRequiredForm email={String(session.account.email ?? '')} />
      </div>
    </main>
  )
}
