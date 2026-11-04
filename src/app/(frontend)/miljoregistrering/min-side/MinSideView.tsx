import { BORDER_WARM, CREAM, INK, MUTED, OLIVE, SANS, SERIF } from '../../bedrifter/theme'
import { ACCOUNT_DELIVERY_LIMIT, type AccountDeliveryRow, type AccountOverview } from '@/lib/miljo/account/organization'
import { qrFor } from '@/lib/miljo/account/qrFiles'
import type { DashboardData } from '@/lib/miljo/account/service'
import { CATEGORY_LABELS, DELIVERY_UNIT_LABELS, type DeliveryUnit } from '@/lib/miljo/constants'
import { formatDayKey } from '@/lib/miljo/period'
import { miljoPath } from '@/lib/miljo/qrPrint'
import { qrSvgPath } from '@/lib/qr/qrcode'
import { formatNo } from '../../miljo/[code]/clientUtils'
import styles from '../../miljo/[code]/miljo.module.css'
import { PAGE_SHELL } from '../pageShell'
import { ChangePassword, LogoutButton, PinBlock, QrActions } from './MinSideClient'
import MinSideTabs from './MinSideTabs'

/**
 * Min side for a signed-in Miljø account — the organisation's dashboard (Stage 2.2b + 2.3).
 *
 * Everything shown belongs to the session's OWN business customer and its environmental
 * organisation (@/lib/miljo/account/service `dashboard`, @/lib/miljo/account/organization); without
 * an authorised session the page redirects to sign-in. The PIN is NOT in this HTML — «Vis PIN»
 * fetches it. Registrations (self-reported) and deliveries (actual) are always shown apart, and
 * kilograms and pieces are never converted.
 */

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BORDER_WARM}`, borderRadius: 18, padding: 'clamp(20px,4vw,32px)', marginBottom: 16 }
const h2: React.CSSProperties = { fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(24px,3.4vw,30px)', lineHeight: 1.15, color: INK, margin: '0 0 12px' }
const p: React.CSSProperties = { fontFamily: SANS, fontSize: 15, lineHeight: 1.65, color: MUTED, margin: '0 0 16px' }

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('nb-NO', { timeZone: 'Europe/Oslo', day: 'numeric', month: 'long', year: 'numeric' })
}

const qty = (n: number, unit: DeliveryUnit) => `${formatNo(n, unit === 'kg' ? 2 : 0)} ${DELIVERY_UNIT_LABELS[unit]}`

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.kpi}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
    </div>
  )
}

function Overview({ overview, otherLabel }: { overview: AccountOverview; otherLabel?: string }) {
  const { registrations: reg, deliveries: del } = overview
  return (
    <section aria-labelledby="oversikt-tittel" className={styles.theme} style={{ marginBottom: 16 }}>
      <h2 id="oversikt-tittel" style={{ ...h2, marginBottom: 4 }}>
        Oversikt
      </h2>
      <p style={{ ...p, fontSize: 14, marginBottom: 12 }}>Totalt siden {formatDayKey(overview.sinceKey)}.</p>
      <div className={styles.card}>
        <div className={styles.sectionHead}>
          <h3 className={styles.subTitle} style={{ margin: 0 }}>
            Registrert av ansatte
          </h3>
          <span className={styles.badge}>Egenrapportert</span>
        </div>
        <p className={styles.small} style={{ marginTop: 4 }}>
          Batterier som ansatte selv har registrert via QR-koden. Ikke kontrollert.
        </p>
        <div className={styles.kpis}>
          <Kpi label={`${CATEGORY_LABELS.aa}-batterier`} value={formatNo(reg.byCategory.aa)} />
          <Kpi label={`${CATEGORY_LABELS.aaa}-batterier`} value={formatNo(reg.byCategory.aaa)} />
          {reg.byCategory.other > 0 && <Kpi label={otherLabel ?? CATEGORY_LABELS.other} value={formatNo(reg.byCategory.other)} />}
          <Kpi label="Registreringer" value={formatNo(reg.registrations)} />
        </div>
      </div>
      <div className={`${styles.card} ${styles.deliveredCard}`}>
        <div className={styles.sectionHead}>
          <h3 className={styles.subTitle} style={{ margin: 0 }}>
            Leverte batterier
          </h3>
          <span className={`${styles.badge} ${styles.badgeDelivered}`}>Faktiske leveranser</span>
        </div>
        <p className={styles.small} style={{ marginTop: 4 }}>
          Leveranser til mottak, registrert av den ansvarlige med PIN. Kilo og stk. vises hver for seg og regnes ikke om.
        </p>
        <div className={styles.kpis}>
          {(['kg', 'stk'] as const).map((u) => (
            <Kpi key={u} label={`Levert (${DELIVERY_UNIT_LABELS[u]})`} value={del.byUnit[u].deliveries > 0 ? qty(del.byUnit[u].quantity, u) : '–'} />
          ))}
          <Kpi label="Leveranser" value={formatNo(del.deliveries)} />
          <Kpi label="Med kvittering" value={formatNo(del.withReceipt)} />
        </div>
      </div>
    </section>
  )
}

export interface MinSideViewProps {
  data: DashboardData
  overview: AccountOverview | null
  deliveries: { rows: AccountDeliveryRow[]; truncated: boolean } | null
  otherLabel?: string
}

/** Min side's markup — no data loading (./page loads everything for the session). */
export default function MinSideView({ data, overview, deliveries, otherLabel }: MinSideViewProps) {
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

  const deliveriesPanel = (
    <section aria-labelledby="leveranser-tittel" className={`${styles.card} ${styles.deliveredCard}`}>
      <div className={styles.sectionHead}>
        <h2 className={styles.subTitle} id="leveranser-tittel" style={{ margin: 0 }}>
          Leveranser
        </h2>
        <span className={`${styles.badge} ${styles.badgeDelivered}`}>Faktiske leveranser</span>
      </div>
      <p className={styles.small} style={{ marginTop: 4 }}>
        Alle leveranser organisasjonen har registrert, nyeste først. Leveranser registreres på QR-siden («Registrer faktisk levering»)
        med organisasjonens PIN; navn på ansvarlig lagres ikke. Ugyldiggjorte leveranser vises ikke. Er noe feil, kontakt aBoks.
      </p>
      {!deliveries || deliveries.rows.length === 0 ? (
        <p className={styles.empty}>Ingen leveranser er registrert ennå.</p>
      ) : (
        <>
        {/* Phones: one compact card per delivery; the table from 640px. */}
        <ul className="sm:hidden" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {deliveries.rows.map((d) => (
            <li key={d.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontWeight: 700 }}>
                <span>{formatDayKey(d.deliveryDate)}</span>
                <span style={{ whiteSpace: 'nowrap' }}>{qty(d.quantity, d.unit)}</span>
              </div>
              <p className={styles.small} style={{ margin: '4px 0 0', color: 'var(--body)', overflowWrap: 'anywhere' }}>{d.operator}</p>
              <p className={styles.small} style={{ margin: '2px 0 0', overflowWrap: 'anywhere' }}>
                Referanse: {d.reference ?? '–'} · Kvittering: {d.documentationStatus === 'documented' ? 'Ja' : 'Nei'}
                {d.corrected && ' · Korrigert av aBoks'}
              </p>
            </li>
          ))}
        </ul>
        <div className={`${styles.tableWrap} hidden sm:block`}>
          <table className={styles.table}>
            <caption className={styles.srOnly}>Leveranser</caption>
            <thead>
              <tr>
                <th scope="col">Dato</th>
                <th scope="col" className={styles.num}>
                  Mengde
                </th>
                <th scope="col">Mottak</th>
                <th scope="col">Referanse</th>
                <th scope="col">Kvittering</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.rows.map((d) => (
                <tr key={d.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{formatDayKey(d.deliveryDate)}</td>
                  <td className={styles.num}>{qty(d.quantity, d.unit)}</td>
                  <td style={{ overflowWrap: 'anywhere' }}>{d.operator}</td>
                  <td style={{ overflowWrap: 'anywhere' }}>{d.reference ?? '–'}</td>
                  <td>
                    {d.documentationStatus === 'documented' ? 'Ja' : 'Nei'}
                    {d.corrected && <span className={styles.small} style={{ display: 'block', margin: 0 }}>Korrigert av aBoks</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {deliveries?.truncated && <p className={styles.small}>Viser de {ACCOUNT_DELIVERY_LIMIT} nyeste. Alle leveranser finnes i CSV-eksporten under «Statistikk og eksport».</p>}
    </section>
  )

  const qrPanel = (
    <>
      <section aria-labelledby="qr-title" style={card}>
        <h2 id="qr-title" style={h2}>
          Organisasjonens QR-kode
        </h2>
        {qr && data.publicUrl ? (
          <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
            <svg
              role="img"
              aria-label={`QR-kode til ${data.publicUrl}`}
              viewBox={`0 0 ${dim} ${dim}`}
              shapeRendering="crispEdges"
              style={{ width: '100%', maxWidth: 220, height: 'auto', background: '#fff', border: `1px solid ${BORDER_WARM}`, borderRadius: 12 }}
            >
              <rect width={dim} height={dim} fill="#ffffff" />
              <path d={qrSvgPath(qr, 4)} fill="#000000" />
            </svg>
            <div>
              <p style={p}>
                Skriv ut QR-koden og fest den på aBoks-beholderen. Ansatte kan registrere brukte AA- og AAA-batterier uten innlogging ved å skanne
                QR-koden.
              </p>
              <p style={{ ...p, color: INK, fontWeight: 600, overflowWrap: 'anywhere' }}>{data.publicUrl}</p>
              {!data.organizationActive && <p style={{ ...p, color: INK }}>Registreringssiden er midlertidig stengt. Kontakt aBoks dersom dette ikke stemmer.</p>}
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
    </>
  )

  const accountPanel = (
    <section aria-labelledby="password-title" style={card}>
      <h2 id="password-title" style={h2}>
        Passord
      </h2>
      <ChangePassword />
      <p style={{ ...p, fontSize: 14, margin: '20px 0 0' }}>Skal organisasjonsopplysningene eller kontaktpersonen endres? Kontakt aBoks.</p>
    </section>
  )

  return (
    <main style={{ background: CREAM, minHeight: '70vh' }}>
      <div className={PAGE_SHELL} style={{ maxWidth: 880 }}>
        <header style={{ marginBottom: 24 }}>
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
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3" style={{ margin: '20px 0 0', fontFamily: SANS, fontSize: 15 }}>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt style={{ color: MUTED, fontSize: 13 }}>{label}</dt>
                <dd style={{ color: INK, margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {overview ? (
          <Overview overview={overview} otherLabel={otherLabel} />
        ) : (
          <p style={{ ...p, ...card }}>Organisasjonen har ingen registreringsside ennå. Kontakt aBoks, så hjelper vi dere.</p>
        )}

        <MinSideTabs deliveries={deliveriesPanel} qr={qrPanel} account={accountPanel} />
      </div>
    </main>
  )
}
