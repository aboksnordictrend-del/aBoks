'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { PublicStatistics } from '@/lib/miljo/service'
import { DELIVERY_UNIT_LABELS } from '@/lib/miljo/constants'
import { formatDayKey, MILJO_PRESET_LABELS, type MiljoPreset } from '@/lib/miljo/period'
import { formatNo } from './clientUtils'
import styles from './miljo.module.css'

const TrendChart = dynamic(() => import('./TrendChart'), {
  ssr: false,
  loading: () => <p className={styles.loading}>Laster diagram …</p>,
})

const PRESETS: MiljoPreset[] = ['thisMonth', 'thisYear', 'lastYear', 'custom']

const CSV_OPTIONS = [
  { value: 'sammendrag', label: 'Sammendrag per periode' },
  { value: 'registreringer', label: 'Registreringer' },
  { value: 'leveranser', label: 'Leveranser' },
] as const

type Query = { preset: MiljoPreset; from?: string; to?: string }

const qs = (q: Query) => {
  const p = new URLSearchParams({ preset: q.preset })
  if (q.preset === 'custom' && q.from && q.to) {
    p.set('from', q.from)
    p.set('to', q.to)
  }
  return p.toString()
}

const qty = (n: number, unit: 'kg' | 'stk') => `${formatNo(n, unit === 'kg' ? 2 : 0)} ${DELIVERY_UNIT_LABELS[unit]}`

/**
 * «Miljøstatistikk» — the organisation's aggregated, public reporting figures. Registrations
 * (self-reported counts) and deliveries (actual, per unit) are shown in separate, differently
 * marked cards and are never added together. Exports use exactly the selected period.
 */
