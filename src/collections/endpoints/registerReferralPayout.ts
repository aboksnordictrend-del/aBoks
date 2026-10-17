import {
  commitTransaction,
  initTransaction,
  killTransaction,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import { PAYOUT_METHODS, type PayoutMethod } from '@/lib/partner/constants'
import { parseAmountOere } from '@/lib/partner/balance'
import { oereToKr } from '@/lib/money'
import { planReferralPayout, MAX_SALES_PER_PAYOUT, type PayoutPlanError } from '@/lib/partner/referral'
import { lockOutstandingAdjustments, lockSalesForPayout } from '@/lib/partner/referralLocks'
import { REFERRAL_PAYOUT_CONTEXT } from '../hooks/referralSale'
import { ADJUSTMENT_SETTLEMENT_CONTEXT } from '../hooks/referralAdjustment'

/**
 * Registers a payout of referral commission (Bedriftssalg / Forhandlersalg) that has ALREADY been
 * paid by bank, Vipps or otherwise — `POST /api/partner-payouts/register-referral`.
 *
 * It never moves money, and it never touches a promo code: promo payouts keep their own endpoint
 * (`/register`) and their own per-code balance, which never reads these rows.
 *
 * ── What the client may say ──
 *
 * Accepted: `partnerId`, `saleIds`, `expectedAmount`, `payoutDate`, `paymentMethod`, `reference`,
 * `note`. Every amount is derived here from the locked rows; `expectedAmount` is only compared, so
 * a screen drawn before anything changed cannot pay a different figure than it showed.
 *
 * ── One transaction ──
 *
 *   1. lock the selected sales and the partner's outstanding adjustments (`FOR UPDATE`);
 *   2. decide with `planReferralPayout` — every sale paid, earned, unpaid and this partner's;
 *      every outstanding adjustment deducted; net above zero;
 *   3. insert the payout row, link each sale to it (→ «Utbetalt»), settle each adjustment;
 *   4. commit. Any failure rolls back all of it — no payout without its sales, no sale marked
 *      paid without its payout, no adjustment deducted by a payout that does not exist.
 *
 * A second request for an overlapping selection blocks on the locks, then finds the sales paid
 * and is refused. Without a database transaction the request is refused rather than run unlocked.
 */

const MAX_BODY_BYTES = 8_000
const MAX_TEXT_LENGTH = 500

type ErrorCode =
  | 'unauthorized'
  | 'invalid_body'
  | 'partner_not_found'
  | 'invalid_payout_date'
  | 'invalid_payment_method'
  | 'invalid_amount'
  | 'transaction_unavailable'
  | 'balance_changed'
  | 'create_failed'
  | PayoutPlanError

/** A refusal raised inside the transaction, so it can be rolled back and reported the same way. */
class Refusal extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const fail = (code: ErrorCode, message: string, status: number): Response =>
  Response.json({ error: message, code }, { status })

const log = (fields: Record<string, unknown>) =>
  console.error(JSON.stringify({ scope: 'referral-payout', ...fields }))

const kr = (oere: number) => oereToKr(oere).toFixed(2).replace('.', ',')

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, MAX_TEXT_LENGTH) : null
}

const isPayoutMethod = (value: unknown): value is PayoutMethod =>
  typeof value === 'string' && (PAYOUT_METHODS as readonly string[]).includes(value)

/**
 * A payout date → ISO string. A date-only value («2026-10-17», what the dialog sends) is stored at
 * 12:00 UTC, the same calendar day in every timezone; midnight UTC would display as the previous
 * day anywhere west of Greenwich.
 */
