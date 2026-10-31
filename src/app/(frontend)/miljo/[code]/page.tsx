import type { Metadata } from 'next'
import { resolvePublicOrganization } from '@/lib/miljo/server'
import { toPublicOrganization } from '@/lib/miljo/service'
import { turnstileSiteKey } from '@/lib/turnstile'
import MiljoPage from './MiljoPage'
import styles from './miljo.module.css'

// One dynamic template for every organisation: status, name and categories are read per request.
export const dynamic = 'force-dynamic'

// Generic on purpose: the metadata never reveals whether, or which, organisation sits behind a
// code. Not indexed and not in the sitemap (src/app/sitemap.ts lists no /miljo routes).
export const metadata: Metadata = {
  title: 'Registrer brukte batterier',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
}

export default async function MiljoCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const resolution = await resolvePublicOrganization(decodeURIComponent(code))

  if (resolution.kind !== 'active') {
    // Inactive organisation, retired code and unknown code look exactly the same.
    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>aBoks Miljøregistrering</p>
          <h1 className={styles.title}>Registreringen er ikke aktiv</h1>
          <p className={styles.lead}>
            Denne QR-koden tar ikke imot registreringer. Kontakt den som har ansvaret for batteriinnsamlingen der du er.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <MiljoPage organization={toPublicOrganization(resolution.org)} turnstileSiteKey={turnstileSiteKey()} />
    </div>
  )
}
