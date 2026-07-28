import { oereToKr, toOere } from '@/lib/cartPricing'
import { COMMISSION_ORDER_STATUSES, isCommissionOrderStatus } from './orderStatus'
import { isCommissionBase } from './commission'

/**
 * What a partner has earned, what they have been paid, and what is still owed.
 *
 * Pure: it takes already-fetched rows and joins them in memory, exactly as
 * `@/lib/analytics/promo` does, so the caller issues a fixed number of queries however many
 * usages or payouts exist. `./balanceQuery.ts` is the half that talks to Payload; everything
 * that decides *money* lives here and is directly testable.
 *
 * ── Every exclusion is explicit ──
 *
 * A usage row is only ever counted when it is positively known to be a valid, paid, partner
 * sale. Everything else is excluded WITH A REASON, never silently dropped and never modified:
 *
 *   not_partner_usage      the snapshot says this was an ordinary code (or an ordinary code
 *                          that was only later converted to a partner code — history must not
 *                          retroactively earn)
 *   legacy_no_snapshot     written before Stage 3; it has no financial snapshot, and the
 *                          amounts must never be invented
 *   order_missing          no order relationship, or the order has been deleted — the status
 *                          is unknowable, so it cannot be treated as a valid sale
 *   order_status_excluded  the order is cancelled, still pending, or in a status this system
 *                          does not recognise
 *   invalid_amount         the stored commission is not a usable non-negative number
 *
 * The rows themselves are never touched. Excluding a cancelled order's commission is a
 * reporting decision, not a correction of history.
 *
 * ── Money ──
 *
 * Stored values are decimal kroner (`numeric` columns). Each one is converted to integer øre
 * ONCE, on the way in, and every sum is integer arithmetic — so a hundred small commissions
 * add up to exactly the right figure instead of drifting. Kroner reappear only in the result,
 * for storage and display.
 */

export type UsageExclusionReason =
  | 'not_partner_usage'
  | 'legacy_no_snapshot'
  | 'order_missing'
  | 'order_status_excluded'
  | 'invalid_amount'

/** One `promo-code-usages` row, as the query hands it over at depth 0. */
export interface BalanceUsageInput {
  id: string | number
  isPartnerUsage?: boolean | null
  commissionAmount?: number | null
  /** Present on every Stage 3 row; null identifies a legacy record. */
  commissionBaseSnapshot?: string | null
  /** Second half of the legacy check — see `hasFinancialSnapshot`. */
  orderAmountAfterDiscount?: number | null
  /** Relationship id, or null when the order was deleted (ON DELETE SET NULL). */
  orderId?: string | number | null
}

/** The orders those usages point at. Only the status matters here. */
export interface BalanceOrderInput {
  id: string | number
  status?: string | null
}

/** One `partner-payouts` row. */
export interface BalancePayoutInput {
  id: string | number
  amount?: number | null
}

export interface ExcludedUsage {
  id: string
  reason: UsageExclusionReason
}

export interface PartnerBalance {
  // ── Integer øre: the arithmetic truth ──
  earnedCommissionOere: number
  paidAmountOere: number
  availableToPayOere: number

  // ── Decimal kroner: for storage, display and the API response ──
  earnedCommission: number
  paidAmount: number
  availableToPay: number

  /** Usages that actually earned. */
  includedUsages: number
  /** Everything that did not, and why. Auditable, never silently dropped. */
  excludedUsages: ExcludedUsage[]
  /** Payouts whose stored amount is unreadable — see `hasUnreadablePayout`. */
  unreadablePayouts: string[]
  /**
   * True when at least one payout amount could not be read.
   *
   * The paid total is then a LOWER BOUND, so `availableToPay` is an upper bound and acting on
   * it could overpay. The registration endpoint refuses while this is true; nothing is
   * silently assumed in either direction.
   */
  hasUnreadablePayout: boolean
}

const idOf = (value: string | number): string => String(value)

