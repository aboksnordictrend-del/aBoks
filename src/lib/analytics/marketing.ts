// Pure marketing-cost calculations: period allocation of expenses and the derived
// ratios (ROAS, CAC, cost-per-order, marketing share). No I/O — every input is passed in,
// so this is fully unit-testable and deterministic.
//
// What an expense COSTS depends on the day it was incurred (`@/lib/vatRegistration`): expenses are
// entered as the amount actually paid, VAT included. While ABOKS AS is not VAT-registered that full
// amount is the cost — input VAT cannot be reclaimed, so nothing is divided by 1.25 and nothing is
// added. On a registered day the cost is the stored `amountExVat` (the record's own VAT removed);
// a record stored with 0 % has nothing to deduct. The records themselves are never changed.
// Expenses imported from the advertising APIs are the exception: their reported amount is the
// cost, on every day, with no VAT adjustment either way (see `API_EXPENSE_SOURCES`).

import { osloDateKey } from './period'
import { VAT_REGISTRATION_PERIODS, costOnDay, type VatRegistrationPeriod } from '../vatRegistration'
import { round2 } from './money'
import type { ChannelRow, MarketingRatioEntry, Period } from './types'
import { channelLabel } from '../marketingChannels'

/** One marketing expense, normalized. */
export interface MarketingExpenseInput {
  channel: string
  /** Stored ex-VAT amount — the cost on a VAT-registered day. */
  amountExVat: number
  /** Cost date (used when no period range is given). */
  date: string
  periodFrom?: string | null
  periodTo?: string | null
  /**
   * Manual expense: the amount actually paid, as entered (incl. VAT). API expense: the spend the
   * platform reported, which is the cost as it stands (see `API_EXPENSE_SOURCES`).
   */
  amount?: number
  /** `marketing-expenses.source`: 'manual' or one of `API_EXPENSE_SOURCES`. */
  source?: string | null
  vatRate?: number
  description?: string | null
  externalReference?: string | null
}

const MS_PER_DAY = 86_400_000

/** Integer day number for an Oslo calendar day (days since epoch). DST-agnostic. */
function osloDayIndex(iso: string): number {
  const [y, mo, d] = osloDateKey(new Date(iso)).split('-').map(Number)
  return Math.floor(Date.UTC(y, mo - 1, d) / MS_PER_DAY)
}

/** Analysis window as inclusive Oslo day indices [fromIdx, toIdx]. `to` is exclusive. */
function windowDays(period: Period): { fromIdx: number; toIdx: number } {
  const fromIdx = osloDayIndex(period.from)
  // period.to is start-of-day *after* the last included day → subtract one day.
  const toIdxExclusive = osloDayIndex(period.to)
  return { fromIdx, toIdx: toIdxExclusive - 1 }
}

/** `YYYY-MM-DD` of an Oslo day index (indices are built from the Oslo calendar date). */
const dayKey = (idx: number): string => new Date(idx * MS_PER_DAY).toISOString().slice(0, 10)

/**
 * Expenses imported from the advertising APIs (the `source` values of `marketing-expenses`). Their
 * `amount` is the platform's reported spend, and it is the actual advertising cost for management
 * analytics — confirmed against the card charge on a Meta receipt. No VAT is added to it and none
 * is taken off, whatever VAT rate the import stored and whether or not ABOKS AS is VAT-registered:
 * the stored rate is an assumption of the import, not invoice data. A discrepancy found on a real
 * invoice is to be handled separately.
 */
export const API_EXPENSE_SOURCES: readonly string[] = ['meta-api', 'google-ads', 'pinterest-ads', 'tiktok-ads']

export const isApiExpense = (expense: Pick<MarketingExpenseInput, 'source'>): boolean =>
  typeof expense.source === 'string' && API_EXPENSE_SOURCES.includes(expense.source)

/**
 * The two amounts an expense can cost. The amount paid falls back to `amountExVat` only for a
 * record without a usable amount, which never happens for an expense saved through the collection.
 * An API expense has one amount only: what the platform reported.
 */
function amountsOf(expense: MarketingExpenseInput): { amountPaid: number; amountExVat: number } {
  if (isApiExpense(expense)) {
    const reported = typeof expense.amount === 'number' && Number.isFinite(expense.amount) ? expense.amount : 0
    return { amountPaid: reported, amountExVat: reported }
  }
  const amountExVat = Number.isFinite(expense.amountExVat) ? expense.amountExVat : 0
  const paid = expense.amount
  return {
    amountPaid: typeof paid === 'number' && Number.isFinite(paid) && paid > 0 ? paid : amountExVat,
    amountExVat,
  }
}

/**
 * The cost of an expense that falls inside the analysis period, each day under the VAT
 * registration that applied on that day (see the file header).
 * - No period range → the whole cost if `date` is within the window, else 0.
 * - Period range → spread evenly per day, allocate the overlapping days.
 * Deterministic; never returns NaN/Infinity.
 */
