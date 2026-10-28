// Pilot analytics («Pilotanalyse»). Pure — every figure the dashboard and the overview show is
// computed here from stored evaluations, so it can be tested without a database.
//
// ── Rules ──
//
//   • Each evaluation is read through its OWN questionnaire snapshot. A question is identified by
//     its question id and type — never by its text, its position or its analysis category — so
//     later edits to a project's questionnaire never change how an old answer counts.
//   • How an answer counts follows from the question type alone: ratings get an average and a
//     distribution, choice questions a count and share per option, text questions are listed.
//     The analysis category only decides under which heading a question is shown.
//   • Unanswered questions are not answers: they count in no average and in no share.
//   • Product experience: an evaluation that picked an option marked «Ingen produkterfaring»
//     (legacy snapshots: a kept-out option of the «Bruksfrekvens» question) has no product
//     experience to report. Its evaluating answers — ratings and evaluating choice questions (see
//     `isEvaluatingChoice`) — are left out of averages and shares, and counted per question as
//     «uten produkterfaring». Descriptive answers still count. Legacy snapshots keep their rule.
//   • Within a single question, an option marked «Holdes utenfor gjennomsnitt og andeler» (e.g.
//     «Vet ikke») is counted and shown, but kept out of the base of that question's percentages.
//   • A response is an anonymous submission, not a person. Nothing here deduplicates or claims
//     unique participants.

import {
  CATEGORY_KEYS,
  RATING_MAX,
  RATING_MIN,
  UNCATEGORIZED_LABEL,
  categoryLabel,
  categoryOf,
  type CategoryKey,
  type QuestionType,
  type StatKey,
} from './constants'
import type { AnswerValue, StoredAnswer } from './answers'
import type { PublicQuestion, QuestionnaireSnapshot } from './questionnaire'
import { bucketFor, enumerateBuckets, osloDateKey } from '../analytics/period'

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

export interface RatingTrendPoint {
  /** Month key (YYYY-MM, Oslo time). */
  key: string
  label: string
  average: number | null
  count: number
}

export interface WrittenAnswer {
  evaluationId: string | number
  projectId: number | null
  submittedAt: string
  questionId: string
  questionLabel: string
  text: string
  modelLabel: string | null
}

export interface QuestionSummary {
  /** `questionId|type`: a question id reused for a different type is a different question. */
  key: string
  questionId: string
  label: string
  type: QuestionType
  statKey: StatKey | null
  /** Universal category (legacy categories mapped); null = «Andre spørsmål». */
  category: CategoryKey | null
  answered: number
  /** Answers (included in `answered`) left out of averages and shares: no product experience. */
  withoutExperience: number
  /** Projects whose evaluations contain this question. */
  projects: number
  distribution: Distribution | null
  rating: RatingSummary | null
  /** Average per month, from the first to the last month with a rating; null for other types. */
  ratingTrend: RatingTrendPoint[] | null
  /** Text answers, newest first; null for other types. */
  written: WrittenAnswer[] | null
}

export interface QuestionGroup {
  category: CategoryKey | null
  label: string
  questions: QuestionSummary[]
}

export interface PilotStats {
  totalResponses: number
  /** Evaluations left out of product-experience figures (no product experience yet). */
  withoutProductExperience: number
  /** Every rating answer of every rating question, pooled (all on the same 1–5 scale). */
  ratings: RatingSummary & { questions: number }
  /** Non-empty text answers. */
  writtenCount: number
  models: Distribution
  timeline: { date: string; count: number }[]
  questions: QuestionSummary[]
  /** `questions` under the six categories in fixed order, then «Andre spørsmål»; empty groups left out. */
  groups: QuestionGroup[]
}

// ── Helpers ──

const round1 = (n: number) => Math.round(n * 10) / 10

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

const isTextQuestion = (type: QuestionType) => type === 'shortText' || type === 'longText'

/**
 * How an evaluation says it has not used the product yet, or null when it does not:
 *   • 'flag'   — it picked an option marked «Ingen produkterfaring» (every snapshot taken since
 *                that flag exists, including those of questionnaires still on legacy categories);
 *   • 'legacy' — a snapshot from before the flag: it picked a kept-out option of the question in
 *                the legacy «Bruksfrekvens» category.
 */
export function noExperienceSource(record: EvaluationRecord): 'flag' | 'legacy' | null {
  let legacy = false
  for (const q of record.snapshot?.questions ?? []) {
    if (q.type !== 'singleChoice' && q.type !== 'dropdown') continue
    const a = answerFor(record, q.questionId)
    if (!a || typeof a.value !== 'string') continue
    const option = q.options.find((o) => o.value === a.value)
    if (!option) continue
    if (option.noProductExperience === true) return 'flag'
    if (q.statKey === 'frequency' && option.excludeFromAverages) legacy = true
  }
  return legacy ? 'legacy' : null
}

export function lacksProductExperience(record: EvaluationRecord): boolean {
  return noExperienceSource(record) != null
}

