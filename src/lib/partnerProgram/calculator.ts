import { oereToKr, toOere } from '@/lib/money'
import { calculateCommission } from '@/lib/partner/commission'
import { DEFAULT_COMMISSION_BASE } from '@/lib/partner/constants'

/**
 * The illustrative arithmetic behind /bli-partner: the calculator, both charts and every
 * worked example on the page come out of `calculatePartnerExample`, so no figure on the page
 * is typed in by hand and none can disagree with another.
 *
 * ── The commission itself comes from the real engine ──
 *
 * The commission step is not re-implemented here: it calls `calculateCommission` from
 * `@/lib/partner/commission`, the same function the Kustom webhook uses on a paid order, with
 * the default `orderAfterDiscount` base. So the page follows the engine's rules by
 * construction — merchandise only, shipping excluded, taken from the amount actually paid
 * after the discount code, one rounding step to the nearest øre. If the engine's rules ever
 * change, these examples change with them.
 *
 * What this module does NOT do is touch a real order: nothing here is imported by checkout,
 * the webhook or the payout flow.
 *
 * ── The order of operations (programme terms) ──
 *
 *   1. original order value, before any discount
 *   2. − corporate (volume) discount            — illustrated as a percentage; in the shop
 *                                                 it is the lower unit price of a quantity band
 *   3. − the additional partner discount, taken from the amount AFTER step 2
 *   4. = what the customer pays for the goods   — the commission base
 *   5. commission = rate × the amount from step 4 (via the engine)
 *   6. ABOKS AS retains step 4 − commission, before production and operating costs
 *
 * Shipping is not part of any of these amounts. No VAT is deducted anywhere: ABOKS AS is not
 * registered in Merverdiavgiftsregisteret, and the engine's base is the amount paid.
 *
 * ── Money ──
 *
 * Integer øre throughout, exactly like the rest of the project (`@/lib/money`). Each rounding
 * step rounds to the nearest øre, once, per order; multi-order totals multiply the rounded
 * per-order figure, which is how separate real orders would add up.
 */

/** The additional customer discount a partner code gives, in percent. Programme term. */
export const PARTNER_DISCOUNT_PERCENT = 10
/** Commission on the amount paid for the goods, in percent. Programme term. */
export const PARTNER_COMMISSION_PERCENT = 15

/** Calculator input bounds. */
export const CALCULATOR_LIMITS = {
  orderValueMin: 0,
  orderValueMax: 1_000_000,
  ordersMin: 1,
  ordersMax: 1000,
  corporateDiscountMin: 0,
  corporateDiscountMax: 50,
} as const

export interface PartnerExampleInput {
  /** Original order value in kroner, before any discount. */
  orderValueKr: number
  /** Number of identical orders. Defaults to 1. */
  orders?: number
  /** Corporate volume discount in percent. Defaults to 0. */
  corporateDiscountPercent?: number
  partnerDiscountPercent?: number
  commissionPercent?: number
}

/** All amounts in øre for ONE order. */
export interface PartnerExampleOrder {
  originalOere: number
  corporateDiscountOere: number
  afterCorporateOere: number
  partnerDiscountOere: number
  /** What the customer pays for the goods — also the commission base. */
  customerPaysOere: number
  commissionOere: number
  retainedOere: number
}

export interface PartnerExampleResult {
  /** The inputs after clamping, so the UI can show what was actually calculated. */
  input: Required<PartnerExampleInput>
  perOrder: PartnerExampleOrder
  /** `perOrder × orders`. */
  total: PartnerExampleOrder
}

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** Percent → integer basis points (10 % → 1000), as the commission engine represents rates. */
const bp = (percent: number): number => Math.round(percent * 100)

/** `amount × percent`, rounded once to the nearest øre. */
const percentOf = (amountOere: number, percent: number): number =>
  Math.round((amountOere * bp(percent)) / 10_000)

/**
 * Normalises raw input. Never throws: a non-number becomes the default, an out-of-range value
 * is clamped, and order counts are whole numbers.
 */
export function normalizeExampleInput(raw: PartnerExampleInput): Required<PartnerExampleInput> {
  return {
    orderValueKr: clamp(
      finiteOr(raw.orderValueKr, 0),
      CALCULATOR_LIMITS.orderValueMin,
      CALCULATOR_LIMITS.orderValueMax,
    ),
    orders: Math.round(
      clamp(finiteOr(raw.orders, 1), CALCULATOR_LIMITS.ordersMin, CALCULATOR_LIMITS.ordersMax),
    ),
    corporateDiscountPercent: clamp(
      finiteOr(raw.corporateDiscountPercent, 0),
      CALCULATOR_LIMITS.corporateDiscountMin,
      CALCULATOR_LIMITS.corporateDiscountMax,
    ),
    partnerDiscountPercent: clamp(finiteOr(raw.partnerDiscountPercent, PARTNER_DISCOUNT_PERCENT), 0, 100),
    commissionPercent: clamp(finiteOr(raw.commissionPercent, PARTNER_COMMISSION_PERCENT), 0, 100),
  }
}

