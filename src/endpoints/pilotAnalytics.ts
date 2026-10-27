// GET /api/pilot-analytics — data behind «Pilotanalyse» (/admin/pilotanalyse).
//
// Administrator-only (role 'admin', like every other pilot surface). Statistics are computed here
// on the server by the pure functions in @/lib/pilot/stats; only aggregates and the anonymous
// written answers leave this handler. `?format=csv` returns the filtered evaluations as CSV.
//
// Query: project=<id>|all, from=YYYY-MM-DD, to=YYYY-MM-DD (Oslo days), model=<model key>.

import type { Endpoint, PayloadRequest, Where } from 'payload'
import type { PilotEvaluation, PilotProject } from '@/payload-types'
import { PILOT_EVALUATIONS_SLUG, PILOT_PROJECTS_SLUG, isQuestionType } from '../lib/pilot/constants'
import { osloDateKey, resolvePeriod } from '../lib/analytics/period'
import {
  compareModels,
  compareProjects,
  computePilotStats,
  modelKey,
  modelOptions,
  type EvaluationRecord,
} from '../lib/pilot/stats'
import { computeOverallAssessment } from '../lib/pilot/assessment'
import { evaluationsCsv, type CsvProjectInfo } from '../lib/pilot/csv'
import type { AnswerValue, StoredAnswer } from '../lib/pilot/answers'
import type { QuestionnaireSnapshot } from '../lib/pilot/questionnaire'
import { pilotPublicUrl } from '../lib/pilot/urls'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

class BadRequest extends Error {}

export interface PilotAnalyticsQuery {
  projectId: number | null
  from?: string
  to?: string
  model?: string
  format: 'json' | 'csv'
}

function str(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (typeof raw === 'string' && raw !== '') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0] !== '') return raw[0]
  return undefined
}

export function parsePilotQuery(query: Record<string, unknown>): PilotAnalyticsQuery {
  const projectRaw = str(query, 'project')
  let projectId: number | null = null
  if (projectRaw && projectRaw !== 'all') {
    if (!/^\d+$/.test(projectRaw)) throw new BadRequest('Ugyldig prosjekt.')
    projectId = Number(projectRaw)
  }
  const from = str(query, 'from')
  const to = str(query, 'to')
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    throw new BadRequest('Datoer må være på formatet ÅÅÅÅ-MM-DD.')
  }
  if (from && to && from > to) throw new BadRequest('Startdato kan ikke være etter sluttdato.')
  const model = str(query, 'model')
  if (model && (model.length > 200 || !/^(id|label):/.test(model))) throw new BadRequest('Ugyldig modell.')
  return { projectId, from, to, model, format: str(query, 'format') === 'csv' ? 'csv' : 'json' }
}

/** Stored answers are `{ answer: <value> }` (see @/lib/pilot/submission). */
export function unwrapAnswerValue(stored: unknown): AnswerValue {
  if (stored && typeof stored === 'object' && !Array.isArray(stored) && 'answer' in stored) {
    return (stored as { answer: AnswerValue }).answer
  }
  return stored as AnswerValue
}

function asSnapshot(value: unknown): QuestionnaireSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const s = value as QuestionnaireSnapshot
  return Array.isArray(s.questions) ? s : null
}

export function toRecord(doc: PilotEvaluation): EvaluationRecord {
  const projectId = typeof doc.project === 'object' && doc.project ? doc.project.id : (doc.project as number | null)
  const modelId = typeof doc.model === 'object' && doc.model ? doc.model.id : ((doc.model as number | null) ?? null)
  const answers: StoredAnswer[] = []
  for (const a of doc.answers ?? []) {
    if (!a.questionId || !isQuestionType(a.questionType)) continue
    answers.push({
      questionId: a.questionId,
      questionLabel: a.questionLabel ?? '',
      questionType: a.questionType,
      value: unwrapAnswerValue(a.value),
      displayValue: a.displayValue ?? '',
    })
  }
  return {
    id: doc.id,
    projectId: projectId ?? null,
    submittedAt: doc.submittedAt,
    modelId,
    modelLabel: doc.modelLabel ?? null,
    answers,
    snapshot: asSnapshot(doc.questionnaireSnapshot),
  }
}

