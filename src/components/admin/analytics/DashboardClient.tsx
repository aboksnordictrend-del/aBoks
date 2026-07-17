'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './dashboard.module.css'
import TimelineChart, { type ChartMetric } from './TimelineChart'
import {
  formatInt,
  formatNOK,
  formatPercent,
  formatSignedPercent,
} from '../../../lib/analytics/money'
import type { Grouping, PresetKey } from '../../../lib/analytics/period'
import type {
  AnalyticsResponse,
  ComparisonEntry,
  ProductRow,
  Summary,
} from '../../../lib/analytics/types'

const API = '/api/analytics'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: 'I dag' },
  { key: 'yesterday', label: 'I går' },
  { key: 'last7', label: 'Siste 7 dager' },
  { key: 'last30', label: 'Siste 30 dager' },
  { key: 'thisMonth', label: 'Denne måneden' },
  { key: 'lastMonth', label: 'Forrige måned' },
  { key: 'thisYear', label: 'I år' },
  { key: 'custom', label: 'Egendefinert' },
]

const GROUPINGS: { key: Grouping; label: string }[] = [
  { key: 'day', label: 'Dag' },
  { key: 'week', label: 'Uke' },
  { key: 'month', label: 'Måned' },
]

type Fmt = 'money' | 'int' | 'percent'

interface KpiDef {
  key: keyof Summary
  label: string
  fmt: Fmt
  color: string
  higherIsBetter: boolean
  hint?: string
}

const KPIS: KpiDef[] = [
  { key: 'orderCount', label: 'Ordre', fmt: 'int', color: '#8b5cf6', higherIsBetter: true },
  { key: 'revenueGross', label: 'Omsetning', fmt: 'money', color: '#3b82f6', higherIsBetter: true, hint: 'Betalt av kunder, inkl. frakt' },
  { key: 'averageOrderValue', label: 'Gj.snittsordre', fmt: 'money', color: '#3b82f6', higherIsBetter: true },
  { key: 'unitsSold', label: 'Solgte enheter', fmt: 'int', color: '#0ea5e9', higherIsBetter: true },
  { key: 'productCost', label: 'Vareforbruk', fmt: 'money', color: '#f97316', higherIsBetter: false, hint: 'Kostpris (kostnad for solgte varer)' },
  { key: 'grossProfit', label: 'Bruttofortjeneste', fmt: 'money', color: '#22c55e', higherIsBetter: true, hint: 'Fra omsetning ekskl. MVA' },
  { key: 'marginPercent', label: 'Margin', fmt: 'percent', color: '#22c55e', higherIsBetter: true },
  { key: 'shippingCharged', label: 'Frakt betalt av kunder', fmt: 'money', color: '#0ea5e9', higherIsBetter: true },
  { key: 'actualShippingCost', label: 'Faktisk fraktkostnad', fmt: 'money', color: '#f97316', higherIsBetter: false },
  { key: 'paymentFees', label: 'Betalingsgebyr', fmt: 'money', color: '#f97316', higherIsBetter: false },
  { key: 'adSpend', label: 'Annonsekostnad', fmt: 'money', color: '#f97316', higherIsBetter: false },
  { key: 'contributionProfit', label: 'Resultat etter variable kostnader', fmt: 'money', color: '#16a34a', higherIsBetter: true, hint: 'Ekskl. faste kostnader (lønn, husleie osv.)' },
]

// Categorical palette for the variant breakdown (fixed order, not cycled beyond it).
const VARIANT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']
const VARIANT_FALLBACK = '#94a3b8'

