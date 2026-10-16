import { PARTNER_COMMISSION_PERCENT, PARTNER_DISCOUNT_PERCENT } from '@/lib/partnerProgram/calculator'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
} from '@/lib/partnerProgram/methodCalculator'

/**
 * The partner programme as the admin presents it. A partner is one of TWO types, chosen once and
 * permanent (`partnerType`):
 *
 *   • regular  — «Vanlig partner»: the referral programme. Always has the three standard earning
 *                methods below; never has a retailer agreement.
 *   • retailer — «Nettbutikk / Forhandler»: an online store with a direct commercial relationship.
 *                Only the two optional agreements below; no referral earnings of its own.
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
 *   • Forhandlersalg  — commission on the paid purchases of a PHYSICAL retail store the partner
 *                       introduced. Never for introducing an online store. The referring partner
 *                       and the purchasing store are different records.
 *
 * Bedriftssalg and Forhandlersalg are not tracked or credited automatically yet. The percentages
 * here are the programme terms shown to the administrator, not inputs to any calculation.
 *
 * ── Retailer agreements — online retailers only, enabled independently ──
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
    description: `Partneren introduserer en fysisk butikk og får ${pct(RETAILER_COMMISSION_PERCENT)} provisjon av butikkens betalte innkjøp, også senere innkjøp direkte hos ABOKS AS, så lenge henvisningsavtalen gjelder. Gjelder bare fysiske butikker – ikke nettbutikker. Butikken får selv ingen provisjon på egne innkjøp.`,
  },
]

export const STANDARD_METHODS_NOTE =
  'Alle vanlige partnere har disse tre opptjeningsmåtene automatisk. Bedriftssalg og Forhandlersalg registreres og beregnes foreløpig manuelt.'

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
      'Nettbutikken selger varene på egne nettsider, og sluttkunden betaler nettbutikken. Nettbutikken betaler ABOKS AS for varene med rabatt og for frakten separat, og ABOKS AS sender direkte til sluttkunden. Ingen provisjon på nettbutikkens egne salg.',
  },
  {
    id: 'wholesale',
    label: 'Forhandlerinnkjøp',
    enabledField: 'wholesaleEnabled',
    percentField: 'wholesaleDiscountPercent',
    defaultDiscountPercent: WHOLESALE_DISCOUNT_PERCENT,
    description:
      'Nettbutikken kjøper varer fra ABOKS AS og står selv for lager, videresalg og levering. Ingen provisjon på egne innkjøp.',
  },
]

/** Purchase discounts never combine with any other price reduction. See the file header. */
export const PURCHASE_DISCOUNTS_STACK = false

export const MIN_AGREEMENT_PERCENT = 0
export const MAX_AGREEMENT_PERCENT = 100

/**
 * True when a retailer agreement is in force on the document: the partner is an online retailer
 * AND the agreement's checkbox is ticked. A regular partner never has one, whatever is stored.
 */
export const isAgreementEnabled = (data: unknown, agreement: Pick<OptionalAgreement, 'enabledField'>): boolean => {
  const d = data as Record<string, unknown> | null | undefined
  return d?.partnerType === 'retailer' && d?.[agreement.enabledField] === true
}

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

/* ------------------------------ partner type ------------------------------ */

export const PARTNER_TYPES = ['regular', 'retailer'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]

export const PARTNER_TYPE_OPTIONS: { label: string; value: PartnerType }[] = [
  { label: 'Vanlig partner', value: 'regular' },
  { label: 'Nettbutikk / Forhandler', value: 'retailer' },
]

export const isPartnerType = (value: unknown): value is PartnerType =>
  typeof value === 'string' && (PARTNER_TYPES as readonly string[]).includes(value)

export const PARTNER_TYPE_DESCRIPTION =
  'Velges én gang og kan ikke endres etter lagring. «Vanlig partner» har de tre standard partnerfordelene. «Nettbutikk / Forhandler» har bare samarbeidsavtalene Dropshipping og Forhandlerinnkjøp.'

export const PARTNER_TYPE_REQUIRED_MESSAGE =
  'Velg partnertype: «Vanlig partner» eller «Nettbutikk / Forhandler».'

/** Refusal when a «Vanlig partner» would keep a retailer agreement ticked. */
export const regularPartnerAgreementMessage = (agreementLabel: string): string =>
  `En vanlig partner kan ikke ha avtalen «${agreementLabel}». Fjern avkrysningen for «${agreementLabel}» før partneren lagres som «Vanlig partner».`

/**
 * True when the document still has a retailer agreement ticked, whatever its type. Used to keep the
 * checkboxes visible so such an agreement can be switched off explicitly.
 */
export const hasTickedAgreement = (data: unknown): boolean => {
  const d = data as Record<string, unknown> | null | undefined
  return OPTIONAL_AGREEMENTS.some((agreement) => d?.[agreement.enabledField] === true)
}

export const PARTNER_TYPE_LOCKED_MESSAGE =
  'Partnertypen kan ikke endres etter at den er lagret. Opprett en ny partner dersom samarbeidet er av en annen type.'

/* ------------------------------ partner status ------------------------------ */

export const PARTNER_STATUSES = ['active', 'paused', 'ended'] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

export const PARTNER_STATUS_OPTIONS: { label: string; value: PartnerStatus }[] = [
  { label: 'Aktiv', value: 'active' },
  { label: 'Pause', value: 'paused' },
  { label: 'Avsluttet', value: 'ended' },
]

/** A NEW promo-code link needs an active, regular partner (Promokode is a regular-partner benefit). */
export const PROMO_LINK_ELIGIBLE_STATUS: PartnerStatus = 'active'
export const PROMO_LINK_ELIGIBLE_TYPE: PartnerType = 'regular'

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
