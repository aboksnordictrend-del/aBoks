import { osloDateKey } from '@/lib/analytics/period'
import { VAT_RATE_PERCENT } from '@/lib/tax'

/**
 * When ABOKS AS is registered in Merverdiavgiftsregisteret — the ONE place the analytics learn
 * whether a sale carried output VAT («utgående MVA»).
 *
 * ── Why this exists ──
 *
 * Every webshop order line stores `vatRate`, but that value is not evidence of VAT charged: the
 * checkout writes `VAT_RATE_PERCENT` (25) from `@/lib/tax` onto every new line, and the same nominal
 * 25 % is sent to Kustom, whether or not the company is registered. A stored 25 cannot be told apart
 * from VAT that was really invoiced. Deducting it would remove 20 % of every gross sale from revenue
 * and profit even though ABOKS AS, not being registered, owes no output VAT and keeps the whole
 * amount paid.
 *
 * So the treatment is decided by the sale's DATE against the explicit registration periods below:
 *
 *   • outside every period  → 0 % output VAT; the full amount paid is revenue
 *   • inside a period       → the rate stored on the order line (the historical snapshot)
 *
 * Because the rule depends only on the sale's own date, registering later never changes a sale made
 * before the registration date, and an order keeps the treatment of the day it was sold. Nothing is
 * written back: checkout, Kustom, receipts and the stored `vatRate` are untouched.
 *
 * ── How to register ──
 *
 * Add the registration as `{ from: 'YYYY-MM-DD' }` (the first day VAT applies, Oslo calendar date,
 * as stated by Skatteetaten). A deregistration closes it with `to` (the last VAT day, inclusive).
 * Deliberately kept in code, not in an admin setting: it is a legal fact that changes very rarely,
 * every change is reviewed and stays in the git history, and nobody can retroactively re-price
 * history with a click. Changing an existing period's `from` DOES change history — only correct it
 * when the stated date was wrong.
 *
 * Only output VAT on sales is decided here. Input VAT on costs (e.g. advertising) and the VAT on
 * manual referral sales (chosen per sale) are separate.
 */

export interface VatRegistrationPeriod {
  /** First day with VAT registration, `YYYY-MM-DD`, Oslo calendar date. Inclusive. */
  from: string
  /** Last day with VAT registration, `YYYY-MM-DD`, inclusive. Absent = still registered. */
  to?: string
}

/** ABOKS AS is NOT registered in Merverdiavgiftsregisteret (as of 2026-10-21). */
export const VAT_REGISTRATION_PERIODS: readonly VatRegistrationPeriod[] = []

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Is the company VAT-registered on the Oslo calendar day of `instant`? */
export function isVatRegisteredOn(
  instant: string | Date,
  periods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): boolean {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  if (!Number.isFinite(date.getTime())) return false
  const day = osloDateKey(date)
  return periods.some((p) => DATE_RE.test(p.from) && day >= p.from && (!p.to || day <= p.to))
}

/** Is the company VAT-registered on this Oslo calendar day (`YYYY-MM-DD`)? */
export function isVatRegisteredOnDay(
  day: string,
  periods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): boolean {
  return DATE_RE.test(day) && periods.some((p) => DATE_RE.test(p.from) && day >= p.from && (!p.to || day <= p.to))
}

/* ------------------------------ input VAT on costs ------------------------------ */

/**
 * What one day's share of a recorded cost (e.g. advertising) costs ABOKS AS.
 *
 * Costs are entered as the amount actually paid, VAT included, with the VAT rate the supplier
 * charged; the expense collection derives `amountExVat` from those two. Input VAT is a cost the
 * company can only get back while it is VAT-registered:
 *
 *   • not registered → the full amount paid. Nothing is divided by 1.25 and nothing is added.
 *   • registered     → the amount without the VAT recorded on the expense. Only VAT the record
 *                      actually states is treated as deductible: an expense stored with 0 % has
 *                      `amountExVat` equal to the amount paid, so nothing is deducted.
 */
export function costOnDay(
  expense: { amountPaid: number; amountExVat: number },
  day: string,
  periods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): number {
  return isVatRegisteredOnDay(day, periods) ? expense.amountExVat : expense.amountPaid
}

export type OutputVatTreatment =
  /** Sold while not VAT-registered: no output VAT, whatever the line stores. */
  | 'notRegistered'
  /** Registered: the rate stored on the line at purchase. */
  | 'stored'
  /** Registered, but the line has no stored rate: the checkout rate is assumed (and flagged). */
  | 'assumed'

export interface OutputVat {
  rate: number
  treatment: OutputVatTreatment
}

/** The output VAT rate (percent) a webshop order line actually carried on its sale date. */
export function outputVatFor(
  input: { saleDate: string; storedRate: number | null | undefined },
  periods: readonly VatRegistrationPeriod[] = VAT_REGISTRATION_PERIODS,
): OutputVat {
  if (!isVatRegisteredOn(input.saleDate, periods)) return { rate: 0, treatment: 'notRegistered' }
  if (typeof input.storedRate === 'number' && Number.isFinite(input.storedRate) && input.storedRate >= 0) {
    return { rate: input.storedRate, treatment: 'stored' }
  }
  return { rate: VAT_RATE_PERCENT, treatment: 'assumed' }
}
