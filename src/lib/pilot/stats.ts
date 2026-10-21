// Pilot analytics («Pilotanalyse»). Pure — every figure the dashboard and the overview show is
// computed here from stored evaluations, so it can be tested without a database.
//
// ── Rules ──
//
//   • Each evaluation is read through its OWN questionnaire snapshot. A question is found by its
//     analysis category (or, for the per-question tables, its question id) — never by its text or
//     position — so later edits to a project's questionnaire never change how an old answer counts.
//   • Unanswered questions are not answers: they count in no average and in no share.
//   • Product experience: an evaluation whose «Bruksfrekvens» answer is an option marked
//     «Holdes utenfor gjennomsnitt og andeler» (by default «Ikke brukt ennå») has no product
//     experience to report. Its ratings and its «Bedre organisering» answer are left out. Its other
//     answers — model, frequency, wish to continue, written feedback — still count.
//   • Within a single question, an option with that mark (e.g. «Vet ikke») is counted and shown,
//     but kept out of the base of that question's percentages.
//   • A response is an anonymous submission, not a person. Nothing here deduplicates or claims
//     unique participants.

import { RATING_MAX, RATING_MIN, type QuestionType, type StatKey } from './constants'
import type { AnswerValue, StoredAnswer } from './answers'
import type { PublicQuestion, QuestionnaireSnapshot } from './questionnaire'
import { osloDateKey } from '../analytics/period'

export interface EvaluationRecord {
  id: string | number
  projectId: number | null
  submittedAt: string
  modelId: number | null
  modelLabel: string | null
  answers: StoredAnswer[]
  snapshot: QuestionnaireSnapshot | null
}

export interface DistributionEntry {
  label: string
  count: number
  /** Share of the question's base (0–1), or null for an option kept out of the base. */
  share: number | null
  excluded: boolean
}

export interface Distribution {
  entries: DistributionEntry[]
  /** Answers in this question. */
  answered: number
  /** Answers that count towards percentages (answered minus options kept out). */
  base: number
  /** Share of positive answers in the base (options marked positive), or null without a base. */
  positiveShare: number | null
}

export interface RatingSummary {
  average: number | null
  count: number
  distribution: { value: number; count: number }[]
}

export interface WrittenAnswer {
  evaluationId: string | number
  projectId: number | null
  submittedAt: string
  category: StatKey | null
  questionId: string
  questionLabel: string
  text: string
  modelLabel: string | null
}

export interface QuestionSummary {
  questionId: string
  label: string
  type: QuestionType
  statKey: StatKey | null
  answered: number
  distribution: Distribution | null
  rating: RatingSummary | null
}

export interface PilotStats {
  totalResponses: number
  /** Evaluations left out of product-experience figures (no product experience yet). */
  withoutProductExperience: number
  usability: RatingSummary
  usefulness: RatingSummary
  models: Distribution
  frequency: Distribution
  organization: Distribution
  continueUsing: Distribution
  written: WrittenAnswer[]
  timeline: { date: string; count: number }[]
  questions: QuestionSummary[]
}

// ── Helpers ──

const round1 = (n: number) => Math.round(n * 10) / 10

function questionFor(record: EvaluationRecord, key: StatKey): PublicQuestion | undefined {
  return record.snapshot?.questions.find((q) => q.statKey === key)
}

function answerFor(record: EvaluationRecord, questionId: string | undefined): StoredAnswer | undefined {
  if (!questionId) return undefined
  return record.answers.find((a) => a.questionId === questionId)
}

function isEmpty(value: AnswerValue | undefined | null): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** True when the evaluation's frequency answer says there is no product experience yet. */
export function lacksProductExperience(record: EvaluationRecord): boolean {
  const q = questionFor(record, 'frequency')
  const a = answerFor(record, q?.questionId)
  if (!q || !a || typeof a.value !== 'string') return false
  return q.options.find((o) => o.value === a.value)?.excludeFromAverages === true
}

