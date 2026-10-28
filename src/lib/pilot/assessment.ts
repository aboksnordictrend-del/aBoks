// «Samlet vurdering og utvikling» — the overall split of evaluation answers into positive, neutral
// and negative, and how that split develops over time. Pure, like ./stats, and additive: nothing
// here changes a figure that ./stats computes.
//
// ── What one observation is ──
//
//   One classified answer to one evaluating question. Twenty evaluations with five evaluating
//   answers each give a hundred observations. The shares describe answers, not people.
//
// ── Which answers are classified ──
//
//   Every evaluation is read through its OWN questionnaire snapshot (question type, options and
//   their flags as the participant saw them), so editing a questionnaire later — or reusing a
//   question id for a different question — never reinterprets an old answer. The analysis category
//   plays no part, except that the two legacy evaluating categories keep counting (see below).
//
//   • Rating («Vurderingsskala 1–5»), every rating question: 4–5 positive, 3 neutral, 1–2
//     negative. The scale is assumed to run from worst (1) to best (5), as the form presents it.
//   • Evaluating choice questions (./stats `isEvaluatingChoice`) — a single choice or dropdown on
//     which the administrator marked at least one option «Positivt svar», or a Ja / Nei question
//     marked «Telles i samlet vurdering» (Ja positive, Nei negative). That explicit mark is what
//     says the question evaluates aBoks; without it, a choice question is descriptive (model,
//     place, frequency, …) and never counts. For compatibility, questions saved with the legacy
//     categories «Bedre organisering» and «Ønsker å fortsette» (including Ja / Nei) count as
//     evaluating, as they always did.
//     Within an evaluating question:
//       – an option marked «Holdes utenfor gjennomsnitt og andeler» is never classified;
//       – an option marked «Positivt svar» is positive;
//       – otherwise the option's whole label must be a known answer word (exact match after
//         normalising case, spacing and trailing punctuation — no substring matching):
//         positive «Ja», neutral «Delvis» / «Kanskje» / …, negative «Nei» / ….
//       An option that matches none of them is left out rather than guessed. A positive-looking
//       label that the questionnaire marked otherwise is not overruled, and a label that contradicts
//       its own «Positivt svar» mark is left out.
//   • Nothing else: free text, multiple choice, unmarked Ja / Nei and choice questions without a
//     «Positivt svar» option never count, whatever their answer text says.
//   • As in ./stats, an evaluation without product experience (an «Ingen produkterfaring» answer)
//     contributes no evaluating answer at all — no rating, no evaluating choice. Snapshots from
//     before that flag keep their original rule: ratings and «Bedre organisering» left out,
//     «Ønsker å fortsette» still counted.
//   • Unanswered questions, values that are not an option of the snapshot and evaluations without a
//     snapshot contribute nothing.

import { RATING_MAX, RATING_MIN } from './constants'
import type { StoredAnswer } from './answers'
import type { PublicOption, PublicQuestion } from './questionnaire'
import { isEvaluatingChoice, needsProductExperience, noExperienceSource, type EvaluationRecord } from './stats'
import { bucketFor, enumerateBuckets, type Grouping } from '../analytics/period'

export type Sentiment = 'positive' | 'neutral' | 'negative'

export const SENTIMENTS: readonly Sentiment[] = ['positive', 'neutral', 'negative']

export interface SentimentCounts {
  positive: number
  neutral: number
  negative: number
}

export interface SentimentSplit {
  counts: SentimentCounts
  /** Classified answers — the base of every share. */
  total: number
  /** Full-precision shares (0–1); null without classified answers. */
  shares: Record<Sentiment, number> | null
  /** Whole percentages for display, summing to exactly 100; null without classified answers. */
  percents: Record<Sentiment, number> | null
}

export interface AssessmentPoint extends SentimentSplit {
  /** Bucket key (YYYY-MM-DD, YYYY-Www or YYYY-MM, Oslo time). */
  key: string
  label: string
  /** Evaluations in this period that contributed at least one classified answer. */
  evaluations: number
}

export interface OverallAssessment extends SentimentSplit {
  /** Evaluations that contributed at least one classified answer. */
  evaluations: number
  /** One point per period from the first to the last contributing answer. Empty periods have
   *  total 0 and null shares — no values are invented for them. */
  timeline: Record<Grouping, AssessmentPoint[]>
}

export { isEvaluatingChoice }

/** Exact answer words, normalised (see normalizeLabel). Not substrings. */
const ANSWER_WORDS: Record<Sentiment, readonly string[]> = {
  positive: ['ja', 'ja absolutt', 'ja helt', 'ja definitivt', 'ja gjerne'],
  neutral: ['delvis', 'kanskje', 'til dels', 'i noen grad', 'noe', 'litt', 'muligens'],
  negative: ['nei', 'nei ikke', 'ikke i det hele tatt', 'nei absolutt ikke', 'nei definitivt ikke'],
}

