// Aggregation for Miljøregistrering — public statistics, admin dashboard, CSV and PDF all read
// from these functions, so every surface shows the same numbers. Pure.
//
// Rules:
//   • Invalidated records are excluded unless the caller explicitly asks for them.
//   • Corrected records count with their corrected (current) lines.
//   • Registration counts and delivery quantities are separate results. Deliveries are summed per
//     unit — kilograms and pieces are never converted or added together.

import {
  BATTERY_CATEGORIES,
  DOCUMENTATION_LABELS,
  type BatteryCategory,
  type DeliveryUnit,
  type DocumentationStatus,
  type RecordStatus,
} from './constants'
import { bucketKeyForDay, bucketKeyForInstant, periodBuckets, type MiljoPeriod } from './period'

export interface RegistrationRecord {
  id: number
  organizationId: number
  organizationName: string
  registeredAt: string
  status: RecordStatus
  lines: { category: BatteryCategory; quantity: number }[]
  submittedTotal: number
  flags: string[]
  reviewState: string
}

export interface DeliveryRecord {
  id: number
  organizationId: number
  organizationName: string
  deliveryDate: string
  quantity: number
  unit: DeliveryUnit
  operator: string
  documentationStatus: DocumentationStatus
  status: RecordStatus
  registeredAt: string
}

export type CategoryCounts = Record<BatteryCategory, number>

const emptyCounts = (): CategoryCounts => ({ aa: 0, aaa: 0, other: 0 })

export function countable<T extends { status: RecordStatus }>(records: T[], includeInvalidated = false): T[] {
  return includeInvalidated ? records : records.filter((r) => r.status !== 'invalidated')
}

