// Public Miljøregistrering operations, with Payload reached through `req` (the server-only
// wrapper in ./server builds a local request; tests pass a stub). Everything runs through the
// local API with overrideAccess — all collections are closed to the public — and only the DTOs
// defined here leave this module: never contacts, notes, the PIN hash, review flags or audit data.

import type { PayloadRequest, Where } from 'payload'
import { osloDateKey, resolvePeriod } from '../analytics/period'
import {
  BATTERY_DELIVERIES_SLUG,
  BATTERY_DELIVERY_AUDIT_SLUG,
  BATTERY_DELIVERY_DOCUMENTS_SLUG,
  BATTERY_REGISTRATIONS_SLUG,
  ENV_ORGANIZATIONS_SLUG,
  type BatteryCategory,
  type RegistrationFlag,
} from './constants'
import { isValidPublicCode } from './code'
import { policyFor, type CategoryOption, type RegistrationPolicy } from './policy'
import { UUID_RE, validateDelivery, validateRegistration, type DeliveryInput, type RegistrationLine } from './validation'
import { registrationFingerprint, type DuplicateTracker } from './duplicates'
import { verifyPin } from './pin'
import type { PinAttemptStore } from './pinAttempts'
import { precheckDocument, prepareDocument } from './documents'
import { DELIVERY_SELECT, REGISTRATION_SELECT, toDeliveryRecord, toRegistrationRecord } from './records'
import {
  countable,
  publicDeliveryRows,
  registrationTrend,
  summarizeDeliveries,
  summarizeRegistrations,
  visibleCategories,
  type DeliveryRecord,
  type DeliverySummary,
  type PublicDeliveryRow,
  type RegistrationRecord,
  type RegistrationSummary,
  type TrendPoint,
} from './stats'
import type { MiljoPeriod } from './period'
import { withTransaction } from './tx'

type Doc = Record<string, unknown>

/** The organisation as the server sees it (internal; never sent to a browser as is). */
export interface ResolvedOrganization {
  id: number
  name: string
  code: string
  policy: RegistrationPolicy
  otherLabel?: string
  pinHash: string | null
}

/** What the public page receives. */
export interface PublicOrganization {
  code: string
  name: string
  categories: CategoryOption[]
  maxPerCategory: number
  maxPerSubmission: number
  confirmAbove: number
  deliveryEnabled: boolean
}

export function toPublicOrganization(org: ResolvedOrganization): PublicOrganization {
  return {
    code: org.code,
    name: org.name,
    categories: org.policy.categories,
    maxPerCategory: org.policy.maxPerCategory,
    maxPerSubmission: org.policy.maxPerSubmission,
    confirmAbove: org.policy.confirmAbove,
    deliveryEnabled: Boolean(org.pinHash),
  }
}

export type OrganizationResolution = { kind: 'active'; org: ResolvedOrganization } | { kind: 'unavailable' }

/**
 * Looks up an organisation by its public code. Inactive organisations, retired codes and unknown
 * codes all resolve to the same `unavailable` — the page never reveals which one applies.
 */
