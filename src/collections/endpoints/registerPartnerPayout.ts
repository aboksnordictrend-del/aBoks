import type { Endpoint, PayloadRequest } from 'payload'
import { PAYOUT_METHODS, PAYOUT_METHOD_OPTIONS, type PayoutMethod } from '@/lib/partner/constants'
import { parseAmountOere } from '@/lib/partner/balance'
import { loadPartnerBalance } from '@/lib/partner/balanceQuery'
import { loadPartnerStatistics } from '@/lib/partner/statistics'
import { createPartnerPayoutEmail } from '@/emails'
import { oereToKr } from '@/lib/cartPricing'

/**
 * Registers a payout that has ALREADY been paid — `POST /api/partner-payouts/register`.
 *
 * This is the only way a `partner-payouts` row can be created; the collection's own `create`
 * access is closed. It never moves money: it records that a human transferred an amount by
 * bank, Vipps or otherwise.
 *
 * ── What the client may say, and what it may not ──
 *
 * Accepted: `promoCodeId`, `amount`, `payoutDate`, `paymentMethod`, `reference`, `note`.
 *
 * Everything financial is derived here, from the database, immediately before the insert: the
 * earned commission, the amount already paid, the balance still available, and the partner's
 * name. A body that carries `partnerNameSnapshot`, `availableToPay` or `earnedCommission` is
 * not rejected — it is simply never read, which is the more robust of the two behaviours.
 *
 * ── Concurrency ──
 *
 * The balance is recalculated from scratch on every request, immediately before the insert, so
 * a stale figure from a screen rendered minutes ago can never authorise a payout — the second
 * of two requests built on the same balance sees the first one's row and is refused.
 *
 * The remaining window is genuinely small: two admins pressing the button in the same few
 * milliseconds could both read the pre-payout balance. That is deliberately NOT solved with
 * row locking here — this is a low-frequency, single-operator admin action, a lock would be
 * the more fragile mechanism, and an overpayment is recoverable (delete the row; the balance
 * recomputes). If it ever needs closing, `loadPartnerBalance` already takes the `req`, so the
 * read and the insert can be wrapped in one transaction without any accounting rule changing.
 */

const MAX_BODY_BYTES = 4_000
const MAX_TEXT_LENGTH = 500

type ErrorCode =
  | 'unauthorized'
  | 'invalid_body'
  | 'promo_not_found'
  | 'not_partner_code'
  | 'partner_name_missing'
  | 'invalid_amount'
  | 'invalid_payout_date'
  | 'invalid_payment_method'
  | 'no_available_balance'
  | 'amount_exceeds_balance'
  | 'unreadable_payout_history'
  | 'balance_lookup_failed'
  | 'create_failed'
  /** `expectFullBalance` was requested but the balance moved since the screen was drawn. */
  | 'balance_changed'

/** What happened to the partner confirmation e-mail. Never affects whether the payout stands. */
export type PayoutEmailStatus = 'sent' | 'skipped_no_address' | 'failed'

/** Norwegian, safe to show an admin. Never carries a database detail or a stack trace. */
function fail(code: ErrorCode, message: string, status: number): Response {
  return Response.json({ error: message, code }, { status })
}

const log = (fields: Record<string, unknown>) =>
  console.error(JSON.stringify({ scope: 'partner-payout', ...fields }))

/** Trimmed, length-capped, or null. Applied to the two free-text fields. */
function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_TEXT_LENGTH)
}

function isPayoutMethod(value: unknown): value is PayoutMethod {
  return typeof value === 'string' && (PAYOUT_METHODS as readonly string[]).includes(value)
}

/**
 * A payout date → ISO string, or `undefined` when it is unusable.
 *
 * Absent means "today", matching the field's own default. Anything present must parse.
 */
function parsePayoutDate(value: unknown): { ok: true; iso: string } | { ok: false } {
  if (value == null || value === '') return { ok: true, iso: new Date().toISOString() }
  if (typeof value !== 'string' && typeof value !== 'number') return { ok: false }
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return { ok: false }
  return { ok: true, iso: new Date(ms).toISOString() }
}

