import { PARTNER_COMMISSION_PERCENT, PARTNER_DISCOUNT_PERCENT } from '@/lib/partnerProgram/calculator'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
} from '@/lib/partnerProgram/methodCalculator'

/**
 * The partner programme as the admin presents it: ONE programme, three standard earning methods
 * every partner has, and two optional commercial agreements enabled per partner.
 *
 * The public `/bli-partner` programme is the authoritative reference; every percentage below is
 * one of its constants, re-exported rather than restated.
 *
 * ── Standard earning methods — always available, never selected ──
 *
 *   • Promokode       — customer discount + commission through the partner's promo code. The rate
 *                       and calculation base that are actually paid live on each promo code
 *                       (`promo-codes.commissionRate` / `commissionBase`) and nowhere else.
 *   • Bedriftssalg    — commission on the final paid order amount of a business customer the
 *                       partner introduced.
 *   • Forhandlersalg  — commission on the paid orders of a retailer the partner introduced. The
 *                       referring partner and the purchasing retailer are different roles.
 *
 * Bedriftssalg and Forhandlersalg are not tracked or credited automatically yet. The percentages
 * here are the programme terms shown to the administrator, not inputs to any calculation.
 *
 * ── Optional agreements — enabled per partner, independently ──
 *
 *   • Dropshipping      — 20 % off the regular catalogue price by default.
 *   • Forhandlerinnkjøp — 35 % off the regular catalogue price by default (the same retailer price
 *                         rule as `/bli-partner`, so the same constant).
 *
 * Both are configuration only: no order is priced from them yet. They never stack with campaign
 * prices, quantity tiers, promo codes or commission on the same order (`PURCHASE_DISCOUNTS_STACK`).
 *
 * ── Legacy five-model selector ──
 *
 * The first release stored all five as one multi-select (`partnershipTypes`). That field is kept,
 * hidden and frozen, so its table and enum still match the database (migration 20261016_090000);
 * its Dropshipping/Forhandlerinnkjøp selections were copied into the two checkboxes by migration
 * 20261018_090000. Nothing reads it.
 */

const pct = (n: number) => `${n} %`

/* ------------------------------ standard earning methods ------------------------------ */

export type StandardEarningMethodId = 'promoCode' | 'businessSale' | 'retailerReferral'

export interface StandardEarningMethod {
  id: StandardEarningMethodId
  label: string
  /** Programme commission, in percent. Display only. */
  commissionPercent: number
  description: string
}

export const STANDARD_EARNING_METHODS: readonly StandardEarningMethod[] = [
  {
    id: 'promoCode',
    label: 'Promokode',
    commissionPercent: PARTNER_COMMISSION_PERCENT,
    description: `Kunden får ${pct(PARTNER_DISCOUNT_PERCENT)} rabatt med partnerens personlige kode, og partneren får provisjon på hver kvalifiserte betalte ordre – også gjentatte kjøp og partnerens egne kjøp med koden. Faktisk provisjonssats og beregningsgrunnlag settes på hver enkelt rabattkode.`,
  },
  {
    id: 'businessSale',
    label: 'Bedriftssalg',
    commissionPercent: BUSINESS_SALE_COMMISSION_PERCENT,
    description: `Partneren får ${pct(BUSINESS_SALE_COMMISSION_PERCENT)} provisjon av endelig betalt ordrebeløp.`,
  },
  {
    id: 'retailerReferral',
    label: 'Forhandlersalg',
    commissionPercent: RETAILER_COMMISSION_PERCENT,
    description: `Partneren introduserer en forhandler og får ${pct(RETAILER_COMMISSION_PERCENT)} provisjon av forhandlerens betalte ordre, også senere ordre direkte hos ABOKS AS, så lenge henvisningsavtalen gjelder. Forhandleren får selv ingen provisjon på egne innkjøp.`,
  },
]

export const STANDARD_METHODS_NOTE =
  'Alle partnere har disse tre opptjeningsmåtene automatisk. Bedriftssalg og Forhandlersalg registreres og beregnes foreløpig manuelt.'

/* ------------------------------ optional agreements ------------------------------ */

/** Dropshipping discount off the regular catalogue price. Programme term. */
export const DROPSHIPPING_DISCOUNT_PERCENT = 20

/**
 * Forhandlerinnkjøp discount off the regular catalogue price. The same 35 % a retailer gets on
 * `/bli-partner`, so it is the same constant rather than a second copy of the number.
 */
export const WHOLESALE_DISCOUNT_PERCENT = RETAILER_DISCOUNT_PERCENT

export type OptionalAgreementId = 'dropshipping' | 'wholesale'

