// Questionnaire model: the admin-side configuration, its validation, and the resolved public
// form that a participant sees (and that every evaluation stores as an immutable snapshot).
// Pure — no Payload, no database.

import {
  PILOT_LIMITS,
  RATING_MAX,
  RATING_MIN,
  YES_NO_OPTIONS,
  isChoiceType,
  isQuestionType,
  isStatKey,
  isTextType,
  type OptionSource,
  type QuestionType,
  type StatKey,
} from './constants'

// ── Admin configuration (shape of the `questions` array on a pilot project) ──

export interface QuestionOptionConfig {
  id?: string | null
  label?: string | null
  excludeFromAverages?: boolean | null
  isPositive?: boolean | null
}

export interface QuestionConfig {
  /** Payload's own array-row id. Changes nothing here except duplicate resolution. */
  id?: string | null
  questionId?: string | null
  type?: QuestionType | string | null
  label?: string | null
  placeholder?: string | null
  helpText?: string | null
  required?: boolean | null
  enabled?: boolean | null
  statKey?: StatKey | string | null
  optionsSource?: OptionSource | string | null
  options?: QuestionOptionConfig[] | null
  scaleMinLabel?: string | null
  scaleMaxLabel?: string | null
}

/** A participating aBoks model as the public form needs it. */
export interface PilotModel {
  id: number
  title: string
}

// ── Public / snapshot shape ──

export interface PublicOption {
  /** The submitted value. Option labels are unique within a question, so the label is the key. */
  value: string
  label: string
  excludeFromAverages: boolean
  isPositive: boolean
  /** Set when the option stands for one of the project's aBoks models. */
  modelId?: number
}

export interface PublicQuestion {
  questionId: string
  type: QuestionType
  label: string
  placeholder: string
  helpText: string
  required: boolean
  statKey: StatKey | null
  options: PublicOption[]
  scaleMinLabel: string
  scaleMaxLabel: string
}

/** What a participant is shown — and, verbatim, what every evaluation stores. */
export interface QuestionnaireSnapshot {
  version: number
  intro: string
  closingMessage: string
  questions: PublicQuestion[]
}

// ── Question ids ──

const QUESTION_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function isValidQuestionId(value: unknown): value is string {
  return typeof value === 'string' && QUESTION_ID_PATTERN.test(value)
}

