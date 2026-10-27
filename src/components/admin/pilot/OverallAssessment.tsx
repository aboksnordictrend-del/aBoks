'use client'

import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import styles from './pilot.module.css'
import { SENTIMENTS, type AssessmentPoint, type OverallAssessment, type Sentiment } from '@/lib/pilot/assessment'
import type { Grouping } from '@/lib/analytics/period'

// «Samlet vurdering og utvikling». Colours validated (lightness band, chroma, CVD separation,
// 3:1 contrast) on light and dark surfaces; identity is never colour alone — every series also has
// a text label, and the lines differ in dash pattern.
const SENTIMENT_META: Record<Sentiment, { label: string; short: string; color: string; dash?: string }> = {
  positive: { label: 'Positive vurderinger', short: 'Positive', color: '#2f7a40' },
  neutral: { label: 'Nøytrale vurderinger', short: 'Nøytrale', color: '#c58610', dash: '6 4' },
  negative: { label: 'Negative vurderinger', short: 'Negative', color: '#c4453c', dash: '2 3' },
}

const GROUPINGS: { key: Grouping; label: string }[] = [
  { key: 'day', label: 'Dag' },
  { key: 'week', label: 'Uke' },
  { key: 'month', label: 'Måned' },
]

const int = new Intl.NumberFormat('nb-NO')
const svar = (n: number) => `${int.format(n)} svar`
const evalueringer = (n: number) => `${int.format(n)} ${n === 1 ? 'evaluering' : 'evalueringer'}`

function Swatch({ sentiment }: { sentiment: Sentiment }) {
  return <span className={styles.swatch} style={{ background: SENTIMENT_META[sentiment].color }} aria-hidden />
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: AssessmentPoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0]!.payload
  return (
    <div className={styles.tooltip}>
      <strong>{p.label}</strong>
      {p.percents ? (
        <>
          {SENTIMENTS.map((s) => (
            <div key={s}>
              <Swatch sentiment={s} /> {SENTIMENT_META[s].short}: {p.percents![s]} % ({svar(p.counts[s])})
            </div>
          ))}
          <div className={styles.note}>
            {svar(p.total)} fra {evalueringer(p.evaluations)}
          </div>
        </>
      ) : (
        <div>Ingen klassifiserte svar</div>
      )}
    </div>
  )
}

