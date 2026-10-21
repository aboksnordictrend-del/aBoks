'use client'

import { useRowLabel } from '@payloadcms/ui'

type Row = { questionLabel?: string | null; displayValue?: string | null }

/** «Hvor ofte har du brukt produktet? — Ukentlig» in an evaluation's answer list. */
export default function AnswerRowLabel() {
  const { data } = useRowLabel<Row>()
  const value = (data?.displayValue ?? '').replace(/\s+/g, ' ')
  return (
    <span>
      {data?.questionLabel || 'Svar'}
      {value && <span style={{ opacity: 0.65 }}> — {value.length > 80 ? `${value.slice(0, 80)}…` : value}</span>}
    </span>
  )
}