/** Legacy categories whose choice questions always counted as evaluating (kept for old questionnaires). */
const LEGACY_EVALUATING_KEYS: readonly StatKey[] = ['organization', 'continue']

/**
 * True when a choice question evaluates aBoks, read from the snapshot's own metadata — never from
 * its wording or its (universal) category:
 *   • single choice / dropdown with at least one option marked «Positivt svar»;
 *   • Ja / Nei marked «Telles i samlet vurdering»;
 *   • for compatibility, any of these types in the legacy categories «Bedre organisering» and
 *     «Ønsker å fortsette», which always counted.
 */
export function isEvaluatingChoice(q: Pick<PublicQuestion, 'type' | 'statKey' | 'options' | 'countInAssessment'>): boolean {
  const single = q.type === 'singleChoice' || q.type === 'dropdown'
  if (q.statKey && LEGACY_EVALUATING_KEYS.includes(q.statKey)) return single || q.type === 'yesNo'
  if (q.type === 'yesNo') return q.countInAssessment === true
  return single && q.options.some((o) => o.isPositive)
}

/**
 * Whether an answer to `q` is left out because the evaluation has no product experience (see
 * `noExperienceSource`). Evaluating answers — ratings and evaluating choice questions — are left
 * out; descriptive answers (model, place, frequency, free text, …) still count. Snapshots from
 * before the «Ingen produkterfaring» flag keep their original rule: ratings and «Bedre
 * organisering» only («Ønsker å fortsette» still counted).
 */