/** A finite, non-negative money value in kroner. Anything else is not usable. */
function readKroner(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

/**
 * Does this row carry a real Stage 3 financial snapshot?
 *
 * Deliberately not a single-field test. `commissionBaseSnapshot` is the precise discriminator
 * (every Stage 3 row stores one, legacy rows have NULL), but a money field is checked too, so
 * a half-written row — a base with no amounts — is treated as legacy rather than counted as a
 * zero-commission sale.
 */
function hasFinancialSnapshot(usage: BalanceUsageInput): boolean {
  if (!isCommissionBase(usage.commissionBaseSnapshot)) return false
  if (readKroner(usage.orderAmountAfterDiscount) == null) return false
  return true
}

/** Classifies one usage. Returns null when it counts. */
function excludeReason(
  usage: BalanceUsageInput,
  orderById: Map<string, BalanceOrderInput>,
): UsageExclusionReason | null {
  if (usage.isPartnerUsage !== true) return 'not_partner_usage'
  if (!hasFinancialSnapshot(usage)) return 'legacy_no_snapshot'

  const orderId = usage.orderId == null ? '' : idOf(usage.orderId)
  const order = orderId ? orderById.get(orderId) : undefined
  // No relationship, or a row the orders query did not return → the order is gone.
  if (!order) return 'order_missing'

  if (!isCommissionOrderStatus(order.status)) return 'order_status_excluded'
  if (readKroner(usage.commissionAmount) == null) return 'invalid_amount'

  return null
}

export interface PartnerBalanceInput {
  usages: BalanceUsageInput[]
  orders: BalanceOrderInput[]
  payouts: BalancePayoutInput[]
}

export function computePartnerBalance(input: PartnerBalanceInput): PartnerBalance {
  const orderById = new Map(input.orders.map((order) => [idOf(order.id), order]))

  let earnedCommissionOere = 0
  let includedUsages = 0
  const excludedUsages: ExcludedUsage[] = []

  for (const usage of input.usages) {
    const reason = excludeReason(usage, orderById)
    if (reason) {
      excludedUsages.push({ id: idOf(usage.id), reason })
      continue
    }
    // readKroner already accepted it inside excludeReason.
    earnedCommissionOere += toOere(usage.commissionAmount as number)
    includedUsages += 1
  }

  let paidAmountOere = 0
  const unreadablePayouts: string[] = []

  for (const payout of input.payouts) {
    const amount = readKroner(payout.amount)
    if (amount == null) {
      unreadablePayouts.push(idOf(payout.id))
      continue
    }
    paidAmountOere += toOere(amount)
  }

  const availableToPayOere = Math.max(earnedCommissionOere - paidAmountOere, 0)

  return {
    earnedCommissionOere,
    paidAmountOere,
    availableToPayOere,
    earnedCommission: oereToKr(earnedCommissionOere),
    paidAmount: oereToKr(paidAmountOere),
    availableToPay: oereToKr(availableToPayOere),
    includedUsages,
    excludedUsages,
    unreadablePayouts,
    hasUnreadablePayout: unreadablePayouts.length > 0,
  }
}

/** A partner with no history at all. */
export const EMPTY_PARTNER_BALANCE: PartnerBalance = {
  earnedCommissionOere: 0,
  paidAmountOere: 0,
  availableToPayOere: 0,
  earnedCommission: 0,
  paidAmount: 0,
  availableToPay: 0,
  includedUsages: 0,
  excludedUsages: [],
  unreadablePayouts: [],
  hasUnreadablePayout: false,
}

/* ------------------------------ request parsing ------------------------------ */

/**
 * A requested payout amount → integer øre, or null when it is not usable money.
 *
 * Narrow on purpose. A finite number, or a plain decimal literal string (a JSON body may
 * legitimately carry `"250.00"`), and nothing else — no general `Number()` coercion, so '',
 * 'abc', '1e5' and booleans are all refused rather than becoming a payout. Sub-øre precision
 * is rounded with the project's single conversion step; the sign and zero checks are the
 * caller's, so it can return the right error for each.
 */
export function parseAmountOere(value: unknown): number | null {
  let kroner: number | null = null

  if (typeof value === 'number' && Number.isFinite(value)) {
    kroner = value
  } else if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) kroner = parsed
  }

  if (kroner == null) return null
  return toOere(kroner)
}

export { COMMISSION_ORDER_STATUSES }