async function loadEvaluations(req: PayloadRequest, q: PilotAnalyticsQuery): Promise<EvaluationRecord[]> {
  const and: Where[] = []
  if (q.from || q.to) {
    const period = resolvePeriod('custom', { customFrom: q.from ?? '2000-01-01', customTo: q.to ?? '2999-12-31' })
    if (q.from) and.push({ submittedAt: { greater_than_equal: period.from } })
    if (q.to) and.push({ submittedAt: { less_than: period.to } })
  }
  const result = await req.payload.find({
    collection: PILOT_EVALUATIONS_SLUG,
    where: and.length ? { and } : undefined,
    depth: 0,
    limit: 0,
    pagination: false,
    sort: 'submittedAt',
    overrideAccess: true,
    req,
  })
  return (result.docs as PilotEvaluation[]).map(toRecord)
}

export async function handlePilotAnalytics(req: PayloadRequest): Promise<Response> {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if ((req.user as { role?: string }).role !== 'admin') {
    return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
  }

  let q: PilotAnalyticsQuery
  try {
    q = parsePilotQuery((req.query ?? {}) as Record<string, unknown>)
  } catch (err) {
    return Response.json({ error: err instanceof BadRequest ? err.message : 'Ugyldig forespørsel.' }, { status: 400 })
  }

  try {
    const projectsResult = await req.payload.find({
      collection: PILOT_PROJECTS_SLUG,
      depth: 0,
      limit: 0,
      pagination: false,
      sort: '-createdAt',
      overrideAccess: true,
      req,
      select: {
        name: true,
        slug: true,
        organization: true,
        organizationType: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    })
    const projects = projectsResult.docs as PilotProject[]

    const inPeriod = await loadEvaluations(req, q)
    const byModel = q.model ? inPeriod.filter((r) => modelKey(r) === q.model) : inPeriod
    const selected = q.projectId != null ? byModel.filter((r) => r.projectId === q.projectId) : byModel

    if (q.format === 'csv') {
      const info = new Map<number, CsvProjectInfo>(
        projects.map((p) => [p.id, { name: p.name, organization: p.organization }]),
      )
      const csv = evaluationsCsv(selected, info)
      const stamp = osloDateKey(new Date())
      const project = q.projectId != null ? projects.find((p) => p.id === q.projectId) : undefined
      const name = `pilotevalueringer-${project?.slug ?? 'alle'}-${stamp}.csv`
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${name}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const modelScope = q.projectId != null ? inPeriod.filter((r) => r.projectId === q.projectId) : inPeriod
    return Response.json(
      {
        filters: { project: q.projectId, from: q.from ?? null, to: q.to ?? null, model: q.model ?? null },
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          url: p.slug ? pilotPublicUrl(p.slug) : null,
          organization: p.organization,
          organizationType: p.organizationType,
          status: p.status,
          startDate: p.startDate ?? null,
          endDate: p.endDate ?? null,
        })),
        modelOptions: modelOptions(modelScope),
        stats: computePilotStats(selected),
        // «Samlet vurdering og utvikling»: same selection (project, period, model) as `stats`.
        assessment: computeOverallAssessment(selected),
        comparison: {
          // Across all projects: respects the period and model filters, not the project filter.
          projects: compareProjects(
            byModel,
            projects.map((p) => ({ id: p.id, label: `${p.name} – ${p.organization}` })),
          ),
          // Across models: respects the period and project filters, not the model filter.
          models: compareModels(modelScope),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    req.payload.logger.error(`[pilot-analytics] failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return Response.json({ error: 'Kunne ikke hente pilotanalysen.' }, { status: 500 })
  }
}

export const pilotAnalyticsEndpoint: Endpoint = {
  path: '/pilot-analytics',
  method: 'get',
  handler: handlePilotAnalytics,
}
