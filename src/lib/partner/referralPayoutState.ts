import type { Payload, PayloadRequest } from 'payload'
import { toOere } from '@/lib/money'
import { computeReferralTotals, type ReferralTotals } from './referral'

/**
 * Everything the partner's «Henvisningsprovisjon» panel shows, in three queries — sales,
 * adjustments, referral payouts — whatever their number. Display only: the payout endpoint
 * re-reads and locks every row before it writes, so nothing here authorises a payout.
 *
 * Promo-code payouts are excluded by `source: 'referral'`; their figures stay on each promo code.
 */

export interface PayableSaleRow {
  id: string
  title: string
  category: string | null
  saleDate: string | null
  commissionAmount: number
}

export interface AdjustmentRow {
  id: string
  title: string
  saleId: string | null
  amount: number
  reason: string | null
  createdAt: string | null
  settledByPayoutId: string | null
  settledAt: string | null
}

export interface ReferralPayoutRow {
  id: string
  payoutDate: string | null
  amount: number
  grossAmount: number | null
  deductedAmount: number | null
  saleCount: number
  paymentMethod: string | null
  reference: string | null
}

export interface ReferralPayoutState {
  totals: ReferralTotals
  payableSales: PayableSaleRow[]
  outstandingAdjustments: AdjustmentRow[]
  adjustments: AdjustmentRow[]
  payouts: ReferralPayoutRow[]
}

const ALL = { limit: 0, pagination: false as const, depth: 0, overrideAccess: true }

const idOf = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

export async function loadReferralPayoutState(
  payload: Payload,
  partnerId: string | number,
  options: { req?: PayloadRequest } = {},
): Promise<ReferralPayoutState> {
  const withReq = options.req ? { req: options.req } : {}

  const [sales, adjustments, payouts] = await Promise.all([
    payload.find({ collection: 'referral-sales', where: { partner: { equals: partnerId } }, sort: 'saleDate', ...ALL, ...withReq }),
    payload.find({
      collection: 'referral-commission-adjustments',
      where: { partner: { equals: partnerId } },
      sort: '-createdAt',
      ...ALL,
      ...withReq,
    }),
    payload.find({
      collection: 'partner-payouts',
      where: { and: [{ partner: { equals: partnerId } }, { source: { equals: 'referral' } }] },
      sort: '-payoutDate',
      ...ALL,
      ...withReq,
    }),
  ])

  const saleDocs = sales.docs as unknown as Record<string, unknown>[]
  const adjustmentRows: AdjustmentRow[] = (adjustments.docs as unknown as Record<string, unknown>[]).map((doc) => ({
    id: String(doc.id),
    title: str(doc.title) ?? `Justering ${String(doc.id)}`,
    saleId: idOf(doc.sale),
    amount: num(doc.amount) ?? 0,
    reason: str(doc.reason),
    createdAt: str(doc.createdAt),
    settledByPayoutId: idOf(doc.settledByPayout),
    settledAt: str(doc.settledAt),
  }))

  const totals = computeReferralTotals(
    saleDocs.map((doc) => ({
      category: doc.category,
      commissionStatus: doc.commissionStatus,
      commissionAmountOere: num(doc.commissionAmount) == null ? null : toOere(num(doc.commissionAmount)!),
    })),
    (adjustments.docs as unknown as Record<string, unknown>[]).map((doc) => ({
      amountOere: num(doc.amount) == null ? null : toOere(num(doc.amount)!),
      settled: idOf(doc.settledByPayout) != null,
    })),
  )

  const payableSales: PayableSaleRow[] = saleDocs
    .filter((doc) => doc.commissionStatus === 'earned' && idOf(doc.payout) == null && (num(doc.commissionAmount) ?? 0) > 0)
    .map((doc) => ({
      id: String(doc.id),
      title: str(doc.title) ?? `Salg ${String(doc.id)}`,
      category: str(doc.category),
      saleDate: str(doc.saleDate),
      commissionAmount: num(doc.commissionAmount) ?? 0,
    }))

  return {
    totals,
    payableSales,
    outstandingAdjustments: adjustmentRows.filter((a) => a.settledByPayoutId == null),
    adjustments: adjustmentRows,
    payouts: (payouts.docs as unknown as Record<string, unknown>[]).map((doc) => ({
      id: String(doc.id),
      payoutDate: str(doc.payoutDate),
      amount: num(doc.amount) ?? 0,
      grossAmount: num(doc.referralGrossAmount),
      deductedAmount: num(doc.referralDeductedAmount),
      saleCount: Array.isArray(doc.referralSales) ? doc.referralSales.length : 0,
      paymentMethod: str(doc.paymentMethod),
      reference: str(doc.reference),
    })),
  }
}

