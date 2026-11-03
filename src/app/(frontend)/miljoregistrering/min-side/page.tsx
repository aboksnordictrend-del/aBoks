import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BORDER_WARM, CREAM, INK, MUTED, OLIVE, SANS, SERIF } from '../../bedrifter/theme'
import { MILJO_PATHS } from '@/lib/miljo/account/constants'
import { qrFor } from '@/lib/miljo/account/qrFiles'
import { dashboard } from '@/lib/miljo/account/service'
import { miljoPath } from '@/lib/miljo/qrPrint'
import { qrSvgPath } from '@/lib/qr/qrcode'
import { NO_INDEX, pageSession } from '../konto'
import { ChangePassword, LogoutButton, PinBlock, QrActions } from './MinSideClient'

export const metadata: Metadata = {
  title: 'Min side – Miljøregistrering',
  robots: NO_INDEX,
}

export const dynamic = 'force-dynamic'

/**
 * Min side for a signed-in Miljø account (Stage 2.2b). Everything shown belongs to the session's
 * OWN business customer (see @/lib/miljo/account/service `dashboard`); without an authorised
 * session the page redirects to sign-in. The PIN is NOT in this HTML — «Vis PIN» fetches it.
 */

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BORDER_WARM}`, borderRadius: 18, padding: 'clamp(20px,4vw,32px)', marginBottom: 24 }
const h2: React.CSSProperties = { fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(24px,3.4vw,30px)', lineHeight: 1.15, color: INK, margin: '0 0 12px' }
const p: React.CSSProperties = { fontFamily: SANS, fontSize: 15, lineHeight: 1.65, color: MUTED, margin: '0 0 16px' }

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function MinSidePage() {
  const session = await pageSession()
  if (!session) redirect(MILJO_PATHS.login)
  const data = await dashboard(session)
  const qr = data.publicUrl ? qrFor(data.publicUrl) : null
  const dim = qr ? qr.size + 8 : 0

  const facts: [string, string][] = [
    ['Organisasjon', data.officialName],
    ['Organisasjonsnummer', data.organizationNumber],
    ['Kontaktperson', data.contactName || '–'],
    ['E-post for innlogging', data.loginEmail],
    ['Tilgang', data.accessStatus],
    ['Aktivert', formatDate(data.activatedAt)],
  ]

  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className="mx-auto" style={{ maxWidth: 880, padding: 'clamp(40px,7vw,80px) 16px' }}>
        <header style={{ marginBottom: 28 }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: OLIVE, margin: '0 0 8px' }}>
                aBoks Miljøregistrering — Min side
              </p>
              <h1 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(32px,5vw,44px)', lineHeight: 1.1, color: INK, margin: 0, overflowWrap: 'anywhere' }}>
                {data.officialName}
              </h1>
            </div>
            <LogoutButton />
          </div>
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2" style={{ margin: '24px 0 0', fontFamily: SANS, fontSize: 15 }}>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt style={{ color: MUTED, fontSize: 13 }}>{label}</dt>
                <dd style={{ color: INK, margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <section aria-labelledby="qr-title" style={card}>
          <h2 id="qr-title" style={h2}>
            Organisasjonens QR-kode
          </h2>
          {qr && data.publicUrl ? (
            <div className="grid gap-6 md:grid-cols-[260px_1fr] md:items-start">
              <svg
                role="img"
                aria-label={`QR-kode til ${data.publicUrl}`}
                viewBox={`0 0 ${dim} ${dim}`}
                shapeRendering="crispEdges"
                style={{ width: '100%', maxWidth: 260, height: 'auto', background: '#fff', border: `1px solid ${BORDER_WARM}`, borderRadius: 12 }}
              >
                <rect width={dim} height={dim} fill="#ffffff" />
                <path d={qrSvgPath(qr, 4)} fill="#000000" />
              </svg>
              <div>
                <p style={p}>Skriv ut QR-koden og fest den på aBoks-beholderen. Den åpner organisasjonens registreringsside:</p>
                <p style={{ ...p, color: INK, fontWeight: 600, overflowWrap: 'anywhere' }}>{data.publicUrl}</p>
                <QrActions publicUrl={data.publicUrl} publicPath={miljoPath(data.publicCode!)} />
              </div>
            </div>
          ) : (
            <p style={p}>Organisasjonen har ingen QR-kode ennå. Kontakt aBoks, så hjelper vi dere.</p>
          )}
        </section>

        <section aria-labelledby="pin-title" style={card}>
          <h2 id="pin-title" style={h2}>
            PIN for registrering av levering
          </h2>
          <p style={p}>PIN-koden brukes av den ansvarlige når batterier leveres til godkjent mottak.</p>
          <PinBlock />
        </section>

        <section aria-labelledby="public-title" style={card}>
          <h2 id="public-title" style={h2}>
            Registreringssiden for ansatte
          </h2>
          <p style={p}>Ansatte kan registrere brukte AA- og AAA-batterier uten innlogging ved å skanne QR-koden.</p>
          {data.publicUrl && !data.organizationActive && (
            <p style={{ ...p, color: INK }}>Registreringssiden er midlertidig stengt. Kontakt aBoks dersom dette ikke stemmer.</p>
          )}
          {data.publicUrl && (
            <a href={miljoPath(data.publicCode!)} target="_blank" rel="noopener" className="inline-flex" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: INK, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Åpne registreringssiden
            </a>
          )}
        </section>

        <section aria-labelledby="password-title" style={card}>
          <h2 id="password-title" style={h2}>
            Passord
          </h2>
          <ChangePassword />
        </section>
      </div>
    </main>
  )
}
