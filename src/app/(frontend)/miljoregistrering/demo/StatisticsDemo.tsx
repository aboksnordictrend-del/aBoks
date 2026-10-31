'use client'

import dynamic from 'next/dynamic'
import { DELIVERY_UNIT_LABELS } from '@/lib/miljo/constants'
import { formatDayKey } from '@/lib/miljo/period'
import { formatNo } from '../../miljo/[code]/clientUtils'
import real from '../../miljo/[code]/miljo.module.css'
import { DEMO_CATEGORIES, DEMO_ORG_NAME } from './demoModel'
import { useDemo } from './DemoProvider'
import DemoBadge from './DemoBadge'
import styles from './demo.module.css'

// The real chart, loaded only in the browser — Recharts never weighs on the rest of the page.
const TrendChart = dynamic(() => import('../../miljo/[code]/TrendChart'), {
  ssr: false,
  loading: () => <p className={real.loading}>Laster diagram …</p>,
})

const qty = (n: number, unit: 'kg' | 'stk') => `${formatNo(n, unit === 'kg' ? 2 : 0)} ${DELIVERY_UNIT_LABELS[unit]}`

/**
 * «Miljøstatistikk» for the fictional organisation — the real panel's two cards (see
 * ../../miljo/[code]/StatisticsPanel.tsx), fed by the demo state instead of the statistics API.
 * Registrations and deliveries stay in separate cards and are never added together; kg and stk.
 * are separate figures and never converted.
 */
export default function StatisticsDemo() {
  const { stats, lastChange, reset } = useDemo()
  const { registrations, deliveries, trend, deliveryRows, period } = stats
  const max = Math.max(1, ...DEMO_CATEGORIES.map((c) => registrations.byCategory[c.value]))

  return (
    <div>
      <section className={real.card} aria-labelledby="demo-stat-tittel">
        <div className={styles.statsHead}>
          <div>
            <DemoBadge>Eksempeldata – DEMO</DemoBadge>
            <h3 className={real.title} id="demo-stat-tittel" style={{ marginTop: 12 }}>
              Miljøstatistikk – {DEMO_ORG_NAME}
            </h3>
            <p className={real.periodLabel} style={{ margin: 0 }}>
              Periode: {formatDayKey(period.fromKey)}–{formatDayKey(period.toKey)} (siste 12 måneder)
            </p>
          </div>
          <button type="button" className={real.secondary} onClick={reset}>
            Nullstill demo
          </button>
        </div>
        <div aria-live="polite" aria-atomic="true">
          {lastChange && (
            <p key={lastChange.at} className={styles.update}>
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {lastChange.text}. Statistikken er oppdatert.
            </p>
          )}
        </div>
      </section>

      <div className={styles.statsGrid}>
        <section className={real.card} aria-labelledby="demo-registrerte-tittel">
          <div className={real.sectionHead}>
            <h4 className={real.subTitle} id="demo-registrerte-tittel" style={{ margin: 0 }}>
              Registrerte batterier
            </h4>
            <span className={real.badge}>Egenrapportert</span>
          </div>
          <p className={real.small} style={{ marginTop: 4 }}>
            Antall som ansatte selv har registrert via QR-koden. Ikke kontrollert.
          </p>
          <div className={real.kpis} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className={real.kpi}>
              <p className={real.kpiLabel}>Registrerte batterier</p>
              <p className={real.kpiValue}>{formatNo(registrations.total)}</p>
            </div>
            <div className={real.kpi}>
              <p className={real.kpiLabel}>Registreringer</p>
              <p className={real.kpiValue}>{formatNo(registrations.registrations)}</p>
            </div>
          </div>
          <div className={real.bars}>
            {DEMO_CATEGORIES.map((c) => {
              const n = registrations.byCategory[c.value]
              return (
                <div key={c.value} className={real.bar}>
                  <span>{c.label}</span>
                  <span className={real.barTrack} aria-hidden="true">
                    <span className={real.barFill} style={{ width: `${(n / max) * 100}%`, display: 'block' }} />
                  </span>
                  <span className={real.barValue}>{formatNo(n)}</span>
                </div>
              )
            })}
          </div>
          <div className={real.chart} aria-hidden="true">
            <TrendChart points={trend} series={DEMO_CATEGORIES} />
          </div>
          <details className={real.chartDetails}>
            <summary>Vis utviklingen som tabell</summary>
            <div className={real.tableWrap}>
              <table className={real.table}>
                <caption className={real.srOnly}>Registrerte batterier per måned</caption>
                <thead>
                  <tr>
                    <th scope="col">Periode</th>
                    {DEMO_CATEGORIES.map((c) => (
                      <th key={c.value} scope="col" className={real.num}>
                        {c.label}
                      </th>
                    ))}
                    <th scope="col" className={real.num}>
                      Totalt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trend
                    .filter((p) => p.total > 0)
                    .map((p) => (
                      <tr key={p.key}>
                        <th scope="row">{p.label}</th>
                        {DEMO_CATEGORIES.map((c) => (
                          <td key={c.value} className={real.num}>
                            {formatNo(p[c.value])}
                          </td>
                        ))}
                        <td className={real.num}>{formatNo(p.total)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className={`${real.card} ${real.deliveredCard}`} aria-labelledby="demo-leverte-tittel">
          <div className={real.sectionHead}>
            <h4 className={real.subTitle} id="demo-leverte-tittel" style={{ margin: 0 }}>
              Leverte batterier
            </h4>
            <span className={`${real.badge} ${real.badgeDelivered}`}>Faktiske leveranser</span>
          </div>
          <p className={real.small} style={{ marginTop: 4 }}>
            Leveranser til mottak eller avfallsselskap, registrert av ansvarlig medarbeider. Kilo og stk. vises hver for seg og
            regnes ikke om.
          </p>
          {deliveries.deliveries === 0 ? (
            <p className={real.empty}>Ingen leveranser er registrert i perioden.</p>
          ) : (
            <>
              <div className={real.kpis} style={{ gridTemplateColumns: '1fr 1fr' }}>
                {(['kg', 'stk'] as const).map((u) => (
                  <div key={u} className={real.kpi}>
                    <p className={real.kpiLabel}>Levert ({DELIVERY_UNIT_LABELS[u]})</p>
                    <p className={real.kpiValue}>{qty(deliveries.byUnit[u].quantity, u)}</p>
                  </div>
                ))}
                <div className={real.kpi}>
                  <p className={real.kpiLabel}>Leveranser</p>
                  <p className={real.kpiValue}>{formatNo(deliveries.deliveries)}</p>
                </div>
                <div className={real.kpi}>
                  <p className={real.kpiLabel}>Med kvittering</p>
                  <p className={real.kpiValue}>{formatNo(deliveries.documented)}</p>
                </div>
              </div>
              <div className={real.tableWrap}>
                <table className={real.table}>
                  <caption className={real.srOnly}>Leveranser i perioden</caption>
                  <thead>
                    <tr>
                      <th scope="col">Dato</th>
                      <th scope="col" className={real.num}>
                        Mengde
                      </th>
                      <th scope="col">Mottak</th>
                      <th scope="col">Dokumentasjon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryRows.map((d, i) => (
                      <tr key={`${d.deliveryDate}-${i}`}>
                        <td>{formatDayKey(d.deliveryDate)}</td>
                        <td className={real.num}>{qty(d.quantity, d.unit)}</td>
                        <td>{d.operator}</td>
                        <td>{d.documentation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <p className={styles.notSummed}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
        Registrerte og leverte batterier er to ulike målinger. De legges aldri sammen, og kilo regnes aldri om til antall.
      </p>
    </div>
  )
}