export default function StatisticsPanel({ code }: { code: string }) {
  const [query, setQuery] = useState<Query>({ preset: 'thisYear' })
  const [draft, setDraft] = useState({ from: '', to: '' })
  const [data, setData] = useState<PublicStatistics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [csvType, setCsvType] = useState<(typeof CSV_OPTIONS)[number]['value']>('sammendrag')

  const load = useCallback(
    async (q: Query) => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/miljo/${encodeURIComponent(code)}/statistikk?${qs(q)}`, { cache: 'no-store' })
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || 'Kunne ikke hente statistikken.')
        setData(body as PublicStatistics)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke hente statistikken.')
      } finally {
        setLoading(false)
      }
    },
    [code],
  )

  useEffect(() => {
    if (query.preset !== 'custom') void load(query)
  }, [query, load])

  const choose = (preset: MiljoPreset) => {
    if (preset === 'custom') {
      const today = new Date().toISOString().slice(0, 10)
      setDraft((d) => ({ from: d.from || `${today.slice(0, 4)}-01-01`, to: d.to || today }))
      setQuery({ preset: 'custom' })
      return
    }
    setQuery({ preset })
  }

  const applyCustom = () => {
    if (!draft.from || !draft.to) return setError('Velg både fra- og til-dato.')
    if (draft.from > draft.to) return setError('Fra-dato kan ikke være etter til-dato.')
    const q = { preset: 'custom' as const, from: draft.from, to: draft.to }
    setQuery(q)
    void load(q)
  }

  const exportQuery = data ? qs({ preset: query.preset, from: data.period.fromKey, to: data.period.toKey }) : ''
  const base = `/api/miljo/${encodeURIComponent(code)}/eksport`
  const max = data ? Math.max(1, ...data.categories.map((c) => data.registrations.byCategory[c.value])) : 1
  const units = data ? (['kg', 'stk'] as const).filter((u) => data.deliveries.byUnit[u].deliveries > 0) : []

  return (
    <div>
      <section className={styles.card} aria-labelledby="periode-tittel">
        <h2 className={styles.title} id="periode-tittel">
          Miljøstatistikk
        </h2>
        <div className={styles.periods} role="group" aria-label="Rapportperiode">
          {PRESETS.map((p) => (
            <button key={p} type="button" className={styles.period} aria-pressed={query.preset === p} onClick={() => choose(p)}>
              {MILJO_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {query.preset === 'custom' && (
          <div className={styles.custom}>
            <label className={styles.field} style={{ marginTop: 0 }}>
              <span className={styles.label}>Fra</span>
              <input type="date" className={styles.input} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            </label>
            <label className={styles.field} style={{ marginTop: 0 }}>
              <span className={styles.label}>Til</span>
              <input type="date" className={styles.input} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </label>
            <button type="button" className={styles.secondary} onClick={applyCustom}>
              Vis periode
            </button>
          </div>
        )}
        {data && (
          <p className={styles.periodLabel}>
            Periode: {formatDayKey(data.period.fromKey)}–{formatDayKey(data.period.toKey)}
          </p>
        )}
        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
        {loading && <p className={styles.loading} role="status">Henter statistikk …</p>}
      </section>

      {data && !loading && (
        <>
          <section className={styles.card} aria-labelledby="registrerte-tittel">
            <div className={styles.sectionHead}>
              <h3 className={styles.subTitle} id="registrerte-tittel" style={{ margin: 0 }}>
                Registrerte batterier
              </h3>
              <span className={styles.badge}>Egenrapportert</span>
            </div>
            <p className={styles.small} style={{ marginTop: 4 }}>
              Antall som ansatte selv har registrert via QR-koden. Ikke kontrollert.
            </p>
            <div className={styles.kpis}>
              <div className={styles.kpi}>
                <p className={styles.kpiLabel}>Registrerte batterier</p>
                <p className={styles.kpiValue}>{formatNo(data.registrations.total)}</p>
              </div>
              <div className={styles.kpi}>
                <p className={styles.kpiLabel}>Registreringer</p>
                <p className={styles.kpiValue}>{formatNo(data.registrations.registrations)}</p>
              </div>
            </div>
            <div className={styles.bars}>
              {data.categories.map((c) => {
                const n = data.registrations.byCategory[c.value]
                return (
                  <div key={c.value} className={styles.bar}>
                    <span>{c.label}</span>
                    <span className={styles.barTrack} aria-hidden="true">
                      <span className={styles.barFill} style={{ width: `${(n / max) * 100}%`, display: 'block' }} />
                    </span>
                    <span className={styles.barValue}>{formatNo(n)}</span>
                  </div>
                )
              })}
            </div>
            {data.registrations.total > 0 && data.trend.length > 1 && (
              <>
                <div className={styles.chart} aria-hidden="true">
                  <TrendChart points={data.trend} series={data.categories} />
                </div>
                <details className={styles.chartDetails}>
                  <summary>Vis utviklingen som tabell</summary>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <caption className={styles.srOnly}>Registrerte batterier per periode</caption>
                      <thead>
                        <tr>
                          <th scope="col">Periode</th>
                          {data.categories.map((c) => (
                            <th key={c.value} scope="col" className={styles.num}>
                              {c.label}
                            </th>
                          ))}
                          <th scope="col" className={styles.num}>
                            Totalt
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.trend
                          .filter((p) => p.total > 0)
                          .map((p) => (
                            <tr key={p.key}>
                              <th scope="row">{p.label}</th>
                              {data.categories.map((c) => (
                                <td key={c.value} className={styles.num}>
                                  {formatNo(p[c.value])}
                                </td>
                              ))}
                              <td className={styles.num}>{formatNo(p.total)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
            {data.registrations.total === 0 && <p className={styles.empty}>Ingen registreringer i perioden.</p>}
          </section>

          <section className={`${styles.card} ${styles.deliveredCard}`} aria-labelledby="leverte-tittel">
            <div className={styles.sectionHead}>
              <h3 className={styles.subTitle} id="leverte-tittel" style={{ margin: 0 }}>
                Leverte batterier
              </h3>
              <span className={`${styles.badge} ${styles.badgeDelivered}`}>Faktiske leveranser</span>
            </div>
            <p className={styles.small} style={{ marginTop: 4 }}>
              Leveranser til mottak eller avfallsselskap, registrert av organisasjonens ansvarlige. Kilo og stk. vises hver
              for seg og regnes ikke om.
            </p>
            {data.deliveries.deliveries === 0 ? (
              <p className={styles.empty}>Ingen leveranser er registrert i perioden.</p>
            ) : (
              <>
                <div className={styles.kpis}>
                  {units.map((u) => (
                    <div key={u} className={styles.kpi}>
                      <p className={styles.kpiLabel}>Levert ({DELIVERY_UNIT_LABELS[u]})</p>
                      <p className={styles.kpiValue}>{qty(data.deliveries.byUnit[u].quantity, u)}</p>
                    </div>
                  ))}
                  <div className={styles.kpi}>
                    <p className={styles.kpiLabel}>Leveranser</p>
                    <p className={styles.kpiValue}>{formatNo(data.deliveries.deliveries)}</p>
                  </div>
                  <div className={styles.kpi}>
                    <p className={styles.kpiLabel}>Med kvittering</p>
                    <p className={styles.kpiValue}>{formatNo(data.deliveries.documented)}</p>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.srOnly}>Leveranser i perioden</caption>
                    <thead>
                      <tr>
                        <th scope="col">Dato</th>
                        <th scope="col" className={styles.num}>
                          Mengde
                        </th>
                        <th scope="col">Mottak</th>
                        <th scope="col">Dokumentasjon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deliveryRows.map((d, i) => (
                        <tr key={`${d.deliveryDate}-${i}`}>
                          <td>{formatDayKey(d.deliveryDate)}</td>
                          <td className={styles.num}>{qty(d.quantity, d.unit)}</td>
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

          <section className={styles.card} aria-labelledby="eksport-tittel">
            <h3 className={styles.subTitle} id="eksport-tittel">
              Eksport
            </h3>
            <p className={styles.small} style={{ marginTop: 0, marginBottom: 12 }}>
              Filene gjelder perioden over. Registrerte batterier er egenrapportert og dokumenterer ikke gjenvinning.
            </p>
            <div className={styles.exports}>
              <a className={styles.submit} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginTop: 0 }} href={`${base}?format=pdf&${exportQuery}`} download>
                Eksporter miljørapport (PDF)
              </a>
              <div className={styles.exportRow}>
                <label className={styles.srOnly} htmlFor="csv-type">
                  Innhold i CSV-filen
                </label>
                <select id="csv-type" className={styles.select} value={csvType} onChange={(e) => setCsvType(e.target.value as typeof csvType)}>
                  {CSV_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <a className={styles.secondary} href={`${base}?format=csv&type=${csvType}&${exportQuery}`} download>
                  Last ned statistikk (CSV)
                </a>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
