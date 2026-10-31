// Builds the CSV and PDF downloads for one organisation (public page and admin) or for all
// organisations (admin CSV only). Server-side; the caller has already scoped and authorised the
// request and loaded the records with invalidated ones excluded.

import { osloDateKey } from '../analytics/period'
import { BATTERY_CATEGORIES, CATEGORY_LABELS, type BatteryCategory } from './constants'
import { deliveriesCsv, fileSlug, registrationsCsv, summaryCsv, type CsvAudience, type CsvType } from './csv'
import type { MiljoPeriod } from './period'
import { buildReportModel, fetchReportLogo, renderReportPdf } from './reportPdf'
import { deliveryTrend, registrationTrend, summarizeRegistrations, visibleCategories, type DeliveryRecord, type RegistrationRecord } from './stats'

export interface ExportScope {
  audience: CsvAudience
  /** Organisation name, or null for «all organisations» (admin). */
  organizationName: string | null
  /** Categories the organisation offers (labels included); all categories for «all». */
  offered: { value: BatteryCategory; label: string }[]
  period: MiljoPeriod
  registrations: RegistrationRecord[]
  deliveries: DeliveryRecord[]
  /** Admin only: delivery references by id. */
  references?: Map<number, string>
}

export interface ExportFile {
  body: Uint8Array | string
  contentType: string
  filename: string
}

function categoriesFor(scope: ExportScope): { value: BatteryCategory; label: string }[] {
  const counts = summarizeRegistrations(scope.registrations).byCategory
  const labels = new Map(scope.offered.map((c) => [c.value, c.label]))
  return visibleCategories(
    scope.offered.map((c) => c.value),
    counts,
  ).map((value) => ({ value, label: labels.get(value) ?? CATEGORY_LABELS[value] }))
}

function stem(scope: ExportScope): string {
  return `${fileSlug(scope.organizationName ?? 'alle-organisasjoner')}-${scope.period.fromKey}-${scope.period.toKey}`
}

export function buildCsvExport(scope: ExportScope, type: CsvType): ExportFile {
  const categories = categoriesFor(scope)
  const other = categories.find((c) => c.value === 'other')
  const ctx = {
    audience: scope.audience,
    title: scope.organizationName ?? 'Alle organisasjoner',
    period: scope.period,
    categories: categories.map((c) => c.value),
    otherLabel: other?.label,
  }
  const body =
    type === 'registreringer'
      ? registrationsCsv(scope.registrations, ctx)
      : type === 'leveranser'
        ? deliveriesCsv(scope.deliveries, ctx, scope.audience === 'admin' ? scope.references : undefined)
        : summaryCsv(registrationTrend(scope.registrations, scope.period), deliveryTrend(scope.deliveries, scope.period), ctx)
  return { body, contentType: 'text/csv; charset=utf-8', filename: `miljo-${type}-${stem(scope)}.csv` }
}

export async function buildPdfExport(scope: ExportScope & { organizationName: string }, now: Date = new Date()): Promise<ExportFile> {
  const model = buildReportModel({
    organizationName: scope.organizationName,
    period: scope.period,
    categories: categoriesFor(scope),
    registrations: scope.registrations,
    deliveries: scope.deliveries,
    now,
  })
  const body = await renderReportPdf(model, await fetchReportLogo())
  return { body, contentType: 'application/pdf', filename: `miljorapport-${stem(scope)}.pdf` }
}

export function downloadResponse(file: ExportFile): Response {
  const body = typeof file.body === 'string' ? file.body : new Blob([file.body as BlobPart])
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

/** All categories with default labels — the admin's «all organisations» scope. */
export const ALL_CATEGORIES = BATTERY_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))

export const todayStamp = (): string => osloDateKey(new Date())
