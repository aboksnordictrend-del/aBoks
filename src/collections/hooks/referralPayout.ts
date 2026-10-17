import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook } from 'payload'
import { REFERRAL_PAYOUT_CONTEXT } from './referralSale'
import { ADJUSTMENT_SETTLEMENT_CONTEXT } from './referralAdjustment'

/**
 * Referral-payout integrity on the shared `partner-payouts` ledger.
 *
 * Promo-code payouts are untouched by both hooks: `assignPayoutSource` only labels a new promo row
 * `promoCode` (and insists it has its promo code, as the field always required), and
 * `reverseReferralPayoutOnDelete` returns immediately for anything that is not a referral payout.
 */

export const REFERRAL_PAYOUT_ONLY_MESSAGE =
  'Utbetaling av henvisningsprovisjon kan bare registreres fra partneren («Registrer utbetaling av henvisningsprovisjon»).'

export const PAYOUT_HAS_CLAWBACK_MESSAGE =
  'Utbetalingen kan ikke slettes fordi et salg den dekket senere er refundert eller kansellert, og det er registrert en provisjonsjustering mot den.'

const relId = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const raw = typeof value === 'object' ? (value as { id?: unknown }).id : value
  const n = Number(raw)
  return Number.isInteger(n) ? n : null
}

/**
 * On create: a row without `source: 'referral'` is a promo payout and must name its promo code.
 * A referral row needs the referral payout endpoint's context flag, sales, and no promo code.
 */
export const assignPayoutSource: CollectionBeforeChangeHook = ({ operation, data, context }) => {
  if (operation !== 'create' || !data) return data

  if (data.source !== 'referral') {
    data.source = 'promoCode'
    if (relId(data.promoCode) == null) throw new APIError('Rabattkode mangler.', 400)
    return data
  }

  if (context?.[REFERRAL_PAYOUT_CONTEXT] !== true) throw new APIError(REFERRAL_PAYOUT_ONLY_MESSAGE, 403)
  if (relId(data.promoCode) != null) throw new APIError('En utbetaling av henvisningsprovisjon har ingen rabattkode.', 400)
  if (!Array.isArray(data.referralSales) || data.referralSales.length === 0) {
    throw new APIError('En utbetaling av henvisningsprovisjon må dekke minst ett salg.', 400)
  }
  return data
}

/**
 * Deleting a referral payout (admin only, for a payout registered by mistake) puts everything it
 * covered back, on the delete's own transaction: its sales become «Opptjent» again and the
 * adjustments it deducted become outstanding again. Refused once one of its sales has a clawback
 * adjustment — that adjustment exists only because this payout paid the sale.
 */
export const reverseReferralPayoutOnDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const payout = (await req.payload.findByID({
    collection: 'partner-payouts',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as { source?: unknown } | null
  if (!payout || payout.source !== 'referral') return

  const clawbacks = await req.payload.count({
    collection: 'referral-commission-adjustments',
    where: { originalPayout: { equals: id } },
    overrideAccess: true,
    req,
  })
  if (clawbacks.totalDocs > 0) throw new APIError(PAYOUT_HAS_CLAWBACK_MESSAGE, 409)

  const sales = await req.payload.find({
    collection: 'referral-sales',
    where: { payout: { equals: id } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  for (const sale of sales.docs) {
    await req.payload.update({
      collection: 'referral-sales',
      id: sale.id,
      data: { payout: null },
      context: { [REFERRAL_PAYOUT_CONTEXT]: true },
      overrideAccess: true,
      req,
    })
  }

  const settled = await req.payload.find({
    collection: 'referral-commission-adjustments',
    where: { settledByPayout: { equals: id } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  for (const adjustment of settled.docs) {
    await req.payload.update({
      collection: 'referral-commission-adjustments',
      id: adjustment.id,
      data: { settledByPayout: null, settledAt: null },
      context: { [ADJUSTMENT_SETTLEMENT_CONTEXT]: true },
      overrideAccess: true,
      req,
    })
  }
}
