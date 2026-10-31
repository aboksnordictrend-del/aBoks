'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CATEGORY_LABELS, DELIVERY_UNIT_LABELS, DOCUMENTATION_LABELS, RECORD_STATUS_OPTIONS, REGISTRATION_FLAG_OPTIONS } from '@/lib/miljo/constants'
import { MILJO_GROUPING_LABELS, MILJO_PRESET_LABELS, MILJO_PRESETS, formatDayKey, type MiljoGrouping, type MiljoPreset } from '@/lib/miljo/period'
import type { CategoryCounts, DeliveryRecord, DeliverySummary, DeliveryTrendPoint, OrganizationRow, RegistrationSummary, TrendPoint } from '@/lib/miljo/stats'
import { osloDateTime } from './adminUi'
import styles from './miljo.module.css'

type Data = {
  period: { preset: MiljoPreset; fromKey: string; toKey: string; grouping: MiljoGrouping }
  organizations: { id: number; name: string; status: string; publicCode: string }[]
  registrations: RegistrationSummary
  invalidatedRegistrations: number
  trend: TrendPoint[]
  deliveries: DeliverySummary
  deliveryTrend: DeliveryTrendPoint[]
  recentDeliveries: DeliveryRecord[]
  perOrganization: OrganizationRow[]
  pendingReview: { id: number; organizationName: string; registeredAt: string; total: number; flags: string[]; status: string }[]
}

const nf = (n: number, d = 0) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: d }).format(n)
const flagLabel = (f: string) => REGISTRATION_FLAG_OPTIONS.find((o) => o.value === f)?.label ?? f
const statusLabel = (s: string) => RECORD_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s
const CATS = ['aa', 'aaa', 'other'] as const
const COLORS: Record<string, string> = { aa: '#3f8a4f', aaa: '#7fb069', other: '#b9a36b' }

/**
 * «Miljøregistrering» dashboard: filters (organisation, period, grouping, include invalidated),
 * registration KPIs + category breakdown + trend, delivery statistics per unit, per-organisation
 * table, the review queue and exports. Registrations (green) and deliveries (blue) are kept in
 * separate sections and never summed.
 */
