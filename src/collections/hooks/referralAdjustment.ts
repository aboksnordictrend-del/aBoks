import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook } from 'payload'
import { adjustmentReasonFor, clawbackFor } from '@/lib/partner/referral'
import { oereToKr, toOere } from '@/lib/money'

/**
 * Negative commission adjustments («Provisjonsjusteringer») — the clawback of a referral
 * commission that was ALREADY PAID OUT when its sale was refunded or cancelled.
 *
 *   • Created only here, by `createClawbackAdjustment` (an afterChange hook on `referral-sales`),
 *     on the request's own transaction: the refund and its adjustment commit or roll back together.
 *   • Exactly one per sale. The hook checks first, and a UNIQUE index on `sale_id` refuses a
 *     second row even from two simultaneous requests.
 *   • Deducted whole, by the next referral payout, which sets `settledByPayout`. Never deducted
 *     twice: only rows without `settledByPayout` are outstanding, and the payout endpoint locks
 *     them before reading them.
 *   • Never edited except the note, never deleted. The sale and the payout that paid it are left
 *     exactly as they were.
 */

/** `req.context` flag with which the payout endpoint — and only it — settles or un-settles a row. */
export const ADJUSTMENT_SETTLEMENT_CONTEXT = 'referralAdjustmentSettlement'

export const ADJUSTMENT_LOCKED_MESSAGE =
  'Provisjonsjusteringer opprettes og avregnes automatisk. Bare notatet kan endres.'

/** Fields the payout endpoint may write; everything else is fixed at creation. */
const SETTLEMENT_FIELDS = ['settledByPayout', 'settledAt']
const EDITABLE_FIELDS = ['note']

/** Money fields compare in øre; everything else — ids included — as text. */
const MONEY_FIELDS = new Set(['amount'])

const comparableValue = (field: string, value: unknown): unknown => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? JSON.stringify(value) : String(id)
  }
  if (MONEY_FIELDS.has(field) && typeof value === 'number') return toOere(value)
  return String(value)
}

/** Refuses every change except the note — and settlement, when the payout endpoint makes it. */
export const guardAdjustmentChanges: CollectionBeforeChangeHook = ({ operation, data, originalDoc, context }) => {
  if (operation !== 'update' || !originalDoc || !data) return data
  const allowed = new Set([...EDITABLE_FIELDS, ...(context?.[ADJUSTMENT_SETTLEMENT_CONTEXT] === true ? SETTLEMENT_FIELDS : [])])
  const system = new Set(['id', 'createdAt', 'updatedAt'])
  const changed = Object.keys(data).filter(
    (key) =>
      !allowed.has(key) &&
      !system.has(key) &&
      comparableValue(key, (data as Record<string, unknown>)[key]) !==
        comparableValue(key, (originalDoc as Record<string, unknown>)[key]),
  )
  if (changed.length > 0) throw new APIError(ADJUSTMENT_LOCKED_MESSAGE, 403)
  return data
}

type SaleDoc = {
  id: number | string
  title?: unknown
  partner?: unknown
  category?: unknown
  payout?: unknown
  paymentStatus?: unknown
  commissionStatus?: unknown
  commissionAmount?: unknown
}

const relId = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const raw = typeof value === 'object' ? (value as { id?: unknown }).id : value
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

/**
 * afterChange on `referral-sales`: a sale whose commission had been PAID OUT and that is now
 * reversed gets exactly one negative adjustment for the full commission.
 */
export const createClawbackAdjustment: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update') return doc
  const sale = doc as SaleDoc
  const before = previousDoc as SaleDoc | undefined

  // The sale's own hook re-reads the payout link under a row lock, so `doc.payout` is the
  // committed truth even if a payout was registered while this refund was being saved.
  const paidOut = relId(sale.payout) != null
  if (!paidOut || sale.commissionStatus !== 'reversed' || before?.commissionStatus === 'reversed') return doc

  const amountOere = clawbackFor({
    previousCommissionStatus: 'paid',
    nextCommissionStatus: 'reversed',
    commissionAmountOere: typeof sale.commissionAmount === 'number' ? toOere(sale.commissionAmount) : 0,
  })
  if (amountOere == null) return doc

  const existing = await req.payload.count({
    collection: 'referral-commission-adjustments',
    where: { sale: { equals: sale.id } },
    overrideAccess: true,
    req,
  })
  if (existing.totalDocs > 0) return doc

  await req.payload.create({
    collection: 'referral-commission-adjustments',
    data: {
      sale: Number(sale.id),
      partner: relId(sale.partner),
      category: sale.category as 'businessSale' | 'retailStore',
      amount: oereToKr(amountOere),
      reason: adjustmentReasonFor(sale.paymentStatus),
      originalPayout: relId(sale.payout),
      title: `Tilbakeføring – ${typeof sale.title === 'string' ? sale.title : `salg ${String(sale.id)}`}`,
      createdBy: relId(req.user?.id),
    },
    overrideAccess: true,
    req,
  })
  return doc
}
