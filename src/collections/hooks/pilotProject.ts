import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeValidateHook,
  type PayloadRequest,
  type TextFieldSingleValidation,
  type Where,
} from 'payload'
import { PILOT_EVALUATIONS_SLUG, PILOT_PROJECTS_SLUG } from '@/lib/pilot/constants'
import {
  assignQuestionIds,
  dropUnusedOptions,
  questionnaireFingerprint,
  validateQuestionnaire,
  type QuestionConfig,
} from '@/lib/pilot/questionnaire'
import { slugify, uniqueSlug, validatePilotSlug } from '@/lib/pilot/slug'

/**
 * Server rules of a pilot project. They run for every write — the admin form, the REST API and
 * local-API calls alike — so none of them depends on the admin UI behaving.
 *
 *   • Slug: generated from the name when left empty, normalised, unique among current slugs AND
 *     earlier slugs (which keep redirecting — see `recordSlugHistory`), and never a reserved word.
 *   • Questions: every question gets a stable unique id; the questionnaire must validate.
 *   • Versioning: any change to what a participant answers moves the project to a new
 *     questionnaire version. Evaluations store their own snapshot, so history is never rewritten.
 *   • Delete: refused while evaluations exist (archive instead).
 */

type Doc = Record<string, unknown>

type SlugHistoryRow = { id?: string | null; slug?: string | null; changedAt?: string | null }

function relationIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids: number[] = []
  for (const v of value) {
    const raw = typeof v === 'object' && v !== null ? (v as { id?: unknown }).id : v
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
    if (Number.isInteger(n)) ids.push(n)
  }
  return ids
}

/**
 * Refuses a save with a Norwegian message the admin actually sees. A public APIError, not a
 * ValidationError: for these cross-field rules Payload's toast would only name the field path
 * («The following field is invalid: models») and drop the explanation.
 */
function fail(path: string, message: string): never {
  throw new APIError(message, 400, { errors: [{ path, message }] }, true)
}

/** Slugs (current and historical) used by projects other than `ownId`. */
async function slugsInUse(req: PayloadRequest, ownId: unknown): Promise<Set<string>> {
  const where: Where | undefined =
    ownId != null && ownId !== '' ? { id: { not_equals: ownId as number } } : undefined
  const result = await req.payload.find({
    collection: PILOT_PROJECTS_SLUG,
    where,
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
    select: { slug: true, slugHistory: true },
  })
  const taken = new Set<string>()
  for (const doc of result.docs as Doc[]) {
    if (typeof doc.slug === 'string') taken.add(doc.slug)
    for (const row of (doc.slugHistory as SlugHistoryRow[] | undefined) ?? []) {
      if (row.slug) taken.add(row.slug)
    }
  }
  return taken
}

/** Field validator on `slug`: format, reserved words and uniqueness, shown inline in the admin. */
export const validateSlugField: TextFieldSingleValidation = async (value, { req, id }) => {
  // An empty slug is filled from the name in beforeValidate, before this runs on the server. In
  // the admin form it is still empty here — allow it; the server fills it on save.
  if (value == null || value === '') return true
  const problem = validatePilotSlug(value)
  if (problem) return problem
  if (!req?.payload) return true
  const taken = await slugsInUse(req, id)
  if (taken.has(value)) return `URL-slug «${value}» er allerede i bruk (eller har vært brukt) av et annet pilotprosjekt.`
  return true
}

export const prepareProject: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data) return data

  // Slug: normalise what was typed; generate from the name when empty.
  const typed = typeof data.slug === 'string' ? data.slug.trim() : ''
  if (typed) {
    data.slug = slugify(typed) || typed
  } else if (typeof data.name === 'string' && data.name.trim()) {
    const taken = await slugsInUse(req, originalDoc?.id)
    data.slug = uniqueSlug(slugify(data.name), taken)
  }

  if (Array.isArray(data.questions)) {
    data.questions = dropUnusedOptions(
      assignQuestionIds(
        data.questions as QuestionConfig[],
        (originalDoc?.questions as QuestionConfig[] | undefined) ?? [],
      ),
    )
  }
  return data
}

