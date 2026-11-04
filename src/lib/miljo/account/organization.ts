import { osloDateKey } from '@/lib/analytics/period'
import { BUSINESS_CUSTOMERS_SLUG, relationshipId } from '@/lib/miljo/business'
import { BATTERY_DELIVERIES_SLUG, DELIVERY_UNIT_LABELS, type DeliveryUnit, type DocumentationStatus } from '@/lib/miljo/constants'
import { resolveMiljoPeriod, type MiljoPeriod } from '@/lib/miljo/period'
import { isCsvType, type CsvType } from '@/lib/miljo/csv'
import { buildCsvExport, buildPdfExport, type ExportFile } from '@/lib/miljo/exports'
import { toDeliveryRecord } from '@/lib/miljo/records'
import { buildPublicStatistics, loadRecords, resolveOrganizationById, type PublicStatistics, type ResolvedOrganization } from '@/lib/miljo/service'
import { summarizeDeliveries, summarizeRegistrations, type CategoryCounts, type UnitTotal } from '@/lib/miljo/stats'
import type { MiljoSession } from './session'

/**
 * Min side's view of the signed-in organisation's battery data (Stage 2.3).
 *
 * The organisation is ALWAYS the session's: account → its business customer → that customer's
 * environmental organisation. Nothing here accepts an organisation id or public code from a
 * request, so one account can never read another organisation's records.
 *
 * Every figure comes from the same functions as the public QR page, the admin and the exports
 * (@/lib/miljo/service `loadRecords`, @/lib/miljo/stats): invalidated records are excluded,
 * corrected ones count with their current values, and kilograms and pieces are never converted
 * or added together. Registrations (self-reported by employees) and deliveries (actual, reported
 * by the responsible person) stay separate results.
 */

type Doc = Record<string, unknown> & { id: number | string }

export interface AccountOrganization {
  org: ResolvedOrganization
  /** False while an administrator has closed the public registration page. */
  active: boolean
  /** Oslo day the organisation was created — the start of «all time». */
  sinceKey: string
}

/** The session's own environmental organisation, or null when the company has none yet. */
export async function accountOrganization(session: MiljoSession): Promise<AccountOrganization | null> {
  const customer = (await session.req.payload.findByID({
    collection: BUSINESS_CUSTOMERS_SLUG,
    id: session.businessCustomerId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req: session.req,
  })) as unknown as Doc | null
  const orgId = relationshipId(customer?.environmentalOrganization)
  if (orgId == null) return null
  const resolved = await resolveOrganizationById(session.req, Number(orgId))
  if (!resolved) return null
  const createdAt = resolved.createdAt ? new Date(resolved.createdAt) : null
  return {
    org: resolved.org,
    active: resolved.active,
    sinceKey: osloDateKey(createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : new Date()),
  }
}

/** «All time»: from the organisation's first day to today (the reporting period helper caps at ten years). */
export function allTimePeriod(sinceKey: string, now: Date = new Date()): MiljoPeriod {
  const today = osloDateKey(now)
  const tenYearsAgo = `${Number(today.slice(0, 4)) - 9}-01-01`
  const from = sinceKey < tenYearsAgo ? tenYearsAgo : sinceKey > today ? today : sinceKey
  return resolveMiljoPeriod({ preset: 'custom', from, to: today }, now)
}

export interface AccountOverview {
  sinceKey: string
  registrations: { registrations: number; total: number; byCategory: CategoryCounts }
  deliveries: { deliveries: number; withReceipt: number; byUnit: Record<DeliveryUnit, UnitTotal> }
}

/** The dashboard figures, all time. */
export async function accountOverview(session: MiljoSession, account: AccountOrganization, now: Date = new Date()): Promise<AccountOverview> {
  const { registrations, deliveries } = await loadRecords(session.req, { organizationId: account.org.id, period: allTimePeriod(account.sinceKey, now) })
  const reg = summarizeRegistrations(registrations)
  const del = summarizeDeliveries(deliveries)
  return {
    sinceKey: account.sinceKey,
    registrations: { registrations: reg.registrations, total: reg.total, byCategory: reg.byCategory },
    deliveries: { deliveries: del.deliveries, withReceipt: del.documented, byUnit: del.byUnit },
  }
}

