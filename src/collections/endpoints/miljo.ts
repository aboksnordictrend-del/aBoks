import type { Endpoint, PayloadRequest } from 'payload'
import { BATTERY_DELIVERIES_SLUG, BATTERY_REGISTRATIONS_SLUG, ENV_ORGANIZATIONS_SLUG } from '@/lib/miljo/constants'
import { generatePin, hashPin, validatePinFormat, verifyPin } from '@/lib/miljo/pin'
import { openPin, pinVaultKey, pinVaultStatus, sealPin } from '@/lib/miljo/pinVault'
import { dbPinAttemptStore, pinLockedUntil } from '@/lib/miljo/pinAttempts'
import { validateReason } from '@/lib/miljo/validation'
import {
  correctDelivery,
  correctRegistration,
  invalidateDelivery,
  invalidateRegistration,
  restoreDelivery,
  restoreRegistration,
  reviewRegistration,
  type AdminResult,
} from '@/lib/miljo/admin'
import { newUniqueCode, type MiljoContext } from '../hooks/miljo'

/**
 * Administrator endpoints for Miljøregistrering (all POST except status; all admin-only):
 *
 *   /api/environmental-organizations/:id/miljo-status   GET  PIN state + record counts
 *   /api/environmental-organizations/:id/pin            POST { mode: 'generate' | 'set' | 'clear', pin? }
 *   /api/environmental-organizations/:id/pin-reveal     POST returns the active PIN («Vis PIN»)
 *   /api/environmental-organizations/:id/pin-unlock     POST clears the failed-attempt counter
 *   /api/environmental-organizations/:id/rotate-code    POST { confirmCode, reason } — exceptional
 *   /api/battery-registrations/:id/{correct,invalidate,restore,review}
 *   /api/battery-deliveries/:id/{correct,invalidate,restore}
 *
 * A PIN is never stored or logged in clear text: the hash verifies it, and an AES-256-GCM copy
 * (key outside the database) lets an administrator reveal it through `pin-reveal` — no other
 * response, log line, export or public route ever contains it.
 */

type Doc = Record<string, unknown>

function deny(req: PayloadRequest): Response | null {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if ((req.user as { role?: string }).role !== 'admin') return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
  return null
}

function routeId(req: PayloadRequest): number | null {
  const raw = req.routeParams?.id
  const id = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
  return Number.isInteger(id) && id > 0 ? id : null
}

async function body(req: PayloadRequest): Promise<Doc> {
  try {
    const raw = typeof req.json === 'function' ? await req.json() : undefined
    return raw && typeof raw === 'object' ? (raw as Doc) : {}
  } catch {
    return {}
  }
}

const reply = (result: AdminResult): Response =>
  result.ok ? Response.json({ ok: true }) : Response.json({ error: result.message }, { status: result.status })

function action(path: string, run: (req: PayloadRequest, id: number, body: Doc) => Promise<AdminResult>, label: string): Endpoint {
  return {
    path,
    method: 'post',
    handler: async (req) => {
      const denied = deny(req)
      if (denied) return denied
      const id = routeId(req)
      if (id == null) return Response.json({ error: 'Ugyldig ID.' }, { status: 400 })
      try {
        return reply(await run(req, id, await body(req)))
      } catch (err) {
        req.payload.logger.error(`[miljo] ${label} ${id} failed: ${err instanceof Error ? err.message : 'unknown'}`)
        return Response.json({ error: 'Endringen kunne ikke lagres. Ingenting ble endret.' }, { status: 500 })
      }
    },
  }
}

async function loadOrganization(req: PayloadRequest, id: number): Promise<Doc | null> {
  try {
    return (await req.payload.findByID({ collection: ENV_ORGANIZATIONS_SLUG, id, depth: 0, overrideAccess: true, req })) as unknown as Doc
  } catch {
    return null
  }
}