export function allocateExpense(
  expense: MarketingExpenseInput,
  period: Period,
  vatPeriods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): number {
  const amounts = amountsOf(expense)
  if (amounts.amountPaid === 0 && amounts.amountExVat === 0) return 0
  const { fromIdx, toIdx } = windowDays(period)
  if (toIdx < fromIdx) return 0

  const hasRange = !!expense.periodFrom && !!expense.periodTo
  if (!hasRange) {
    const day = osloDayIndex(expense.date)
    return day >= fromIdx && day <= toIdx ? round2(costOnDay(amounts, dayKey(day), vatPeriods)) : 0
  }

  let expFrom = osloDayIndex(expense.periodFrom!)
  let expTo = osloDayIndex(expense.periodTo!)
  if (expTo < expFrom) [expFrom, expTo] = [expTo, expFrom] // defensive: swap inverted range
  const totalDays = expTo - expFrom + 1
  if (totalDays <= 0) return 0

  const overlapStart = Math.max(expFrom, fromIdx)
  const overlapEnd = Math.min(expTo, toIdx)
  const overlapDays = overlapEnd - overlapStart + 1
  if (overlapDays <= 0) return 0

  // Each overlapping day costs its share under that day's registration, counted as two day totals.
  let paidDays = 0
  for (let idx = overlapStart; idx <= overlapEnd; idx += 1) {
    if (costOnDay({ amountPaid: 1, amountExVat: 0 }, dayKey(idx), vatPeriods) === 1) paidDays += 1
  }
  const exVatDays = overlapDays - paidDays
  return round2((amounts.amountPaid / totalDays) * paidDays + (amounts.amountExVat / totalDays) * exVatDays)
}

/** The cost of the whole record (all of its days) under the same rule — for the CSV export. */
export function expenseCost(
  expense: MarketingExpenseInput,
  vatPeriods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): number {
  const ranged = !!expense.periodFrom && !!expense.periodTo
  const a = osloDayIndex(ranged ? expense.periodFrom! : expense.date)
  const b = osloDayIndex(ranged ? expense.periodTo! : expense.date)
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  // 00:00 UTC of a day is 01:00/02:00 Oslo on the same calendar day, so these instants map to the
  // Oslo days lo (inclusive) and hi + 1 (exclusive) in either season.
  const window = {
    from: new Date(lo * MS_PER_DAY).toISOString(),
    to: new Date((hi + 1) * MS_PER_DAY).toISOString(),
  }
  return allocateExpense(expense, window, vatPeriods)
}

/** Whether an expense's date or period range touches the analysis window (for CSV listing). */
export function expenseOverlapsPeriod(expense: MarketingExpenseInput, period: Period): boolean {
  const { fromIdx, toIdx } = windowDays(period)
  if (toIdx < fromIdx) return false
  if (expense.periodFrom && expense.periodTo) {
    const a = osloDayIndex(expense.periodFrom)
    const b = osloDayIndex(expense.periodTo)
    const [lo, hi] = a <= b ? [a, b] : [b, a]
    return lo <= toIdx && hi >= fromIdx
  }
  const day = osloDayIndex(expense.date)
  return day >= fromIdx && day <= toIdx
}

/** Total marketing cost allocated to the period. */
export function computeAdSpend(
  expenses: MarketingExpenseInput[],
  period: Period,
  vatPeriods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): number {
  let total = 0
  for (const e of expenses) total += allocateExpense(e, period, vatPeriods)
  return round2(total)
}

/** Per-channel cost + share of total, sorted by amount desc. No revenue attribution. */
export function computeChannels(
  expenses: MarketingExpenseInput[],
  period: Period,
  vatPeriods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): ChannelRow[] {
  const map = new Map<string, number>()
  let total = 0
  for (const e of expenses) {
    const allocated = allocateExpense(e, period, vatPeriods)
    if (allocated === 0) continue
    map.set(e.channel, (map.get(e.channel) ?? 0) + allocated)
    total += allocated
  }
  const rows: ChannelRow[] = [...map.entries()].map(([channel, amount]) => ({
    channel,
    label: channelLabel(channel),
    amount: round2(amount),
    share: round2(total > 0 ? (amount / total) * 100 : 0),
  }))
  rows.sort((a, b) => b.amount - a.amount)
  return rows
}

/** ROAS = gross revenue / ad spend. Null (render "—") when ad spend is 0. */
export function computeRoas(revenueGross: number, adSpend: number): number | null {
  if (adSpend <= 0) return null
  return round2(revenueGross / adSpend)
}

/** CAC = ad spend / new customers. Null when there are no new customers. */
export function computeCac(adSpend: number, newCustomers: number): number | null {
  if (newCustomers <= 0) return null
  return round2(adSpend / newCustomers)
}

/** Marketing cost per paid order. Null when there are no paid orders. */
export function computeCostPerOrder(adSpend: number, paidOrders: number): number | null {
  if (paidOrders <= 0) return null
  return round2(adSpend / paidOrders)
}

/** Ad spend as a percent of net revenue. Null when net revenue is 0. */
export function computeMarketingShare(adSpend: number, revenueNet: number): number | null {
  if (revenueNet <= 0) return null
  return round2((adSpend / revenueNet) * 100)
}

/** Pair a current/previous ratio into a comparison entry, null-safe (no NaN/Infinity). */
export function ratioEntry(current: number | null, previous: number | null): MarketingRatioEntry {
  const changePercent =
    current == null || previous == null || previous === 0
      ? null
      : round2(((current - previous) / Math.abs(previous)) * 100)
  return { current, previous, changePercent }
}
