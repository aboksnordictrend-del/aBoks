import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { permanentRedirect } from 'next/navigation'
import { getPayloadClient } from '@/lib/payload'
import { resolvePilotPage, type PilotPageState } from '@/lib/pilot/server'
import { pilotPath } from '@/lib/pilot/urls'
import { turnstileSiteKey } from '@/lib/turnstile'
import PilotForm from './PilotForm'
import styles from './pilot.module.css'

// One dynamic template for every pilot project: status and questionnaire are read per request.
export const dynamic = 'force-dynamic'

// Generic on purpose: the metadata never reveals whether, or which, project sits behind a slug.
export const metadata: Metadata = {
  title: 'Pilotevaluering',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

const STATE_TEXT: Record<Exclude<PilotPageState, 'active'>, { title: string; body: string }> = {
  draft: {
    title: 'Undersøkelsen er ikke åpnet ennå',
    body: 'Denne evalueringen tar ikke imot svar ennå. Prøv igjen senere.',
  },
  completed: {
    title: 'Undersøkelsen er avsluttet',
    body: 'Takk for interessen! Denne evalueringen tar ikke lenger imot svar.',
  },
  archived: {
    title: 'Undersøkelsen er avsluttet',
    body: 'Takk for interessen! Denne evalueringen tar ikke lenger imot svar.',
  },
  notFound: {
    title: 'Fant ikke undersøkelsen',
    body: 'Lenken er ugyldig, eller undersøkelsen finnes ikke. Sjekk at adressen er riktig.',
  },
}

/** True only for a logged-in administrator who asked for a preview. */
async function isAdminPreview(requested: boolean): Promise<boolean> {
  if (!requested) return false
  try {
    const payload = await getPayloadClient()
    const { user } = await payload.auth({ headers: await headers() })
    return (user as { role?: string } | null)?.role === 'admin'
  } catch {
    return false
  }
}

export default async function PilotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const preview = await isAdminPreview(sp.forhandsvisning === '1')

  const resolution = await resolvePilotPage(decodeURIComponent(slug), { preview })
  if (resolution.kind === 'redirect') {
    // An earlier slug of the project: permanent, so printed QR codes keep working.
    permanentRedirect(`${pilotPath(resolution.slug)}${preview ? '?forhandsvisning=1' : ''}`)
  }

  const { state, view } = resolution
  if (!view) {
    const text = STATE_TEXT[state === 'active' ? 'notFound' : state]
    return (
      <div className={styles.wrap}>
        <div className={`${styles.card} ${styles.center}`}>
          <p className={styles.eyebrow}>aBoks pilotevaluering</p>
          <h1 className={styles.title}>{text.title}</h1>
          <p className={styles.body}>{text.body}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <PilotForm
        projectId={view.projectId}
        projectName={view.name}
        snapshot={view.snapshot}
        preview={preview}
        previewStatus={preview && state !== 'active' ? state : null}
        turnstileSiteKey={preview ? '' : turnstileSiteKey()}
      />
    </div>
  )
}