function ratingValue(a: StoredAnswer | undefined): number | null {
  if (!a || typeof a.value !== 'number') return null
  if (!Number.isInteger(a.value) || a.value < RATING_MIN || a.value > RATING_MAX) return null
  return a.value
}

function summarizeRatings(values: number[]): RatingSummary {
  const distribution: { value: number; count: number }[] = []
  for (let v = RATING_MIN; v <= RATING_MAX; v++) {
    distribution.push({ value: v, count: values.filter((x) => x === v).length })
  }
  if (values.length === 0) return { average: null, count: 0, distribution }
  const sum = values.reduce((s, v) => s + v, 0)
  return { average: round1(sum / values.length), count: values.length, distribution }
}

interface Tally {
  order: string[]
  counts: Map<string, number>
  excluded: Set<string>
  positive: Set<string>
  answered: number
}

const newTally = (): Tally => ({ order: [], counts: new Map(), excluded: new Set(), positive: new Set(), answered: 0 })

function registerOption(t: Tally, label: string, excluded: boolean, positive: boolean) {
  if (!t.counts.has(label)) {
    t.counts.set(label, 0)
    t.order.push(label)
  }
  if (excluded) t.excluded.add(label)
  if (positive) t.positive.add(label)
}

/** Counts one answer to a choice-type question (single, dropdown, multiple or Ja / Nei). */
function tallyChoice(t: Tally, question: PublicQuestion, answer: StoredAnswer | undefined) {
  for (const o of question.options) registerOption(t, o.label, o.excludeFromAverages, o.isPositive)
  if (!answer || isEmpty(answer.value)) return
  const picked = Array.isArray(answer.value) ? answer.value : [String(answer.value)]
  t.answered += 1
  for (const label of picked) {
    const option = question.options.find((o) => o.value === label)
    registerOption(t, label, option?.excludeFromAverages ?? false, option?.isPositive ?? false)
    t.counts.set(label, (t.counts.get(label) ?? 0) + 1)
  }
}

/**
 * Turns a tally into a distribution. The base counts answers, not ticks: for a multiple-choice
 * question an answer is in the base when at least one of its picks is not a kept-out option.
 */
function finishTally(t: Tally, answersInBase: number, positiveAnswers: number): Distribution {
  const entries = t.order.map((label) => {
    const count = t.counts.get(label) ?? 0
    const excluded = t.excluded.has(label)
    return {
      label,
      count,
      excluded,
      share: excluded || answersInBase === 0 ? null : count / answersInBase,
    }
  })
  return {
    entries,
    answered: t.answered,
    base: answersInBase,
    positiveShare: answersInBase === 0 ? null : positiveAnswers / answersInBase,
  }
}

/** Distribution of one analysis category across evaluations, each read via its own snapshot. */
function categoryDistribution(
  records: EvaluationRecord[],
  key: StatKey,
  include: (r: EvaluationRecord) => boolean = () => true,
): Distribution {
  const t = newTally()
  let base = 0
  let positive = 0
  for (const r of records) {
    if (!include(r)) continue
    const q = questionFor(r, key)
    if (!q) continue
    const a = answerFor(r, q.questionId)
    tallyChoice(t, q, a)
    const counted = countsInBase(q, a)
    if (counted) {
      base += 1
      if (counted.positive) positive += 1
    }
  }
  return finishTally(t, base, positive)
}

function countsInBase(q: PublicQuestion, a: StoredAnswer | undefined): { positive: boolean } | null {
  if (!a || isEmpty(a.value)) return null
  const picked = Array.isArray(a.value) ? a.value : [String(a.value)]
  const options = picked.map((v) => q.options.find((o) => o.value === v))
  const inBase = options.some((o) => !o?.excludeFromAverages)
  if (!inBase) return null
  return { positive: options.some((o) => o?.isPositive === true) }
}

