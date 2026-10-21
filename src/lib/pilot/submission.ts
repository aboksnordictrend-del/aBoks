import type { Payload } from 'payload'
import type { PilotProject, Product } from '@/payload-types'
import { PILOT_EVALUATIONS_SLUG, PILOT_PROJECTS_SLUG, isPilotStatus, type PilotStatus } from './constants'
import {
  resolvePublicQuestions,
  type PilotModel,
  type QuestionConfig,
  type QuestionnaireSnapshot,
} from './questionnaire'
import { modelFromAnswers, validateAnswers, type RawAnswers } from './answers'
import { validatePilotSlug } from './slug'

/**
 * Public-questionnaire access to pilot projects, with Payload injected (the server-only wrapper in
 * ./server passes the real client; tests pass a stub). Everything runs through the local API with
 * overrideAccess (both collections are closed to the public), and only the public questionnaire
 * leaves this module — never contact details, notes, description or status history.
 */

/** The slice of the Payload local API this module uses. */
export type PilotPayload = Pick<Payload, 'find' | 'findByID' | 'create' | 'logger'>

export type PilotPageState = PilotStatus | 'notFound'

export type PilotPageResolution =
  | { kind: 'redirect'; slug: string }
  | {
      kind: 'page'
      state: PilotPageState
      /** Present only when the form may be shown: an active project, or any project in preview. */
      view?: { projectId: number; name: string; snapshot: QuestionnaireSnapshot }
    }

function modelsOf(project: PilotProject): PilotModel[] {
  const out: PilotModel[] = []
  for (const m of project.models ?? []) {
    if (typeof m === 'object' && m && typeof (m as Product).title === 'string') {
      out.push({ id: (m as Product).id, title: (m as Product).title })
    }
  }
  return out
}

/** The questionnaire as a participant sees it — and as each evaluation stores it. */
export function buildSnapshot(project: PilotProject): QuestionnaireSnapshot {
  return {
    version: project.questionnaireVersion ?? 1,
    intro: project.intro ?? '',
    closingMessage: project.closingMessage ?? '',
    questions: resolvePublicQuestions((project.questions ?? []) as QuestionConfig[], modelsOf(project)),
  }
}

/**
 * Resolves /pilot/[slug]. An earlier slug of a project redirects to its current one. A project
 * that is not active shows only a status message — unless `preview` is set (a logged-in
 * administrator), which shows the form for any status with submission disabled by the page.
 */
export async function resolvePilotPage(
  payload: PilotPayload,
  slug: string,
  { preview }: { preview: boolean },
): Promise<PilotPageResolution> {
  if (validatePilotSlug(slug) !== null) return { kind: 'page', state: 'notFound' }

  const found = await payload.find({
    collection: PILOT_PROJECTS_SLUG,
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  const project = found.docs[0]

  if (!project) {
    const moved = await payload.find({
      collection: PILOT_PROJECTS_SLUG,
      where: { 'slugHistory.slug': { equals: slug } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      select: { slug: true },
    })
    const target = moved.docs[0]?.slug
    if (target && target !== slug) return { kind: 'redirect', slug: target }
    return { kind: 'page', state: 'notFound' }
  }

  const state: PilotStatus = isPilotStatus(project.status) ? project.status : 'draft'
  if (state !== 'active' && !preview) return { kind: 'page', state }
  return {
    kind: 'page',
    state,
    view: { projectId: project.id, name: project.name, snapshot: buildSnapshot(project) },
  }
}

export type SubmitPilotResult =
  | { ok: true; evaluationId: number | string; closingMessage: string }
  | { ok: false; reason: 'closed' | 'stale' | 'invalid' | 'error'; message?: string; errors?: Record<string, string> }

/**
 * Stores one anonymous evaluation. The project is identified by its id (never by the slug or by
 * anything the participant typed), its status is re-checked here, and the answers are validated
 * against the questionnaire version the participant was shown — if the project has moved to a new
 * version since the page loaded, the submission is refused rather than mapped onto changed questions.
 */
export async function submitPilotEvaluation(
  payload: PilotPayload,
  input: { projectId: number; version: number; raw: RawAnswers },
): Promise<SubmitPilotResult> {

  let project: PilotProject | null = null
  try {
    project = await payload.findByID({
      collection: PILOT_PROJECTS_SLUG,
      id: input.projectId,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    project = null
  }
  if (!project || project.status !== 'active') {
    return { ok: false, reason: 'closed', message: 'Denne undersøkelsen tar ikke imot svar for øyeblikket.' }
  }

  const snapshot = buildSnapshot(project)
  if (input.version !== snapshot.version) {
    return {
      ok: false,
      reason: 'stale',
      message: 'Spørreskjemaet er oppdatert siden siden ble åpnet. Last siden på nytt og send inn på nytt.',
    }
  }

  const result = validateAnswers(snapshot.questions, input.raw)
  if (!result.ok) return { ok: false, reason: 'invalid', errors: result.errors, message: result.message }

  const { modelId, modelLabel } = modelFromAnswers(snapshot.questions, result.answers)

  try {
    const created = await payload.create({
      collection: PILOT_EVALUATIONS_SLUG,
      overrideAccess: true,
      data: {
        project: project.id,
        projectName: project.name,
        organization: project.organization,
        model: modelId,
        modelLabel,
        questionnaireVersion: snapshot.version,
        questionnaireSnapshot: snapshot as unknown as Record<string, unknown>,
        submittedAt: new Date().toISOString(),
        answers: result.answers.map((a) => ({
          questionId: a.questionId,
          questionLabel: a.questionLabel,
          questionType: a.questionType,
          displayValue: a.displayValue,
          // Always an object: Payload reads a bare string in a json field as JSON text.
          value: { answer: a.value },
        })),
      },
    })
    return { ok: true, evaluationId: created.id, closingMessage: snapshot.closingMessage }
  } catch (err) {
    payload.logger.error(`[pilot] evaluation create failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return { ok: false, reason: 'error', message: 'Noe gikk galt. Prøv igjen om litt.' }
  }
}