/** «Miljøstatistikk» for a period — exactly what the public page shows for the same organisation. */
export async function accountStatistics(session: MiljoSession, account: AccountOrganization, period: MiljoPeriod): Promise<PublicStatistics> {
  const { registrations, deliveries } = await loadRecords(session.req, { organizationId: account.org.id, period })
  return buildPublicStatistics(account.org, period, registrations, deliveries)
}

export interface AccountDeliveryRow {
  id: number
  deliveryDate: string
  quantity: number
  unit: DeliveryUnit
  unitLabel: string
  operator: string
  /** The receipt or reference number the responsible person typed, if any. */
  reference: string | null
  documentationStatus: DocumentationStatus
  /** «Dokumentert med kvittering» when a receipt was attached; otherwise «Oppgitt av ansvarlig». */
  receipt: string
  corrected: boolean
  registeredAt: string
}

export const ACCOUNT_DELIVERY_LIMIT = 500

/**
 * The organisation's deliveries, newest first (invalidated ones left out, like everywhere else).
 * Adds the reference — the organisation's own data — which the public page does not show.
 * Read-only: nothing here edits or deletes a delivery.
 */
export async function accountDeliveries(session: MiljoSession, account: AccountOrganization): Promise<{ rows: AccountDeliveryRow[]; truncated: boolean }> {
  const found = await session.req.payload.find({
    collection: BATTERY_DELIVERIES_SLUG,
    where: { and: [{ organization: { equals: account.org.id } }, { status: { not_equals: 'invalidated' } }] },
    depth: 0,
    limit: ACCOUNT_DELIVERY_LIMIT + 1,
    sort: '-deliveryDate',
    overrideAccess: true,
    req: session.req,
    select: { organization: true, deliveryDate: true, quantity: true, unit: true, operator: true, reference: true, documentationStatus: true, status: true, registeredAt: true },
  } as never)
  const docs = (found.docs as unknown as Doc[]).filter(
    // Filtered again in memory: never rely on the query alone for another organisation's rows.
    (d) => String(relationshipId(d.organization)) === String(account.org.id) && d.status !== 'invalidated',
  )
  const rows = docs
    .map((doc) => {
      const r = toDeliveryRecord(doc)
      const reference = typeof doc.reference === 'string' && doc.reference.trim() ? doc.reference.trim() : null
      return {
        id: r.id,
        deliveryDate: r.deliveryDate,
        quantity: r.quantity,
        unit: r.unit,
        unitLabel: DELIVERY_UNIT_LABELS[r.unit],
        operator: r.operator,
        reference,
        documentationStatus: r.documentationStatus,
        receipt: r.documentationStatus === 'documented' ? 'Dokumentert med kvittering' : 'Oppgitt av ansvarlig',
        corrected: r.status === 'corrected',
        registeredAt: r.registeredAt,
      }
    })
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.id - a.id)
  return { rows: rows.slice(0, ACCOUNT_DELIVERY_LIMIT), truncated: rows.length > ACCOUNT_DELIVERY_LIMIT }
}

/**
 * The miljørapport (PDF) or a CSV for a period — the public page's files (same builders, same
 * `public` columns), for the account's own organisation.
 */
export async function accountExport(
  session: MiljoSession,
  account: AccountOrganization,
  request: { format: 'pdf' | 'csv'; type: string; period: MiljoPeriod },
): Promise<ExportFile> {
  const { org } = account
  const { registrations, deliveries } = await loadRecords(session.req, { organizationId: org.id, period: request.period })
  const scope = {
    audience: 'public' as const,
    organizationName: org.name,
    offered: org.policy.categories.map((c) => ({ value: c.value, label: c.label })),
    period: request.period,
    registrations,
    deliveries,
  }
  if (request.format === 'pdf') return buildPdfExport(scope)
  const type: CsvType = isCsvType(request.type) ? request.type : 'sammendrag'
  return buildCsvExport(scope, type)
}