function parsePayoutDate(value: unknown): string | null {
  if (value == null || value === '') return new Date().toISOString()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const ms = new Date(`${value}T12:00:00.000Z`).getTime()
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

const positiveInt = (value: unknown): number | null => {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

async function readBody(req: PayloadRequest): Promise<Record<string, unknown> | null> {
  try {
    const raw = typeof req.json === 'function' ? await req.json() : undefined
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
    if (JSON.stringify(raw).length > MAX_BODY_BYTES) return null
    return raw as Record<string, unknown>
  } catch {
    return null
  }
}

/** The database steps the handler depends on — injectable so the money logic is testable. */
export interface ReferralPayoutDeps {
  lockSales: typeof lockSalesForPayout
  lockAdjustments: typeof lockOutstandingAdjustments
  initTransaction: (req: PayloadRequest) => Promise<boolean>
  commitTransaction: (req: PayloadRequest) => Promise<void>
  killTransaction: (req: PayloadRequest) => Promise<void>
}

const defaultDeps: ReferralPayoutDeps = {
  lockSales: lockSalesForPayout,
  lockAdjustments: lockOutstandingAdjustments,
  initTransaction,
  commitTransaction,
  killTransaction,
}

export function createReferralPayoutHandler(deps: ReferralPayoutDeps = defaultDeps) {
  return async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) return fail('unauthorized', 'Du må være innlogget.', 401)

    const body = await readBody(req)
    if (!body) return fail('invalid_body', 'Ugyldig forespørsel.', 400)

    const partnerId = positiveInt(body.partnerId)
    if (partnerId == null) return fail('invalid_body', 'Partner mangler.', 400)

    if (!Array.isArray(body.saleIds) || body.saleIds.length === 0) {
      return fail('no_sales', 'Velg minst ett salg.', 400)
    }
    if (body.saleIds.length > MAX_SALES_PER_PAYOUT) {
      return fail('too_many_sales', `Én utbetaling kan dekke høyst ${MAX_SALES_PER_PAYOUT} salg.`, 400)
    }
    const saleIds = body.saleIds.map(positiveInt)
    if (saleIds.some((id) => id == null)) return fail('invalid_body', 'Ugyldig salg i utvalget.', 400)

    const expectedOere = parseAmountOere(body.expectedAmount)
    if (expectedOere == null || expectedOere <= 0) return fail('invalid_amount', 'Ugyldig beløp.', 400)

    const payoutDate = parsePayoutDate(body.payoutDate)
    if (!payoutDate) return fail('invalid_payout_date', 'Ugyldig utbetalingsdato.', 400)
    if (!isPayoutMethod(body.paymentMethod)) {
      return fail('invalid_payment_method', 'Velg en gyldig betalingsmåte.', 400)
    }
    const paymentMethod = body.paymentMethod

    const { payload } = req
    const partner = (await payload.findByID({
      collection: 'partners',
      id: partnerId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })) as { id: number; name?: unknown } | null
    const partnerName = typeof partner?.name === 'string' ? partner.name.trim() : ''
    if (!partner || !partnerName) return fail('partner_not_found', 'Fant ikke partneren.', 404)

    // ── One transaction from the first lock to the commit ──
    let shouldCommit = false
    try {
      shouldCommit = await deps.initTransaction(req)

      const sales = await deps.lockSales(req, saleIds as number[])
      const adjustments = await deps.lockAdjustments(req, partnerId)
      if (sales == null || adjustments == null) {
        throw new Refusal('transaction_unavailable', 'Utbetalingen kan ikke registreres akkurat nå (ingen databasetransaksjon). Prøv igjen.', 503)
      }

      const plan = planReferralPayout({ partnerId, requestedSaleIds: saleIds as number[], sales, adjustments })
      if (!plan.ok) {
        throw new Refusal(plan.code, plan.message, plan.code === 'sale_not_found' ? 404 : 409)
      }

      // The screen stated an amount; the locked rows must still produce exactly that amount.
      if (expectedOere !== plan.netOere) {
        throw new Refusal(
          'balance_changed',
          `Beløpet har endret seg siden skjemaet ble åpnet. Til utbetaling nå: ${kr(plan.netOere)} kr. Lukk og prøv igjen.`,
          409,
        )
      }

      const payout = await payload.create({
        collection: 'partner-payouts',
        data: {
          source: 'referral',
          promoCode: null,
          partner: partnerId,
          partnerNameSnapshot: partnerName,
          amount: oereToKr(plan.netOere),
          referralGrossAmount: oereToKr(plan.grossOere),
          referralDeductedAmount: oereToKr(plan.deductedOere),
          referralSales: plan.saleIds,
          referralAdjustments: plan.adjustmentIds,
          payoutDate,
          paymentMethod,
          reference: optionalText(body.reference),
          note: optionalText(body.note),
          createdBy: Number(req.user.id),
        } as never,
        context: { [REFERRAL_PAYOUT_CONTEXT]: true },
        overrideAccess: true,
        req,
      })

      for (const saleId of plan.saleIds) {
        await payload.update({
          collection: 'referral-sales',
          id: saleId,
          data: { payout: payout.id },
          context: { [REFERRAL_PAYOUT_CONTEXT]: true },
          overrideAccess: true,
          req,
        })
      }

      const settledAt = new Date().toISOString()
      for (const adjustmentId of plan.adjustmentIds) {
        await payload.update({
          collection: 'referral-commission-adjustments',
          id: adjustmentId,
          data: { settledByPayout: payout.id, settledAt },
          context: { [ADJUSTMENT_SETTLEMENT_CONTEXT]: true },
          overrideAccess: true,
          req,
        })
      }

      if (shouldCommit) await deps.commitTransaction(req)

      return Response.json({
        ok: true,
        payoutId: payout.id,
        amount: oereToKr(plan.netOere),
        grossCommission: oereToKr(plan.grossOere),
        deducted: oereToKr(plan.deductedOere),
        saleCount: plan.saleIds.length,
        adjustmentCount: plan.adjustmentIds.length,
      })
    } catch (err) {
      await deps.killTransaction(req).catch(() => {})
      if (err instanceof Refusal) return fail(err.code, err.message, err.status)
      log({ event: 'payout-failed', partnerId, error: err instanceof Error ? err.message.slice(0, 200) : 'unknown' })
      return fail('create_failed', 'Utbetalingen kunne ikke registreres. Ingenting er lagret.', 500)
    }
  }
}

export const registerReferralPayout: Endpoint = {
  path: '/register-referral',
  method: 'post',
  handler: createReferralPayoutHandler(),
}
