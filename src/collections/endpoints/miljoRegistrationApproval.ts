import type { Endpoint, PayloadRequest } from 'payload'
import { resolveApplicationOrigin } from '@/lib/appOrigin'
import { SITE_URL } from '@/lib/site'
import {
  approveRegistration,
  registrationReview,
  rejectRegistration,
  saveInternalNotes,
  type Administrator,
  type ApprovalDeps,
  type ApprovalResult,
} from '@/lib/miljo/registration/approval'
import { isAdminUser, isStaffUser } from '@/lib/security/staffAccess'

/**
 * Administrator endpoints for self-registration approval (Stage 2.6). All are administrator-only,
 * checked here on the server: an applicant has no account at all, and a Miljø account or an editor
 * is refused like anyone else.
 *
 *   GET  /api/miljo-registrations/:id/review   what the review panel shows
 *   POST /api/miljo-registrations/:id/approve  { verificationMethod, note? }
 *   POST /api/miljo-registrations/:id/reject   { reason }
 *   POST /api/miljo-registrations/:id/notes    { notes }
 */

const NO_STORE = { 'Cache-Control': 'no-store' }

function administrator(req: PayloadRequest): Administrator | Response {
  if (!isStaffUser(req.user)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  if (!isAdminUser(req.user)) return Response.json({ error: 'Kun for administratorer.' }, { status: 403, headers: NO_STORE })
  const user = req.user as unknown as { id: number | string; email?: unknown }
  return { id: user.id, email: typeof user.email === 'string' ? user.email : '' }
}

function routeId(req: PayloadRequest): number | null {
  const raw = req.routeParams?.id
  return typeof raw === 'string' && /^\d{1,12}$/.test(raw) ? Number(raw) : typeof raw === 'number' ? raw : null
}

async function body(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const data = await req.json?.()
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function deps(req: PayloadRequest): ApprovalDeps {
  return {
    payload: req.payload,
    sendEmail: async (message) => {
      await req.payload.sendEmail(message)
    },
    siteUrl: resolveApplicationOrigin({ fallback: SITE_URL }),
  }
}

function reply(result: ApprovalResult): Response {
  if (!result.ok) return Response.json({ error: result.message, field: result.field }, { status: result.status, headers: NO_STORE })
  return Response.json(result, { headers: NO_STORE })
}

const action =
  (run: (d: ApprovalDeps, admin: Administrator, id: number, input: Record<string, unknown>) => Promise<ApprovalResult>) =>
  async (req: PayloadRequest): Promise<Response> => {
    const admin = administrator(req)
    if (admin instanceof Response) return admin
    const id = routeId(req)
    if (id == null) return Response.json({ error: 'Ugyldig ID.' }, { status: 400, headers: NO_STORE })
    return reply(await run(deps(req), admin, id, await body(req)))
  }

async function handleReview(req: PayloadRequest): Promise<Response> {
  const admin = administrator(req)
  if (admin instanceof Response) return admin
  const id = routeId(req)
  if (id == null) return Response.json({ error: 'Ugyldig ID.' }, { status: 400, headers: NO_STORE })
  const review = await registrationReview(req, admin, id)
  if (!review) return Response.json({ error: 'Fant ikke registreringen.' }, { status: 404, headers: NO_STORE })
  return Response.json(review, { headers: NO_STORE })
}

export const miljoRegistrationApprovalEndpoints: Endpoint[] = [
  { path: '/:id/review', method: 'get', handler: handleReview },
  { path: '/:id/approve', method: 'post', handler: action((d, a, id, i) => approveRegistration(d, a, id, { verificationMethod: i.verificationMethod, note: i.note })) },
  { path: '/:id/reject', method: 'post', handler: action((d, a, id, i) => rejectRegistration(d, a, id, { reason: i.reason })) },
  { path: '/:id/notes', method: 'post', handler: action((d, a, id, i) => saveInternalNotes(d, a, id, { notes: i.notes })) },
]
