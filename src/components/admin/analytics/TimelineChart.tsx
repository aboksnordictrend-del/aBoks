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
import { formatInt, formatNOK } from '../../../lib/analytics/money'

export type ChartMetric = 'revenue' | 'orders' | 'grossProfit'

// Single-series chart → no legend needed; the title/toggle names the series.
const METRICS: Record<ChartMetric, { label: string; color: string; money: boolean }> = {
  revenue: { label: 'Omsetning', color: '#3b82f6', money: true },
  orders: { label: 'Ordre', color: '#8b5cf6', money: false },
  grossProfit: { label: 'Bruttofortjeneste', color: '#22c55e', money: true },
}

function TooltipBox({
  active,
  payload,
  money,
}: {
  active?: boolean
  payload?: { value: number; payload: TimelinePoint }[]
  money: boolean
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  return (
    <div
      style={{
        background: 'var(--theme-elevation-0)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 6,
        padding: '0.5rem 0.7rem',
        fontSize: '0.78rem',
        color: 'var(--theme-text)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
      }}
    >
      <div style={{ opacity: 0.65, marginBottom: 2 }}>{point.payload.label}</div>
      <strong>{money ? formatNOK(point.value) : formatInt(point.value)}</strong>
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
  const cfg = METRICS[metric]
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
          tickFormatter={(v: number) => (cfg.money ? formatNOK(v) : formatInt(v))}
        />
        <Tooltip
          content={(props) => (
            <TooltipBox
              active={props.active}
              payload={props.payload as { value: number; payload: TimelinePoint }[] | undefined}
              money={cfg.money}
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
