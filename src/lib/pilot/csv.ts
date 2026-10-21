// CSV export of pilot evaluations. Pure.
//
// Same target as the sales exports (src/lib/analytics/csv.ts): Excel in nb-NO — UTF-8 with BOM so
// æ/ø/å survive, semicolon delimiter, CRLF line ends, every text value quoted with inner quotes
// doubled. Free text is participant input, so a value that a spreadsheet would read as a formula
// (=, +, -, @, tab, CR) is prefixed with an apostrophe.

import type { EvaluationRecord } from './stats'
import { osloDateKey } from '../analytics/period'

const BOM = '﻿'
const DELIM = ';'

export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
  }
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${guarded.replace(/"/g, '""')}"`
}

function osloTime(iso: string): string {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat('nb-NO', {
    timeZone: 'Europe/Oslo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
  return `${osloDateKey(d)} ${time}`
}

export interface CsvProjectInfo {
  name: string
  organization: string
}

/**
 * One row per evaluation; one column per question id seen in any of the exported evaluations, in
 * first-seen order and headed by the newest label. Answers are matched by question id, so a
 * question that was renamed keeps a single column, and one that did not exist for an evaluation
 * stays empty for it.
 */
export function evaluationsCsv(
  records: EvaluationRecord[],
  projects: Map<number, CsvProjectInfo>,
): string {
  const sorted = [...records].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

  const columns: string[] = []
  const labels = new Map<string, { label: string; at: string }>()
  for (const r of sorted) {
    for (const q of r.snapshot?.questions ?? []) {
      const seen = labels.get(q.questionId)
      if (!seen) {
        columns.push(q.questionId)
        labels.set(q.questionId, { label: q.label, at: r.submittedAt })
      } else if (r.submittedAt >= seen.at) {
        labels.set(q.questionId, { label: q.label, at: r.submittedAt })
      }
    }
  }

  const headers = [
    'Evaluering-ID',
    'Innsendt',
    'Prosjekt-ID',
    'Prosjekt',
    'Organisasjon',
    'Spørreskjemaversjon',
    'Modell',
    ...columns.map((id) => labels.get(id)!.label),
  ]

  const lines = [headers.map(csvCell).join(DELIM)]
  for (const r of sorted) {
    const project = r.projectId != null ? projects.get(r.projectId) : undefined
    const byId = new Map(r.answers.map((a) => [a.questionId, a]))
    const row: (string | number | null)[] = [
      String(r.id),
      osloTime(r.submittedAt),
      r.projectId,
      project?.name ?? '',
      project?.organization ?? '',
      r.snapshot?.version ?? null,
      r.modelLabel ?? '',
      ...columns.map((id) => {
        const a = byId.get(id)
        if (!a) return ''
        return typeof a.value === 'number' ? a.value : a.displayValue
      }),
    ]
    lines.push(row.map(csvCell).join(DELIM))
  }
  return BOM + lines.join('\r\n') + '\r\n'
}
