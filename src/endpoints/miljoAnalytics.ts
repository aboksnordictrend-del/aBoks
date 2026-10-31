// GET /api/miljo-analytics — data behind «Miljøregistrering» (/admin/miljoregistrering).
//
// Administrator-only (role 'admin'). Aggregates are computed server-side by the same pure
// functions the public page and the PDF use (@/lib/miljo/stats), so every surface shows the same
// numbers.
//
// Query: organization=<id>|all, preset, from, to (Oslo days), grouping=day|month|year,
// includeInvalidated=1, format=json|csv|pdf, type=registreringer|leveranser|sammendrag (CSV).
// PDF needs one organisation (the report is per organisation).

import type { Endpoint, PayloadRequest } from 'payload'
import { BATTERY_DELIVERIES_SLUG, ENV_ORGANIZATIONS_SLUG } from '../lib/miljo/constants'
import { isCsvType } from '../lib/miljo/csv'
import { ALL_CATEGORIES, buildCsvExport, buildPdfExport, downloadResponse } from '../lib/miljo/exports'
import { PeriodError, resolveMiljoPeriod } from '../lib/miljo/period'
import { policyFor } from '../lib/miljo/policy'
import { loadRecords } from '../lib/miljo/service'
import {
  deliveryTrend,
  perOrganization,
  registrationTrend,
  summarizeDeliveries,
  summarizeRegistrations,
} from '../lib/miljo/stats'

type Doc = Record<string, unknown>

function str(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (typeof raw === 'string' && raw !== '') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0] !== '') return raw[0]
  return undefined
}

export async function handleMiljoAnalytics(req: PayloadRequest): Promise<Response> {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if ((req.user as { role?: string }).role !== 'admin') return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })

  const query = (req.query ?? {}) as Record<string, unknown>
  const orgRaw = str(query, 'organization')
  let organizationId: number | null = null
  if (orgRaw && orgRaw !== 'all') {
    if (!/^\d+$/.test(orgRaw)) return Response.json({ error: 'Ugyldig organisasjon.' }, { status: 400 })
    organizationId = Number(orgRaw)
  }
  let period
  try {
    period = resolveMiljoPeriod({ preset: str(query, 'preset'), from: str(query, 'from'), to: str(query, 'to'), grouping: str(query, 'grouping') })
  } catch (err) {
    return Response.json({ error: err instanceof PeriodError ? err.message : 'Ugyldig periode.' }, { status: 400 })
  }
  const includeInvalidated = str(query, 'includeInvalidated') === '1'
  const format = str(query, 'format') ?? 'json'

  try {
    const orgsResult = await req.payload.find({
      collection: ENV_ORGANIZATIONS_SLUG,
      depth: 0,
      limit: 0,
      pagination: false,
      sort: 'name',
      overrideAccess: true,
      req,
      select: { name: true, status: true, publicCode: true, allowedCategories: true, otherCategoryLabel: true, otherCategoryDescription: true },
    })
    const orgs = orgsResult.docs as unknown as Doc[]
    const selected = organizationId != null ? orgs.find((o) => Number(o.id) === organizationId) : undefined
    if (organizationId != null && !selected) return Response.json({ error: 'Fant ikke organisasjonen.' }, { status: 404 })

    // Everything is loaded once; aggregates and exports always use valid records only, while the
    // «include invalidated» toggle only affects the lists on screen.
    const all = await loadRecords(req, { organizationId, period, includeInvalidated: true })
    const registrations = all.registrations.filter((r) => r.status !== 'invalidated')
    const deliveries = all.deliveries.filter((d) => d.status !== 'invalidated')

    if (format === 'csv' || format === 'pdf') {
      const offered = selected
        ? policyFor(selected).categories.map((c) => ({ value: c.value, label: c.label }))
        : ALL_CATEGORIES
      const scope = {
        audience: 'admin' as const,
        organizationName: selected ? String(selected.name) : null,
        offered,
        period,
        // Exports never contain invalidated records, whatever the screen shows.
        registrations,
        deliveries,
      }
      if (format === 'pdf') {
        if (!selected) return Response.json({ error: 'Velg én organisasjon for miljørapporten.' }, { status: 400 })
        return downloadResponse(await buildPdfExport({ ...scope, organizationName: String(selected.name) }))
      }
      const type = str(query, 'type') ?? 'sammendrag'
      if (!isCsvType(type)) return Response.json({ error: 'Ukjent eksporttype.' }, { status: 400 })
      let references: Map<number, string> | undefined
      if (type === 'leveranser' && scope.deliveries.length > 0) {
        const refs = await req.payload.find({
          collection: BATTERY_DELIVERIES_SLUG,
          where: { id: { in: scope.deliveries.map((d) => d.id) } },
          depth: 0,
          limit: 0,
          pagination: false,
          overrideAccess: true,
          req,
          select: { reference: true },
        })
        references = new Map((refs.docs as unknown as Doc[]).map((d) => [Number(d.id), String(d.reference ?? '')]))
      }
      return downloadResponse(buildCsvExport({ ...scope, references }, type))
    }

    const pending = registrations
      .filter((r) => r.reviewState === 'pending')
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
      .slice(0, 50)
      .map((r) => ({ id: r.id, organizationName: r.organizationName, registeredAt: r.registeredAt, total: r.lines.reduce((s, l) => s + l.quantity, 0), flags: r.flags, status: r.status }))

    return Response.json(
      {
        filters: { organization: organizationId, includeInvalidated },
        period: { preset: period.preset, fromKey: period.fromKey, toKey: period.toKey, grouping: period.grouping },
        organizations: orgs.map((o) => ({ id: Number(o.id), name: String(o.name ?? ''), status: String(o.status ?? ''), publicCode: String(o.publicCode ?? '') })),
        registrations: summarizeRegistrations(registrations),
        invalidatedRegistrations: all.registrations.length - registrations.length,
        invalidatedDeliveries: all.deliveries.length - deliveries.length,
        trend: registrationTrend(registrations, period),
        deliveries: summarizeDeliveries(deliveries),
        deliveryTrend: deliveryTrend(deliveries, period),
        recentDeliveries: [...(includeInvalidated ? all.deliveries : deliveries)]
          .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.id - a.id)
          .slice(0, 50),
        perOrganization: perOrganization(
          orgs.filter((o) => organizationId == null || Number(o.id) === organizationId).map((o) => ({ id: Number(o.id), name: String(o.name ?? ''), status: String(o.status ?? '') })),
          registrations,
          deliveries,
        ),
        pendingReview: pending,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    req.payload.logger.error(`[miljo-analytics] failed: ${err instanceof Error ? err.message : 'unknown'}`)
    return Response.json({ error: 'Kunne ikke hente miljøstatistikken.' }, { status: 500 })
  }
}

export const miljoAnalyticsEndpoint: Endpoint = {
  path: '/miljo-analytics',
  method: 'get',
  handler: handleMiljoAnalytics,
}
