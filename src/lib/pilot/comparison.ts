// Comparison between pilot projects and between models («Sammenligning»). Pure, like ./stats.
//
// Only figures with the same meaning in every row are compared:
//
//   • The overall split («Samlet vurdering», ./assessment) — defined the same way for every
//     questionnaire: positive / neutral / negative shares of the classified answers.
//   • Rating questions that are literally the same question in several rows: the same question id
//     and the rating type (1–5). Projects started from the default questionnaire share its fixed
//     ids (e.g. «brukervennlighet»), and models within one project share all of theirs. Two
//     questions are never treated as the same because they share an analysis category or a
//     similar text.

import { RATING_MAX, RATING_MIN } from './constants'
import { classifyEvaluation, percentsSummingTo100, type Sentiment } from './assessment'
import { groupByModel, questionRatings, type EvaluationRecord } from './stats'

/** Shared rating questions shown as columns, at most. */
const MAX_RATING_COLUMNS = 4

export interface ComparisonColumn {
  questionId: string
  label: string
}

export interface ComparisonRow {
  key: string
  label: string
  responses: number
  /** Classified answers behind the split. */
  assessed: number
  /** Whole percentages summing to 100; null without classified answers. */
  percents: Record<Sentiment, number> | null
  /** Average per column (same order as `columns`); null where the row has no rating. */
  ratingAverages: (number | null)[]
}

export interface Comparison {
  columns: ComparisonColumn[]
  rows: ComparisonRow[]
}

interface Group {
  key: string
  label: string
  records: EvaluationRecord[]
}

/** Rating questions (by id) answered in at least two groups, most answers first. */
function sharedRatingColumns(groups: Group[]): ComparisonColumn[] {
  const seen = new Map<string, { label: string; newest: string; groups: Set<string>; answers: number }>()
  for (const g of groups) {
    for (const r of g.records) {
      for (const q of r.snapshot?.questions ?? []) {
        if (q.type !== 'rating') continue
        const value = r.answers.find((a) => a.questionId === q.questionId)?.value
        if (typeof value !== 'number' || !Number.isInteger(value) || value < RATING_MIN || value > RATING_MAX) continue
        const entry = seen.get(q.questionId) ?? { label: q.label, newest: r.submittedAt, groups: new Set(), answers: 0 }
        if (r.submittedAt >= entry.newest) {
          entry.label = q.label
          entry.newest = r.submittedAt
        }
        entry.groups.add(g.key)
        entry.answers += 1
        seen.set(q.questionId, entry)
      }
    }
  }
  return [...seen.entries()]
    .filter(([, e]) => e.groups.size >= 2)
    .sort((a, b) => b[1].answers - a[1].answers || a[0].localeCompare(b[0]))
    .slice(0, MAX_RATING_COLUMNS)
    .map(([questionId, e]) => ({ questionId, label: e.label }))
}

function compare(groups: Group[]): Comparison {
  const columns = sharedRatingColumns(groups)
  const rows = groups.map((g) => {
    const counts = { positive: 0, neutral: 0, negative: 0 }
    for (const r of g.records) for (const s of classifyEvaluation(r)) counts[s] += 1
    return {
      key: g.key,
      label: g.label,
      responses: g.records.length,
      assessed: counts.positive + counts.neutral + counts.negative,
      percents: percentsSummingTo100(counts),
      ratingAverages: columns.map((c) => questionRatings(g.records, c.questionId).average),
    }
  })
  return { columns, rows }
}

/** One row per project, in the order of `projects` (projects without responses included). */
export function compareProjects(records: EvaluationRecord[], projects: { id: number; label: string }[]): Comparison {
  return compare(
    projects.map((p) => ({ key: String(p.id), label: p.label, records: records.filter((r) => r.projectId === p.id) })),
  )
}

/** One row per model, most responses first. */
export function compareModels(records: EvaluationRecord[]): Comparison {
  return compare(groupByModel(records))
}