/** Model distribution, keyed by the stored model (id when known, label otherwise). */
function modelDistribution(records: EvaluationRecord[]): Distribution {
  const t = newTally()
  const labelByKey = new Map<string, string>()
  const keyOf = (r: EvaluationRecord) => (r.modelId != null ? `id:${r.modelId}` : `label:${r.modelLabel}`)
  // The newest label wins for a model id, so a renamed product shows under its current name.
  const newestFirst = [...records].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  for (const r of newestFirst) {
    if (!r.modelLabel) continue
    const key = keyOf(r)
    if (!labelByKey.has(key)) labelByKey.set(key, r.modelLabel)
  }
  let base = 0
  for (const r of records) {
    if (!r.modelLabel) continue
    const label = labelByKey.get(keyOf(r)) ?? r.modelLabel
    registerOption(t, label, false, false)
    t.counts.set(label, (t.counts.get(label) ?? 0) + 1)
    t.answered += 1
    base += 1
  }
  t.order.sort((a, b) => (t.counts.get(b) ?? 0) - (t.counts.get(a) ?? 0) || a.localeCompare(b, 'nb'))
  return finishTally(t, base, 0)
}

const WRITTEN_CATEGORIES: readonly (StatKey | null)[] = ['improvements', 'comments', 'location', 'room', null]

function writtenAnswers(records: EvaluationRecord[]): WrittenAnswer[] {
  const out: WrittenAnswer[] = []
  for (const r of records) {
    for (const q of r.snapshot?.questions ?? []) {
      if (q.type !== 'shortText' && q.type !== 'longText') continue
      if (!WRITTEN_CATEGORIES.includes(q.statKey)) continue
      const a = answerFor(r, q.questionId)
      if (!a || typeof a.value !== 'string' || a.value.trim() === '') continue
      out.push({
        evaluationId: r.id,
        projectId: r.projectId,
        submittedAt: r.submittedAt,
        category: q.statKey,
        questionId: q.questionId,
        questionLabel: a.questionLabel || q.label,
        text: a.value,
        modelLabel: r.modelLabel,
      })
    }
  }
  return out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
}