export const enforceProjectRules: CollectionBeforeChangeHook = async ({ data, originalDoc, operation }) => {
  const questions = (
    (Array.isArray(data.questions) ? data.questions : (originalDoc?.questions as unknown[] | undefined)) ?? []
  ) as QuestionConfig[]
  const modelIds = relationIds(data.models !== undefined ? data.models : originalDoc?.models)

  // Questionnaire structure.
  const problems = validateQuestionnaire(questions, { modelCount: modelIds.length })
  if (problems.length > 0) {
    throw new APIError(
      `Spørreskjemaet kan ikke lagres: ${problems.join(' ')}`,
      400,
      { errors: problems.map((message) => ({ path: 'questions', message })) },
      true,
    )
  }

  const status = data.status ?? originalDoc?.status
  if (status === 'active' && !questions.some((q) => q.enabled !== false)) {
    fail('status', 'Et aktivt pilotprosjekt må ha minst ett aktivt spørsmål.')
  }
  // A model question fed from the project's models would otherwise show only its extra options
  // (e.g. «Flere modeller») to participants.
  if (
    status === 'active' &&
    modelIds.length === 0 &&
    questions.some((q) => q.enabled !== false && q.optionsSource === 'projectModels')
  ) {
    fail(
      'models',
      'Velg minst én aBoks-modell under «aBoks-modeller i prosjektet» før prosjektet aktiveres — spørsmålet om modell henter alternativene herfra.',
    )
  }

  const start = data.startDate ?? originalDoc?.startDate
  const end = data.endDate ?? originalDoc?.endDate
  if (start && end && new Date(end as string).getTime() < new Date(start as string).getTime()) {
    fail('endDate', 'Sluttdato kan ikke være før startdato.')
  }

  // Questionnaire version: bump when anything a participant answers changes.
  const fingerprint = questionnaireFingerprint(questions, modelIds)
  if (operation === 'create') {
    data.questionnaireVersion = 1
  } else {
    const previousVersion = Number(originalDoc?.questionnaireVersion) || 1
    data.questionnaireVersion =
      originalDoc?.questionnaireFingerprint && originalDoc.questionnaireFingerprint !== fingerprint
        ? previousVersion + 1
        : previousVersion
  }
  data.questionnaireFingerprint = fingerprint

  // Slug history: the previous slug keeps working as a permanent redirect, so a QR code that is
  // already printed never dies. Server-owned — whatever the client sent is ignored.
  const history = [...(((originalDoc?.slugHistory as SlugHistoryRow[] | undefined) ?? []).map((r) => ({
    slug: r.slug ?? '',
    changedAt: r.changedAt ?? null,
  })))].filter((r) => r.slug)
  const newSlug = typeof data.slug === 'string' ? data.slug : originalDoc?.slug
  const oldSlug = originalDoc?.slug
  if (operation === 'update' && typeof oldSlug === 'string' && oldSlug && oldSlug !== newSlug) {
    if (!history.some((r) => r.slug === oldSlug)) {
      history.push({ slug: oldSlug, changedAt: new Date().toISOString() })
    }
  }
  data.slugHistory = history.filter((r) => r.slug !== newSlug)

  return data
}

export const PILOT_PROJECT_IN_USE_MESSAGE =
  'Pilotprosjektet har innsendte evalueringer og kan ikke slettes. Sett status til «Arkivert» i stedet.'

export const guardProjectDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const evaluations = await req.payload.count({
    collection: PILOT_EVALUATIONS_SLUG,
    where: { project: { equals: id } },
    overrideAccess: true,
    req,
  })
  if (evaluations.totalDocs > 0) throw new APIError(PILOT_PROJECT_IN_USE_MESSAGE, 409)
}
