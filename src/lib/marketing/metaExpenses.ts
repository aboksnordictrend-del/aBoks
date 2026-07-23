// Pure helpers for the Meta Ads detail view: filtering to imported (meta-api) records and
// computing the displayed totals. No I/O and no Payload types, so it is fully unit-testable.
//
// The total shown under the table is a *computed* sum of the displayed rows — it is never
// written back as a MarketingExpense, so analytics can never double-count it.
//
// The maths itself is provider-neutral and lives in ./expenseSummary (shared with the
// Google Ads view). This module keeps the Meta-named public API unchanged.

import {
  expensesSummary,
  filterImportedRows,
  sumExVat,
  sumInclVat,
  type ExpenseRow,
  type ExpensesSummary,
} from './expenseSummary'

/** One marketing-expenses record, normalized for the detail table. No secrets. */
export type MetaExpenseRow = ExpenseRow
export type MetaExpensesSummary = ExpensesSummary

export { sumInclVat, sumExVat }

const META_API_SOURCE = 'meta-api'

/** Only the rows imported from the Meta API (source === 'meta-api'). Manual rows excluded. */
export function filterMetaApiRows(rows: MetaExpenseRow[]): MetaExpenseRow[] {
  return filterImportedRows(rows, META_API_SOURCE)
}

/** Summary of the displayed rows: totals, distinct days, latest sync. */
export function metaExpensesSummary(rows: MetaExpenseRow[]): MetaExpensesSummary {
  return expensesSummary(rows)
}
