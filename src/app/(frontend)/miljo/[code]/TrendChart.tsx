'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrendPoint } from '@/lib/miljo/stats'

// Loaded with next/dynamic (ssr: false) only when the statistics tab opens, so Recharts never
// weighs on the registration form that people scan the QR code for. The same numbers are always
// available as a table next to the chart.

const COLORS: Record<string, string> = { aa: '#5e6a48', aaa: '#9aa57f', other: '#c9b48a' }

export default function TrendChart({ points, series }: { points: TrendPoint[]; series: { value: 'aa' | 'aaa' | 'other'; label: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#efe9de" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5f6357' }} interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: '#d9d2c4' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5f6357' }} tickLine={false} axisLine={false} width={44} />
        <Tooltip cursor={{ fill: 'rgba(94,106,72,0.08)' }} contentStyle={{ borderRadius: 10, borderColor: '#e8e0d4', fontSize: 13 }} />
        {series.map((s, i) => (
          <Bar key={s.value} dataKey={s.value} name={s.label} stackId="a" fill={COLORS[s.value]} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
