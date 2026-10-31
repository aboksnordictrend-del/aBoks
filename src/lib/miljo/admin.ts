// Administrator corrections of registrations and deliveries. Each operation validates, changes the
// record and appends an audit row in ONE transaction, so a change without its history (or the
// reverse) cannot exist. Originals are never touched (also enforced by the collection hooks).
// Callers (src/collections/endpoints/miljo.ts) must have verified that req.user is an admin.

import type { PayloadRequest } from 'payload'
import { osloDateKey } from '../analytics/period'
import {
  BATTERY_DELIVERIES_SLUG,
  BATTERY_DELIVERY_AUDIT_SLUG,
  BATTERY_REGISTRATIONS_SLUG,
  BATTERY_REGISTRATION_AUDIT_SLUG,
  REGISTRATION_LIMITS,
  type AuditAction,
  type DocumentationStatus,
} from './constants'
import { toDeliveryRecord, toLines } from './records'
import { lineTotal } from './stats'
import { validateCorrectedLines, validateDelivery, validateReason } from './validation'
import { withTransaction } from './tx'

type Doc = Record<string, unknown>

export type AdminResult = { ok: true } | { ok: false; status: number; message: string }

const bad = (message: string, status = 400): AdminResult => ({ ok: false, status, message })

function actorOf(req: PayloadRequest): { performedBy: number | null; performedByLabel: string } {
  const user = req.user as { id?: number | string; email?: string } | null
  return {
    performedBy: user?.id != null ? Number(user.id) : null,
    performedByLabel: user?.email ?? 'Administrator',
  }
}

async function load(req: PayloadRequest, collection: typeof BATTERY_REGISTRATIONS_SLUG | typeof BATTERY_DELIVERIES_SLUG, id: number) {
  try {
    return (await req.payload.findByID({ collection, id, depth: 0, overrideAccess: true, req })) as unknown as Doc
  } catch {
    return null
  }
}

const orgId = (doc: Doc): number | null => {
  const v = doc.organization
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  return raw == null ? null : Number(raw)
}

// ── Registrations ──

function registrationSnapshot(doc: Doc) {
  const lines = toLines(doc.lines)
  return { lines, total: lineTotal(lines), status: doc.status ?? 'registered', reviewState: doc.reviewState ?? 'none' }
}

