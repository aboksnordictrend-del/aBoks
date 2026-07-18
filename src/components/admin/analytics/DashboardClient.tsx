'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './dashboard.module.css'
import TimelineChart, { CHART_METRICS, type ChartMetric } from './TimelineChart'
import {
  formatDecimal,
  formatInt,
  formatNOK,
  formatPercent,
  formatSignedPercent,
} from '../../../lib/analytics/money'
import type { Grouping, PresetKey } from '../../../lib/analytics/period'
import type {
  AnalyticsResponse,
  ComparisonEntry,
  MarketingRatioEntry,
  MarketingSummary,
  ProductRow,
  ProductWithoutSales,
  Summary,
  VariantRow,
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

type Fmt = 'money' | 'int' | 'percent' | 'dec'

interface KpiDef {
  key: keyof Summary
  label: string
  fmt: Fmt
  color: string
  higherIsBetter: boolean
  hint?: string
}

// KPIs grouped for scannability (§3): Ordre / Salg / Fortjeneste / Kostnader.
// `storageKey` + `defaultExpanded` drive the collapsible section state (persisted in
// localStorage); change the defaults here rather than in the markup.
interface KpiGroupDef {
  title: string
  storageKey: string
  defaultExpanded: boolean
  items: KpiDef[]
}

const KPI_GROUPS: KpiGroupDef[] = [
  {
    title: 'Ordre',
    storageKey: 'order',
    defaultExpanded: true,
    items: [
      { key: 'orderCount', label: 'Ordre', fmt: 'int', color: '#8b5cf6', higherIsBetter: true },
      { key: 'paidOrders', label: 'Betalte ordre', fmt: 'int', color: '#22c55e', higherIsBetter: true, hint: 'Bekreftet, sendt eller levert' },
      { key: 'cancelledOrders', label: 'Kansellerte ordre', fmt: 'int', color: '#ef4444', higherIsBetter: false, hint: 'Talt for perioden – aldri omsetning' },
      { key: 'averageOrderValue', label: 'Gj.snittsordre', fmt: 'money', color: '#3b82f6', higherIsBetter: true },
    ],
  },
  {
    title: 'Salg',
    storageKey: 'sales',
    defaultExpanded: true,
    items: [
      { key: 'unitsSold', label: 'Solgte enheter', fmt: 'int', color: '#0ea5e9', higherIsBetter: true },
      { key: 'avgUnitsPerOrder', label: 'Enheter per ordre', fmt: 'dec', color: '#0ea5e9', higherIsBetter: true, hint: 'Gj.snittlig antall enheter i én ordre' },
      { key: 'revenueGross', label: 'Omsetning', fmt: 'money', color: '#3b82f6', higherIsBetter: true, hint: 'Betalt av kunder, inkl. frakt' },
      { key: 'revenueNet', label: 'Omsetning eks. MVA', fmt: 'money', color: '#3b82f6', higherIsBetter: true },
      { key: 'avgUnitPrice', label: 'Snittpris per enhet', fmt: 'money', color: '#3b82f6', higherIsBetter: true },
    ],
  },
  {
    title: 'Fortjeneste',
    storageKey: 'profit',
    defaultExpanded: true,
    items: [
      { key: 'productCost', label: 'Vareforbruk', fmt: 'money', color: '#f97316', higherIsBetter: false, hint: 'Kostpris (kostnad for solgte varer)' },
      { key: 'grossProfit', label: 'Bruttofortjeneste', fmt: 'money', color: '#22c55e', higherIsBetter: true, hint: 'Fra omsetning ekskl. MVA' },
      { key: 'marginPercent', label: 'Margin', fmt: 'percent', color: '#22c55e', higherIsBetter: true },
      { key: 'contributionProfit', label: 'Resultat etter variable kostnader', fmt: 'money', color: '#16a34a', higherIsBetter: true, hint: 'Ekskl. faste kostnader (lønn, husleie osv.)' },
    ],
  },
  {
    title: 'Kostnader og frakt',
    storageKey: 'costs',
    defaultExpanded: false,
    items: [
      { key: 'shippingCharged', label: 'Frakt betalt av kunder', fmt: 'money', color: '#0ea5e9', higherIsBetter: true },
      { key: 'actualShippingCost', label: 'Faktisk fraktkostnad', fmt: 'money', color: '#f97316', higherIsBetter: false },
      { key: 'paymentFees', label: 'Betalingsgebyr', fmt: 'money', color: '#f97316', higherIsBetter: false, hint: 'Beregnes automatisk hvis aktivert i Økonomiinnstillinger' },
    ],
  },
]

// Marketing KPIs that map to a Summary key (rendered as ordinary KPI cards with comparison).
const MARKETING_SUMMARY_KPIS: KpiDef[] = [
  { key: 'adSpend', label: 'Annonsekostnad eks. MVA', fmt: 'money', color: '#ec4899', higherIsBetter: false, hint: 'Markedsføringskostnad uten MVA, fordelt på perioden' },
  { key: 'newCustomers', label: 'Nye kunder', fmt: 'int', color: '#8b5cf6', higherIsBetter: true, hint: 'Kunder med sin første betalte ordre i perioden' },
  { key: 'contributionProfit', label: 'Markedsføringsresultat', fmt: 'money', color: '#16a34a', higherIsBetter: true, hint: 'Omsetning eks. MVA − vareforbruk − frakt − gebyr − andre kostnader − annonsekostnad. Samme tall som «Resultat etter variable kostnader».' },
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
  paidOrders: svg(<><path d="M6 7h12l-1 12H7L6 7z" /><path d="M9.5 13l1.8 1.8L15 11" /></>),
  cancelledOrders: svg(<><path d="M6 7h12l-1 12H7L6 7z" /><path d="M10 11l4 4M14 11l-4 4" /></>),
  revenueGross: svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>),
  averageOrderValue: svg(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></>),
  unitsSold: svg(<><path d="M12 3l8 4-8 4-8-4 8-4z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>),
  avgUnitsPerOrder: svg(<><path d="M12 3l8 4-8 4-8-4 8-4z" /><path d="M4 7v10l8 4 8-4V7" /></>),
  avgUnitPrice: svg(<><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5h3.2a1.8 1.8 0 0 1 0 3.6H10M10 8v8" /></>),
  productCost: svg(<><path d="M4 4h8l8 8-8 8-8-8V4z" /><circle cx="8" cy="8" r="1.1" /></>),
  grossProfit: svg(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  marginPercent: svg(<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>),
  shippingCharged: svg(<><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></>),
  actualShippingCost: svg(<><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></>),
  shippingResult: svg(<><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></>),
  paymentFees: svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>),
  vatAmount: svg(<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>),
  revenueNet: svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M12 9.5v5M9.5 12h5" /></>),
  adSpend: svg(<><path d="M3 11v2l14 5V6L3 11z" /><path d="M17 9a3 3 0 0 1 0 6M7 14v4" /></>),
  newCustomers: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M18 6v6M21 9h-6" /></>),
  contributionProfit: svg(<><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /><path d="M16 12h.01M3 8l4-4h10" /></>),
}

function TrendIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {up ? <path d="M5 15l7-7 7 7" /> : <path d="M5 9l7 7 7-7" />}
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
      <path d="M9 6l6 6-6 6" />
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
  if (fmt === 'dec') return formatDecimal(value)
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
    async (type: 'products' | 'orders' | 'marketing') => {
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
          <button className={styles.btn} onClick={() => downloadCsv('marketing')} type="button">
            Eksporter markedsføring (CSV)
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
          <button type="button" className={styles.segItem} onClick={() => setAllSections(true)}>
            Vis alle
          </button>
          <button type="button" className={styles.segItem} onClick={() => setAllSections(false)}>
            Skjul alle
          </button>
        </div>

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
          {KPI_GROUPS.map((g) => (
            <DashboardSection
              key={g.storageKey}
              title={g.title}
              storageKey={g.storageKey}
              defaultExpanded={g.defaultExpanded}
              count={g.items.length}
            >
              <div className={styles.kpiGrid}>
                {g.items.map((def) => (
                  <KpiCard key={def.key} def={def} entry={data.comparison[def.key]} />
                ))}
              </div>
            </DashboardSection>
          ))}

          <DashboardSection
            title="Markedsføring"
            storageKey="marketing"
            defaultExpanded={false}
            count={MARKETING_SUMMARY_KPIS.length + 4}
          >
            <MarketingBlock
              summary={data.summary}
              comparison={data.comparison}
              marketing={data.marketing}
            />
          </DashboardSection>

          {/* Timeline */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Utvikling over tid</h2>
              <div className={styles.toolbar}>
                <div className={styles.segmented}>
                  {(Object.keys(CHART_METRICS) as ChartMetric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.segItem} ${metric === m ? styles.segItemActive : ''}`}
                      onClick={() => setMetric(m)}
                    >
                      {CHART_METRICS[m].label}
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

          <ProductsTable products={data.products} />

          <VariantsBlock variants={data.variants} />

          <MatrixBlock products={data.products} />

          <div className={styles.cols2}>
            <ProductsWithoutSalesBlock items={data.productsWithoutSales} />
            <RecentOrders orders={data.recentOrders} />
          </div>

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
    changePercent == null || changePercent === 0
      ? null
      : def.higherIsBetter
        ? changePercent > 0
        : changePercent < 0
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
        ) : changePercent === 0 ? (
          <span>Uendret mot forrige periode</span>
        ) : (
          <>
            <TrendIcon up={changePercent > 0} />
            {formatSignedPercent(changePercent)} mot forrige periode
          </>
        )}
      </div>
      {def.hint && <div className={styles.kpiHint}>{def.hint}</div>}
    </div>
  )
}

/* ------------------------------ Collapsible section ------------------------------ */

// Section collapse state persists per-key in localStorage; "Vis alle"/"Skjul alle" broadcast
// a single window event so every mounted section responds without prop drilling.
const SECTION_STORAGE_PREFIX = 'dashboard.sections.'
const SECTION_SET_ALL_EVENT = 'dashboard:sections:setAll'

function readSectionState(storageKey: string): boolean | null {
  try {
    const v = window.localStorage.getItem(SECTION_STORAGE_PREFIX + storageKey)
    return v === null ? null : v === 'true'
  } catch {
    return null
  }
}

function writeSectionState(storageKey: string, value: boolean) {
  try {
    window.localStorage.setItem(SECTION_STORAGE_PREFIX + storageKey, String(value))
  } catch {
    // ignore (private mode / storage disabled) — falls back to default each load
  }
}

function setAllSections(expanded: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(SECTION_SET_ALL_EVENT, { detail: expanded }))
}

function DashboardSection({
  title,
  storageKey,
  defaultExpanded = true,
  count,
  children,
}: {
  title: string
  storageKey: string
  defaultExpanded?: boolean
  count?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultExpanded)

  // Hydrate from localStorage after mount (kept out of the initial render so SSR/CSR match).
  useEffect(() => {
    const stored = readSectionState(storageKey)
    if (stored !== null) setOpen(stored)
  }, [storageKey])

  // Respond to the global "Vis alle" / "Skjul alle" broadcast.
  useEffect(() => {
    const handler = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail
      setOpen(next)
      writeSectionState(storageKey, next)
    }
    window.addEventListener(SECTION_SET_ALL_EVENT, handler)
    return () => window.removeEventListener(SECTION_SET_ALL_EVENT, handler)
  }, [storageKey])

  const toggle = () =>
    setOpen((prev) => {
      const next = !prev
      writeSectionState(storageKey, next)
      return next
    })

  return (
    <section className={styles.accSection}>
      <button
        type="button"
        className={styles.accHead}
        onClick={toggle}
        aria-expanded={open}
      >
        <span className={styles.accChevron}>
          <Chevron open={open} />
        </span>
        <span className={styles.accTitle}>{title}</span>
        {typeof count === 'number' && <span className={styles.accCount}>{count}</span>}
      </button>
      <div className={`${styles.accBody} ${open ? styles.accBodyOpen : ''}`}>
        <div className={styles.accBodyInner}>{children}</div>
      </div>
    </section>
  )
}

/* ------------------------------ Marketing (Stage 4) ------------------------------ */

type RatioFmt = 'roas' | 'money' | 'percent'

interface RatioDef {
  key: keyof Pick<MarketingSummary, 'roas' | 'cac' | 'costPerOrder' | 'marketingShare'>
  label: string
  fmt: RatioFmt
  color: string
  higherIsBetter: boolean
  hint: string
  icon: ReactNode
}

const MARKETING_RATIOS: RatioDef[] = [
  {
    key: 'roas', label: 'ROAS', fmt: 'roas', color: '#22c55e', higherIsBetter: true,
    hint: 'Omsetning / annonsekostnad. «—» når det ikke finnes annonsekostnad.',
    icon: svg(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  },
  {
    key: 'cac', label: 'CAC', fmt: 'money', color: '#f97316', higherIsBetter: false,
    hint: 'Annonsekostnad / nye kunder. «—» uten nye kunder i perioden.',
    icon: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M18 8h3M19.5 6.5v3" /></>),
  },
  {
    key: 'costPerOrder', label: 'Kostnad per ordre', fmt: 'money', color: '#f97316', higherIsBetter: false,
    hint: 'Annonsekostnad / betalte ordre.',
    icon: svg(<><path d="M6 7h12l-1 12H7L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
  },
  {
    key: 'marketingShare', label: 'Markedsføringsandel', fmt: 'percent', color: '#ec4899', higherIsBetter: false,
    hint: 'Annonsekostnad som andel av omsetning eks. MVA.',
    icon: svg(<><path d="M19 5L5 19" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>),
  },
]

function fmtRatio(value: number, fmt: RatioFmt): string {
  if (fmt === 'roas') return `${formatDecimal(value, 1)}×`
  if (fmt === 'percent') return formatPercent(value)
  return formatNOK(value)
}

function MarketingRatioCard({ def, entry }: { def: RatioDef; entry: MarketingRatioEntry }) {
  const { current, changePercent } = entry
  const favorable =
    changePercent == null || changePercent === 0
      ? null
      : def.higherIsBetter
        ? changePercent > 0
        : changePercent < 0
  const deltaColor = favorable == null ? 'var(--muted)' : favorable ? 'var(--pos)' : 'var(--neg)'

  return (
    <div className={styles.kpiCard} style={{ ['--accent' as string]: def.color }}>
      <div className={styles.kpiHead}>
        <span className={styles.kpiIcon}>{def.icon}</span>
        <span className={styles.kpiName}>{def.label}</span>
      </div>
      <div className={styles.kpiValue}>{current == null ? '—' : fmtRatio(current, def.fmt)}</div>
      <div className={styles.kpiDelta} style={{ color: deltaColor }}>
        {current == null ? (
          <span>Ingen data</span>
        ) : changePercent == null ? (
          <span>— mot forrige periode</span>
        ) : changePercent === 0 ? (
          <span>Uendret mot forrige periode</span>
        ) : (
          <>
            <TrendIcon up={changePercent > 0} />
            {formatSignedPercent(changePercent)} mot forrige periode
          </>
        )}
      </div>
      <div className={styles.kpiHint}>{def.hint}</div>
    </div>
  )
}

function ChannelBlock({
  channels,
  attributionConnected,
}: {
  channels: MarketingSummary['channels']
  attributionConnected: boolean
}) {
  const max = channels.reduce((m, c) => Math.max(m, c.amountExVat), 0)
  return (
    <div className={styles.channelBlock}>
      <h3 className={styles.channelTitle}>Markedsføring per kanal</h3>
      <div className={styles.card}>
        {channels.length === 0 ? (
          <div className={styles.empty}>Ingen markedsføringskostnader i perioden.</div>
        ) : (
          <div className={styles.barList}>
            {channels.map((c, i) => (
              <div key={c.channel} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span
                    className={styles.barSwatch}
                    style={{ background: VARIANT_COLORS[i % VARIANT_COLORS.length], border: '1px solid var(--card-border)' }}
                  />
                  <span>{c.label}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${max > 0 ? (c.amountExVat / max) * 100 : 0}%`,
                      background: VARIANT_COLORS[i % VARIANT_COLORS.length],
                    }}
                  />
                </div>
                <div className={styles.barValue}>
                  {formatNOK(c.amountExVat)} ({formatPercent(c.share)})
                </div>
              </div>
            ))}
          </div>
        )}
        {!attributionConnected && (
          <p className={styles.attNote}>
            Inntekt og ROAS per kanal er ikke koblet på ennå (ingen attribution). Kun kostnad vises per kanal.
          </p>
        )}
      </div>
    </div>
  )
}