/** Responses per Oslo calendar day, with every day between the first and the last filled in. */
export function responsesOverTime(records: EvaluationRecord[]): { date: string; count: number }[] {
  if (records.length === 0) return []
  const counts = new Map<string, number>()
  for (const r of records) {
    const key = osloDateKey(new Date(r.submittedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const keys = [...counts.keys()].sort()
  const out: { date: string; count: number }[] = []
  const cursor = new Date(`${keys[0]}T12:00:00Z`)
  const last = keys[keys.length - 1]!
  for (let guard = 0; guard < 4000; guard++) {
    const key = cursor.toISOString().slice(0, 10)
    out.push({ date: key, count: counts.get(key) ?? 0 })
    if (key >= last) break
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

/** One summary per question id across all evaluations, labelled by the newest snapshot. */
function questionSummaries(records: EvaluationRecord[]): QuestionSummary[] {
  interface Acc {
    question: PublicQuestion
    newest: string
    answered: number
    tally: Tally
    base: number
    positive: number
    ratings: number[]
  }
  const acc = new Map<string, Acc>()
  const order: string[] = []
  for (const r of records) {
    const noExperience = lacksProductExperience(r)
    for (const q of r.snapshot?.questions ?? []) {
      let entry = acc.get(q.questionId)
      if (!entry) {
        entry = { question: q, newest: r.submittedAt, answered: 0, tally: newTally(), base: 0, positive: 0, ratings: [] }
        acc.set(q.questionId, entry)
        order.push(q.questionId)
      } else if (r.submittedAt > entry.newest) {
        entry.question = q
        entry.newest = r.submittedAt
      }
      const a = answerFor(r, q.questionId)
      if (q.type === 'rating') {
        const v = ratingValue(a)
        if (v != null) {
          entry.answered += 1
          if (!noExperience) entry.ratings.push(v)
        }
        continue
      }
      if (q.type === 'shortText' || q.type === 'longText') {
        if (a && !isEmpty(a.value)) entry.answered += 1
        continue
      }
      tallyChoice(entry.tally, q, a)
      if (a && !isEmpty(a.value)) entry.answered += 1
      const counted = countsInBase(q, a)
      if (counted) {
        entry.base += 1
        if (counted.positive) entry.positive += 1
      }
    }
  }
  return order.map((id) => {
    const e = acc.get(id)!
    const q = e.question
    const isChoice = q.type !== 'rating' && q.type !== 'shortText' && q.type !== 'longText'
    return {
      questionId: id,
      label: q.label,
      type: q.type,
      statKey: q.statKey,
      answered: e.answered,
      distribution: isChoice ? finishTally(e.tally, e.base, e.positive) : null,
      rating: q.type === 'rating' ? summarizeRatings(e.ratings) : null,
    }
  })
}

function categoryRatings(records: EvaluationRecord[], key: 'usability' | 'usefulness'): RatingSummary {
  const values: number[] = []
  for (const r of records) {
    if (lacksProductExperience(r)) continue
    const v = ratingValue(answerFor(r, questionFor(r, key)?.questionId))
    if (v != null) values.push(v)
  }
  return summarizeRatings(values)
}

// ── Public API ──

export function computePilotStats(records: EvaluationRecord[]): PilotStats {
  return {
    totalResponses: records.length,
    withoutProductExperience: records.filter(lacksProductExperience).length,
    usability: categoryRatings(records, 'usability'),
    usefulness: categoryRatings(records, 'usefulness'),
    models: modelDistribution(records),
    frequency: categoryDistribution(records, 'frequency'),
    organization: categoryDistribution(records, 'organization', (r) => !lacksProductExperience(r)),
    continueUsing: categoryDistribution(records, 'continue'),
    written: writtenAnswers(records),
    timeline: responsesOverTime(records),
    questions: questionSummaries(records),
  }
}

export interface ComparisonRow {
  key: string
  label: string
  responses: number
  usabilityAverage: number | null
  usefulnessAverage: number | null
  organizationPositiveShare: number | null
  continuePositiveShare: number | null
}

function comparisonRow(key: string, label: string, records: EvaluationRecord[]): ComparisonRow {
  return {
    key,
    label,
    responses: records.length,
    usabilityAverage: categoryRatings(records, 'usability').average,
    usefulnessAverage: categoryRatings(records, 'usefulness').average,
    organizationPositiveShare: categoryDistribution(records, 'organization', (r) => !lacksProductExperience(r))
      .positiveShare,
    continuePositiveShare: categoryDistribution(records, 'continue').positiveShare,
  }
}

/** One comparison row per project, in the order of `projects` (projects without responses included). */
export function compareProjects(
  records: EvaluationRecord[],
  projects: { id: number; label: string }[],
): ComparisonRow[] {
  return projects.map((p) =>
    comparisonRow(
      String(p.id),
      p.label,
      records.filter((r) => r.projectId === p.id),
    ),
  )
}

/** Key of the model an evaluation is about: `id:<product id>` or `label:<text>`; null without one. */
export function modelKey(r: Pick<EvaluationRecord, 'modelId' | 'modelLabel'>): string | null {
  if (r.modelId != null) return `id:${r.modelId}`
  if (r.modelLabel) return `label:${r.modelLabel}`
  return null
}

/** One comparison row per model, most responses first. */
export function compareModels(records: EvaluationRecord[]): ComparisonRow[] {
  const groups = new Map<string, { label: string; newest: string; records: EvaluationRecord[] }>()
  for (const r of records) {
    const key = modelKey(r)
    if (!key) continue
    const g = groups.get(key)
    if (!g) groups.set(key, { label: r.modelLabel ?? '', newest: r.submittedAt, records: [r] })
    else {
      g.records.push(r)
      if (r.submittedAt > g.newest && r.modelLabel) {
        g.label = r.modelLabel
        g.newest = r.submittedAt
      }
    }
  }
  return [...groups.entries()]
    .map(([key, g]) => comparisonRow(key, g.label, g.records))
    .sort((a, b) => b.responses - a.responses || a.label.localeCompare(b.label, 'nb'))
}

/** The distinct models present in `records`, for the model filter. */
export function modelOptions(records: EvaluationRecord[]): { key: string; label: string }[] {
  return compareModels(records).map((row) => ({ key: row.key, label: row.label }))
}