/* ------------------------------ Icons (inline SVG, currentColor) ------------------------------ */

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const KPI_ICONS: Record<keyof Summary, ReactNode> = {
  orderCount: svg(<><path d="M6 7h12l-1 12H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
  revenueGross: svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
  averageOrderValue: svg(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>),
  unitsSold: svg(<><path d="M12 3l8 4-8 4-8-4 8-4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>),
  productCost: svg(<><path d="M4 4h8l8 8-8 8-8-8V4z" /><circle cx="8" cy="8" r="1.1" /></>),
  grossProfit: svg(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  marginPercent: svg(<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>),
  shippingCharged: svg(<><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></>),
  actualShippingCost: svg(<><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></>),
  shippingResult: svg(<><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></>),
  paymentFees: svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>),
  vatAmount: svg(<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>),
  revenueNet: svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
  adSpend: svg(<><path d="M3 11v2l14 5V6L3 11z" /><path d="M17 9a3 3 0 0 1 0 6M7 14v4" /></>),
  contributionProfit: svg(<><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /><path d="M16 12h.01M3 8l4-4h10" /></>),
}

function TrendIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {up ? <><path d="M5 15l7-7 7 7" /></> : <><path d="M5 9l7 7 7-7" /></>}
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 4v5h-5" />
    </svg>
  )
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  pending: { label: 'Venter', color: '#f59e0b' },
  confirmed: { label: 'Bekreftet', color: '#22c55e' },
  shipped: { label: 'Sendt', color: '#3b82f6' },
  delivered: { label: 'Levert', color: '#8b5cf6' },
  cancelled: { label: 'Kansellert', color: '#ef4444' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, color: '#94a3b8' }
  return (
    <span className={styles.badge} style={{ ['--badge' as string]: s.color }}>
      <span className={styles.badgeDot} />
      {s.label}
    </span>
  )
}

function fmtValue(value: number, fmt: Fmt): string {
  if (fmt === 'money') return formatNOK(value)
  if (fmt === 'percent') return formatPercent(value)
  return formatInt(value)
}