async function applyRegistration(
  req: PayloadRequest,
  doc: Doc,
  action: AuditAction,
  reason: string,
  data: Doc,
): Promise<void> {
  const before = registrationSnapshot(doc)
  await withTransaction(req, async () => {
    const updated = (await req.payload.update({
      collection: BATTERY_REGISTRATIONS_SLUG,
      id: Number(doc.id),
      data,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as Doc
    await req.payload.create({
      collection: BATTERY_REGISTRATION_AUDIT_SLUG,
      overrideAccess: true,
      req,
      data: {
        registration: Number(doc.id),
        organization: orgId(doc),
        action,
        reason,
        before,
        after: registrationSnapshot(updated),
        performedAt: new Date().toISOString(),
        ...actorOf(req),
      },
    })
  })
}

export async function correctRegistration(req: PayloadRequest, id: number, body: Doc): Promise<AdminResult> {
  const doc = await load(req, BATTERY_REGISTRATIONS_SLUG, id)
  if (!doc) return bad('Fant ikke registreringen.', 404)
  if (doc.status === 'invalidated') return bad('Registreringen er ugyldiggjort. Gjenopprett den før du korrigerer.')
  const reason = validateReason(body.reason)
  if (!reason.ok) return bad(reason.message)
  const lines = validateCorrectedLines(body.lines, REGISTRATION_LIMITS.maxPerCategory)
  if (!lines.ok) return bad(lines.message)

  const current = toLines(doc.lines)
  const same = JSON.stringify(current) === JSON.stringify(lines.lines)
  if (same) return bad('Antallene er uendret.')
  const submitted = toLines(doc.submittedLines)
  const backToOriginal = JSON.stringify(submitted) === JSON.stringify(lines.lines)

  await applyRegistration(req, doc, 'correct', reason.reason, {
    lines: lines.lines,
    status: backToOriginal ? 'registered' : 'corrected',
    reviewState: doc.reviewState === 'pending' ? 'reviewed' : doc.reviewState,
  })
  return { ok: true }
}

export async function invalidateRegistration(req: PayloadRequest, id: number, body: Doc): Promise<AdminResult> {
  const doc = await load(req, BATTERY_REGISTRATIONS_SLUG, id)
  if (!doc) return bad('Fant ikke registreringen.', 404)
  if (doc.status === 'invalidated') return bad('Registreringen er allerede ugyldiggjort.')
  const reason = validateReason(body.reason)
  if (!reason.ok) return bad(reason.message)
  await applyRegistration(req, doc, 'invalidate', reason.reason, {
    status: 'invalidated',
    reviewState: doc.reviewState === 'pending' ? 'reviewed' : doc.reviewState,
  })
  return { ok: true }
}

export async function restoreRegistration(req: PayloadRequest, id: number, body: Doc): Promise<AdminResult> {
  const doc = await load(req, BATTERY_REGISTRATIONS_SLUG, id)
  if (!doc) return bad('Fant ikke registreringen.', 404)
  if (doc.status !== 'invalidated') return bad('Bare ugyldiggjorte registreringer kan gjenopprettes.')
  const reason = validateReason(body.reason)
  if (!reason.ok) return bad(reason.message)
  const changed = JSON.stringify(toLines(doc.lines)) !== JSON.stringify(toLines(doc.submittedLines))
  await applyRegistration(req, doc, 'restore', reason.reason, { status: changed ? 'corrected' : 'registered' })
  return { ok: true }
}

export async function reviewRegistration(req: PayloadRequest, id: number, body: Doc): Promise<AdminResult> {
  const doc = await load(req, BATTERY_REGISTRATIONS_SLUG, id)
  if (!doc) return bad('Fant ikke registreringen.', 404)
  if (doc.reviewState !== 'pending') return bad('Registreringen venter ikke på gjennomgang.')
  const note = typeof body.reason === 'string' && body.reason.trim() ? validateReason(body.reason) : { ok: true as const, reason: 'Gjennomgått uten endring.' }
  if (!note.ok) return bad(note.message)
  await applyRegistration(req, doc, 'review', note.reason, { reviewState: 'reviewed' })
  return { ok: true }
}

// ── Deliveries ──

function deliverySnapshot(doc: Doc) {
  return {
    deliveryDate: doc.deliveryDate ?? null,
    quantity: doc.quantity ?? null,
    unit: doc.unit ?? null,
    operator: doc.operator ?? null,
    reference: doc.reference ?? null,
    documentationStatus: doc.documentationStatus ?? 'reported',
    status: doc.status ?? 'registered',
  }
}

async function applyDelivery(req: PayloadRequest, doc: Doc, action: AuditAction, reason: string, data: Doc): Promise<void> {
  const before = deliverySnapshot(doc)
  await withTransaction(req, async () => {
    const updated = (await req.payload.update({
      collection: BATTERY_DELIVERIES_SLUG,
      id: Number(doc.id),
      data,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as Doc
    await req.payload.create({
      collection: BATTERY_DELIVERY_AUDIT_SLUG,
      overrideAccess: true,
      req,
      data: {
        delivery: Number(doc.id),
        organization: orgId(doc),
        action,
        reason,
        before,
        after: deliverySnapshot(updated),
        performedAt: new Date().toISOString(),
        ...actorOf(req),
      },
    })
  })
}

export async function correctDelivery(req: PayloadRequest, id: number, body: Doc, now: Date = new Date()): Promise<AdminResult> {
  const doc = await load(req, BATTERY_DELIVERIES_SLUG, id)
  if (!doc) return bad('Fant ikke leveransen.', 404)
  if (doc.status === 'invalidated') return bad('Leveransen er ugyldiggjort. Gjenopprett den før du korrigerer.')
  const reason = validateReason(body.reason)
  if (!reason.ok) return bad(reason.message)
  const validated = validateDelivery(
    { deliveryDate: body.deliveryDate, quantity: body.quantity, unit: body.unit, operator: body.operator, reference: body.reference },
    osloDateKey(now),
  )
  if (!validated.ok) return bad(Object.values(validated.errors)[0] ?? validated.message)
  const documentationStatus: DocumentationStatus =
    body.documentationStatus === 'documented' || body.documentationStatus === 'reported'
      ? body.documentationStatus
      : toDeliveryRecord(doc).documentationStatus
  // Documented means a supporting document is attached to this delivery — nothing else.
  if (documentationStatus === 'documented' && (doc.document == null || doc.document === '')) {
    return bad('«Dokumentert med kvittering» krever at leveransen har et vedlegg. Uten vedlegg er den «Oppgitt av ansvarlig».')
  }

  const v = validated.value
  const next = {
    deliveryDate: v.deliveryDate,
    quantity: v.quantity,
    unit: v.unit,
    operator: v.operator,
    reference: v.reference || null,
    documentationStatus,
  }
  const current = deliverySnapshot(doc)
  const unchanged = (Object.keys(next) as (keyof typeof next)[]).every((k) => (current[k] ?? null) === (next[k] ?? null))
  if (unchanged) return bad('Ingen felter er endret.')

  await applyDelivery(req, doc, 'correct', reason.reason, { ...next, status: 'corrected' })
  return { ok: true }
}

export async function invalidateDelivery(req: PayloadRequest, id: number, body: Doc): Promise<AdminResult> {
  const doc = await load(req, BATTERY_DELIVERIES_SLUG, id)
  if (!doc) return bad('Fant ikke leveransen.', 404)
  if (doc.status === 'invalidated') return bad('Leveransen er allerede ugyldiggjort.')
  const reason = validateReason(body.reason)
  if (!reason.ok) return bad(reason.message)
  await applyDelivery(req, doc, 'invalidate', reason.reason, { status: 'invalidated' })
  return { ok: true }
}

export async function restoreDelivery(req: PayloadRequest, id: number, body: Doc): Promise<AdminResult> {
  const doc = await load(req, BATTERY_DELIVERIES_SLUG, id)
  if (!doc) return bad('Fant ikke leveransen.', 404)
  if (doc.status !== 'invalidated') return bad('Bare ugyldiggjorte leveranser kan gjenopprettes.')
  const reason = validateReason(body.reason)
  if (!reason.ok) return bad(reason.message)
  const original = (doc.submittedValues ?? {}) as Doc
  const current = deliverySnapshot(doc)
  const changed = (['deliveryDate', 'quantity', 'unit', 'operator', 'documentationStatus'] as const).some(
    (k) => (original[k] ?? null) !== (current[k] ?? null),
  )
  await applyDelivery(req, doc, 'restore', reason.reason, { status: changed ? 'corrected' : 'registered' })
  return { ok: true }
}
