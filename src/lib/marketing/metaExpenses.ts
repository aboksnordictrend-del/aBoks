// Pure helpers for the Meta Ads detail view: filtering to imported (meta-api) records and
// computing the displayed totals. No I/O and no Payload types, so it is fully unit-testable.
//
// The total shown under the table is a *computed* sum of the displayed rows — it is never
// written back as a MarketingExpense, so analytics can never double-count it.

import { round2 } from '../analytics/money'

/** One marketing-expenses record, normalized for the detail table. No secrets. */
export interface MetaExpenseRow {
  id: string
  /** Cost day (ISO). */
  date: string
  /** Paid amount incl. MVA, NOK. */
  amount: number
  /** Amount excl. MVA, NOK. */
  amountExVat: number
  /** 'manual' | 'meta-api' | … */
  source: string
  description?: string | null
  /** ISO timestamp of the last sync for imported rows. */
  lastSyncedAt?: string | null
}

export interface MetaExpensesSummary {
  totalInclVat: number
  totalExVat: number
  /** Distinct cost days among the displayed rows. */
  days: number
  /** Most recent lastSyncedAt among the rows, or null. */
  lastSyncedAt: string | null
  /** Earliest cost day present (YYYY-MM-DD), or null — the stored history range. */
  firstDay: string | null
  /** Latest cost day present (YYYY-MM-DD), or null. */
  lastDay: string | null
}

const META_API_SOURCE = 'meta-api'

/** Only the rows imported from the Meta API (source === 'meta-api'). Manual rows excluded. */
export function filterMetaApiRows(rows: MetaExpenseRow[]): MetaExpenseRow[] {
  return rows.filter((r) => r.source === META_API_SOURCE)
}

/** Sum of paid amounts incl. MVA over the given rows (rounded, NaN-safe). */
export function sumInclVat(rows: MetaExpenseRow[]): number {
  return round2(rows.reduce((t, r) => t + (Number.isFinite(r.amount) ? r.amount : 0), 0))
}

/** Sum of ex-MVA amounts over the given rows. */
export function sumExVat(rows: MetaExpenseRow[]): number {
  return round2(rows.reduce((t, r) => t + (Number.isFinite(r.amountExVat) ? r.amountExVat : 0), 0))
}

/** YYYY-MM-DD from an ISO date (for distinct-day counting). */
function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Summary of the displayed rows: totals, distinct days, latest sync. */
export function metaExpensesSummary(rows: MetaExpenseRow[]): MetaExpensesSummary {
  const dayKeys = rows.map((r) => dayKey(r.date))
  const days = new Set(dayKeys).size
  let lastSyncedAt: string | null = null
  let firstDay: string | null = null
  let lastDay: string | null = null
  for (const r of rows) {
    if (r.lastSyncedAt && (!lastSyncedAt || r.lastSyncedAt > lastSyncedAt)) {
      lastSyncedAt = r.lastSyncedAt
    }
  }
  for (const key of dayKeys) {
    if (!firstDay || key < firstDay) firstDay = key
    if (!lastDay || key > lastDay) lastDay = key
  }
  return {
    totalInclVat: sumInclVat(rows),
    totalExVat: sumExVat(rows),
    days,
    lastSyncedAt,
    firstDay,
    lastDay,
  }
}