function calculateOrder(input: Required<PartnerExampleInput>): PartnerExampleOrder {
  const originalOere = toOere(input.orderValueKr)
  const corporateDiscountOere = percentOf(originalOere, input.corporateDiscountPercent)
  const afterCorporateOere = originalOere - corporateDiscountOere
  // Stacked: the partner discount is a share of the price AFTER the corporate discount — the
  // same order checkout applies a code to a quantity-banded subtotal. Same rounding as the
  // promo validator: nearest øre, once.
  const partnerDiscountOere = percentOf(afterCorporateOere, input.partnerDiscountPercent)
  const customerPaysOere = afterCorporateOere - partnerDiscountOere
  // The real engine, fed exactly what the paid-order path feeds it: the subtotal the code was
  // applied to, and the code's discount.
  const { commissionAmountOere: commissionOere } = calculateCommission({
    isPartnerCode: true,
    commissionRate: input.commissionPercent,
    commissionBase: DEFAULT_COMMISSION_BASE,
    subtotalBeforeDiscountOere: afterCorporateOere,
    discountAmountOere: partnerDiscountOere,
  })
  return {
    originalOere,
    corporateDiscountOere,
    afterCorporateOere,
    partnerDiscountOere,
    customerPaysOere,
    commissionOere,
    retainedOere: customerPaysOere - commissionOere,
  }
}

function scale(order: PartnerExampleOrder, factor: number): PartnerExampleOrder {
  const out = {} as PartnerExampleOrder
  for (const key of Object.keys(order) as (keyof PartnerExampleOrder)[]) {
    out[key] = order[key] * factor
  }
  return out
}

/** Pure. The single calculation every example on /bli-partner is drawn from. */
export function calculatePartnerExample(raw: PartnerExampleInput): PartnerExampleResult {
  const input = normalizeExampleInput(raw)
  const perOrder = calculateOrder(input)
  return { input, perOrder, total: scale(perOrder, input.orders) }
}

/** One bar of the earnings chart. */
export interface EarningsPoint {
  orders: number
  commissionOere: number
}

/** Commission for each order count, from the same per-order calculation. */
export function earningsSeries(
  raw: Omit<PartnerExampleInput, 'orders'>,
  orderCounts: readonly number[],
): EarningsPoint[] {
  return orderCounts.map((orders) => ({
    orders,
    commissionOere: calculatePartnerExample({ ...raw, orders }).total.commissionOere,
  }))
}

/** Order counts the earnings chart shows. */
export const EARNINGS_ORDER_COUNTS = [10, 25, 50, 100] as const

/** The page's worked examples. Named so tests pin the published numbers. */
export const STANDARD_EXAMPLE: PartnerExampleInput = { orderValueKr: 1000 }
export const CORPORATE_EXAMPLE: PartnerExampleInput = {
  orderValueKr: 50_000,
  corporateDiscountPercent: 20,
}
export const EARNINGS_EXAMPLE: Omit<PartnerExampleInput, 'orders'> = { orderValueKr: 800 }

/* ────────────────────────────── formatting ────────────────────────────── */

/**
 * `4 320 kr`, or `4 320,50 kr` when there are øre — never a silently rounded figure.
 *
 * Built on `Intl.NumberFormat('nb-NO')`, with every whitespace variant normalised to a
 * no-break space and the minus sign to ASCII: Node's ICU and browsers disagree on those
 * characters, and a server-rendered figure must match the hydrated one exactly.
 */
export function formatNok(oere: number): string {
  const hasOere = oere % 100 !== 0
  const formatted = new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: hasOere ? 2 : 0,
    maximumFractionDigits: hasOere ? 2 : 0,
  }).format(oereToKr(oere))
  return normalizeIntl(formatted)
}

/** `10 %` — percent with Norwegian spacing and decimal comma. */
export function formatPercent(value: number): string {
  return normalizeIntl(`${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(value)} %`)
}

function normalizeIntl(value: string): string {
  return value.replace(/[\s  ]/g, ' ').replace(/−/g, '-')
}