/** Size-limited JSON body, following the pattern in `@/endpoints/metaSync`. */
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

/** The parts of a promo code this endpoint reads. All from the one document already fetched. */
type PartnerPromo = {
  id: number | string
  code?: string | null
  isPartnerCode?: boolean | null
  partnerName?: string | null
  partnerEmail?: string | null
}

/**
 * A deliberately conservative address check: exactly one @, something either side, a dot in
 * the domain, no whitespace. An address that does not clear this is treated as absent, so a
 * malformed value skips the e-mail rather than throwing inside the send.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const METHOD_LABEL = new Map<string, string>(
  PAYOUT_METHOD_OPTIONS.map((o) => [o.value as string, o.label]),
)

export const registerPartnerPayout: Endpoint = {
  path: '/register',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return fail('unauthorized', 'Du må være innlogget.', 401)
    }

    const body = await readBody(req)
    if (!body) return fail('invalid_body', 'Ugyldig forespørsel.', 400)

    const { payload } = req

    // ── The promo code, and whether it may receive a payout at all ──
    const promoCodeId = body.promoCodeId
    if (
      promoCodeId == null ||
      (typeof promoCodeId !== 'string' && typeof promoCodeId !== 'number') ||
      String(promoCodeId).trim() === ''
    ) {
      return fail('invalid_body', 'Rabattkode mangler.', 400)
    }

    let promo: PartnerPromo | undefined
    try {
      promo = (await payload.findByID({
        collection: 'promo-codes',
        id: promoCodeId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })) as PartnerPromo | undefined
    } catch (err) {
      log({ event: 'promo-lookup-failed', promoCodeId: String(promoCodeId), error: String(err) })
      return fail('promo_not_found', 'Fant ikke rabattkoden.', 404)
    }

    if (!promo) return fail('promo_not_found', 'Fant ikke rabattkoden.', 404)

    // Verified server-side, independently of the admin UI's filterOptions.
    if (promo.isPartnerCode !== true) {
      return fail(
        'not_partner_code',
        'Rabattkoden er ikke en partnerkode. Utbetaling kan ikke registreres.',
        409,
      )
    }

    const partnerNameSnapshot =
      typeof promo.partnerName === 'string' ? promo.partnerName.trim() : ''
    if (!partnerNameSnapshot) {
      return fail(
        'partner_name_missing',
        'Rabattkoden mangler partnernavn. Fyll ut «Partner / eier» før du registrerer en utbetaling.',
        409,
      )
    }

    // ── The rest of the request ──
    const payoutDate = parsePayoutDate(body.payoutDate)
    if (!payoutDate.ok) return fail('invalid_payout_date', 'Ugyldig utbetalingsdato.', 400)

    if (!isPayoutMethod(body.paymentMethod)) {
      return fail('invalid_payment_method', 'Velg en gyldig betalingsmåte.', 400)
    }

    const amountOere = parseAmountOere(body.amount)
    if (amountOere == null) return fail('invalid_amount', 'Ugyldig beløp.', 400)
    if (amountOere <= 0) return fail('invalid_amount', 'Beløpet må være større enn 0.', 400)

    // ── The authoritative balance, recalculated right now ──
    let balance
    try {
      balance = await loadPartnerBalance(payload, promo.id, { req })
    } catch (err) {
      log({ event: 'balance-failed', promoCodeId: String(promo.id), error: String(err) })
      return fail(
        'balance_lookup_failed',
        'Kunne ikke beregne saldoen akkurat nå. Prøv igjen.',
        503,
      )
    }

    // The paid total is only a lower bound while a stored payout is unreadable, which makes
    // the available balance an upper bound. Refuse rather than risk overpaying.
    if (balance.hasUnreadablePayout) {
      log({
        event: 'unreadable-payout-history',
        promoCodeId: String(promo.id),
        payoutIds: balance.unreadablePayouts,
      })
      return fail(
        'unreadable_payout_history',
        'Utbetalingshistorikken inneholder en ugyldig verdi. Kontroller registrerte utbetalinger før du registrerer en ny.',
        409,
      )
    }

    if (balance.availableToPayOere <= 0) {
      return fail('no_available_balance', 'Det er ingenting å utbetale.', 409)
    }

    if (amountOere > balance.availableToPayOere) {
      return fail(
        'amount_exceeds_balance',
        `Beløpet er høyere enn tilgjengelig saldo (${oereToKr(balance.availableToPayOere).toFixed(2).replace('.', ',')} kr).`,
        409,
      )
    }

    // The admin flow always pays the whole accumulated balance, and says so with this flag.
    // Requiring exact equality is what makes a stale screen safe: if anything moved between
    // the modal being drawn and the button being pressed — a new paid order, another payout —
    // the figures no longer match and the request is refused rather than paying a stale
    // amount. Left opt-in so the endpoint's existing partial-amount contract is unchanged.
    if (body.expectFullBalance === true && amountOere !== balance.availableToPayOere) {
      return fail(
        'balance_changed',
        `Saldoen har endret seg siden skjemaet ble åpnet. Tilgjengelig nå: ${oereToKr(balance.availableToPayOere).toFixed(2).replace('.', ',')} kr. Lukk og prøv igjen.`,
        409,
      )
    }

    // ── Create ──
    let payoutId: number | string
    try {
      const created = await payload.create({
        collection: 'partner-payouts',
        data: {
          promoCode: Number(promo.id),
          // Server-copied. A client-submitted name is never read.
          partnerNameSnapshot,
          amount: oereToKr(amountOere),
          payoutDate: payoutDate.iso,
          paymentMethod: body.paymentMethod,
          reference: optionalText(body.reference),
          note: optionalText(body.note),
          createdBy: req.user.id,
        },
        overrideAccess: true,
        req,
      })
      payoutId = created.id
    } catch (err) {
      log({ event: 'create-failed', promoCodeId: String(promo.id), error: String(err) })
      return fail('create_failed', 'Utbetalingen kunne ikke registreres.', 500)
    }

    // ── Partner confirmation e-mail ──
    //
    // Strictly after the ledger row exists, so an e-mail can never announce a payout that was
    // not registered. The row is authoritative: a failed send is reported and logged, never
    // rolled back, never retried automatically, and never deletes the payout.
    const partnerEmail =
      typeof promo.partnerEmail === 'string' ? promo.partnerEmail.trim() : ''
    let emailStatus: PayoutEmailStatus = 'skipped_no_address'

    if (partnerEmail && EMAIL_RE.test(partnerEmail)) {
      try {
        // The two figures the e-mail shows that the balance alone does not carry. Read after
        // the insert; neither depends on payouts, so the new row cannot skew them.
        const stats = await loadPartnerStatistics(payload, promo.id, { req })

        await payload.sendEmail({
          to: partnerEmail,
          ...createPartnerPayoutEmail({
            partnerName: partnerNameSnapshot,
            promoCode: typeof promo.code === 'string' ? promo.code : '',
            validUsageCount: stats.counts.valid,
            revenueAfterDiscount: stats.revenue,
            payoutAmount: oereToKr(amountOere),
            payoutDate: payoutDate.iso,
            paymentMethod: METHOD_LABEL.get(body.paymentMethod) ?? body.paymentMethod,
            reference: optionalText(body.reference),
          }),
        })
        emailStatus = 'sent'
      } catch (err) {
        emailStatus = 'failed'
        log({
          event: 'email-failed',
          promoCodeId: String(promo.id),
          payoutId: String(payoutId),
          error: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
        })
      }
    }

    // Derived from the balance that was just validated plus this payout, so the caller gets
    // the figures that are true after the insert without a second round of queries.
    const paidAmountOere = balance.paidAmountOere + amountOere
    const availableToPayOere = Math.max(balance.earnedCommissionOere - paidAmountOere, 0)

    return Response.json({
      ok: true,
      payoutId,
      amount: oereToKr(amountOere),
      earnedCommission: balance.earnedCommission,
      paidAmount: oereToKr(paidAmountOere),
      availableToPay: oereToKr(availableToPayOere),
      emailStatus,
    })
  },
}
