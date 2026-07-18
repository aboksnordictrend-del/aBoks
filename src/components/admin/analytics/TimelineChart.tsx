'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TimelinePoint } from '../../../lib/analytics/types'
import { formatInt, formatNOK, formatPercent } from '../../../lib/analytics/money'

export type ChartMetric = 'revenue' | 'orders' | 'unitsSold' | 'grossProfit' | 'marginPercent'

type Unit = 'money' | 'int' | 'percent'

// Single-series chart → no legend needed; the title/toggle names the series.
export const CHART_METRICS: Record<ChartMetric, { label: string; color: string; unit: Unit }> = {
  revenue: { label: 'Omsetning', color: '#3b82f6', unit: 'money' },
  orders: { label: 'Ordre', color: '#8b5cf6', unit: 'int' },
  unitsSold: { label: 'Solgte enheter', color: '#0ea5e9', unit: 'int' },
  grossProfit: { label: 'Bruttofortjeneste', color: '#22c55e', unit: 'money' },
  marginPercent: { label: 'Margin', color: '#14b8a6', unit: 'percent' },
}

function fmt(value: number, unit: Unit): string {
  if (unit === 'money') return formatNOK(value)
  if (unit === 'percent') return formatPercent(value)
  return formatInt(value)
}

function TooltipBox({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: { value: number; payload: TimelinePoint }[]
  unit: Unit
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const value = payload[0].value
  const rows: [string, string][] = [
    ['Ordre', formatInt(p.orders)],
    ['Enheter', formatInt(p.unitsSold)],
    ['Omsetning', formatNOK(p.revenue)],
    ['Fortjeneste', formatNOK(p.grossProfit)],
    ['Margin', formatPercent(p.marginPercent)],
  ]
  return (
    <div
      style={{
        background: 'var(--theme-elevation-0)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 6,
        padding: '0.55rem 0.75rem',
        fontSize: '0.76rem',
        color: 'var(--theme-text)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
        minWidth: 150,
      }}
    >
      <div style={{ opacity: 0.65, marginBottom: 4 }}>{p.label}</div>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 5 }}>{fmt(value, unit)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '1px 10px', opacity: 0.85 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <span style={{ opacity: 0.7 }}>{k}</span>
            <span style={{ textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TimelineChart({
  data,
  metric,
}: {
  data: TimelinePoint[]
  metric: ChartMetric
}) {
  const cfg = CHART_METRICS[metric]
  const gradientId = `grad-${metric}`

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cfg.color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={cfg.color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--theme-elevation-150)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--theme-elevation-600)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--theme-elevation-150)' }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          tick={{ fill: 'var(--theme-elevation-600)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={54}
          tickFormatter={(v: number) => fmt(v, cfg.unit)}
        />
        <Tooltip
          content={(props) => (
            <TooltipBox
              active={props.active}
              payload={props.payload as { value: number; payload: TimelinePoint }[] | undefined}
              unit={cfg.unit}
            />
          )}
          cursor={{ stroke: cfg.color, strokeWidth: 1.5, strokeDasharray: '4 4', strokeOpacity: 0.7 }}
        />
        <Area
          type="monotone"
          dataKey={metric}
          stroke={cfg.color}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--theme-elevation-0)', fill: cfg.color }}
          name={cfg.label}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
