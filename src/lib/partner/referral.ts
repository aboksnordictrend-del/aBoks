import { oereToKr } from '@/lib/money'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
} from '@/lib/partnerProgram/methodCalculator'
import {
  COMMISSION_RATE_SCALE,
  MAX_COMMISSION_RATE,
  MAX_COMMISSION_RATE_BASIS_POINTS,
  MIN_COMMISSION_RATE,
} from './constants'
import { isCountryCode } from './countries'

/**
 * Manual referral commission — Bedriftssalg and Forhandlersalg — as one set of pure rules.
 *
 * A regular partner introduces a business customer (Bedriftssalg) or a PHYSICAL retail store
 * (Forhandlersalg). An ABOKS administrator records that customer by hand (`referred-customers`)
 * and registers each sale against it by hand (`referral-sales`). Everything that decides money
 * or status lives here, so the collections only wire it up and the rules are directly testable.
 *
 * This module is separate from the promo-code engine (`./commission.ts`) and never calls it:
 * promo-code accounting is automatic, reads verified Kustom snapshots, and must stay exactly as
 * it is. The two share only the rate representation (integer basis points, one rounding step).
 *
 * ── Two layers, as in `./commission.ts` ──
 *
 *   • Validation (`validateSaleAmounts`, `validateRate`, …) runs on an admin save and REJECTS bad
 *     input with a Norwegian message — a human is typing and can fix it.
 *   • Calculation (`calculateReferralCommission`) only ever runs on input that passed validation.
 *     It still never throws, and every fallback resolves to zero commission.
 *
 * ── Commission base ──
 *
 *     base = invoiced total − shipping − other charges invoiced on top − VAT (when invoiced)
 *
 * The qualifying paid goods amount, exactly as `/bli-partner` promises ("frakt og eventuelle
 * avgifter som faktureres i tillegg" are excluded). ABOKS AS is not VAT-registered today, so the
 * normal choice is `noVat`. For a future VAT invoice the VAT amount must be typed explicitly and
 * is always deducted. There is deliberately no option that keeps VAT inside the base: a sale
 * cannot be registered without saying which of the two it is.
 *
 * ── Status ──
 *
 * The administrator sets the PAYMENT status. The COMMISSION status is derived from it here and is
 * never chosen by hand: earned only once the sale is paid, paid only through a registered payout,
 * reversed when the sale is cancelled or refunded. Reversing a commission that was already paid
 * out produces a separate negative adjustment (`clawbackFor`), deducted from the next referral
 * payout; the original sale and payout are never rewritten.
 *
 * ── Money ──
 *
 * Integer øre throughout; kroner only at the storage boundary (`toReferralSnapshotKr`).
 */

/* ------------------------------ categories ------------------------------ */

export const REFERRAL_CATEGORIES = ['businessSale', 'retailStore'] as const
export type ReferralCategory = (typeof REFERRAL_CATEGORIES)[number]

export const REFERRAL_CATEGORY_OPTIONS: { label: string; value: ReferralCategory }[] = [
  { label: 'Bedriftssalg', value: 'businessSale' },
  { label: 'Forhandlersalg – fysisk butikk', value: 'retailStore' },
]

export const REFERRAL_CATEGORY_DESCRIPTION =
  'Bedriftssalg: bedrift, institusjon eller annen bedriftskunde. Forhandlersalg: KUN fysisk butikk – aldri nettbutikk.'

/** Programme rates, re-used from `/bli-partner`, never restated. */
export const DEFAULT_REFERRAL_RATE: Record<ReferralCategory, number> = {
  businessSale: BUSINESS_SALE_COMMISSION_PERCENT,
  retailStore: RETAILER_COMMISSION_PERCENT,
}

export function isReferralCategory(value: unknown): value is ReferralCategory {
  return typeof value === 'string' && (REFERRAL_CATEGORIES as readonly string[]).includes(value)
}

/** The standard rate for a category, or null for an unknown category (never a guessed rate). */
export function defaultRateFor(category: unknown): number | null {
  return isReferralCategory(category) ? DEFAULT_REFERRAL_RATE[category] : null
}

/* ------------------------------ referred customers ------------------------------ */

export const REFERRED_CUSTOMER_STATUSES = ['pending', 'approved', 'rejected', 'inactive'] as const
export type ReferredCustomerStatus = (typeof REFERRED_CUSTOMER_STATUSES)[number]

export const REFERRED_CUSTOMER_STATUS_OPTIONS: { label: string; value: ReferredCustomerStatus }[] = [
  { label: 'Venter', value: 'pending' },
  { label: 'Godkjent', value: 'approved' },
  { label: 'Avvist', value: 'rejected' },
  { label: 'Inaktiv', value: 'inactive' },
]

/**
 * Statuses in which a customer is "taken": a second open record for the same company or store
 * is a conflict. Rejected and inactive records are history and never block a new assignment —
 * ending the old one is precisely how an administrator resolves a conflict.
 */