function todayIso(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export default function DashboardClient() {
  const [preset, setPreset] = useState<PresetKey>('last30')
  const [customFrom, setCustomFrom] = useState(todayIso(-29))
  const [customTo, setCustomTo] = useState(todayIso(0))
  const [paidOnly, setPaidOnly] = useState(true)
  const [groupingOverride, setGroupingOverride] = useState<Grouping | ''>('')
  const [metric, setMetric] = useState<ChartMetric>('revenue')

  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reqId = useRef(0)

  const queryString = useCallback(() => {
    const p = new URLSearchParams()
    p.set('preset', preset)
    p.set('paidOnly', String(paidOnly))
    if (groupingOverride) p.set('grouping', groupingOverride)
    if (preset === 'custom') {
      p.set('from', customFrom)
      p.set('to', customTo)
    }
    return p.toString()
  }, [preset, paidOnly, groupingOverride, customFrom, customTo])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API}?${queryString()}`, { credentials: 'include' })
      const body = await res.json().catch(() => ({}))
      if (id !== reqId.current) return // a newer request superseded this one
      if (!res.ok) {
        setError(body?.error ?? `Feil (${res.status})`)
        setData(null)
      } else {
        setData(body as AnalyticsResponse)
      }
    } catch {
      if (id === reqId.current) setError('Nettverksfeil. Prøv igjen.')
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    // For custom, wait until both dates are valid and ordered.
    if (preset === 'custom' && (!customFrom || !customTo || customFrom > customTo)) return
    load()
  }, [load, preset, customFrom, customTo])

  const downloadCsv = useCallback(
    async (type: 'products' | 'orders') => {
      const res = await fetch(`${API}?${queryString()}&format=csv&type=${type}`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aboks-${type}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
    [queryString],
  )

  const grouping = data?.period.grouping
  const dateInvalid = preset === 'custom' && customFrom > customTo

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Analyse</h1>
          <p className={styles.subtitle}>Salg, fortjeneste og margin for nettbutikken</p>
        </div>
        <div className={styles.toolbar}>
          <button
            className={`${styles.btn} ${styles.refreshBtn}`}
            onClick={() => load()}
            type="button"
            disabled={loading}
            title="Hent data på nytt"
          >
            <span className={loading ? styles.spin : undefined}>
              <RefreshIcon />
            </span>
            Oppdater
          </button>
          <button className={styles.btn} onClick={() => downloadCsv('products')} type="button">
            Eksporter produkter (CSV)
          </button>
          <button className={styles.btn} onClick={() => downloadCsv('orders')} type="button">
            Eksporter ordre (CSV)
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.toolbar}>
        <div className={styles.segmented}>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`${styles.segItem} ${preset === p.key ? styles.segItemActive : ''}`}
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <>
            <input
              type="date"
              className={styles.dateInput}
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span style={{ opacity: 0.5 }}>–</span>
            <input
              type="date"
              className={styles.dateInput}
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </>
        )}

        <div className={styles.spacer} />

        <div className={styles.segmented}>
          <button
            type="button"
            className={`${styles.segItem} ${paidOnly ? styles.segItemActive : ''}`}
            onClick={() => setPaidOnly(true)}
          >
            Betalte ordre
          </button>
          <button
            type="button"
            className={`${styles.segItem} ${!paidOnly ? styles.segItemActive : ''}`}
            onClick={() => setPaidOnly(false)}
          >
            Alle ordre
          </button>
        </div>
      </div>

      {dateInvalid && (
        <div className={styles.warn}>Startdato kan ikke være etter sluttdato.</div>
      )}

      {error && !loading ? (
        <div className={styles.errorBox}>
          <strong>{error}</strong>
          <button className={styles.btn} onClick={() => load()} type="button">
            Prøv igjen
          </button>
        </div>
      ) : loading || !data ? (
        <SkeletonDashboard />
      ) : (
        <>
          <KpiGrid summary={data.summary} comparison={data.comparison} />

          {/* Timeline */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Utvikling over tid</h2>
              <div className={styles.toolbar}>
                <div className={styles.segmented}>
                  {(['revenue', 'orders', 'grossProfit'] as ChartMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.segItem} ${metric === m ? styles.segItemActive : ''}`}
                      onClick={() => setMetric(m)}
                    >
                      {m === 'revenue' ? 'Omsetning' : m === 'orders' ? 'Ordre' : 'Bruttofortjeneste'}
                    </button>
                  ))}
                </div>
                <select
                  className={styles.select}
                  value={groupingOverride || grouping || 'day'}
                  onChange={(e) => setGroupingOverride(e.target.value as Grouping)}
                >
                  {GROUPINGS.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={`${styles.card} ${styles.chartCard}`}>
              {data.timeline.length === 0 ? (
                <div className={styles.empty}>Ingen data i perioden.</div>
              ) : (
                <div className={styles.chartWrap}>
                  <TimelineChart data={data.timeline} metric={metric} />
                </div>
              )}
            </div>
          </section>

          <div className={styles.cols2}>
            <ProductsTable products={data.products} />
            <VariantsBlock variants={data.variants} />
          </div>

          <RecentOrders orders={data.recentOrders} />

          {data.warnings.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Merknader om datagrunnlag</h2>
              {data.warnings.map((w) => (
                <div key={w.code} className={styles.warn}>
                  <span aria-hidden>⚠️</span>
                  <span>{w.message}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------ KPI grid ------------------------------ */

function KpiCard({ def, entry }: { def: KpiDef; entry: ComparisonEntry }) {
  const { changePercent } = entry
  const favorable =
    changePercent == null
      ? null
      : def.higherIsBetter
        ? changePercent >= 0
        : changePercent <= 0
  const deltaColor =
    favorable == null ? 'var(--muted)' : favorable ? 'var(--pos)' : 'var(--neg)'

  return (
    <div className={styles.kpiCard} style={{ ['--accent' as string]: def.color }}>
      <div className={styles.kpiHead}>
        <span className={styles.kpiIcon}>{KPI_ICONS[def.key]}</span>
        <span className={styles.kpiName}>{def.label}</span>
      </div>
      <div className={styles.kpiValue}>{fmtValue(entry.current, def.fmt)}</div>
      <div className={styles.kpiDelta} style={{ color: deltaColor }}>
        {changePercent == null ? (
          <span>— mot forrige periode</span>
        ) : (
          <>
            <TrendIcon up={changePercent >= 0} />
            {formatSignedPercent(changePercent)} mot forrige periode
          </>
        )}
      </div>
      {def.hint && <div className={styles.kpiHint}>{def.hint}</div>}
    </div>
  )
}

function KpiGrid({
  summary,
  comparison,
}: {
  summary: Summary
  comparison: AnalyticsResponse['comparison']
}) {
  return (
    <div className={styles.kpiGrid}>
      {KPIS.map((def) => (
        <KpiCard key={def.key} def={def} entry={comparison[def.key]} />
      ))}
    </div>
  )
}

/* ------------------------------ Products table ------------------------------ */

type SortKey = 'productName' | 'unitsSold' | 'revenueGross' | 'cost' | 'grossProfit' | 'marginPercent' | 'revenueShare'

function ProductsTable({ products }: { products: ProductRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('revenueGross')
  const [asc, setAsc] = useState(false)

  const sorted = useMemo(() => {
    const rows = [...products]
    rows.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp =
        typeof av === 'string' && typeof bv === 'string'
          ? av.localeCompare(bv)
          : (av as number) - (bv as number)
      return asc ? cmp : -cmp
    })
    return rows
  }, [products, sortKey, asc])

  const onSort = (key: SortKey) => {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(false)
    }
  }
  const arrow = (key: SortKey) => (key === sortKey ? (asc ? ' ▲' : ' ▼') : '')

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Salg per produkt</h2>
      <div className={styles.card}>
        {products.length === 0 ? (
          <div className={styles.empty}>Ingen salg i perioden.</div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => onSort('productName')}>Produkt / variant{arrow('productName')}</th>
                  <th onClick={() => onSort('unitsSold')}>Antall{arrow('unitsSold')}</th>
                  <th onClick={() => onSort('revenueGross')}>Omsetning{arrow('revenueGross')}</th>
                  <th onClick={() => onSort('cost')}>Kostpris{arrow('cost')}</th>
                  <th onClick={() => onSort('grossProfit')}>Fortjeneste{arrow('grossProfit')}</th>
                  <th onClick={() => onSort('marginPercent')}>Margin{arrow('marginPercent')}</th>
                  <th onClick={() => onSort('revenueShare')}>Andel{arrow('revenueShare')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.key}>
                    <td>
                      {p.productName}
                      {p.variantName ? ` · ${p.variantName}` : ''}
                      {p.costEstimated && (
                        <span title="Kostpris mangler – estimert" style={{ opacity: 0.6 }}> *</span>
                      )}
                    </td>
                    <td>{formatInt(p.unitsSold)}</td>
                    <td>{formatNOK(p.revenueGross)}</td>
                    <td>{formatNOK(p.cost)}</td>
                    <td>{formatNOK(p.grossProfit)}</td>
                    <td>{formatPercent(p.marginPercent)}</td>
                    <td>{formatPercent(p.revenueShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ Variants ------------------------------ */

function VariantsBlock({ variants }: { variants: AnalyticsResponse['variants'] }) {
  const max = variants.reduce((m, v) => Math.max(m, v.unitsSold), 0)
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Salg per variant</h2>
      <div className={styles.card}>
        {variants.length === 0 ? (
          <div className={styles.empty}>Ingen salg i perioden.</div>
        ) : (
          <div className={styles.barList}>
            {variants.map((v, i) => (
              <div key={v.variantName} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span
                    className={styles.barSwatch}
                    style={{ background: v.colorHex ?? VARIANT_COLORS[i] ?? VARIANT_FALLBACK }}
                  />
                  <span title={v.variantName} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.variantName}
                  </span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${max > 0 ? (v.unitsSold / max) * 100 : 0}%`,
                      background: v.colorHex ?? VARIANT_COLORS[i] ?? VARIANT_FALLBACK,
                    }}
                  />
                </div>
                <div className={styles.barValue}>
                  {formatInt(v.unitsSold)} ({formatPercent(v.unitsShare)})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ Recent orders ------------------------------ */

function RecentOrders({ orders }: { orders: AnalyticsResponse['recentOrders'] }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Siste betalte ordre</h2>
      <div className={styles.card}>
        {orders.length === 0 ? (
          <div className={styles.empty}>Ingen ordre i perioden.</div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ordre</th>
                  <th>Dato</th>
                  <th>Status</th>
                  <th>Antall</th>
                  <th>Sum</th>
                  <th>Fortjeneste</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a className={styles.link} href={`/admin/collections/orders/${o.id}`}>
                        {o.orderNumber}
                      </a>
                    </td>
                    <td>{o.date.slice(0, 10)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{formatInt(o.unitsSold)}</td>
                    <td>{formatNOK(o.revenueGross)}</td>
                    <td>{formatNOK(o.grossProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ Skeleton ------------------------------ */

function SkeletonDashboard() {
  return (
    <>
      <div className={styles.kpiGrid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.skeleton} style={{ height: 12, width: '55%' }} />
            <div className={styles.skeleton} style={{ height: 26, width: '70%', marginTop: 12 }} />
            <div className={styles.skeleton} style={{ height: 10, width: '45%', marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className={`${styles.card} ${styles.chartCard}`}>
        <div className={styles.skeleton} style={{ height: 280, width: '100%' }} />
      </div>
    </>
  )
}
