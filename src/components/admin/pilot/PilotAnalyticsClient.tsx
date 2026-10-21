'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import styles from './pilot.module.css'
import type { ComparisonRow, Distribution, PilotStats, RatingSummary, WrittenAnswer } from '@/lib/pilot/stats'
import { PILOT_STATUS_OPTIONS, organizationTypeLabel, statKeyLabel, type StatKey } from '@/lib/pilot/constants'

const API = '/api/pilot-analytics'
const BAR = '#3f8a4f'

interface ProjectInfo {
  id: number
  name: string
  slug: string | null
  url: string | null
  organization: string
  organizationType: string
  status: string
  startDate: string | null
  endDate: string | null
}

interface PilotAnalyticsResponse {
  projects: ProjectInfo[]
  modelOptions: { key: string; label: string }[]
  stats: PilotStats
  comparison: { projects: ComparisonRow[]; models: ComparisonRow[] }
}

const nb = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const int = new Intl.NumberFormat('nb-NO')
const fmtAvg = (v: number | null) => (v == null ? '–' : nb.format(v))
const fmtPct = (v: number | null) => (v == null ? '–' : `${Math.round(v * 100)} %`)
const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', dateStyle: 'medium' }).format(new Date(iso)) : '–'
const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
const statusLabel = (s: string) => PILOT_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={styles.kpi}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      {sub && <p className={styles.kpiSub}>{sub}</p>}
    </div>
  )
}

/** Labelled horizontal bars — the label, count and share are text, so the list doubles as its own table. */
function DistributionBars({ dist, empty = 'Ingen svar ennå.' }: { dist: Distribution; empty?: string }) {
  if (dist.answered === 0) return <p className={styles.note}>{empty}</p>
  const max = Math.max(1, ...dist.entries.map((e) => e.count))
  return (
    <>
      <ul className={styles.bars}>
        {dist.entries.map((e) => (
          <li
            key={e.label}
            className={styles.barRow}
            title={`${e.label}: ${e.count} svar${e.share != null ? ` (${fmtPct(e.share)})` : ' – holdes utenfor andelene'}`}
          >
            <span className={styles.barLabel}>{e.label}</span>
            <span className={styles.barTrack} aria-hidden>
              <span
                className={e.excluded ? styles.barFillMuted : styles.barFill}
                style={{ display: 'block', width: `${(e.count / max) * 100}%` }}
              />
            </span>
            <span className={styles.barValue}>
              {int.format(e.count)} <span>{e.share != null ? fmtPct(e.share) : 'utenfor'}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.note} style={{ marginTop: '0.6rem' }}>
        {int.format(dist.answered)} besvart · andeler av {int.format(dist.base)}
        {dist.base !== dist.answered ? ' (grå alternativer holdes utenfor)' : ''}
      </p>
    </>
  )
}

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <strong>{label}</strong>
      <div>
        {int.format(payload[0]!.value)} {unit}
      </div>
    </div>
  )
}