export default function MiljoClient({ initialOrganization }: { initialOrganization?: string }) {
  const [organization, setOrganization] = useState(initialOrganization ?? 'all')
  const [preset, setPreset] = useState<MiljoPreset>('thisYear')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [grouping, setGrouping] = useState<'auto' | MiljoGrouping>('auto')
  const [includeInvalidated, setIncludeInvalidated] = useState(false)
  const [csvType, setCsvType] = useState('sammendrag')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const params = useCallback(() => {
    const p = new URLSearchParams({ organization, preset })
    if (preset === 'custom') {
      p.set('from', from)
      p.set('to', to)
    }
    if (grouping !== 'auto') p.set('grouping', grouping)
    if (includeInvalidated) p.set('includeInvalidated', '1')
    return p
  }, [organization, preset, from, to, grouping, includeInvalidated])

  useEffect(() => {
    if (preset === 'custom' && (!from || !to)) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/miljo-analytics?${params().toString()}`, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body?.error || 'Kunne ikke hente data.')
        if (!cancelled) setData(body as Data)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Kunne ikke hente data.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [params, preset, from, to])

  const exportHref = (format: 'csv' | 'pdf') => {
    const p = params()
    p.delete('includeInvalidated')
    p.set('format', format)
    if (format === 'csv') p.set('type', csvType)
    return `/api/miljo-analytics?${p.toString()}`
  }

  const counts: CategoryCounts | null = data?.registrations.byCategory ?? null
  const shownCats = CATS.filter((c) => (counts ? counts[c] > 0 : false) || c !== 'other')
  const maxCat = counts ? Math.max(1, ...CATS.map((c) => counts[c])) : 1

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Miljøregistrering</h1>
          <p className={styles.subtitle}>
            Registrerte batterier er egenrapportert av ansatte via QR-koden. Leverte batterier er registrert av organisasjonens
            ansvarlige med PIN, i kilo eller stk. De to tallene vises hver for seg og legges aldri sammen.
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.field}>
          Organisasjon
          <select className={styles.select} value={organization} onChange={(e) => setOrganization(e.target.value)}>
            <option value="all">Alle organisasjoner</option>
            {data?.organizations.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.name}
                {o.status !== 'active' ? ' (inaktiv)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Periode
          <select className={styles.select} value={preset} onChange={(e) => setPreset(e.target.value as MiljoPreset)}>
            {MILJO_PRESETS.map((p) => (
              <option key={p} value={p}>
                {MILJO_PRESET_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label className={styles.field}>
              Fra
              <input type="date" className={styles.dateInput} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className={styles.field}>
              Til
              <input type="date" className={styles.dateInput} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        <label className={styles.field}>
          Gruppering
          <select className={styles.select} value={grouping} onChange={(e) => setGrouping(e.target.value as typeof grouping)}>
            <option value="auto">Automatisk</option>
            {(['day', 'month', 'year'] as const).map((g) => (
              <option key={g} value={g}>
                {MILJO_GROUPING_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={includeInvalidated} onChange={(e) => setIncludeInvalidated(e.target.checked)} />
          Vis ugyldiggjorte i listene
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && !data && <p className={styles.note}>Henter …</p>}

      {data && (
        <>
          <p className={styles.note}>
            Periode {formatDayKey(data.period.fromKey)}–{formatDayKey(data.period.toKey)} · gruppert per {MILJO_GROUPING_LABELS[data.period.grouping].toLowerCase()}
            {loading ? ' · oppdaterer …' : ''}
          </p>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 className={styles.sectionTitle}>
              Registrerte batterier <span className={`${styles.tag} ${styles.tagReg}`}>Egenrapportert</span>
            </h2>
            <div className={styles.kpis}>
              <div className={`${styles.kpi} ${styles.kpiReg}`}>
                <p className={styles.kpiLabel}>Registrerte batterier</p>
                <p className={styles.kpiValue}>{nf(data.registrations.total)}</p>
              </div>
              <div className={`${styles.kpi} ${styles.kpiReg}`}>
                <p className={styles.kpiLabel}>Registreringer</p>
                <p className={styles.kpiValue}>{nf(data.registrations.registrations)}</p>
              </div>
              <div className={`${styles.kpi} ${styles.kpiReg}`}>
                <p className={styles.kpiLabel}>Snitt per registrering</p>
                <p className={styles.kpiValue}>{data.registrations.registrations ? nf(data.registrations.total / data.registrations.registrations, 1) : '–'}</p>
              </div>
              <div className={`${styles.kpi} ${styles.kpiReg}`}>
                <p className={styles.kpiLabel}>Til gjennomgang</p>
                <p className={styles.kpiValue}>{nf(data.pendingReview.length)}</p>
              </div>
            </div>
            <div className={styles.grid}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Per batteritype</p>
                <ul className={styles.bars}>
                  {shownCats.map((c) => (
                    <li key={c} className={styles.barRow}>
                      <span>{CATEGORY_LABELS[c]}</span>
                      <span className={styles.barTrack}>
                        <span className={styles.barFill} style={{ width: `${(data.registrations.byCategory[c] / maxCat) * 100}%`, display: 'block' }} />
                      </span>
                      <span className={styles.num}>{nf(data.registrations.byCategory[c])}</span>
                    </li>
                  ))}
                </ul>
                {data.invalidatedRegistrations > 0 && <p className={styles.note} style={{ marginTop: '0.6rem' }}>{data.invalidatedRegistrations} ugyldiggjorte registreringer er ikke med i tallene.</p>}
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Utvikling</p>
                <div className={styles.chart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--theme-elevation-100)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--theme-elevation-0)', border: '1px solid var(--theme-elevation-150)', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {shownCats.map((c) => (
                        <Bar key={c} dataKey={c} name={CATEGORY_LABELS[c]} stackId="r" fill={COLORS[c]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 className={styles.sectionTitle}>
              Leverte batterier <span className={`${styles.tag} ${styles.tagDel}`}>Faktiske leveranser</span>
            </h2>
            <div className={styles.kpis}>
              {(['kg', 'stk'] as const).map((u) => (
                <div key={u} className={`${styles.kpi} ${styles.kpiDel}`}>
                  <p className={styles.kpiLabel}>Levert ({DELIVERY_UNIT_LABELS[u]})</p>
                  <p className={styles.kpiValue}>
                    {nf(data.deliveries.byUnit[u].quantity, u === 'kg' ? 2 : 0)} {DELIVERY_UNIT_LABELS[u]}
                  </p>
                  <p className={styles.note}>{data.deliveries.byUnit[u].deliveries} leveranser</p>
                </div>
              ))}
              <div className={`${styles.kpi} ${styles.kpiDel}`}>
                <p className={styles.kpiLabel}>{DOCUMENTATION_LABELS.documented}</p>
                <p className={styles.kpiValue}>{nf(data.deliveries.documented)}</p>
              </div>
              <div className={`${styles.kpi} ${styles.kpiDel}`}>
                <p className={styles.kpiLabel}>{DOCUMENTATION_LABELS.reported}</p>
                <p className={styles.kpiValue}>{nf(data.deliveries.reported)}</p>
              </div>
            </div>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Leveranser</p>
              {data.recentDeliveries.length === 0 ? (
                <p className={styles.note}>Ingen leveranser i perioden.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Dato</th>
                        <th>Organisasjon</th>
                        <th className={styles.num}>Mengde</th>
                        <th>Mottak</th>
                        <th>Dokumentasjon</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentDeliveries.map((d) => (
                        <tr key={d.id} className={d.status === 'invalidated' ? styles.muted : undefined}>
                          <td>
                            <a href={`/admin/collections/battery-deliveries/${d.id}`}>{formatDayKey(d.deliveryDate)}</a>
                          </td>
                          <td>{d.organizationName}</td>
                          <td className={styles.num}>
                            {nf(d.quantity, d.unit === 'kg' ? 2 : 0)} {DELIVERY_UNIT_LABELS[d.unit]}
                          </td>
                          <td>{d.operator}</td>
                          <td>{DOCUMENTATION_LABELS[d.documentationStatus]}</td>
                          <td>{statusLabel(d.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <div className={styles.grid}>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Per organisasjon</p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Organisasjon</th>
                      <th className={styles.num}>Registreringer</th>
                      <th className={styles.num}>Batterier</th>
                      <th className={styles.num}>Levert kg</th>
                      <th className={styles.num}>Levert stk.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perOrganization.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <a href={`/admin/collections/environmental-organizations/${o.id}`}>{o.name}</a>
                          {o.status !== 'active' && <span className={styles.muted}> (inaktiv)</span>}
                        </td>
                        <td className={styles.num}>{nf(o.registrations)}</td>
                        <td className={styles.num}>{nf(o.total)}</td>
                        <td className={styles.num}>{nf(o.kg, 2)}</td>
                        <td className={styles.num}>{nf(o.stk)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.card}>
              <p className={styles.cardTitle}>Til gjennomgang</p>
              {data.pendingReview.length === 0 ? (
                <p className={styles.note}>Ingen registreringer venter på gjennomgang.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Tidspunkt</th>
                        <th>Organisasjon</th>
                        <th className={styles.num}>Antall</th>
                        <th>Merknad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pendingReview.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <a href={`/admin/collections/battery-registrations/${r.id}`}>{osloDateTime(r.registeredAt)}</a>
                          </td>
                          <td>{r.organizationName}</td>
                          <td className={styles.num}>{nf(r.total)}</td>
                          <td>
                            {r.flags.map((f) => (
                              <span key={f} className={styles.flag}>
                                {flagLabel(f)}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <p className={styles.cardTitle}>Eksport</p>
            <div className={styles.toolbar}>
              <a className={`${styles.btn} ${organization === 'all' ? styles.btnDisabled : ''}`} href={organization === 'all' ? undefined : exportHref('pdf')} aria-disabled={organization === 'all'}>
                Eksporter miljørapport (PDF)
              </a>
              <select className={styles.select} value={csvType} onChange={(e) => setCsvType(e.target.value)} aria-label="CSV-innhold">
                <option value="sammendrag">Sammendrag per periode</option>
                <option value="registreringer">Registreringer</option>
                <option value="leveranser">Leveranser</option>
              </select>
              <a className={styles.btn} href={exportHref('csv')}>
                Last ned statistikk (CSV)
              </a>
            </div>
            <p className={styles.note} style={{ marginTop: '0.5rem' }}>
              {organization === 'all' ? 'Velg én organisasjon for PDF-rapporten. ' : ''}Eksportene følger filtrene over og tar aldri med ugyldiggjorte
              poster. Admin-CSV inneholder også status, merknader og referanser.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
