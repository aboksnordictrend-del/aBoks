'use client'

import { useRowLabel } from '@payloadcms/ui'
import { QUESTION_TYPE_OPTIONS } from '@/lib/pilot/constants'

type Row = { label?: string | null; type?: string | null; enabled?: boolean | null; required?: boolean | null }

/** «3. Hvor ofte har du brukt produktet? · Enkeltvalg · obligatorisk» in the collapsed question list. */
export default function QuestionRowLabel() {
  const { data, rowNumber } = useRowLabel<Row>()
  const type = QUESTION_TYPE_OPTIONS.find((o) => o.value === data?.type)?.label
  const parts = [type, data?.required ? 'obligatorisk' : null, data?.enabled === false ? 'deaktivert' : null].filter(
    Boolean,
  )
  return (
    <span style={{ opacity: data?.enabled === false ? 0.55 : 1 }}>
      {(rowNumber ?? 0) + 1}. {data?.label || 'Nytt spørsmål'}
      {parts.length > 0 && <span style={{ opacity: 0.6 }}> · {parts.join(' · ')}</span>}
    </span>
  )
}