function RatingChart({ rating }: { rating: RatingSummary }) {
  if (rating.count === 0) return <p className={styles.note}>Ingen vurderinger ennå.</p>
  const data = rating.distribution.map((d) => ({ label: String(d.value), count: d.count }))
  return (
    <div className={styles.chart} style={{ height: 180 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--theme-elevation-100)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--theme-elevation-500)' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} />
          <Tooltip cursor={{ fill: 'var(--theme-elevation-100)' }} content={<ChartTooltip unit="svar" />} />
          <Bar dataKey="count" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TimelineChart({ points }: { points: { date: string; count: number }[] }) {
  if (points.length === 0) return <p className={styles.note}>Ingen svar i perioden.</p>
  const data = points.map((p) => ({
    label: new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(`${p.date}T12:00:00Z`),
    ),
    count: p.count,
  }))
  return (
    <div className={styles.chart}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--theme-elevation-100)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} />
          <Tooltip cursor={{ fill: 'var(--theme-elevation-100)' }} content={<ChartTooltip unit="svar" />} />
          <Bar dataKey="count" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ComparisonTable({ rows, first }: { rows: ComparisonRow[]; first: string }) {
  if (rows.length === 0) return <p className={styles.note}>Ingen data.</p>
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{first}</th>
            <th className={styles.num}>Svar</th>
            <th className={styles.num}>Brukervennlighet</th>
            <th className={styles.num}>Nytteverdi</th>
            <th className={styles.num}>Bedre organisering</th>
            <th className={styles.num}>Vil fortsette</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td className={styles.num}>{int.format(r.responses)}</td>
              <td className={styles.num}>{fmtAvg(r.usabilityAverage)}</td>
              <td className={styles.num}>{fmtAvg(r.usefulnessAverage)}</td>
              <td className={styles.num}>{fmtPct(r.organizationPositiveShare)}</td>
              <td className={styles.num}>{fmtPct(r.continuePositiveShare)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type WrittenFilter = 'feedback' | 'all' | StatKey | 'other'
// «Tilbakemeldinger» first: the location answers are short place names and would otherwise
// bury the actual feedback.
const WRITTEN_FILTERS: { key: WrittenFilter; label: string }[] = [
  { key: 'feedback', label: 'Tilbakemeldinger' },
  { key: 'improvements', label: 'Forbedringer' },
  { key: 'comments', label: 'Kommentarer' },
  { key: 'location', label: 'Brukssted' },
  { key: 'room', label: 'Rom / avdeling' },
  { key: 'other', label: 'Øvrige' },
  { key: 'all', label: 'Alle' },
]
const FEEDBACK_CATEGORIES: (StatKey | null)[] = ['improvements', 'comments', null]

function WrittenFeedback({ items, projectName }: { items: WrittenAnswer[]; projectName: (id: number | null) => string }) {
  const [filter, setFilter] = useState<WrittenFilter>('feedback')
  const [limit, setLimit] = useState(30)
  const shown = items.filter((i) =>
    filter === 'all'
      ? true
      : filter === 'feedback'
        ? FEEDBACK_CATEGORIES.includes(i.category)
        : filter === 'other'
          ? i.category == null
          : i.category === filter,
  )
  return (
    <>
      <div className={styles.segmented} role="group" aria-label="Filtrer skriftlige svar">
        {WRITTEN_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${styles.segItem} ${filter === f.key ? styles.segItemActive : ''}`}
            aria-pressed={filter === f.key}
            onClick={() => {
              setFilter(f.key)
              setLimit(30)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className={styles.note}>Ingen skriftlige svar.</p>
      ) : (
        <ul className={styles.feedback}>
          {shown.slice(0, limit).map((i) => (
            <li key={`${i.evaluationId}-${i.questionId}`} className={styles.feedbackItem}>
              <p className={styles.feedbackText}>{i.text}</p>
              <p className={styles.feedbackMeta}>
                {i.questionLabel}
                {i.category ? ` (${statKeyLabel(i.category)})` : ''} · {projectName(i.projectId)}
                {i.modelLabel ? ` · ${i.modelLabel}` : ''} · {fmtDateTime(i.submittedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {shown.length > limit && (
        <button type="button" className={styles.btn} style={{ marginTop: '0.75rem' }} onClick={() => setLimit((l) => l + 50)}>
          Vis flere ({shown.length - limit} igjen)
        </button>
      )}
    </>
  )
}

export default function PilotAnalyticsClient({ initialProject }: { initialProject?: string }) {
  const [project, setProject] = useState(initialProject && /^\d+$/.test(initialProject) ? initialProject : 'all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [model, setModel] = useState('')
  const [data, setData] = useState<PilotAnalyticsResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set('project', project)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (model) p.set('model', model)
    return p.toString()
  }, [project, from, to, model])

  // Filters change faster than responses arrive; only the latest request may update the view,
  // or a slow earlier response would overwrite the current filter's figures.
  const latest = useRef(0)
  const load = useCallback(async () => {
    const seq = ++latest.current
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}?${query}`, { credentials: 'include' })
      const body = (await res.json()) as PilotAnalyticsResponse & { error?: string }
      if (seq !== latest.current) return
      if (!res.ok) throw new Error(body.error || 'Kunne ikke hente pilotanalysen.')
      setData(body)
    } catch (err) {
      if (seq !== latest.current) return
      setError(err instanceof Error ? err.message : 'Kunne ikke hente pilotanalysen.')
    } finally {
      if (seq === latest.current) setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const projectById = useMemo(() => new Map((data?.projects ?? []).map((p) => [p.id, p])), [data])
  const projectName = useCallback(
    (id: number | null) => (id != null ? projectById.get(id)?.name ?? `Prosjekt ${id}` : '–'),
    [projectById],
  )
  const selected = project !== 'all' ? projectById.get(Number(project)) : undefined
  const s = data?.stats

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Pilotanalyse</h1>
          <p className={styles.subtitle}>
            Resultater fra pilotprosjektenes spørreskjemaer. Svarene er anonyme innsendinger — antall svar er ikke det
            samme som antall personer.
          </p>
        </div>
        <a className={styles.btn} href={`${API}?${query}&format=csv`}>
          Eksporter CSV
        </a>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.field}>
          Pilotprosjekt
          <select
            className={styles.select}
            value={project}
            onChange={(e) => {
              setProject(e.target.value)
              setModel('')
            }}
          >
            <option value="all">Alle prosjekter</option>
            {(data?.projects ?? []).map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} – {p.organization}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Fra dato
          <input className={styles.dateInput} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={styles.field}>
          Til dato
          <input className={styles.dateInput} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className={styles.field}>
          aBoks-modell
          <select className={styles.select} value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Alle modeller</option>
            {(data?.modelOptions ?? []).map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        {(from || to || model) && (
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setFrom('')
              setTo('')
              setModel('')
            }}
          >
            Nullstill filtre
          </button>
        )}
        {loading && <span className={styles.note}>Laster …</span>}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {selected && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>
            {selected.name} · {selected.organization}
          </p>
          <p className={styles.note}>
            {organizationTypeLabel(selected.organizationType)} · Status: {statusLabel(selected.status)} ·{' '}
            {selected.startDate || selected.endDate
              ? `${fmtDate(selected.startDate)} – ${fmtDate(selected.endDate)}`
              : 'Periode ikke satt'}
            {selected.url && (
              <>
                {' · '}
                <a href={selected.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                  {selected.url}
                </a>
              </>
            )}
            {' · '}
            <a href={`/admin/collections/pilot-projects/${selected.id}`} style={{ color: 'inherit' }}>
              Rediger prosjekt
            </a>
          </p>
        </div>
      )}

      {data && s && (
        <>
          <div className={styles.kpis}>
            <Kpi label="Antall svar" value={int.format(s.totalResponses)} sub="Innsendte evalueringer" />
            <Kpi
              label="Brukervennlighet (snitt 1–5)"
              value={fmtAvg(s.usability.average)}
              sub={`${int.format(s.usability.count)} vurderinger`}
            />
            <Kpi
              label="Nytteverdi (snitt 1–5)"
              value={fmtAvg(s.usefulness.average)}
              sub={`${int.format(s.usefulness.count)} vurderinger`}
            />
            <Kpi
              label="Ønsker å fortsette"
              value={fmtPct(s.continueUsing.positiveShare)}
              sub={`av ${int.format(s.continueUsing.base)} som svarte`}
            />
            <Kpi
              label="Bedre organisering"
              value={fmtPct(s.organization.positiveShare)}
              sub={`«Ja» av ${int.format(s.organization.base)} som svarte`}
            />
          </div>
          {s.withoutProductExperience > 0 && (
            <p className={styles.note}>
              {int.format(s.withoutProductExperience)} svar oppgir at produktet ikke er brukt ennå. Deres vurderinger og svar om
              organisering holdes utenfor gjennomsnitt og andeler. Ubesvarte spørsmål teller aldri med.
            </p>
          )}

          <div className={styles.grid}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Svar over tid</h2>
              <TimelineChart points={s.timeline} />
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Modellbruk</h2>
              <DistributionBars dist={s.models} />
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Bruksfrekvens</h2>
              <DistributionBars dist={s.frequency} />
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Brukervennlighet</h2>
              <RatingChart rating={s.usability} />
              <p className={styles.note}>1 = svært vanskelig · 5 = svært enkelt</p>
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Nytteverdi</h2>
              <RatingChart rating={s.usefulness} />
              <p className={styles.note}>1 = lite nyttig · 5 = svært nyttig</p>
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Har aBoks bidratt til bedre organisering?</h2>
              <DistributionBars dist={s.organization} />
            </section>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Ønsker å fortsette å bruke aBoks</h2>
              <DistributionBars dist={s.continueUsing} />
            </section>
          </div>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Skriftlige tilbakemeldinger</h2>
            <WrittenFeedback items={s.written} projectName={projectName} />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Alle spørsmål</h2>
            <p className={styles.note} style={{ marginBottom: '0.75rem' }}>
              Per spørsmåls-ID, med teksten fra siste versjon. Endrede spørsmål beholder sin historikk.
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Spørsmål</th>
                    <th className={styles.num}>Besvart</th>
                    <th>Resultat</th>
                  </tr>
                </thead>
                <tbody>
                  {s.questions.map((q) => (
                    <tr key={q.questionId}>
                      <td>{q.label}</td>
                      <td className={styles.num}>{int.format(q.answered)}</td>
                      <td>
                        {q.rating
                          ? `Snitt ${fmtAvg(q.rating.average)} (${int.format(q.rating.count)} vurderinger)`
                          : q.distribution
                            ? q.distribution.entries
                                .filter((e) => e.count > 0)
                                .map((e) => `${e.label}: ${e.count}`)
                                .join(' · ') || '–'
                            : 'Fritekst'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Sammenligning mellom pilotprosjekter</h2>
            <p className={styles.note} style={{ marginBottom: '0.75rem' }}>
              Alle prosjekter, med valgt periode og modell. Snitt på skala 1–5; andeler av dem som svarte.
            </p>
            <ComparisonTable rows={data.comparison.projects} first="Prosjekt" />
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Sammenligning mellom modeller</h2>
            <p className={styles.note} style={{ marginBottom: '0.75rem' }}>
              {selected ? 'Valgt prosjekt' : 'Alle prosjekter'}, med valgt periode.
            </p>
            <ComparisonTable rows={data.comparison.models} first="Modell" />
          </section>
        </>
      )}
    </div>
  )
}