export async function handleOrganizationStatus(req: PayloadRequest): Promise<Response> {
  const denied = deny(req)
  if (denied) return denied
  const id = routeId(req)
  const org = id == null ? null : await loadOrganization(req, id)
  if (!org || id == null) return Response.json({ error: 'Fant ikke organisasjonen.' }, { status: 404 })
  const [registrations, deliveries, pending] = await Promise.all([
    req.payload.count({ collection: BATTERY_REGISTRATIONS_SLUG, where: { organization: { equals: id } }, overrideAccess: true, req }),
    req.payload.count({ collection: BATTERY_DELIVERIES_SLUG, where: { organization: { equals: id } }, overrideAccess: true, req }),
    req.payload.count({
      collection: BATTERY_REGISTRATIONS_SLUG,
      where: { and: [{ organization: { equals: id } }, { reviewState: { equals: 'pending' } }] },
      overrideAccess: true,
      req,
    }),
  ])
  const lockedUntil = pinLockedUntil(org.pinAttemptCount as number | null, org.pinAttemptWindowStart as string | null)
  return Response.json(
    {
      hasPin: typeof org.pinHash === 'string' && org.pinHash !== '',
      pinSetAt: org.pinSetAt ?? null,
      // Whether «Vis PIN» can work — decided without decrypting anything.
      pinRevealable: typeof org.pinHash === 'string' && org.pinHash !== '' && typeof org.pinEncrypted === 'string' && org.pinEncrypted !== '' && pinVaultStatus().configured,
      pinRevealConfigured: pinVaultStatus().configured,
      pinLockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
      registrations: registrations.totalDocs,
      deliveries: deliveries.totalDocs,
      pendingReview: pending.totalDocs,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export async function handleSetPin(req: PayloadRequest): Promise<Response> {
  const denied = deny(req)
  if (denied) return denied
  const id = routeId(req)
  if (id == null || !(await loadOrganization(req, id))) return Response.json({ error: 'Fant ikke organisasjonen.' }, { status: 404 })
  const data = await body(req)

  let pin: string | null = null
  if (data.mode === 'generate') pin = generatePin()
  else if (data.mode === 'set') {
    const problem = validatePinFormat(data.pin)
    if (problem) return Response.json({ error: problem }, { status: 400 })
    pin = data.pin as string
  } else if (data.mode !== 'clear') return Response.json({ error: 'Ugyldig handling.' }, { status: 400 })
  const vaultKey = pinVaultKey()

  await req.payload.update({
    collection: ENV_ORGANIZATIONS_SLUG,
    id,
    data: {
      pinHash: pin ? await hashPin(pin) : null,
      pinSetAt: pin ? new Date().toISOString() : null,
      // Without a configured key the PIN still works; it just cannot be shown later.
      pinEncrypted: pin && vaultKey ? sealPin(pin, id, vaultKey) : null,
      pinAttemptCount: 0,
      pinAttemptWindowStart: null,
    },
    context: { miljoSetPin: true } satisfies MiljoContext,
    depth: 0,
    overrideAccess: true,
    req,
  })
  req.payload.logger.info(`[miljo] delivery PIN ${data.mode === 'clear' ? 'removed' : 'changed'} for organization ${id} by user ${String(req.user?.id)}`)
  return Response.json(
    { ok: true, revealable: Boolean(pin && vaultKey), ...(data.mode === 'generate' ? { pin } : {}) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/**
 * «Vis PIN». Administrator-only, POST (never prefetched or cached). The decrypted value must still
 * match the active hash, so a stale or foreign copy is never shown. The log line records who
 * revealed which organisation's PIN — never the PIN.
 */
export async function handleRevealPin(req: PayloadRequest): Promise<Response> {
  const denied = deny(req)
  if (denied) return denied
  const id = routeId(req)
  const org = id == null ? null : await loadOrganization(req, id)
  if (!org || id == null) return Response.json({ error: 'Fant ikke organisasjonen.' }, { status: 404 })
  const headers = { 'Cache-Control': 'no-store, private' }
  const hash = typeof org.pinHash === 'string' ? org.pinHash : ''
  if (!hash) return Response.json({ error: 'Ingen PIN er satt.', code: 'no-pin' }, { status: 404, headers })
  const key = pinVaultKey()
  if (!key) {
    return Response.json(
      { error: 'PIN kan ikke vises — krypteringsnøkkelen er ikke satt opp på serveren.', code: 'not-configured' },
      { status: 409, headers },
    )
  }
  const pin = openPin(org.pinEncrypted as string | null, id, key)
  if (!pin || !(await verifyPin(pin, hash))) {
    return Response.json({ error: 'PIN kan ikke vises — opprett ny PIN.', code: 'not-recoverable' }, { status: 409, headers })
  }
  req.payload.logger.info(`[miljo] delivery PIN revealed for organization ${id} by user ${String(req.user?.id)}`)
  return Response.json({ pin }, { headers })
}

export async function handlePinUnlock(req: PayloadRequest): Promise<Response> {
  const denied = deny(req)
  if (denied) return denied
  const id = routeId(req)
  if (id == null || !(await loadOrganization(req, id))) return Response.json({ error: 'Fant ikke organisasjonen.' }, { status: 404 })
  await dbPinAttemptStore(req.payload).reset(id)
  return Response.json({ ok: true })
}

export async function handleRotateCode(req: PayloadRequest): Promise<Response> {
  const denied = deny(req)
  if (denied) return denied
  const id = routeId(req)
  const org = id == null ? null : await loadOrganization(req, id)
  if (!org || id == null) return Response.json({ error: 'Fant ikke organisasjonen.' }, { status: 404 })
  const data = await body(req)
  // The administrator must type the current code — rotation is never a single stray click.
  if (data.confirmCode !== org.publicCode) {
    return Response.json({ error: 'Skriv inn den nåværende koden for å bekrefte.' }, { status: 400 })
  }
  const reason = validateReason(data.reason)
  if (!reason.ok) return Response.json({ error: reason.message }, { status: 400 })

  const next = await newUniqueCode(req)
  const history = Array.isArray(org.codeHistory) ? (org.codeHistory as Doc[]) : []
  await req.payload.update({
    collection: ENV_ORGANIZATIONS_SLUG,
    id,
    data: {
      publicCode: next,
      codeHistory: [
        ...history.map((h) => ({ code: String(h.code), retiredAt: (h.retiredAt as string | null) ?? null, reason: (h.reason as string | null) ?? null })),
        { code: String(org.publicCode), retiredAt: new Date().toISOString(), reason: reason.reason },
      ],
    },
    context: { miljoRotateCode: true } satisfies MiljoContext,
    depth: 0,
    overrideAccess: true,
    req,
  })
  req.payload.logger.info(`[miljo] public code rotated for organization ${id} by user ${String(req.user?.id)}`)
  return Response.json({ ok: true, publicCode: next })
}

export const miljoOrganizationEndpoints: Endpoint[] = [
  { path: '/:id/miljo-status', method: 'get', handler: handleOrganizationStatus },
  { path: '/:id/pin', method: 'post', handler: handleSetPin },
  { path: '/:id/pin-reveal', method: 'post', handler: handleRevealPin },
  { path: '/:id/pin-unlock', method: 'post', handler: handlePinUnlock },
  { path: '/:id/rotate-code', method: 'post', handler: handleRotateCode },
]

export const miljoRegistrationEndpoints: Endpoint[] = [
  action('/:id/correct', correctRegistration, 'registration correct'),
  action('/:id/invalidate', invalidateRegistration, 'registration invalidate'),
  action('/:id/restore', restoreRegistration, 'registration restore'),
  action('/:id/review', reviewRegistration, 'registration review'),
]

export const miljoDeliveryEndpoints: Endpoint[] = [
  action('/:id/correct', (req, id, b) => correctDelivery(req, id, b), 'delivery correct'),
  action('/:id/invalidate', invalidateDelivery, 'delivery invalidate'),
  action('/:id/restore', restoreDelivery, 'delivery restore'),
]
