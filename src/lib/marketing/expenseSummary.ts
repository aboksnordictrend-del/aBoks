// Provider-neutral summary maths for an imported marketing-expenses table (Meta Ads,
// Google Ads, …). No I/O and no Payload types, so it is fully unit-testable.
//
// The totals here are *computed* from the displayed rows — they are never written back as a
// MarketingExpense, so analytics can never double-count them.
//
// src/lib/marketing/metaExpenses.ts re-exports these under their original Meta names, so
// the Meta detail view keeps working byte-for-byte while Google Ads reuses the same code.

import { round2 } from '../analytics/money'

/** One marketing-expenses record, normalized for a channel detail table. No secrets. */
export interface ExpenseRow {
  id: string
  /** Cost day (ISO). */
  date: string
  /** Paid amount incl. MVA, NOK. */
  amount: number
  /** Amount excl. MVA, NOK. */
  amountExVat: number
  /** 'manual' | 'meta-api' | 'google-ads' | … */
  source: string
  description?: string | null
  /** ISO timestamp of the last sync for imported rows. */
  lastSyncedAt?: string | null
}

export interface ExpensesSummary {
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

/** Only the rows imported from the given provider. Manual rows excluded. */
export function filterImportedRows(rows: ExpenseRow[], sourceValue: string): ExpenseRow[] {
  return rows.filter((r) => r.source === sourceValue)
}

/** Sum of paid amounts incl. MVA over the given rows (rounded, NaN-safe). */
export function sumInclVat(rows: ExpenseRow[]): number {
  return round2(rows.reduce((t, r) => t + (Number.isFinite(r.amount) ? r.amount : 0), 0))
}

/** Sum of ex-MVA amounts over the given rows. */
export function sumExVat(rows: ExpenseRow[]): number {
  return round2(rows.reduce((t, r) => t + (Number.isFinite(r.amountExVat) ? r.amountExVat : 0), 0))
}

/** YYYY-MM-DD from an ISO date (for distinct-day counting). */
function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Summary of the displayed rows: totals, distinct days, latest sync, stored history range. */
export function expensesSummary(rows: ExpenseRow[]): ExpensesSummary {
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