export function lineTotal(lines: { quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

export interface RegistrationSummary {
  registrations: number
  total: number
  byCategory: CategoryCounts
}

export function summarizeRegistrations(records: RegistrationRecord[]): RegistrationSummary {
  const byCategory = emptyCounts()
  let total = 0
  for (const r of records) {
    for (const l of r.lines) {
      byCategory[l.category] += l.quantity
      total += l.quantity
    }
  }
  return { registrations: records.length, total, byCategory }
}

export interface TrendPoint extends CategoryCounts {
  key: string
  label: string
  total: number
  registrations: number
}

export function registrationTrend(records: RegistrationRecord[], period: MiljoPeriod): TrendPoint[] {
  const points = periodBuckets(period).map((b) => ({ ...b, ...emptyCounts(), total: 0, registrations: 0 }))
  const index = new Map(points.map((p, i) => [p.key, i]))
  for (const r of records) {
    const i = index.get(bucketKeyForInstant(r.registeredAt, period.grouping))
    if (i === undefined) continue
    const p = points[i]!
    p.registrations += 1
    for (const l of r.lines) {
      p[l.category] += l.quantity
      p.total += l.quantity
    }
  }
  return points
}

// ── Deliveries ──

/** Sums kilograms in hundredths so 0.1 + 0.2 stays 0.3. */
const addKg = (a: number, b: number): number => Math.round(a * 100 + b * 100) / 100

export interface UnitTotal {
  deliveries: number
  quantity: number
}

export interface DeliverySummary {
  deliveries: number
  byUnit: Record<DeliveryUnit, UnitTotal>
  documented: number
  reported: number
  operators: { name: string; deliveries: number; kg: number; stk: number }[]
}

export function summarizeDeliveries(records: DeliveryRecord[]): DeliverySummary {
  const byUnit: Record<DeliveryUnit, UnitTotal> = { kg: { deliveries: 0, quantity: 0 }, stk: { deliveries: 0, quantity: 0 } }
  const operators = new Map<string, { name: string; deliveries: number; kg: number; stk: number }>()
  let documented = 0
  for (const d of records) {
    const unit = byUnit[d.unit]
    unit.deliveries += 1
    unit.quantity = d.unit === 'kg' ? addKg(unit.quantity, d.quantity) : unit.quantity + d.quantity
    if (d.documentationStatus === 'documented') documented += 1
    const key = d.operator.toLocaleLowerCase('nb-NO')
    const op = operators.get(key) ?? { name: d.operator, deliveries: 0, kg: 0, stk: 0 }
    op.deliveries += 1
    if (d.unit === 'kg') op.kg = addKg(op.kg, d.quantity)
    else op.stk += d.quantity
    operators.set(key, op)
  }
  return {
    deliveries: records.length,
    byUnit,
    documented,
    reported: records.length - documented,
    operators: [...operators.values()].sort((a, b) => b.deliveries - a.deliveries || a.name.localeCompare(b.name, 'nb')),
  }
}

export interface DeliveryTrendPoint {
  key: string
  label: string
  kg: number
  stk: number
  deliveries: number
}

export function deliveryTrend(records: DeliveryRecord[], period: MiljoPeriod): DeliveryTrendPoint[] {
  const points = periodBuckets(period).map((b) => ({ ...b, kg: 0, stk: 0, deliveries: 0 }))
  const index = new Map(points.map((p, i) => [p.key, i]))
  for (const d of records) {
    const i = index.get(bucketKeyForDay(d.deliveryDate, period.grouping))
    if (i === undefined) continue
    const p = points[i]!
    p.deliveries += 1
    if (d.unit === 'kg') p.kg = addKg(p.kg, d.quantity)
    else p.stk += d.quantity
  }
  return points
}

/** Public row of a delivery — no reference, no document, no audit data. */
export interface PublicDeliveryRow {
  deliveryDate: string
  quantity: number
  unit: DeliveryUnit
  operator: string
  documentation: string
  documentationStatus: DocumentationStatus
}

export function publicDeliveryRows(records: DeliveryRecord[]): PublicDeliveryRow[] {
  return [...records]
    .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.id - a.id)
    .map((d) => ({
      deliveryDate: d.deliveryDate,
      quantity: d.quantity,
      unit: d.unit,
      operator: d.operator,
      documentationStatus: d.documentationStatus,
      documentation: DOCUMENTATION_LABELS[d.documentationStatus],
    }))
}

/** Categories to show: those offered now, plus any that still carry data from earlier. */
export function visibleCategories(offered: BatteryCategory[], counts: CategoryCounts): BatteryCategory[] {
  return BATTERY_CATEGORIES.filter((c) => offered.includes(c) || counts[c] > 0)
}

// ── Admin: per organisation ──

export interface OrganizationRow {
  id: number
  name: string
  status: string
  registrations: number
  total: number
  byCategory: CategoryCounts
  deliveries: number
  kg: number
  stk: number
  lastRegistrationAt: string | null
}

export function perOrganization(
  organizations: { id: number; name: string; status: string }[],
  registrations: RegistrationRecord[],
  deliveries: DeliveryRecord[],
): OrganizationRow[] {
  const rows = new Map<number, OrganizationRow>(
    organizations.map((o) => [
      o.id,
      { id: o.id, name: o.name, status: o.status, registrations: 0, total: 0, byCategory: emptyCounts(), deliveries: 0, kg: 0, stk: 0, lastRegistrationAt: null },
    ]),
  )
  for (const r of registrations) {
    const row = rows.get(r.organizationId)
    if (!row) continue
    row.registrations += 1
    for (const l of r.lines) {
      row.byCategory[l.category] += l.quantity
      row.total += l.quantity
    }
    if (!row.lastRegistrationAt || r.registeredAt > row.lastRegistrationAt) row.lastRegistrationAt = r.registeredAt
  }
  for (const d of deliveries) {
    const row = rows.get(d.organizationId)
    if (!row) continue
    row.deliveries += 1
    if (d.unit === 'kg') row.kg = addKg(row.kg, d.quantity)
    else row.stk += d.quantity
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'nb'))
}