export interface OptionalAgreement {
  id: OptionalAgreementId
  label: string
  /** The checkbox that enables the agreement on a partner. */
  enabledField: 'dropshippingEnabled' | 'wholesaleEnabled'
  /** The discount field shown, and required, only while the agreement is enabled. */
  percentField: 'dropshippingDiscountPercent' | 'wholesaleDiscountPercent'
  defaultDiscountPercent: number
  description: string
}

export const NO_STACKING_DESCRIPTION =
  'Gis av ordinær katalogpris og kombineres aldri med kampanjepris, mengderabatt, rabattkode eller partnerprovisjon. Foreløpig kun en avtalt sats – den brukes ikke automatisk på noen ordre.'

export const OPTIONAL_AGREEMENTS: readonly OptionalAgreement[] = [
  {
    id: 'dropshipping',
    label: 'Dropshipping',
    enabledField: 'dropshippingEnabled',
    percentField: 'dropshippingDiscountPercent',
    defaultDiscountPercent: DROPSHIPPING_DISCOUNT_PERCENT,
    description:
      'Kunden handler og betaler i forhandlerens nettbutikk. Forhandleren betaler ABOKS AS for varene med rabatt og for frakten separat, og ABOKS AS sender direkte til sluttkunden. Ingen ekstra partnerprovisjon på det samme salget.',
  },
  {
    id: 'wholesale',
    label: 'Forhandlerinnkjøp',
    enabledField: 'wholesaleEnabled',
    percentField: 'wholesaleDiscountPercent',
    defaultDiscountPercent: WHOLESALE_DISCOUNT_PERCENT,
    description:
      'Forhandleren kjøper varer på lager og står selv for videresalg og levering. Ingen provisjon til forhandleren på egne innkjøp. En annen partner som introduserte forhandleren kan ha krav på Forhandlersalg-provisjon etter avtalen.',
  },
]

/** Purchase discounts never combine with any other price reduction. See the file header. */
export const PURCHASE_DISCOUNTS_STACK = false

export const MIN_AGREEMENT_PERCENT = 0
export const MAX_AGREEMENT_PERCENT = 100

/** True when the optional agreement's checkbox is ticked on the document. */
export const isAgreementEnabled = (data: unknown, agreement: Pick<OptionalAgreement, 'enabledField'>): boolean =>
  (data as Record<string, unknown> | null | undefined)?.[agreement.enabledField] === true

/**
 * Validates an optional agreement's discount. Required — and within 0–100 — only while the
 * agreement is enabled; a disabled agreement's stored value is kept and ignored.
 *
 * Returns `true` or a Norwegian message, the shape Payload field validators return.
 */
export function validateAgreementPercent(
  value: unknown,
  options: { enabled: boolean; label: string },
): true | string {
  if (!options.enabled) return true
  if (value == null || value === '') return `${options.label} (%) må fylles ut.`
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${options.label} (%) må være et tall.`
  }
  if (value < MIN_AGREEMENT_PERCENT) return `${options.label} (%) kan ikke være negativ.`
  if (value > MAX_AGREEMENT_PERCENT) {
    return `${options.label} (%) kan ikke være høyere enn ${MAX_AGREEMENT_PERCENT}.`
  }
  return true
}

/* ------------------------------ partner status ------------------------------ */

export const PARTNER_STATUSES = ['active', 'paused', 'ended'] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

export const PARTNER_STATUS_OPTIONS: { label: string; value: PartnerStatus }[] = [
  { label: 'Aktiv', value: 'active' },
  { label: 'Pause', value: 'paused' },
  { label: 'Avsluttet', value: 'ended' },
]

/** Only an active partner may be linked to a promo code for the first time (or anew). */
export const PROMO_LINK_ELIGIBLE_STATUS: PartnerStatus = 'active'

export const PARTNER_ENTITY_TYPES = ['person', 'company'] as const
export type PartnerEntityType = (typeof PARTNER_ENTITY_TYPES)[number]

export const PARTNER_ENTITY_TYPE_OPTIONS: { label: string; value: PartnerEntityType }[] = [
  { label: 'Privatperson', value: 'person' },
  { label: 'Bedrift', value: 'company' },
]

/* ------------------------------ legacy (hidden, frozen) ------------------------------ */

/**
 * The values of the hidden legacy `partnershipTypes` field. They must keep matching the
 * `enum_partners_partnership_types` database enum created by migration 20261016_090000.
 */
export const LEGACY_PARTNERSHIP_TYPE_OPTIONS = [
  { label: 'Promokode', value: 'promoCode' },
  { label: 'Bedriftssalg', value: 'businessSale' },
  { label: 'Forhandlersalg', value: 'retailerReferral' },
  { label: 'Dropshipping', value: 'dropshipping' },
  { label: 'Forhandlerinnkjøp', value: 'wholesale' },
] as const