function MarketingBlock({
  summary,
  comparison,
  marketing,
}: {
  summary: Summary
  comparison: AnalyticsResponse['comparison']
  marketing: MarketingSummary
}) {
  void summary
  return (
    <div className={styles.marketingWrap}>
      <div className={styles.kpiGrid}>
        {MARKETING_SUMMARY_KPIS.map((def) => (
          <KpiCard key={def.key} def={def} entry={comparison[def.key]} />
        ))}
        {MARKETING_RATIOS.map((def) => (
          <MarketingRatioCard key={def.key} def={def} entry={marketing[def.key]} />
        ))}
      </div>
      <ChannelBlock channels={marketing.channels} attributionConnected={marketing.attributionConnected} />
    </div>
  )
}

/* ------------------------------ Products table (expandable) ------------------------------ */

type SortKey =
  | 'productName'
  | 'orderCount'
  | 'unitsSold'
  | 'revenueGross'
  | 'revenueShare'
  | 'cost'
  | 'grossProfit'
  | 'marginPercent'
  | 'avgUnitPrice'
  | 'avgUnitsPerOrder'

function ProductsTable({ products }: { products: ProductRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('revenueGross')
  const [asc, setAsc] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

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
                  <th onClick={() => onSort('productName')}>Produkt{arrow('productName')}</th>
                  <th onClick={() => onSort('orderCount')}>Ordre{arrow('orderCount')}</th>
                  <th onClick={() => onSort('unitsSold')}>Antall{arrow('unitsSold')}</th>
                  <th onClick={() => onSort('revenueGross')}>Omsetning{arrow('revenueGross')}</th>
                  <th onClick={() => onSort('revenueShare')}>Andel{arrow('revenueShare')}</th>
                  <th onClick={() => onSort('cost')}>Kostpris{arrow('cost')}</th>
                  <th onClick={() => onSort('grossProfit')}>Fortjeneste{arrow('grossProfit')}</th>
                  <th onClick={() => onSort('marginPercent')}>Margin{arrow('marginPercent')}</th>
                  <th className={styles.hideSm} onClick={() => onSort('avgUnitPrice')}>Snittpris{arrow('avgUnitPrice')}</th>
                  <th className={styles.hideSm} onClick={() => onSort('avgUnitsPerOrder')}>Enh./ordre{arrow('avgUnitsPerOrder')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const open = expanded.has(p.key)
                  const hasVariants = p.variants.length > 1
                  return (
                    <Fragment key={p.key}>
                      <tr
                        className={hasVariants ? styles.rowClickable : undefined}
                        onClick={hasVariants ? () => toggle(p.key) : undefined}
                      >
                        <td>
                          <span className={styles.expandCell}>
                            {hasVariants ? <Chevron open={open} /> : <span style={{ width: 14, display: 'inline-block' }} />}
                            {p.productName}
                            {p.costEstimated && (
                              <span title="Kostpris mangler – estimert" style={{ opacity: 0.6 }}> *</span>
                            )}
                          </span>
                        </td>
                        <td>{formatInt(p.orderCount)}</td>
                        <td>{formatInt(p.unitsSold)}</td>
                        <td>{formatNOK(p.revenueGross)}</td>
                        <td>{formatPercent(p.revenueShare)}</td>
                        <td>{formatNOK(p.cost)}</td>
                        <td>{formatNOK(p.grossProfit)}</td>
                        <td>{formatPercent(p.marginPercent)}</td>
                        <td className={styles.hideSm}>{formatNOK(p.avgUnitPrice)}</td>
                        <td className={styles.hideSm}>{formatDecimal(p.avgUnitsPerOrder)}</td>
                      </tr>
                      {open &&
                        p.variants.map((v) => (
                          <tr key={v.key} className={styles.subRow}>
                            <td>
                              <span className={styles.variantCell}>
                                <span
                                  className={styles.barSwatch}
                                  style={{ background: v.colorHex ?? VARIANT_FALLBACK, border: '1px solid var(--card-border)' }}
                                />
                                {v.displayName}
                              </span>
                            </td>
                            <td>{formatInt(v.orderCount)}</td>
                            <td>{formatInt(v.unitsSold)}</td>
                            <td>{formatNOK(v.revenueGross)}</td>
                            <td>{formatPercent(v.parentUnitsShare)}</td>
                            <td>{formatNOK(v.cost)}</td>
                            <td>{formatNOK(v.grossProfit)}</td>
                            <td>{formatPercent(v.marginPercent)}</td>
                            <td className={styles.hideSm}>—</td>
                            <td className={styles.hideSm}>—</td>
                          </tr>
                        ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ Variants (metric toggle) ------------------------------ */

type VariantMetric = 'unitsSold' | 'revenueGross' | 'grossProfit'
const VARIANT_METRICS: { key: VariantMetric; label: string; money: boolean }[] = [
  { key: 'unitsSold', label: 'Antall', money: false },
  { key: 'revenueGross', label: 'Omsetning', money: true },
  { key: 'grossProfit', label: 'Fortjeneste', money: true },
]

function VariantsBlock({ variants }: { variants: VariantRow[] }) {
  const [vm, setVm] = useState<VariantMetric>('unitsSold')
  const cfg = VARIANT_METRICS.find((m) => m.key === vm)!
  const sorted = useMemo(() => [...variants].sort((a, b) => b[vm] - a[vm]), [variants, vm])
  const max = sorted.reduce((m, v) => Math.max(m, v[vm]), 0)

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Salg per variant</h2>
        <div className={styles.segmented}>
          {VARIANT_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`${styles.segItem} ${vm === m.key ? styles.segItemActive : ''}`}
              onClick={() => setVm(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.card}>
        {variants.length === 0 ? (
          <div className={styles.empty}>Ingen salg i perioden.</div>
        ) : (
          <div className={styles.barList}>
            {sorted.map((v, i) => (
              <div key={v.key} className={styles.barRow}>
                <div className={styles.barLabel}>
                  <span
                    className={styles.barSwatch}
                    style={{ background: v.colorHex ?? VARIANT_COLORS[i % VARIANT_COLORS.length], border: '1px solid var(--card-border)' }}
                  />
                  <span title={`${v.displayName} · ${v.parentProductName}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.displayName}
                  </span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${max > 0 ? (v[vm] / max) * 100 : 0}%`,
                      background: v.colorHex ?? VARIANT_COLORS[i % VARIANT_COLORS.length],
                    }}
                  />
                </div>
                <div className={styles.barValue}>
                  {cfg.money ? formatNOK(v[vm]) : formatInt(v[vm])} ({formatPercent(vm === 'unitsSold' ? v.unitsShare : v.revenueShare)})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ Product × Variant matrix ------------------------------ */

function MatrixBlock({ products }: { products: ProductRow[] }) {
  const [vm, setVm] = useState<VariantMetric>('unitsSold')
  const cfg = VARIANT_METRICS.find((m) => m.key === vm)!
  const withVariants = products.filter((p) => p.variants.length > 0)
  const max = withVariants.reduce(
    (m, p) => p.variants.reduce((mm, v) => Math.max(mm, v[vm]), m),
    0,
  )

  if (withVariants.length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Produkt- og variantoversikt</h2>
        <div className={styles.segmented}>
          {VARIANT_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`${styles.segItem} ${vm === m.key ? styles.segItemActive : ''}`}
              onClick={() => setVm(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.matrixList}>
          {withVariants.map((p) => (
            <div key={p.key} className={styles.matrixRow}>
              <div className={styles.matrixProduct} title={p.productName}>{p.productName}</div>
              <div className={styles.matrixCells}>
                {p.variants.map((v) => {
                  const intensity = max > 0 ? v[vm] / max : 0
                  return (
                    <span
                      key={v.key}
                      className={styles.matrixCell}
                      title={`${v.displayName}: ${cfg.money ? formatNOK(v[vm]) : formatInt(v[vm])}`}
                      style={{
                        background: `color-mix(in srgb, ${v.colorHex ?? '#3b82f6'} ${Math.round(18 + intensity * 62)}%, var(--card-bg))`,
                      }}
                    >
                      <span className={styles.matrixCellName}>{v.variantName}</span>
                      <strong>{cfg.money ? formatNOK(v[vm]) : formatInt(v[vm])}</strong>
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------ Products without sales ------------------------------ */

function ProductsWithoutSalesBlock({ items }: { items: ProductWithoutSales[] }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Produkter uten salg</h2>
      <div className={styles.card}>
        {items.length === 0 ? (
          <div className={styles.empty}>🎉 Alle publiserte varianter hadde salg i perioden.</div>
        ) : (
          <ul className={styles.noSalesList}>
            {items.map((it) => (
              <li key={it.variantId ?? it.name} className={styles.noSalesItem}>
                <div className={styles.noSalesMain}>
                  <span className={styles.noSalesName}>{it.name}</span>
                  <span className={styles.noSalesTag}>Ingen salg i valgt periode</span>
                </div>
                <div className={styles.noSalesMeta}>
                  {typeof it.inventory === 'number' && <span>Lager: {formatInt(it.inventory)}</span>}
                  <span>
                    {it.lastSoldAt ? `Sist solgt ${it.lastSoldAt.slice(0, 10)}` : 'Aldri solgt'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/* ------------------------------ Recent orders ------------------------------ */

function RecentOrders({ orders }: { orders: AnalyticsResponse['recentOrders'] }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Siste ordre</h2>
      <div className={styles.card}>
        {orders.length === 0 ? (
          <div className={styles.empty}>Ingen ordre i perioden.</div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ordre</th>
                  <th className={styles.hideSm}>Kunde</th>
                  <th className={styles.hideSm}>Dato</th>
                  <th>Status</th>
                  <th>Antall</th>
                  <th>Sum</th>
                  <th className={styles.hideSm}>Kostpris</th>
                  <th>Fortjeneste</th>
                  <th className={styles.hideSm}>Margin</th>
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
                    <td className={styles.hideSm}>{o.customerName ?? '—'}</td>
                    <td className={styles.hideSm}>{o.date.slice(0, 10)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{formatInt(o.unitsSold)}</td>
                    <td>{formatNOK(o.revenueGross)}</td>
                    <td className={styles.hideSm}>{formatNOK(o.cost)}</td>
                    <td>{formatNOK(o.grossProfit)}</td>
                    <td className={styles.hideSm}>{formatPercent(o.marginPercent)}</td>
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