export const OPEN_REFERRED_CUSTOMER_STATUSES: readonly ReferredCustomerStatus[] = ['pending', 'approved']

export function isOpenReferredCustomerStatus(value: unknown): boolean {
  return typeof value === 'string' && (OPEN_REFERRED_CUSTOMER_STATUSES as readonly string[]).includes(value)
}

/** Only an approved referral may receive new sales. */
export const SALE_REQUIRES_CUSTOMER_STATUS: ReferredCustomerStatus = 'approved'

/* ------------------------------ organisation number ------------------------------ */

const ORG_NUMBER_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const

/**
 * Typed organisation number → its nine digits, or null when nothing was entered.
 *
 * Tolerates how people actually write it: spaces, dots, hyphens, a leading «NO» and a trailing
 * «MVA» («NO 834 012 952 MVA» → «834012952»). Anything else is kept as digits-only so the
 * validator can say what is wrong with it.
 */
export function normalizeOrganizationNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const stripped = value
    .trim()
    .toUpperCase()
    .replace(/^NO/, '')
    .replace(/MVA$/, '')
    .replace(/[\s.\-]/g, '')
  return stripped === '' ? null : stripped
}

/** Brønnøysund modulus-11 check digit. */
function hasValidCheckDigit(digits: string): boolean {
  const sum = ORG_NUMBER_WEIGHTS.reduce((acc, weight, i) => acc + weight * Number(digits[i]), 0)
  const remainder = sum % 11
  const check = remainder === 0 ? 0 : 11 - remainder
  // A remainder of 1 gives 10, which is never issued.
  return check !== 10 && check === Number(digits[8])
}

/** Optional; when present it must be a real Norwegian organisation number. */
export function validateOrganizationNumber(value: unknown): true | string {
  const normalized = normalizeOrganizationNumber(value)
  if (normalized == null) return true
  if (!/^\d{9}$/.test(normalized)) return 'Organisasjonsnummeret må bestå av 9 sifre.'
  if (!hasValidCheckDigit(normalized)) return 'Organisasjonsnummeret er ikke gyldig (kontrollsifferet stemmer ikke).'
  return true
}

/* ------------------------------ registration number (any country) ------------------------------ */

/**
 * The referred customer's registration number, Norwegian or foreign.
 *
 * The country is an ISO 3166-1 alpha-2 code (`./countries`), chosen from a list, so «Sverige»,
 * «Sweden» and «SE» can never be three different countries. The code decides the rule:
 *
 *   • `NO` — and a missing country, which can only be legacy or API input and is treated as the
 *     strictest case — must be a real organisation number: 9 digits and a valid check digit.
 *   • any other valid code — accepted as written within light limits (letters, digits, spaces and
 *     . - /). No Norwegian check-digit rule is ever applied.
 *   • anything else is refused: the country must be chosen from the list.
 */
export const REGISTRATION_NUMBER_MAX = 40

const FOREIGN_REGISTRATION_NUMBER = /^[\p{L}\p{N}][\p{L}\p{N} .\-/]*$/u

export const COUNTRY_REQUIRED_MESSAGE = 'Velg land fra listen.'

/** True for Norway, and for a missing country (see above). */
export function isNorwegianCountryCode(country: unknown): boolean {
  return country == null || country === '' || country === 'NO'
}

export function validateCountryCode(country: unknown): true | string {
  return isNorwegianCountryCode(country) || isCountryCode(country) ? true : COUNTRY_REQUIRED_MESSAGE
}

export function validateRegistrationNumber(value: unknown, country: unknown): true | string {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return true
  if (typeof value !== 'string') return 'Registreringsnummeret må være tekst.'
  if (isNorwegianCountryCode(country)) return validateOrganizationNumber(value)
  if (!isCountryCode(country)) return COUNTRY_REQUIRED_MESSAGE

  const trimmed = value.trim()
  if (trimmed.length > REGISTRATION_NUMBER_MAX) {
    return `Registreringsnummeret kan ikke være lengre enn ${REGISTRATION_NUMBER_MAX} tegn.`
  }
  if (!FOREIGN_REGISTRATION_NUMBER.test(trimmed)) {
    return 'Registreringsnummeret kan bare inneholde bokstaver, tall, mellomrom, punktum, bindestrek og skråstrek.'
  }
  return true
}

/**
 * The identity of a customer's registration, used to find the same company or store twice:
 * `<ISO code>:<letters and digits>` — `NO:834012952`, `SE:5566778899`. Null when no number was
 * entered (such a customer is matched by name instead) or the country is not a valid code.
 *
 * The country is part of the key, so the same digits registered in two countries are two
 * different companies.
 */