function normalizeLabel(label: string): string {
  return label
    .toLocaleLowerCase('nb')
    .replace(/[,.!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordSentiment(label: string): Sentiment | null {
  const n = normalizeLabel(label)
  for (const s of SENTIMENTS) if (ANSWER_WORDS[s].includes(n)) return s
  return null
}

/** Sentiment of one option of an evaluating choice question, or null when it is not classifiable. */
export function classifyOption(option: PublicOption): Sentiment | null {
  if (option.excludeFromAverages) return null
  const byWord = wordSentiment(option.label)
  if (option.isPositive) return byWord == null || byWord === 'positive' ? 'positive' : null
  if (byWord === 'positive') return null
  return byWord
}

export function classifyRating(value: unknown): Sentiment | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < RATING_MIN || value > RATING_MAX) return null
  if (value >= 4) return 'positive'
  if (value === 3) return 'neutral'
  return 'negative'
}

/** Sentiment of one answer read against the question it answered, or null when it does not count. */
export function classifyAnswer(question: PublicQuestion, answer: StoredAnswer | undefined): Sentiment | null {
  if (!answer) return null
  if (question.type === 'rating') return classifyRating(answer.value)
  if (!isEvaluatingChoice(question)) return null
  if (typeof answer.value !== 'string') return null
  const option = question.options.find((o) => o.value === answer.value)
  return option ? classifyOption(option) : null
}

/** Every classified answer of one evaluation, read through its own snapshot. */
export function classifyEvaluation(record: EvaluationRecord): Sentiment[] {
  if (!record.snapshot) return []
  const noExperience = noExperienceSource(record)
  const out: Sentiment[] = []
  for (const q of record.snapshot.questions) {
    if (noExperience && needsProductExperience(q, noExperience)) continue
    const s = classifyAnswer(
      q,
      record.answers.find((a) => a.questionId === q.questionId),
    )
    if (s) out.push(s)
  }
  return out
}

/**
 * Whole percentages that sum to exactly 100 (largest remainder). Ties go to the earlier category,
 * so the result is deterministic. Null when there is nothing to divide.
 */
export function percentsSummingTo100(counts: SentimentCounts): Record<Sentiment, number> | null {
  const total = counts.positive + counts.neutral + counts.negative
  if (total === 0) return null
  const raw = SENTIMENTS.map((s) => (counts[s] / total) * 100)
  const floors = raw.map(Math.floor)
  let left = 100 - floors.reduce((a, b) => a + b, 0)
  const order = SENTIMENTS.map((_, i) => i).sort((a, b) => raw[b]! - floors[b]! - (raw[a]! - floors[a]!) || a - b)
  for (const i of order) {
    if (left <= 0) break
    floors[i]! += 1
    left -= 1
  }
  return { positive: floors[0]!, neutral: floors[1]!, negative: floors[2]! }
}

function split(counts: SentimentCounts): SentimentSplit {
  const total = counts.positive + counts.neutral + counts.negative
  return {
    counts,
    total,
    shares:
      total === 0
        ? null
        : { positive: counts.positive / total, neutral: counts.neutral / total, negative: counts.negative / total },
    percents: percentsSummingTo100(counts),
  }
}

const zero = (): SentimentCounts => ({ positive: 0, neutral: 0, negative: 0 })

function timeline(
  classified: { record: EvaluationRecord; sentiments: Sentiment[] }[],
  grouping: Grouping,
): AssessmentPoint[] {
  if (classified.length === 0) return []
  const buckets = new Map<string, { counts: SentimentCounts; evaluations: number }>()
  for (const { record, sentiments } of classified) {
    const { key } = bucketFor(new Date(record.submittedAt), grouping)
    const b = buckets.get(key) ?? { counts: zero(), evaluations: 0 }
    for (const s of sentiments) b.counts[s] += 1
    b.evaluations += 1
    buckets.set(key, b)
  }
  const times = classified.map((c) => new Date(c.record.submittedAt).getTime())
  const first = new Date(Math.min(...times)).toISOString()
  const end = new Date(Math.max(...times) + 1).toISOString()
  return enumerateBuckets({ from: first, to: end }, grouping).map(({ key, label }) => {
    const b = buckets.get(key)
    return { key, label, evaluations: b?.evaluations ?? 0, ...split(b?.counts ?? zero()) }
  })
}

export function computeOverallAssessment(records: EvaluationRecord[]): OverallAssessment {
  const classified = records
    .map((record) => ({ record, sentiments: classifyEvaluation(record) }))
    .filter((c) => c.sentiments.length > 0)
  const counts = zero()
  for (const c of classified) for (const s of c.sentiments) counts[s] += 1
  return {
    ...split(counts),
    evaluations: classified.length,
    timeline: {
      day: timeline(classified, 'day'),
      week: timeline(classified, 'week'),
      month: timeline(classified, 'month'),
    },
  }
}