function TrendChart({ points }: { points: AssessmentPoint[] }) {
  const data = points.map((p) => ({
    ...p,
    positivePct: p.shares ? p.shares.positive * 100 : null,
    neutralPct: p.shares ? p.shares.neutral * 100 : null,
    negativePct: p.shares ? p.shares.negative * 100 : null,
  }))
  return (
    <div className={styles.chart} style={{ height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--theme-elevation-100)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }} />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v} %`}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--theme-elevation-500)' }}
          />
          <Tooltip cursor={{ stroke: 'var(--theme-elevation-300)' }} content={<TrendTooltip />} />
          {SENTIMENTS.map((s) => (
            <Line
              key={s}
              type="linear"
              dataKey={`${s}Pct`}
              name={SENTIMENT_META[s].label}
              stroke={SENTIMENT_META[s].color}
              strokeWidth={2}
              strokeDasharray={SENTIMENT_META[s].dash}
              dot={{ r: 4, strokeWidth: 0, fill: SENTIMENT_META[s].color }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--theme-elevation-0)' }}
              // Periods without classified answers stay gaps — no value is invented for them.
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function TrendTable({ points }: { points: AssessmentPoint[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Periode</th>
            {SENTIMENTS.map((s) => (
              <th key={s} className={styles.num}>
                {SENTIMENT_META[s].short}
              </th>
            ))}
            <th className={styles.num}>Svar</th>
            <th className={styles.num}>Evalueringer</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <td>{p.label}</td>
              {SENTIMENTS.map((s) => (
                <td key={s} className={styles.num}>
                  {p.percents ? `${p.percents[s]} % (${int.format(p.counts[s])})` : '–'}
                </td>
              ))}
              <td className={styles.num}>{int.format(p.total)}</td>
              <td className={styles.num}>{int.format(p.evaluations)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function OverallAssessmentSection({ assessment }: { assessment: OverallAssessment }) {
  const [grouping, setGrouping] = useState<Grouping>('week')
  const { percents, shares, counts, total } = assessment
  const points = assessment.timeline[grouping]

  return (
    <section className={styles.card} aria-labelledby="samlet-vurdering">
      <h2 id="samlet-vurdering" className={styles.cardTitle} style={{ marginBottom: '0.25rem' }}>
        Samlet vurdering og utvikling
      </h2>
      <p className={styles.note} style={{ marginBottom: '0.9rem' }}>
        Samlet oversikt over positive, nøytrale og negative vurderinger, og hvordan disse utvikler seg over tid.{' '}
        <span title="Hvert klassifiserte svar på et vurderingsspørsmål teller én gang. Vurderingsskala: 4–5 positiv, 3 nøytral, 1–2 negativ. Ja / Delvis eller Kanskje / Nei på spørsmålene om bedre organisering og om å fortsette. «Vet ikke», alternativer som holdes utenfor andelene, ubesvarte spørsmål, fritekst og beskrivende spørsmål (modell, brukssted, bruksfrekvens) teller ikke.">
          Fordelingen viser andelen positive, nøytrale og negative vurderingssvar, ikke andelen personer.
        </span>
      </p>

      {!percents || !shares ? (
        <p className={styles.note}>
          Ingen klassifiserte vurderingssvar for valgt utvalg ennå. Fordelingen vises når det finnes svar på
          vurderingsspørsmål.
        </p>
      ) : (
        <>
          <div className={styles.kpis}>
            {SENTIMENTS.map((s) => (
              <div key={s} className={styles.kpi} style={{ borderTop: `3px solid ${SENTIMENT_META[s].color}` }}>
                <p className={styles.kpiLabel}>
                  <Swatch sentiment={s} /> {SENTIMENT_META[s].label}
                </p>
                <p className={styles.kpiValue}>{percents[s]} %</p>
                <p className={styles.kpiSub}>
                  {int.format(counts[s])} av {svar(total)}
                </p>
              </div>
            ))}
          </div>

          <div
            className={styles.stack}
            role="img"
            aria-label={SENTIMENTS.map((s) => `${SENTIMENT_META[s].short} ${percents[s]} %`).join(', ')}
          >
            {SENTIMENTS.filter((s) => counts[s] > 0).map((s) => (
              <span
                key={s}
                className={styles.stackSeg}
                style={{ flexGrow: shares[s], background: SENTIMENT_META[s].color }}
                title={`${SENTIMENT_META[s].label}: ${percents[s]} % (${svar(counts[s])})`}
              />
            ))}
          </div>

          <p className={styles.note} style={{ marginTop: '0.6rem' }}>
            Basert på {int.format(total)} klassifiserte svar fra {evalueringer(assessment.evaluations)}.
          </p>

          <h3 className={styles.cardTitle} style={{ margin: '1.4rem 0 0.6rem' }}>
            Utvikling over tid
          </h3>
          <div className={styles.trendBar}>
            <div className={styles.segmented} role="group" aria-label="Gruppering">
              {GROUPINGS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`${styles.segItem} ${grouping === g.key ? styles.segItemActive : ''}`}
                  aria-pressed={grouping === g.key}
                  onClick={() => setGrouping(g.key)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <ul className={styles.legend}>
              {SENTIMENTS.map((s) => (
                <li key={s}>
                  <Swatch sentiment={s} /> {SENTIMENT_META[s].short}
                </li>
              ))}
            </ul>
          </div>
          <TrendChart points={points} />
          <p className={styles.note}>
            Andel per periode, beregnet bare av svarene som kom inn i den perioden (ikke kumulativt). Perioder uten
            klassifiserte svar vises som brudd i linjene.
          </p>
          <details style={{ marginTop: '0.6rem' }}>
            <summary className={styles.note} style={{ cursor: 'pointer' }}>
              Vis som tabell
            </summary>
            <TrendTable points={points} />
          </details>
        </>
      )}
    </section>
  )
}