/** A fresh, collision-resistant question id (`q-` + 10 base-36 characters). */
export function generateQuestionId(random: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < 10; i++) out += Math.floor(random() * 36).toString(36)
  return `q-${out}`
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Gives every question a stable, unique `questionId` before it is saved.
 *
 *   • A question without an id gets a new one.
 *   • Two rows with the same id happen when an administrator duplicates a row in the admin. The
 *     row that already carried that id in the stored document (matched on Payload's own row id)
 *     keeps it — historical evaluations point at that question — and every other copy gets a
 *     fresh id. Without a stored match, the first occurrence keeps it.
 *
 * Returns new objects; the input is not mutated.
 */
export function assignQuestionIds(
  questions: QuestionConfig[],
  previous: QuestionConfig[] = [],
  newId: () => string = () => generateQuestionId(),
): QuestionConfig[] {
  const ownerRowById = new Map<string, string>()
  for (const q of previous) {
    const qid = str(q.questionId)
    if (qid && q.id && !ownerRowById.has(qid)) ownerRowById.set(qid, q.id)
  }

  // Which row may keep each id: the stored owner if it is still present, else the first one.
  const keeper = new Map<string, number>()
  questions.forEach((q, index) => {
    const qid = str(q.questionId)
    if (!isValidQuestionId(qid)) return
    const owner = ownerRowById.get(qid)
    if (owner && q.id === owner) keeper.set(qid, index)
  })
  questions.forEach((q, index) => {
    const qid = str(q.questionId)
    if (isValidQuestionId(qid) && !keeper.has(qid)) keeper.set(qid, index)
  })

  const used = new Set<string>(keeper.keys())
  return questions.map((q, index) => {
    const qid = str(q.questionId)
    if (isValidQuestionId(qid) && keeper.get(qid) === index) return { ...q, questionId: qid }
    let fresh = newId()
    while (used.has(fresh)) fresh = newId()
    used.add(fresh)
    return { ...q, questionId: fresh }
  })
}

// ── Validation ──

/** Which question types each analysis category accepts. */
const STAT_KEY_TYPES: Record<StatKey, readonly QuestionType[]> = {
  location: ['shortText', 'longText'],
  room: ['shortText', 'longText'],
  improvements: ['shortText', 'longText'],
  comments: ['shortText', 'longText'],
  usability: ['rating'],
  usefulness: ['rating'],
  model: ['singleChoice', 'dropdown'],
  frequency: ['singleChoice', 'dropdown'],
  organization: ['singleChoice', 'dropdown', 'yesNo'],
  continue: ['singleChoice', 'dropdown', 'yesNo'],
}

export interface ValidateQuestionnaireOptions {
  /** Number of aBoks models selected on the project (for «Prosjektets aBoks-modeller»). */
  modelCount: number
}

/**
 * Every problem with a questionnaire configuration, as Norwegian messages naming the question by
 * its position. An empty list means it can be saved. Runs on the server before every save, so
 * neither the admin form nor a hand-written API call can store an inconsistent questionnaire.
 */
export function validateQuestionnaire(
  questions: QuestionConfig[],
  { modelCount }: ValidateQuestionnaireOptions,
): string[] {
  const errors: string[] = []
  if (questions.length > PILOT_LIMITS.questionsMax) {
    errors.push(`Et spørreskjema kan ha maks ${PILOT_LIMITS.questionsMax} spørsmål.`)
  }

  const seenIds = new Set<string>()
  const statKeyOwner = new Map<string, number>()

  questions.forEach((q, index) => {
    const n = index + 1
    const where = `Spørsmål ${n}`
    const label = str(q.label)
    const qid = str(q.questionId)

    if (!isValidQuestionId(qid)) {
      errors.push(`${where}: ugyldig spørsmåls-ID.`)
    } else if (seenIds.has(qid)) {
      errors.push(`${where}: spørsmåls-ID «${qid}» er brukt mer enn én gang.`)
    } else {
      seenIds.add(qid)
    }

    if (!label) errors.push(`${where}: spørsmålsteksten mangler.`)
    else if (label.length > PILOT_LIMITS.labelMax) {
      errors.push(`${where}: spørsmålsteksten kan ha maks ${PILOT_LIMITS.labelMax} tegn.`)
    }

    if (!isQuestionType(q.type)) {
      errors.push(`${where}: ugyldig spørsmålstype.`)
      return
    }
    const type = q.type

    if (isChoiceType(type)) {
      const options = q.options ?? []
      if (options.length > PILOT_LIMITS.optionsMax) {
        errors.push(`${where}: maks ${PILOT_LIMITS.optionsMax} svaralternativer.`)
      }
      const seenLabels = new Set<string>()
      options.forEach((o, oi) => {
        const ol = str(o.label)
        if (!ol) {
          errors.push(`${where}: svaralternativ ${oi + 1} mangler tekst.`)
          return
        }
        if (ol.length > PILOT_LIMITS.optionLabelMax) {
          errors.push(`${where}: svaralternativ ${oi + 1} kan ha maks ${PILOT_LIMITS.optionLabelMax} tegn.`)
        }
        const key = ol.toLocaleLowerCase('nb')
        if (seenLabels.has(key)) errors.push(`${where}: svaralternativet «${ol}» finnes flere ganger.`)
        seenLabels.add(key)
      })
      const fromModels = q.optionsSource === 'projectModels' ? modelCount : 0
      if (options.length + fromModels === 0) {
        errors.push(
          q.optionsSource === 'projectModels'
            ? `${where}: velg minst én aBoks-modell for prosjektet, eller legg til svaralternativer.`
            : `${where}: legg til minst ett svaralternativ.`,
        )
      }
    }

    if (q.statKey != null && (q.statKey as string) !== '') {
      if (!isStatKey(q.statKey)) {
        errors.push(`${where}: ugyldig analysekategori.`)
      } else {
        if (!STAT_KEY_TYPES[q.statKey].includes(type)) {
          errors.push(`${where}: analysekategorien passer ikke til spørsmålstypen.`)
        }
        if (q.enabled !== false) {
          const owner = statKeyOwner.get(q.statKey)
          if (owner !== undefined) {
            errors.push(
              `${where}: analysekategorien er allerede brukt av spørsmål ${owner}. Hver kategori kan bare brukes av ett aktivt spørsmål.`,
            )
          } else {
            statKeyOwner.set(q.statKey, n)
          }
        }
      }
    }
  })

  return errors
}

// ── Resolution to the public form ──

function resolveOptions(q: QuestionConfig, type: QuestionType, models: PilotModel[]): PublicOption[] {
  if (type === 'yesNo') {
    return YES_NO_OPTIONS.map((o) => ({ value: o.label, ...o }))
  }
  if (!isChoiceType(type)) return []

  const out: PublicOption[] = []
  const seen = new Set<string>()
  const push = (option: PublicOption) => {
    const key = option.label.toLocaleLowerCase('nb')
    if (!option.label || seen.has(key)) return
    seen.add(key)
    out.push(option)
  }
  if (q.optionsSource === 'projectModels') {
    for (const m of models) {
      const label = m.title.trim()
      push({ value: label, label, excludeFromAverages: false, isPositive: false, modelId: m.id })
    }
  }
  for (const o of q.options ?? []) {
    const label = str(o.label)
    push({
      value: label,
      label,
      excludeFromAverages: o.excludeFromAverages === true,
      isPositive: o.isPositive === true,
    })
  }
  return out
}

/**
 * The public questionnaire: enabled questions only, in admin order, with options resolved
 * (project models expanded, Ja / Nei filled in). Internal fields never appear here. A choice
 * question that ends up with no options at all is left out rather than shown unanswerable.
 */
export function resolvePublicQuestions(questions: QuestionConfig[], models: PilotModel[]): PublicQuestion[] {
  const out: PublicQuestion[] = []
  for (const q of questions) {
    if (q.enabled === false) continue
    if (!isQuestionType(q.type)) continue
    const questionId = str(q.questionId)
    const label = str(q.label)
    if (!isValidQuestionId(questionId) || !label) continue
    const type = q.type
    const options = resolveOptions(q, type, models)
    if ((isChoiceType(type) || type === 'yesNo') && options.length === 0) continue
    out.push({
      questionId,
      type,
      label,
      placeholder: isTextType(type) || type === 'dropdown' ? str(q.placeholder) : '',
      helpText: str(q.helpText),
      required: q.required === true,
      statKey: isStatKey(q.statKey) ? q.statKey : null,
      options,
      scaleMinLabel: type === 'rating' ? str(q.scaleMinLabel) : '',
      scaleMaxLabel: type === 'rating' ? str(q.scaleMaxLabel) : '',
    })
  }
  return out
}

/**
 * Canonical text of everything that changes what a participant answers: the questions and their
 * options, and the selected models (they become options). Payload's row ids, the intro and the
 * closing message are left out — editing those does not alter what an answer means. A change of
 * this value moves the project to a new questionnaire version.
 */
export function questionnaireFingerprint(questions: QuestionConfig[], modelIds: number[]): string {
  const canonical = questions.map((q) => ({
    questionId: str(q.questionId),
    type: q.type ?? null,
    label: str(q.label),
    placeholder: str(q.placeholder),
    helpText: str(q.helpText),
    required: q.required === true,
    enabled: q.enabled !== false,
    statKey: q.statKey || null,
    optionsSource: q.optionsSource || 'manual',
    options: (q.options ?? []).map((o) => ({
      label: str(o.label),
      excludeFromAverages: o.excludeFromAverages === true,
      isPositive: o.isPositive === true,
    })),
    scaleMinLabel: str(q.scaleMinLabel),
    scaleMaxLabel: str(q.scaleMaxLabel),
  }))
  return JSON.stringify({ questions: canonical, models: [...modelIds].sort((a, b) => a - b) })
}

export { RATING_MIN, RATING_MAX }
