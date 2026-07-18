// Pure marketing-cost calculations: period allocation of expenses and the derived
// ratios (ROAS, CAC, cost-per-order, marketing share). No I/O — every input is passed in,
// so this is fully unit-testable and deterministic.
//
// Amounts are always ex-VAT (comparable to net revenue): the user enters the paid amount
// incl. MVA and the collection stores amountExVat; here we only ever read the ex-VAT value.

import { osloDateKey } from './period'
import { round2 } from './money'
import type { ChannelRow, MarketingRatioEntry, Period } from './types'
import { channelLabel } from '../marketingChannels'

/** One marketing expense, normalized. amountExVat drives analytics; the rest is for CSV. */
export interface MarketingExpenseInput {
  channel: string
  amountExVat: number
  /** Cost date (used when no period range is given). */
  date: string
  periodFrom?: string | null
  periodTo?: string | null
  /** Gross amount as entered (incl. VAT) — CSV only. */
  amount?: number
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

/**
 * Ex-VAT amount of an expense that falls inside the analysis period.
 * - No period range → the whole amount if `date` is within the window, else 0.
 * - Period range → spread evenly per day, allocate the overlapping days.
 * Deterministic; never returns NaN/Infinity.
 */
export function allocateExpense(expense: MarketingExpenseInput, period: Period): number {
  const amount = Number.isFinite(expense.amountExVat) ? expense.amountExVat : 0
  if (amount === 0) return 0
  const { fromIdx, toIdx } = windowDays(period)
  if (toIdx < fromIdx) return 0

  const hasRange = !!expense.periodFrom && !!expense.periodTo
  if (!hasRange) {
    const day = osloDayIndex(expense.date)
    return day >= fromIdx && day <= toIdx ? round2(amount) : 0
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

  return round2((amount / totalDays) * overlapDays)
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

/** Total ex-VAT ad spend allocated to the period. */
export function computeAdSpend(expenses: MarketingExpenseInput[], period: Period): number {
  let total = 0
  for (const e of expenses) total += allocateExpense(e, period)
  return round2(total)
}

/** Per-channel ex-VAT spend + share of total, sorted by amount desc. No revenue attribution. */
export function computeChannels(expenses: MarketingExpenseInput[], period: Period): ChannelRow[] {
  const map = new Map<string, number>()
  let total = 0
  for (const e of expenses) {
    const allocated = allocateExpense(e, period)
    if (allocated === 0) continue
    map.set(e.channel, (map.get(e.channel) ?? 0) + allocated)
    total += allocated
  }
  const rows: ChannelRow[] = [...map.entries()].map(([channel, amountExVat]) => ({
    channel,
    label: channelLabel(channel),
    amountExVat: round2(amountExVat),
    share: round2(total > 0 ? (amountExVat / total) * 100 : 0),
  }))
  rows.sort((a, b) => b.amountExVat - a.amountExVat)
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
