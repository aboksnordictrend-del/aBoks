// Server-side validation of a participant's answers against the questionnaire they were shown.
// Pure. The public form validates too, for friendliness; this is the check that counts.

import { PILOT_LIMITS, RATING_MAX, RATING_MIN, isChoiceType, type QuestionType } from './constants'
import type { PublicQuestion } from './questionnaire'

export type AnswerValue = string | number | string[]

/** One answered question, as stored on an evaluation. Unanswered questions are not stored. */
export interface StoredAnswer {
  questionId: string
  questionLabel: string
  questionType: QuestionType
  value: AnswerValue
  /** Human-readable form of `value` (multiple choices joined with «, »). */
  displayValue: string
}

/** Raw submitted values per question id. A multiple-choice question may carry several. */
export type RawAnswers = Map<string, string[]>

export type AnswerValidationResult =
  | { ok: true; answers: StoredAnswer[] }
  | { ok: false; errors: Record<string, string>; message?: string }

/** Form field name for a question. The prefix keeps answer fields apart from the form's own fields. */
export const answerFieldName = (questionId: string) => `q:${questionId}`

/** Collects the `q:*` fields of a submitted form. */
export function rawAnswersFromFormData(formData: FormData): RawAnswers {
  const raw: RawAnswers = new Map()
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('q:')) continue
    if (typeof value !== 'string') {
      // A file where text was expected: keep the key so the question is rejected, not ignored.
      raw.set(key.slice(2), [...(raw.get(key.slice(2)) ?? []), '\u0000file'])
      continue
    }
    raw.set(key.slice(2), [...(raw.get(key.slice(2)) ?? []), value])
  }
  return raw
}

/** Removes control characters (keeping line breaks and tabs) and trims. */
export function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
}

const REQUIRED = 'Dette spørsmålet må besvares.'
const INVALID = 'Ugyldig svar. Velg et av alternativene.'

/**
 * Validates every submitted value against `questions` — the enabled questions of the version the
 * participant was shown. Rejects the whole submission when it carries an answer to a question that
 * is not in that questionnaire (an old or hand-made form), and reports field-level errors for
 * missing required answers and for values that are not valid for their question type.
 */
export function validateAnswers(questions: PublicQuestion[], raw: RawAnswers): AnswerValidationResult {
  const known = new Set(questions.map((q) => q.questionId))
  for (const key of raw.keys()) {
    if (!known.has(key)) {
      return {
        ok: false,
        errors: {},
        message: 'Skjemaet inneholder spørsmål som ikke finnes i denne undersøkelsen. Last siden på nytt og prøv igjen.',
      }
    }
  }

  const errors: Record<string, string> = {}
  const answers: StoredAnswer[] = []

  for (const q of questions) {
    const values = (raw.get(q.questionId) ?? []).map((v) => (typeof v === 'string' ? v : '\u0000'))
    const base = { questionId: q.questionId, questionLabel: q.label, questionType: q.type }

    // A NUL character never comes from a real form field (it marks an uploaded file, see
    // rawAnswersFromFormData) — reject instead of silently cleaning it away.
    if (values.some((v) => v.includes('\u0000'))) {
      errors[q.questionId] = 'Ugyldig svar.'
      continue
    }

    if (q.type === 'shortText' || q.type === 'longText') {
      if (values.length > 1) {
        errors[q.questionId] = 'Ugyldig svar.'
        continue
      }
      const text = cleanText(values[0] ?? '')
      const max = q.type === 'shortText' ? PILOT_LIMITS.shortTextMax : PILOT_LIMITS.longTextMax
      if (text.length > max) {
        errors[q.questionId] = `Svaret kan ha maks ${max} tegn.`
      } else if (!text) {
        if (q.required) errors[q.questionId] = REQUIRED
      } else {
        answers.push({ ...base, value: text, displayValue: text })
      }
      continue
    }

    if (q.type === 'rating') {
      const nonEmpty = values.filter((v) => v.trim() !== '')
      if (nonEmpty.length === 0) {
        if (q.required) errors[q.questionId] = 'Velg en verdi fra 1 til 5.'
        continue
      }
      const pattern = new RegExp(`^[${RATING_MIN}-${RATING_MAX}]$`)
      if (nonEmpty.length > 1 || !pattern.test(nonEmpty[0]!.trim())) {
        errors[q.questionId] = 'Velg en verdi fra 1 til 5.'
        continue
      }
      const n = Number(nonEmpty[0]!.trim())
      answers.push({ ...base, value: n, displayValue: String(n) })
      continue
    }

    // Single choice, dropdown, multiple choice and Ja / Nei: values must be exact option values.
    const allowed = new Set(q.options.map((o) => o.value))
    const picked = values.filter((v) => v !== '')
    if (picked.length === 0) {
      if (q.required) errors[q.questionId] = q.type === 'multipleChoice' ? 'Velg minst ett alternativ.' : REQUIRED
      continue
    }
    if (picked.some((v) => !allowed.has(v))) {
      errors[q.questionId] = INVALID
      continue
    }
    if (q.type === 'multipleChoice') {
      const unique = q.options.map((o) => o.value).filter((v) => picked.includes(v))
      answers.push({ ...base, value: unique, displayValue: unique.join(', ') })
      continue
    }
    if (picked.length > 1 || !(isChoiceType(q.type) || q.type === 'yesNo')) {
      errors[q.questionId] = 'Velg bare ett alternativ.'
      continue
    }
    answers.push({ ...base, value: picked[0]!, displayValue: picked[0]! })
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, answers }
}

/**
 * The question that asks which aBoks model was used: the first single-answer question whose
 * options come from the project's models («Prosjektets aBoks-modeller»). Found by that structure,
 * not by its category. A question still carrying the legacy «aBoks-modell» category counts too, so
 * a model question with hand-typed options keeps working as before.
 */
export function modelQuestion(questions: PublicQuestion[]): PublicQuestion | undefined {
  const single = (q: PublicQuestion) => q.type === 'singleChoice' || q.type === 'dropdown'
  return (
    questions.find((q) => single(q) && q.options.some((o) => o.modelId != null)) ??
    questions.find((q) => single(q) && q.statKey === 'model')
  )
}

/**
 * The aBoks model an evaluation is about, read from the answer to the model question (see
 * `modelQuestion`). `modelId` is set only when the chosen option is one of the project's models;
 * an option such as «Flere modeller» gives a label without an id.
 */
export function modelFromAnswers(
  questions: PublicQuestion[],
  answers: StoredAnswer[],
): { modelId: number | null; modelLabel: string | null } {
  const question = modelQuestion(questions)
  if (!question) return { modelId: null, modelLabel: null }
  const answer = answers.find((a) => a.questionId === question.questionId)
  if (!answer || typeof answer.value !== 'string') return { modelId: null, modelLabel: null }
  const option = question.options.find((o) => o.value === answer.value)
  return { modelId: option?.modelId ?? null, modelLabel: answer.value }
}
