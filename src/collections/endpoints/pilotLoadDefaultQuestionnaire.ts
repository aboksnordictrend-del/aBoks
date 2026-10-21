import type { Endpoint, PayloadRequest } from 'payload'
import type { PilotProject } from '@/payload-types'
import { DEFAULT_CLOSING, DEFAULT_INTRO, PILOT_PROJECTS_SLUG } from '@/lib/pilot/constants'
import { defaultQuestions } from '@/lib/pilot/defaultQuestionnaire'

/**
 * POST /api/pilot-projects/:id/load-default-questionnaire — «Last inn standard spørreskjema».
 *
 * Replaces the project's questions, introduction and closing message with a fresh copy of the
 * default template. Goes through a normal Payload update, so every project rule applies (question
 * ids, validation, version bump). Evaluations already submitted keep their own snapshot and are
 * unaffected. Administrator-only.
 */
export async function handleLoadDefaultQuestionnaire(req: PayloadRequest): Promise<Response> {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if ((req.user as { role?: string }).role !== 'admin') {
    return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
  }
  const id = req.routeParams?.id as string | undefined
  if (!id) return Response.json({ error: 'Mangler prosjekt-ID.' }, { status: 400 })

  try {
    await req.payload.update({
      collection: PILOT_PROJECTS_SLUG,
      id,
      data: {
        // The template uses the same shape as the admin array (QuestionConfig ⊂ the generated row type).
        questions: defaultQuestions() as NonNullable<PilotProject['questions']>,
        intro: DEFAULT_INTRO,
        closingMessage: DEFAULT_CLOSING,
      },
      overrideAccess: false,
      user: req.user,
      req,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ukjent feil'
    req.payload.logger.warn(`[pilot] load default questionnaire failed for ${id}: ${message}`)
    return Response.json({ error: `Kunne ikke laste inn standard spørreskjema: ${message}` }, { status: 400 })
  }
  return Response.json({ ok: true })
}

export const loadDefaultQuestionnaireEndpoint: Endpoint = {
  path: '/:id/load-default-questionnaire',
  method: 'post',
  handler: handleLoadDefaultQuestionnaire,
}