export function registrationKey(value: unknown, country: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  if (isNorwegianCountryCode(country)) {
    const digits = normalizeOrganizationNumber(value)
    return digits == null ? null : `NO:${digits}`
  }
  if (!isCountryCode(country)) return null
  const number = value.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '')
  return number === '' ? null : `${country}:${number}`
}

/** Display form: «834 012 952». */
export function formatOrganizationNumber(value: unknown): string | null {
  const normalized = normalizeOrganizationNumber(value)
  if (normalized == null || !/^\d{9}$/.test(normalized)) return normalized
  return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`
}

const LEGAL_FORM_SUFFIX = /\s+(as|asa|ans|da|enk|sa|ba|nuf|ab|aps|gmbh|ltd)$/

/**
 * A company or store name reduced to what identifies it, for duplicate detection only — never
 * stored as the display name. Case, accents written as combining marks, punctuation, repeated
 * whitespace and a trailing legal form are ignored: «Elkjøp Lørenskog AS» and «elkjøp  lørenskog»
 * compare equal. Æ, Ø and Å are kept, since they distinguish Norwegian names.
 */
export function normalizeCustomerName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEGAL_FORM_SUFFIX, '')
    .trim()
  return name === '' ? null : name
}

/* ------------------------------ sales: statuses ------------------------------ */

export const SALE_PAYMENT_STATUSES = ['pending', 'paid', 'cancelled', 'refunded'] as const
export type SalePaymentStatus = (typeof SALE_PAYMENT_STATUSES)[number]

export const SALE_PAYMENT_STATUS_OPTIONS: { label: string; value: SalePaymentStatus }[] = [
  { label: 'Venter på betaling', value: 'pending' },
  { label: 'Betalt', value: 'paid' },
  { label: 'Kansellert', value: 'cancelled' },
  { label: 'Refundert', value: 'refunded' },
]

export const REFERRAL_COMMISSION_STATUSES = ['pending', 'earned', 'paid', 'reversed'] as const
export type ReferralCommissionStatus = (typeof REFERRAL_COMMISSION_STATUSES)[number]

export const REFERRAL_COMMISSION_STATUS_OPTIONS: { label: string; value: ReferralCommissionStatus }[] = [
  { label: 'Venter', value: 'pending' },
  { label: 'Opptjent', value: 'earned' },
  { label: 'Utbetalt', value: 'paid' },
  { label: 'Tilbakeført', value: 'reversed' },
]

export function isSalePaymentStatus(value: unknown): value is SalePaymentStatus {
  return typeof value === 'string' && (SALE_PAYMENT_STATUSES as readonly string[]).includes(value)
}

/**
 * Which payment-status changes an administrator may make.
 *
 *   pending   → paid, cancelled
 *   paid      → refunded; back to pending only to undo a mistake, and only while no payout
 *               covers the sale
 *   cancelled, refunded → final. A correction is a NEW sale, so the original stays as it was.
 *
 * `paid → cancelled` is refused on purpose: money was received, so the correct word is
 * «Refundert», and the two must not be confused in the history.
 */
export function validatePaymentTransition(
  from: unknown,
  to: unknown,
  options: { paidOut: boolean },
): true | string {
  if (!isSalePaymentStatus(to)) return 'Velg en gyldig betalingsstatus.'
  // A new sale, or a legacy value: any valid status is a valid start.
  if (!isSalePaymentStatus(from) || from === to) return true

  switch (from) {
    case 'pending':
      return to === 'paid' || to === 'cancelled'
        ? true
        : 'Et salg som venter på betaling kan bare settes til «Betalt» eller «Kansellert».'
    case 'paid':
      if (to === 'refunded') return true
      if (to === 'pending') {
        return options.paidOut
          ? 'Provisjonen for dette salget er allerede utbetalt. Registrer en refusjon i stedet.'
          : true
      }
      return 'Et betalt salg kan ikke kanselleres. Velg «Refundert» dersom pengene er betalt tilbake.'
    case 'cancelled':
    case 'refunded':
      return 'Salget er avsluttet og kan ikke endres. Registrer et nytt salg som korreksjon.'
  }
}

/**
 * The commission status that follows from the facts. Never chosen by hand.
 *
 *   cancelled / refunded → reversed (whether or not it had been earned or paid out)
 *   paid + payout        → paid
 *   paid                 → earned
 *   anything else        → pending
 */
export function deriveCommissionStatus(input: {
  paymentStatus: unknown
  paidOut: boolean
}): ReferralCommissionStatus {
  const { paymentStatus, paidOut } = input
  if (paymentStatus === 'cancelled' || paymentStatus === 'refunded') return 'reversed'
  if (paymentStatus === 'paid') return paidOut ? 'paid' : 'earned'
  return 'pending'
}

/**
 * The negative adjustment owed back when a commission that was ALREADY PAID OUT is reversed, in
 * øre (≤ 0), or null when none is due. Only a paid-out commission produces one: a commission that
 * was merely earned is simply never paid.
 */
export function clawbackFor(input: {
  previousCommissionStatus: unknown
  nextCommissionStatus: ReferralCommissionStatus
  commissionAmountOere: number
}): number | null {
  if (input.previousCommissionStatus !== 'paid') return null
  if (input.nextCommissionStatus !== 'reversed') return null
  if (!Number.isInteger(input.commissionAmountOere) || input.commissionAmountOere <= 0) return null
  return -input.commissionAmountOere
}

/* ------------------------------ sales: amounts ------------------------------ */

export const VAT_TREATMENTS = ['noVat', 'vatDeducted'] as const
export type VatTreatment = (typeof VAT_TREATMENTS)[number]

export const VAT_TREATMENT_OPTIONS: { label: string; value: VatTreatment }[] = [
  { label: 'Ingen MVA på salget (ABOKS AS er ikke MVA-registrert)', value: 'noVat' },
  { label: 'Faktura med MVA – MVA-beløpet trekkes fra grunnlaget', value: 'vatDeducted' },
]

export const VAT_TREATMENT_DESCRIPTION =
  'Må velges for hvert salg. MVA inngår aldri i provisjonsgrunnlaget: er salget fakturert med MVA, skal MVA-beløpet føres inn og trekkes fra.'

export const REFERRAL_BASE_DESCRIPTION =
  'Provisjonsgrunnlag = fakturert beløp − frakt − andre tillegg − MVA. Provisjon beregnes kun av betalt varebeløp.'

export function isVatTreatment(value: unknown): value is VatTreatment {
  return typeof value === 'string' && (VAT_TREATMENTS as readonly string[]).includes(value)
}

/** All amounts in øre, as typed by the administrator (converted from kroner by the caller). */
export interface ReferralSaleAmounts {
  invoicedTotalOere: number | null | undefined
  shippingOere?: number | null
  otherExcludedOere?: number | null
  vatTreatment: unknown
  vatAmountOere?: number | null
}

export type AmountsValidation =
  | { ok: true; baseOere: number }
  | { ok: false; field: 'invoicedTotal' | 'shippingAmount' | 'otherExcludedAmount' | 'vatTreatment' | 'vatAmount'; message: string }

const isWholeOere = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/** Optional øre: absent counts as 0; present must be whole and non-negative. */
const optionalOere = (value: unknown): number | null =>
  value == null ? 0 : isWholeOere(value) ? value : null

/**
 * Validates a sale's amounts and returns the commission base.
 *
 * Refuses rather than clamps: an exclusion larger than the invoice, a negative figure, a missing
 * VAT treatment or a VAT invoice without its VAT amount are all typing errors the administrator
 * must see, never something to round away.
 */
export function validateSaleAmounts(input: ReferralSaleAmounts): AmountsValidation {
  if (!isWholeOere(input.invoicedTotalOere)) {
    return { ok: false, field: 'invoicedTotal', message: 'Fakturert beløp må fylles ut og kan ikke være negativt.' }
  }
  const shipping = optionalOere(input.shippingOere)
  if (shipping == null) return { ok: false, field: 'shippingAmount', message: 'Frakt kan ikke være negativ.' }
  const other = optionalOere(input.otherExcludedOere)
  if (other == null) return { ok: false, field: 'otherExcludedAmount', message: 'Andre tillegg kan ikke være negative.' }

  if (!isVatTreatment(input.vatTreatment)) {
    return { ok: false, field: 'vatTreatment', message: 'Velg MVA-behandling for salget.' }
  }

  let vat = 0
  if (input.vatTreatment === 'vatDeducted') {
    if (!isWholeOere(input.vatAmountOere) || input.vatAmountOere === 0) {
      return { ok: false, field: 'vatAmount', message: 'Før inn MVA-beløpet på fakturaen. Det trekkes fra provisjonsgrunnlaget.' }
    }
    vat = input.vatAmountOere
  } else if (input.vatAmountOere != null && input.vatAmountOere !== 0) {
    return { ok: false, field: 'vatAmount', message: 'MVA-beløp kan bare føres når salget er fakturert med MVA.' }
  }

  const excluded = shipping + other + vat
  if (excluded > input.invoicedTotalOere) {
    return {
      ok: false,
      field: 'invoicedTotal',
      message: 'Frakt, andre tillegg og MVA kan til sammen ikke være høyere enn fakturert beløp.',
    }
  }

  return { ok: true, baseOere: input.invoicedTotalOere - excluded }
}

/* ------------------------------ sales: rate ------------------------------ */

/**
 * Validates the rate on a sale. Default 25 % / 15 % by category; any other value is an override
 * and needs a written explanation. The rate can only be changed before the commission is earned —
 * that lock is enforced by the collection, which knows the stored state.
 */
export function validateRate(input: {
  rate: unknown
  category: unknown
  overrideReason?: unknown
}): true | string {
  const { rate } = input
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return 'Provisjonssats (%) må fylles ut.'
  if (rate < MIN_COMMISSION_RATE) return 'Provisjonssats (%) kan ikke være negativ.'
  if (rate > MAX_COMMISSION_RATE) return `Provisjonssats (%) kan ikke være høyere enn ${MAX_COMMISSION_RATE}.`
  if (isRateOverride(rate, input.category) && !hasText(input.overrideReason)) {
    return 'Satsen avviker fra standardsatsen. Skriv en begrunnelse for avviket.'
  }
  return true
}

/** True when the rate differs from the category's standard rate (compared in basis points). */
export function isRateOverride(rate: unknown, category: unknown): boolean {
  const standard = defaultRateFor(category)
  if (standard == null || typeof rate !== 'number' || !Number.isFinite(rate)) return true
  return Math.round(rate * COMMISSION_RATE_SCALE) !== Math.round(standard * COMMISSION_RATE_SCALE)
}

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim() !== ''

/* ------------------------------ sales: commission ------------------------------ */

export interface ReferralCommission {
  /** The rate actually applied, in percent. 0 when the sale does not qualify. */
  appliedRate: number
  commissionAmountOere: number
}

/**
 * The commission on a validated base. One rounding step, to the nearest øre, as in
 * `./commission.ts`. Never throws: a sale that does not qualify, an unusable rate or an unusable
 * base all earn zero.
 *
 * `qualifies` is the administrator's explicit decision. For Bedriftssalg it is off by default —
 * a business customer's later purchases do not earn commission automatically.
 */
export function calculateReferralCommission(input: {
  baseOere: number
  rate: unknown
  qualifies: boolean
}): ReferralCommission {
  if (input.qualifies !== true) return { appliedRate: 0, commissionAmountOere: 0 }
  if (!isWholeOere(input.baseOere)) return { appliedRate: 0, commissionAmountOere: 0 }
  if (typeof input.rate !== 'number' || !Number.isFinite(input.rate)) return { appliedRate: 0, commissionAmountOere: 0 }

  const bp = Math.round(input.rate * COMMISSION_RATE_SCALE)
  if (bp < 0 || bp > MAX_COMMISSION_RATE_BASIS_POINTS) return { appliedRate: 0, commissionAmountOere: 0 }

  return {
    appliedRate: bp / COMMISSION_RATE_SCALE,
    commissionAmountOere: Math.round((input.baseOere * bp) / MAX_COMMISSION_RATE_BASIS_POINTS),
  }
}

/**
 * Whether a new sale on this category qualifies when the administrator has not said otherwise.
 * Forhandlersalg: every paid purchase of an approved store qualifies. Bedriftssalg: never by
 * default.
 */
export function defaultQualifies(category: unknown): boolean {
  return category === 'retailStore'
}

/**
 * Whether a sale earns commission, as stored on the sale. A choice rather than a checkbox so a
 * NEW sale can be left empty and take its category's standard (`defaultEligibility`): every
 * Forhandlersalg purchase earns 15 % without an extra click, while a Bedriftssalg purchase earns
 * nothing until the administrator explicitly picks «Gir provisjon».
 */
export const COMMISSION_ELIGIBILITIES = ['eligible', 'notEligible'] as const
export type CommissionEligibility = (typeof COMMISSION_ELIGIBILITIES)[number]

export const COMMISSION_ELIGIBILITY_OPTIONS: { label: string; value: CommissionEligibility }[] = [
  { label: 'Gir provisjon', value: 'eligible' },
  { label: 'Gir ikke provisjon', value: 'notEligible' },
]

export const COMMISSION_ELIGIBILITY_DESCRIPTION =
  'La feltet stå tomt for standard: Forhandlersalg gir provisjon på hvert betalt kjøp, Bedriftssalg gir provisjon bare når du velger «Gir provisjon» for et avtalt salg.'

export function isCommissionEligibility(value: unknown): value is CommissionEligibility {
  return typeof value === 'string' && (COMMISSION_ELIGIBILITIES as readonly string[]).includes(value)
}

export function defaultEligibility(category: unknown): CommissionEligibility {
  return defaultQualifies(category) ? 'eligible' : 'notEligible'
}

/* ------------------------------ kroner input ------------------------------ */

/**
 * A kroner amount as typed into the admin → øre. Absent is `null`; a value with more than two
 * decimals, a non-finite number or a non-number is refused rather than rounded, so a typing
 * error can never silently change an invoiced amount.
 */
export function parseKroner(value: unknown): { ok: true; oere: number | null } | { ok: false } {
  if (value == null || value === '') return { ok: true, oere: null }
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false }
  const scaled = value * 100
  const oere = Math.round(scaled)
  if (Math.abs(scaled - oere) > 1e-6) return { ok: false }
  return { ok: true, oere }
}

/* ------------------------------ one sale, end to end ------------------------------ */

/** The sale fields that decide its commission, exactly as the admin form holds them (kroner). */
export interface SaleCommissionInput {
  category: unknown
  commissionEligibility?: unknown
  commissionRate?: unknown
  rateOverrideReason?: unknown
  invoicedTotal?: unknown
  shippingAmount?: unknown
  otherExcludedAmount?: unknown
  vatTreatment?: unknown
  vatAmount?: unknown
}

export type SaleCommissionField =
  | 'commissionEligibility'
  | 'commissionRate'
  | 'rateOverrideReason'
  | 'invoicedTotal'
  | 'shippingAmount'
  | 'otherExcludedAmount'
  | 'vatTreatment'
  | 'vatAmount'

export type SaleCommission =
  | {
      ok: true
      /** The eligibility applied: the stored choice, or the category standard when empty. */
      eligibility: CommissionEligibility
      /** True when the eligibility came from the category standard, not an explicit choice. */
      eligibilityIsDefault: boolean
      /** The rate applied: the stored rate, or the category standard when empty. */
      rate: number
      isOverride: boolean
      baseOere: number
      commissionOere: number
    }
  | { ok: false; field: SaleCommissionField; message: string }

const KRONER_LABEL: Record<'invoicedTotal' | 'shippingAmount' | 'otherExcludedAmount' | 'vatAmount', string> = {
  invoicedTotal: 'Fakturert beløp',
  shippingAmount: 'Frakt',
  otherExcludedAmount: 'Andre tillegg',
  vatAmount: 'MVA-beløp',
}

/**
 * The commission of one sale, from the form's own values — the ONE implementation used both by the
 * server when a sale is saved (`enforceReferralSaleRules`) and by the live preview in the admin
 * form. Same defaults, same validation, same messages, same rounding, so the preview can never
 * show a figure the server would not store.
 */
export function computeSaleCommission(input: SaleCommissionInput): SaleCommission {
  const { category } = input

  const explicit = input.commissionEligibility
  const eligibilityIsDefault = explicit == null || explicit === ''
  const eligibility = eligibilityIsDefault ? defaultEligibility(category) : explicit
  if (!isCommissionEligibility(eligibility)) {
    return { ok: false, field: 'commissionEligibility', message: 'Velg om salget gir provisjon.' }
  }

  const rawRate = input.commissionRate
  const rate = rawRate == null || rawRate === '' ? defaultRateFor(category) : rawRate
  const rateCheck = validateRate({ rate, category, overrideReason: input.rateOverrideReason })
  if (rateCheck !== true) {
    const needsReason = typeof rate === 'number' && Number.isFinite(rate) && rate >= MIN_COMMISSION_RATE && rate <= MAX_COMMISSION_RATE
    return { ok: false, field: needsReason ? 'rateOverrideReason' : 'commissionRate', message: rateCheck }
  }

  const oere: Record<keyof typeof KRONER_LABEL, number | null> = {
    invoicedTotal: null,
    shippingAmount: null,
    otherExcludedAmount: null,
    vatAmount: null,
  }
  for (const field of Object.keys(KRONER_LABEL) as (keyof typeof KRONER_LABEL)[]) {
    const parsed = parseKroner(input[field])
    if (!parsed.ok) {
      return { ok: false, field, message: `${KRONER_LABEL[field]} må være et beløp i kroner med høyst to desimaler.` }
    }
    oere[field] = parsed.oere
  }

  const amounts = validateSaleAmounts({
    invoicedTotalOere: oere.invoicedTotal,
    shippingOere: oere.shippingAmount,
    otherExcludedOere: oere.otherExcludedAmount,
    vatTreatment: input.vatTreatment,
    vatAmountOere: oere.vatAmount,
  })
  if (!amounts.ok) return amounts

  const commission = calculateReferralCommission({
    baseOere: amounts.baseOere,
    rate,
    qualifies: eligibility === 'eligible',
  })

  return {
    ok: true,
    eligibility,
    eligibilityIsDefault,
    rate: rate as number,
    isOverride: isRateOverride(rate, category),
    baseOere: amounts.baseOere,
    commissionOere: commission.commissionAmountOere,
  }
}

/* ------------------------------ double commission ------------------------------ */

/**
 * A sale linked to an order that already earned promo-code commission may only carry referral
 * commission after an explicit administrator decision with a reason. A sale that earns nothing
 * itself is no double commission and passes.
 */
export function validatePromoOverlap(input: {
  promoCommissionOere: number
  referralCommissionOere: number
  allowDouble: unknown
  reason: unknown
}): true | string {
  if (input.promoCommissionOere <= 0 || input.referralCommissionOere <= 0) return true
  if (input.allowDouble !== true) {
    return 'Ordren har allerede gitt promokode-provisjon. Kryss av for «Tillat provisjon i tillegg til promokode» og skriv en begrunnelse, eller sett salget til ikke provisjonsberettiget.'
  }
  if (!hasText(input.reason)) return 'Skriv en begrunnelse for at ordren skal gi provisjon i tillegg til promokode-provisjonen.'
  return true
}

/* ------------------------------ balance ------------------------------ */

export interface ReferralSaleRow {
  category: unknown
  commissionStatus: unknown
  commissionAmountOere: number | null
}

export interface ReferralAdjustmentRow {
  /** ≤ 0. */
  amountOere: number | null
  /** True once a payout has deducted it. */
  settled: boolean
}

export interface ReferralTotals {
  /** Earned (paid sale) but not yet paid out, per category and in total. */
  earnedUnpaidOere: Record<ReferralCategory, number>
  /** Everything ever earned: earned + paid out, per category. */
  earnedTotalOere: Record<ReferralCategory, number>
  /** Sales not yet paid by the customer. */
  pendingOere: number
  /** Already paid out to the partner. */
  paidOutOere: number
  /** Commission on cancelled or refunded sales (never counted above). */
  reversedOere: number
  /** Open negative adjustments, as a positive figure owed back to ABOKS AS. */
  outstandingClawbackOere: number
  /** What a payout right now would transfer: max(earned unpaid − clawback, 0). */
  payableOere: number
  /** Rows whose amount could not be read. Excluded from every total, never guessed. */
  unreadableRows: number
}

const zeroByCategory = (): Record<ReferralCategory, number> => ({ businessSale: 0, retailStore: 0 })

/**
 * Totals for one partner from already-fetched rows. Pure.
 *
 * Each row is counted under exactly one status. A row with an unreadable amount or an unknown
 * category is excluded and counted in `unreadableRows`, so a corrupt row can only ever make the
 * payable figure smaller, never larger.
 */
export function computeReferralTotals(
  sales: readonly ReferralSaleRow[],
  adjustments: readonly ReferralAdjustmentRow[],
): ReferralTotals {
  const totals: ReferralTotals = {
    earnedUnpaidOere: zeroByCategory(),
    earnedTotalOere: zeroByCategory(),
    pendingOere: 0,
    paidOutOere: 0,
    reversedOere: 0,
    outstandingClawbackOere: 0,
    payableOere: 0,
    unreadableRows: 0,
  }

  for (const sale of sales) {
    const amount = sale.commissionAmountOere
    if (!isWholeOere(amount) || !isReferralCategory(sale.category)) {
      totals.unreadableRows += 1
      continue
    }
    switch (sale.commissionStatus) {
      case 'pending':
        totals.pendingOere += amount
        break
      case 'earned':
        totals.earnedUnpaidOere[sale.category] += amount
        totals.earnedTotalOere[sale.category] += amount
        break
      case 'paid':
        totals.paidOutOere += amount
        totals.earnedTotalOere[sale.category] += amount
        break
      case 'reversed':
        totals.reversedOere += amount
        break
      default:
        totals.unreadableRows += 1
    }
  }

  for (const adjustment of adjustments) {
    if (adjustment.settled) continue
    const amount = adjustment.amountOere
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount > 0) {
      totals.unreadableRows += 1
      continue
    }
    totals.outstandingClawbackOere += -amount
  }

  const earnedUnpaid = totals.earnedUnpaidOere.businessSale + totals.earnedUnpaidOere.retailStore
  totals.payableOere = Math.max(earnedUnpaid - totals.outstandingClawbackOere, 0)
  return totals
}

/* ------------------------------ adjustments ------------------------------ */

export const ADJUSTMENT_REASONS = ['refundedAfterPayout', 'cancelledAfterPayout'] as const
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]

export const ADJUSTMENT_REASON_OPTIONS: { label: string; value: AdjustmentReason }[] = [
  { label: 'Refundert etter utbetaling', value: 'refundedAfterPayout' },
  { label: 'Kansellert etter utbetaling', value: 'cancelledAfterPayout' },
]

export function adjustmentReasonFor(paymentStatus: unknown): AdjustmentReason {
  return paymentStatus === 'cancelled' ? 'cancelledAfterPayout' : 'refundedAfterPayout'
}

/* ------------------------------ referral payout plan ------------------------------ */

/** The most sales one payout may cover. A guard against a runaway request, not a business rule. */
export const MAX_SALES_PER_PAYOUT = 200

/** A sale as read — and row-locked — immediately before a payout is written. */
export interface PayoutCandidateSale {
  id: number
  partnerId: number | null
  paymentStatus: unknown
  commissionStatus: unknown
  payoutId: number | null
  commissionAmountOere: number | null
}

/** An outstanding (not yet deducted) adjustment, as read and row-locked. ≤ 0. */
export interface PayoutCandidateAdjustment {
  id: number
  amountOere: number | null
}

export type PayoutPlanError =
  | 'no_sales'
  | 'too_many_sales'
  | 'duplicate_sales'
  | 'sale_not_found'
  | 'sale_other_partner'
  | 'sale_not_payable'
  | 'unreadable_amount'
  | 'adjustments_exceed_selection'

export type PayoutPlan =
  | {
      ok: true
      saleIds: number[]
      adjustmentIds: number[]
      grossOere: number
      deductedOere: number
      netOere: number
    }
  | { ok: false; code: PayoutPlanError; message: string; saleId?: number }

const planFail = (code: PayoutPlanError, message: string, saleId?: number): PayoutPlan => ({
  ok: false,
  code,
  message,
  ...(saleId == null ? {} : { saleId }),
})

/**
 * Decides one referral payout from the rows the server has just locked. Pure.
 *
 *   • Every selected sale must belong to this partner, be paid, have earned commission, and not
 *     be covered by any payout yet. One bad sale refuses the whole payout — nothing is skipped.
 *   • EVERY outstanding adjustment of the partner is deducted, whole. None can be left behind by a
 *     selection, and none can be deducted twice: a deducted adjustment is no longer outstanding.
 *   • The net amount must be above zero. Adjustments larger than the selection are refused rather
 *     than producing a zero or negative payout; they stay outstanding for a later payout.
 */
export function planReferralPayout(input: {
  partnerId: number
  requestedSaleIds: readonly number[]
  sales: readonly PayoutCandidateSale[]
  adjustments: readonly PayoutCandidateAdjustment[]
}): PayoutPlan {
  const { partnerId, requestedSaleIds } = input
  if (requestedSaleIds.length === 0) return planFail('no_sales', 'Velg minst ett salg.')
  if (requestedSaleIds.length > MAX_SALES_PER_PAYOUT) {
    return planFail('too_many_sales', `Én utbetaling kan dekke høyst ${MAX_SALES_PER_PAYOUT} salg.`)
  }
  if (new Set(requestedSaleIds).size !== requestedSaleIds.length) {
    return planFail('duplicate_sales', 'Det samme salget er valgt flere ganger.')
  }

  const byId = new Map(input.sales.map((s) => [s.id, s]))
  let grossOere = 0
  for (const id of requestedSaleIds) {
    const sale = byId.get(id)
    if (!sale) return planFail('sale_not_found', 'Et av de valgte salgene finnes ikke lenger.', id)
    if (sale.partnerId !== partnerId) {
      return planFail('sale_other_partner', 'Et av de valgte salgene tilhører en annen partner.', id)
    }
    if (sale.payoutId != null || sale.commissionStatus === 'paid') {
      return planFail('sale_not_payable', 'Et av de valgte salgene er allerede utbetalt.', id)
    }
    if (sale.paymentStatus !== 'paid' || sale.commissionStatus !== 'earned') {
      return planFail('sale_not_payable', 'Et av de valgte salgene har ikke opptjent provisjon (ikke betalt, eller kansellert/refundert).', id)
    }
    const amount = sale.commissionAmountOere
    if (amount == null || !Number.isInteger(amount) || amount <= 0) {
      return planFail('unreadable_amount', 'Et av de valgte salgene har ingen gyldig provisjon å utbetale.', id)
    }
    grossOere += amount
  }

  let deductedOere = 0
  for (const adjustment of input.adjustments) {
    const amount = adjustment.amountOere
    if (amount == null || !Number.isInteger(amount) || amount > 0) {
      return planFail('unreadable_amount', 'En registrert provisjonsjustering har et ugyldig beløp. Kontroller justeringene før utbetaling.')
    }
    deductedOere += -amount
  }

  const netOere = grossOere - deductedOere
  if (netOere <= 0) {
    return planFail(
      'adjustments_exceed_selection',
      `Utestående justeringer (${oereToKr(deductedOere).toFixed(2).replace('.', ',')} kr) er like store som eller større enn valgt provisjon (${oereToKr(grossOere).toFixed(2).replace('.', ',')} kr). Velg flere salg, eller vent til mer provisjon er opptjent.`,
    )
  }

  return {
    ok: true,
    saleIds: [...requestedSaleIds].sort((a, b) => a - b),
    adjustmentIds: input.adjustments.map((a) => a.id).sort((a, b) => a - b),
    grossOere,
    deductedOere,
    netOere,
  }
}

/* ------------------------------ storage boundary ------------------------------ */

/**
 * The calculated sale figures in kroner, the project's storage convention. The rate is not
 * included: the stored rate is the one the administrator set, and a sale that does not qualify
 * keeps it while earning 0.
 */
export function toReferralSnapshotKr(input: { baseOere: number; commission: ReferralCommission }) {
  return {
    commissionBase: oereToKr(input.baseOere),
    commissionAmount: oereToKr(input.commission.commissionAmountOere),
  }
}