export function needsProductExperience(
  q: Pick<PublicQuestion, 'type' | 'statKey' | 'options' | 'countInAssessment'>,
  source: 'flag' | 'legacy',
): boolean {
  if (q.type === 'rating') return true
  if (source === 'legacy') return q.statKey === 'organization'
  return isEvaluatingChoice(q)
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

function registerOptions(t: Tally, question: PublicQuestion) {
  for (const o of question.options) registerOption(t, o.label, o.excludeFromAverages, o.isPositive)
}

/** Counts one answer to a choice-type question (single, dropdown, multiple or Ja / Nei). */
function tallyChoice(t: Tally, question: PublicQuestion, answer: StoredAnswer | undefined) {
  registerOptions(t, question)
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
 * question an answer is in the base when at least one of its picks is not a kept-out option, and
 * each option's share is the share of those answers that picked it — so a multiple-choice
 * question's shares may add up to more than 100 %.
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

/** Monthly averages from the first to the last month with a rating; empty months have no average. */
function ratingTrend(points: { at: string; value: number }[]): RatingTrendPoint[] {
  if (points.length === 0) return []
  const months = new Map<string, { sum: number; count: number }>()
  const times: number[] = []
  for (const p of points) {
    const { key } = bucketFor(new Date(p.at), 'month')
    const m = months.get(key) ?? { sum: 0, count: 0 }
    m.sum += p.value
    m.count += 1
    months.set(key, m)
    times.push(new Date(p.at).getTime())
  }
  const period = {
    from: new Date(Math.min(...times)).toISOString(),
    to: new Date(Math.max(...times) + 1).toISOString(),
  }
  return enumerateBuckets(period, 'month').map(({ key, label }) => {
    const m = months.get(key)
    return { key, label, average: m ? round1(m.sum / m.count) : null, count: m?.count ?? 0 }
  })
}

/** Identity of a question across evaluations: the same id AND the same type. */
export const questionKey = (q: Pick<PublicQuestion, 'questionId' | 'type'>) => `${q.questionId}|${q.type}`

/**
 * One summary per question (id + type) across all evaluations, labelled and categorised by the
 * newest snapshot that contains it. Answers of different questions are never combined, whatever
 * their category; an id reused for another question type is summarised as a separate question.
 */
function questionSummaries(records: EvaluationRecord[]): QuestionSummary[] {
  interface Acc {
    question: PublicQuestion
    newest: string
    answered: number
    withoutExperience: number
    projects: Set<number | null>
    tally: Tally
    base: number
    positive: number
    ratings: { at: string; value: number }[]
    written: WrittenAnswer[]
  }
  const acc = new Map<string, Acc>()
  const order: string[] = []
  for (const r of records) {
    const noExperience = noExperienceSource(r)
    for (const q of r.snapshot?.questions ?? []) {
      const key = questionKey(q)
      let entry = acc.get(key)
      if (!entry) {
        entry = {
          question: q,
          newest: r.submittedAt,
          answered: 0,
          withoutExperience: 0,
          projects: new Set(),
          tally: newTally(),
          base: 0,
          positive: 0,
          ratings: [],
          written: [],
        }
        acc.set(key, entry)
        order.push(key)
      } else if (r.submittedAt > entry.newest) {
        entry.question = q
        entry.newest = r.submittedAt
      }
      entry.projects.add(r.projectId)
      const a = answerFor(r, q.questionId)
      const leftOut = noExperience != null && needsProductExperience(q, noExperience)
      if (q.type === 'rating') {
        const v = ratingValue(a)
        if (v != null) {
          entry.answered += 1
          if (leftOut) entry.withoutExperience += 1
          else entry.ratings.push({ at: r.submittedAt, value: v })
        }
        continue
      }
      if (isTextQuestion(q.type)) {
        if (a && typeof a.value === 'string' && a.value.trim() !== '') {
          entry.answered += 1
          entry.written.push({
            evaluationId: r.id,
            projectId: r.projectId,
            submittedAt: r.submittedAt,
            questionId: q.questionId,
            questionLabel: a.questionLabel || q.label,
            text: a.value,
            modelLabel: r.modelLabel,
          })
        }
        continue
      }
      if (a && !isEmpty(a.value)) entry.answered += 1
      if (leftOut) {
        if (a && !isEmpty(a.value)) entry.withoutExperience += 1
        registerOptions(entry.tally, q)
        continue
      }
      tallyChoice(entry.tally, q, a)
      const counted = countsInBase(q, a)
      if (counted) {
        entry.base += 1
        if (counted.positive) entry.positive += 1
      }
    }
  }
  return order.map((key) => {
    const e = acc.get(key)!
    const q = e.question
    const isChoice = q.type !== 'rating' && !isTextQuestion(q.type)
    return {
      key,
      questionId: q.questionId,
      label: q.label,
      type: q.type,
      statKey: q.statKey,
      category: categoryOf(q.statKey),
      answered: e.answered,
      withoutExperience: e.withoutExperience,
      projects: e.projects.size,
      distribution: isChoice ? finishTally(e.tally, e.base, e.positive) : null,
      rating: q.type === 'rating' ? summarizeRatings(e.ratings.map((p) => p.value)) : null,
      ratingTrend: q.type === 'rating' ? ratingTrend(e.ratings) : null,
      written: isTextQuestion(q.type) ? e.written.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) : null,
    }
  })
}

function groupQuestions(questions: QuestionSummary[]): QuestionGroup[] {
  const keys: (CategoryKey | null)[] = [...CATEGORY_KEYS, null]
  return keys
    .map((category) => ({
      category,
      label: category ? categoryLabel(category) : UNCATEGORIZED_LABEL,
      questions: questions.filter((q) => q.category === category),
    }))
    .filter((g) => g.questions.length > 0)
}

/** Every applicable rating answer of `records`, pooled (all rating questions share the 1–5 scale). */
export function pooledRatings(records: EvaluationRecord[]): RatingSummary & { questions: number } {
  const values: number[] = []
  const questions = new Set<string>()
  for (const r of records) {
    if (lacksProductExperience(r)) continue
    for (const q of r.snapshot?.questions ?? []) {
      if (q.type !== 'rating') continue
      const v = ratingValue(answerFor(r, q.questionId))
      if (v == null) continue
      values.push(v)
      questions.add(questionKey(q))
    }
  }
  return { ...summarizeRatings(values), questions: questions.size }
}

/** Ratings of one rating question (by id) over `records`, without evaluations lacking experience. */
export function questionRatings(records: EvaluationRecord[], questionId: string): RatingSummary {
  const values: number[] = []
  for (const r of records) {
    if (lacksProductExperience(r)) continue
    const q = r.snapshot?.questions.find((x) => x.questionId === questionId && x.type === 'rating')
    const v = q ? ratingValue(answerFor(r, q.questionId)) : null
    if (v != null) values.push(v)
  }
  return summarizeRatings(values)
}

// ── Public API ──

export function computePilotStats(records: EvaluationRecord[]): PilotStats {
  const questions = questionSummaries(records)
  return {
    totalResponses: records.length,
    withoutProductExperience: records.filter(lacksProductExperience).length,
    ratings: pooledRatings(records),
    writtenCount: questions.reduce((n, q) => n + (q.written?.length ?? 0), 0),
    models: modelDistribution(records),
    timeline: responsesOverTime(records),
    questions,
    groups: groupQuestions(questions),
  }
}

/** Key of the model an evaluation is about: `id:<product id>` or `label:<text>`; null without one. */
export function modelKey(r: Pick<EvaluationRecord, 'modelId' | 'modelLabel'>): string | null {
  if (r.modelId != null) return `id:${r.modelId}`
  if (r.modelLabel) return `label:${r.modelLabel}`
  return null
}

/** Evaluations grouped by model and labelled by each model's newest label; most responses first. */
export function groupByModel(
  records: EvaluationRecord[],
): { key: string; label: string; records: EvaluationRecord[] }[] {
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
    .map(([key, g]) => ({ key, label: g.label, records: g.records }))
    .sort((a, b) => b.records.length - a.records.length || a.label.localeCompare(b.label, 'nb'))
}

/** The distinct models present in `records`, for the model filter. */
export function modelOptions(records: EvaluationRecord[]): { key: string; label: string }[] {
  return groupByModel(records).map(({ key, label }) => ({ key, label }))
}