export async function resolveOrganization(req: PayloadRequest, code: string): Promise<OrganizationResolution> {
  if (!isValidPublicCode(code)) return { kind: 'unavailable' }
  const found = await req.payload.find({
    collection: ENV_ORGANIZATIONS_SLUG,
    where: { publicCode: { equals: code } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })
  const doc = found.docs[0] as unknown as Doc | undefined
  if (!doc || doc.status !== 'active') return { kind: 'unavailable' }
  return {
    kind: 'active',
    org: {
      id: Number(doc.id),
      name: String(doc.name ?? ''),
      code,
      policy: policyFor(doc),
      otherLabel: typeof doc.otherCategoryLabel === 'string' && doc.otherCategoryLabel.trim() ? doc.otherCategoryLabel.trim() : undefined,
      pinHash: typeof doc.pinHash === 'string' && doc.pinHash ? doc.pinHash : null,
    },
  }
}

const CLOSED_MESSAGE = 'Registreringen er ikke aktiv. Kontakt den som har ansvaret for batteriinnsamlingen.'
const ERROR_MESSAGE = 'Noe gikk galt. Prøv igjen om litt.'

async function findByKey(req: PayloadRequest, collection: typeof BATTERY_REGISTRATIONS_SLUG | typeof BATTERY_DELIVERIES_SLUG, key: string) {
  const found = await req.payload.find({
    collection,
    where: { submissionKey: { equals: key } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })
  return found.docs[0] as unknown as Doc | undefined
}

// ── Registrations ──

export interface RegistrationInput {
  code: string
  quantities: Partial<Record<BatteryCategory, unknown>>
  confirmed: boolean
  confirmDuplicate: boolean
  submissionKey: string
  /** In-memory-only client key (the request IP) for duplicate detection. */
  clientKey: string
}

export type SubmitRegistrationResult =
  | { ok: true; total: number; lines: RegistrationLine[] }
  | {
      ok: false
      reason: 'closed' | 'invalid' | 'needs-confirmation' | 'possible-duplicate' | 'error'
      message: string
      errors?: Record<string, string>
    }

/** Total registered today (Oslo) for the organisation, invalidated excluded. */
async function todaysTotal(req: PayloadRequest, organizationId: number, now: Date): Promise<number> {
  const today = osloDateKey(now)
  const { from } = resolvePeriod('custom', { customFrom: today, customTo: today })
  const found = await req.payload.find({
    collection: BATTERY_REGISTRATIONS_SLUG,
    where: {
      and: [
        { organization: { equals: organizationId } },
        { registeredAt: { greater_than_equal: from } },
        { status: { not_equals: 'invalidated' } },
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
    select: { totalQuantity: true },
  })
  return (found.docs as Doc[]).reduce((s, d) => s + (Number(d.totalQuantity) || 0), 0)
}

export async function submitRegistration(
  req: PayloadRequest,
  input: RegistrationInput,
  deps: { duplicates: DuplicateTracker; now?: Date },
): Promise<SubmitRegistrationResult> {
  const now = deps.now ?? new Date()
  const resolved = await resolveOrganization(req, input.code)
  if (resolved.kind !== 'active') return { ok: false, reason: 'closed', message: CLOSED_MESSAGE }
  const { org } = resolved

  if (!UUID_RE.test(input.submissionKey)) {
    return { ok: false, reason: 'invalid', message: 'Skjemaet er ugyldig. Last siden på nytt og prøv igjen.' }
  }

  // A retry of a stored submission: answer with what was stored, store nothing new.
  const existing = await findByKey(req, BATTERY_REGISTRATIONS_SLUG, input.submissionKey)
  if (existing) {
    const record = toRegistrationRecord(existing)
    if (record.organizationId !== org.id) return { ok: false, reason: 'invalid', message: 'Skjemaet er ugyldig. Last siden på nytt.' }
    return { ok: true, total: record.submittedTotal, lines: toRegistrationRecord({ ...existing, lines: existing.submittedLines }).lines }
  }

  const result = validateRegistration(input.quantities, input.confirmed, org.policy)
  if (!result.ok) return { ok: false, reason: result.reason, message: result.message, errors: result.errors as Record<string, string> }

  const flags: RegistrationFlag[] = [...result.flags]
  const fingerprint = registrationFingerprint(org.code, input.clientKey, result.lines)
  if (deps.duplicates.seenRecently(fingerprint, now.getTime())) {
    if (!input.confirmDuplicate) {
      return {
        ok: false,
        reason: 'possible-duplicate',
        message: 'Akkurat de samme antallene ble registrert for et øyeblikk siden. Vil du registrere dem på nytt?',
      }
    }
    flags.push('possible-duplicate')
  }

  try {
    if ((await todaysTotal(req, org.id, now)) + result.total > org.policy.dailyFlagThreshold) flags.push('burst')
  } catch {
    // The burst flag is advisory; never lose a registration over it.
  }

  const lines = result.lines.map((l) => ({ category: l.category, quantity: l.quantity }))
  try {
    await req.payload.create({
      collection: BATTERY_REGISTRATIONS_SLUG,
      overrideAccess: true,
      req,
      data: {
        organization: org.id,
        organizationName: org.name,
        registeredAt: now.toISOString(),
        submittedLines: lines,
        lines,
        submittedTotal: result.total,
        totalQuantity: result.total,
        method: 'manual',
        source: 'qr-form',
        status: 'registered',
        flags,
        reviewState: flags.length > 0 ? 'pending' : 'none',
        submissionKey: input.submissionKey,
      },
    })
  } catch (err) {
    // Lost a race against a parallel copy of the same submission (unique key): that one stored it.
    const raced = await findByKey(req, BATTERY_REGISTRATIONS_SLUG, input.submissionKey).catch(() => undefined)
    if (raced) return { ok: true, total: result.total, lines: result.lines }
    req.payload.logger.error(`[miljo] registration create failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return { ok: false, reason: 'error', message: ERROR_MESSAGE }
  }
  deps.duplicates.record(fingerprint, now.getTime())
  return { ok: true, total: result.total, lines: result.lines }
}

// ── Deliveries ──

export interface DeliveryFormInput {
  code: string
  pin: string
  submissionKey: string
  fields: { deliveryDate?: unknown; quantity?: unknown; unit?: unknown; operator?: unknown; reference?: unknown }
  document?: Uint8Array | null
}

export type SubmitDeliveryResult =
  | { ok: true; delivery: DeliveryInput & { documented: boolean } }
  | { ok: false; reason: 'closed' | 'invalid' | 'unauthorized' | 'error'; message: string; errors?: Record<string, string> }

/** One message for every PIN failure — wrong, missing, not configured or temporarily blocked. */
export const PIN_REJECTED_MESSAGE =
  'PIN-koden ble ikke godtatt. Kontroller koden og prøv igjen. Etter flere feil forsøk stenges registreringen i en kort periode.'

export async function submitDelivery(
  req: PayloadRequest,
  input: DeliveryFormInput,
  deps: { pinAttempts: PinAttemptStore; now?: Date },
): Promise<SubmitDeliveryResult> {
  const now = deps.now ?? new Date()
  const resolved = await resolveOrganization(req, input.code)
  if (resolved.kind !== 'active') return { ok: false, reason: 'closed', message: CLOSED_MESSAGE }
  const { org } = resolved

  if (!UUID_RE.test(input.submissionKey)) {
    return { ok: false, reason: 'invalid', message: 'Skjemaet er ugyldig. Last siden på nytt og prøv igjen.' }
  }

  // Field and file checks come first, so a typo never costs one of the limited PIN attempts.
  const validated = validateDelivery(input.fields, osloDateKey(now))
  if (!validated.ok) return { ok: false, reason: 'invalid', message: validated.message, errors: validated.errors as Record<string, string> }
  if (input.document && input.document.byteLength > 0) {
    const pre = precheckDocument(input.document)
    if (!pre.ok) return { ok: false, reason: 'invalid', message: pre.message, errors: { document: pre.message } }
  }

  // PIN — every submission, no session. The attempt is reserved atomically BEFORE comparing.
  if (!org.pinHash || typeof input.pin !== 'string' || input.pin === '') {
    return { ok: false, reason: 'unauthorized', message: PIN_REJECTED_MESSAGE }
  }
  let reserved: { allowed: boolean }
  try {
    reserved = await deps.pinAttempts.reserve(org.id, now)
  } catch (err) {
    req.payload.logger.error(`[miljo] pin attempt reservation failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return { ok: false, reason: 'error', message: ERROR_MESSAGE }
  }
  if (!reserved.allowed || !(await verifyPin(input.pin, org.pinHash))) {
    return { ok: false, reason: 'unauthorized', message: PIN_REJECTED_MESSAGE }
  }
  await deps.pinAttempts.reset(org.id).catch(() => undefined)

  const existing = await findByKey(req, BATTERY_DELIVERIES_SLUG, input.submissionKey)
  if (existing) {
    const r = toDeliveryRecord(existing)
    if (r.organizationId !== org.id) return { ok: false, reason: 'invalid', message: 'Skjemaet er ugyldig. Last siden på nytt.' }
    return { ok: true, delivery: { ...validated.value, documented: r.documentationStatus === 'documented' } }
  }

  let file = null
  if (input.document && input.document.byteLength > 0) {
    const prepared = await prepareDocument(input.document)
    if (!prepared.ok) return { ok: false, reason: 'invalid', message: prepared.message, errors: { document: prepared.message } }
    file = prepared.file
  }

  const v = validated.value
  const documented = file !== null
  try {
    await withTransaction(req, async () => {
      let documentId: number | null = null
      if (file) {
        const doc = await req.payload.create({
          collection: BATTERY_DELIVERY_DOCUMENTS_SLUG,
          overrideAccess: true,
          req,
          data: { organization: org.id },
          file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.size },
        })
        documentId = Number(doc.id)
      }
      const values = {
        deliveryDate: v.deliveryDate,
        quantity: v.quantity,
        unit: v.unit,
        operator: v.operator,
        reference: v.reference || null,
        documentationStatus: documented ? 'documented' : 'reported',
      } as const
      const delivery = await req.payload.create({
        collection: BATTERY_DELIVERIES_SLUG,
        overrideAccess: true,
        req,
        data: {
          organization: org.id,
          organizationName: org.name,
          ...values,
          document: documentId,
          submittedValues: { ...values, document: documentId !== null },
          status: 'registered',
          registeredAt: now.toISOString(),
          source: 'pin-form',
          submissionKey: input.submissionKey,
        },
      })
      await req.payload.create({
        collection: BATTERY_DELIVERY_AUDIT_SLUG,
        overrideAccess: true,
        req,
        data: {
          delivery: Number(delivery.id),
          organization: org.id,
          action: 'create',
          performedAt: now.toISOString(),
          performedByLabel: 'Ansvarlig (PIN)',
          reason: 'Registrert på QR-siden med PIN.',
          after: { ...values, document: documentId !== null },
        },
      })
    })
  } catch (err) {
    const raced = await findByKey(req, BATTERY_DELIVERIES_SLUG, input.submissionKey).catch(() => undefined)
    if (raced) return { ok: true, delivery: { ...v, documented } }
    req.payload.logger.error(`[miljo] delivery create failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return { ok: false, reason: 'error', message: ERROR_MESSAGE }
  }
  return { ok: true, delivery: { ...v, documented } }
}

// ── Statistics ──

/** Loads one organisation's records (or all, for the admin) for a period. Invalidated excluded unless asked. */
export async function loadRecords(
  req: PayloadRequest,
  opts: { organizationId: number | null; period: MiljoPeriod; includeInvalidated?: boolean },
): Promise<{ registrations: RegistrationRecord[]; deliveries: DeliveryRecord[] }> {
  const org: Where[] = opts.organizationId != null ? [{ organization: { equals: opts.organizationId } }] : []
  const valid: Where[] = opts.includeInvalidated ? [] : [{ status: { not_equals: 'invalidated' } }]
  const [regs, dels] = await Promise.all([
    req.payload.find({
      collection: BATTERY_REGISTRATIONS_SLUG,
      where: {
        and: [...org, ...valid, { registeredAt: { greater_than_equal: opts.period.from } }, { registeredAt: { less_than: opts.period.to } }],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'registeredAt',
      overrideAccess: true,
      req,
      select: REGISTRATION_SELECT,
    }),
    req.payload.find({
      collection: BATTERY_DELIVERIES_SLUG,
      where: {
        and: [
          ...org,
          ...valid,
          { deliveryDate: { greater_than_equal: opts.period.fromKey } },
          { deliveryDate: { less_than_equal: opts.period.toKey } },
        ],
      },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'deliveryDate',
      overrideAccess: true,
      req,
      select: DELIVERY_SELECT,
    }),
  ])
  return {
    // Filtered again in memory: the aggregates must never depend on the query having done it.
    registrations: countable((regs.docs as Doc[]).map(toRegistrationRecord), opts.includeInvalidated),
    deliveries: countable((dels.docs as Doc[]).map(toDeliveryRecord), opts.includeInvalidated),
  }
}

export interface PublicStatistics {
  period: { preset: string; fromKey: string; toKey: string; grouping: string }
  categories: { value: BatteryCategory; label: string }[]
  registrations: RegistrationSummary
  trend: TrendPoint[]
  deliveries: DeliverySummary
  deliveryRows: PublicDeliveryRow[]
}

export function buildPublicStatistics(
  org: Pick<ResolvedOrganization, 'policy' | 'otherLabel'>,
  period: MiljoPeriod,
  registrations: RegistrationRecord[],
  deliveries: DeliveryRecord[],
): PublicStatistics {
  const summary = summarizeRegistrations(registrations)
  const offered = org.policy.categories.map((c) => c.value)
  const labels = new Map(org.policy.categories.map((c) => [c.value, c.label]))
  return {
    period: { preset: period.preset, fromKey: period.fromKey, toKey: period.toKey, grouping: period.grouping },
    categories: visibleCategories(offered, summary.byCategory).map((value) => ({
      value,
      label: labels.get(value) ?? (value === 'other' ? org.otherLabel ?? 'Andre' : value.toUpperCase()),
    })),
    registrations: summary,
    trend: registrationTrend(registrations, period),
    deliveries: summarizeDeliveries(deliveries),
    deliveryRows: publicDeliveryRows(deliveries).slice(0, 200),
  }
}
