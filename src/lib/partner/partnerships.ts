import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
} from '@/lib/partnerProgram/methodCalculator'

/**
 * Partnership models (`Samarbeidsformer`) a partner in the `partners` collection can take part
 * in. One partner may have any combination of them at the same time.
 *
 * Dependency-free apart from the programme constants it reuses, mirroring `./constants.ts`: the
 * collection, its tests and any later admin component can import it without pulling the CMS.
 *
 * ── Five models, two kinds ──
 *
 * REFERRAL / COMMISSION — the partner brings a customer and earns a share of what that customer
 * pays. These are the three models `/bli-partner` already describes, at the rates it states:
 *
 *   • promoCode        Promokode         — customer discount + commission, tracked through
 *                                           promo codes. The rate lives on each promo code and
 *                                           ONLY there (see below).
 *   • businessSale     Bedriftssalg      — 25 % of the paid goods value of a business sale.
 *   • retailerReferral Forhandlersalg    — 15 % of each paid order from a retailer the partner
 *                                           introduced. The partner is NOT the retailer.
 *
 * PURCHASE / DISCOUNT — the partner itself buys from ABOKS AS at a reduced price:
 *
 *   • dropshipping     Dropshipping      — 20 % off the regular catalogue price.
 *   • wholesale        Forhandlerinnkjøp — 35 % off the regular catalogue price. The partner IS
 *                                           the retailer, buying stock to resell.
 *
 * Forhandlersalg and Forhandlerinnkjøp are deliberately separate models with separate labels:
 * one pays the partner for an introduction, the other lets the partner buy cheaper. A partner
 * may have both.
 *
 * ── What is configuration and what is authoritative ──
 *
 * Nothing in this module, and nothing stored on a partner, is read by checkout, by the promo
 * code flow or by the commission engine (`./commission.ts`). In particular:
 *
 *   • Promokode commission is configured per promo code (`promo-codes.commissionRate`), which
 *     stays the single authoritative input to `calculateCommission`. A partner therefore stores
 *     NO promo-code rate at all — a second rate would be a second source of truth.
 *   • The Bedriftssalg / Forhandlersalg rates and the Dropshipping / Forhandlerinnkjøp discounts
 *     are agreed terms recorded for the administrator. No order is priced or credited from them
 *     yet; a later phase (partner-linked manual orders) will read them and freeze the value it
 *     used on the order, exactly as usages freeze commission today.
 *
 * ── No stacking ──
 *
 * The two purchase discounts are taken off the REGULAR catalogue price (`products.price`) and
 * replace every other price reduction: never on top of a campaign/sale price, a quantity tier, a
 * promo code, or together with an affiliate commission on the same order. `PURCHASE_DISCOUNTS_STACK`
 * states that rule for whatever later applies the discount; nothing applies it today.
 */

export const PARTNERSHIP_TYPES = [
  'promoCode',
  'businessSale',
  'retailerReferral',
  'dropshipping',
  'wholesale',
] as const
export type PartnershipType = (typeof PARTNERSHIP_TYPES)[number]

export type PartnershipKind = 'commission' | 'discount'

export const PARTNERSHIP_TYPE_OPTIONS: { label: string; value: PartnershipType }[] = [
  { label: 'Promokode', value: 'promoCode' },
  { label: 'Bedriftssalg', value: 'businessSale' },
  { label: 'Forhandlersalg', value: 'retailerReferral' },
  { label: 'Dropshipping', value: 'dropshipping' },
  { label: 'Forhandlerinnkjøp', value: 'wholesale' },
]

export const PARTNERSHIP_KIND: Record<PartnershipType, PartnershipKind> = {
  promoCode: 'commission',
  businessSale: 'commission',
  retailerReferral: 'commission',
  dropshipping: 'discount',
  wholesale: 'discount',
}

/** Dropshipping discount off the regular catalogue price. Programme term. */
export const DROPSHIPPING_DISCOUNT_PERCENT = 20

/**
 * Forhandlerinnkjøp discount off the regular catalogue price. The same 35 % a retailer gets on
 * `/bli-partner`, so it is the same constant rather than a second copy of the number.
 */
export const WHOLESALE_DISCOUNT_PERCENT = RETAILER_DISCOUNT_PERCENT

/**
 * The default percentage stored on a new partner for each configurable model. Promokode has no
 * entry: its rate is set on the promo code itself.
 */
export const PARTNERSHIP_DEFAULT_PERCENT = {
  businessSale: BUSINESS_SALE_COMMISSION_PERCENT,
  retailerReferral: RETAILER_COMMISSION_PERCENT,
  dropshipping: DROPSHIPPING_DISCOUNT_PERCENT,
  wholesale: WHOLESALE_DISCOUNT_PERCENT,
} as const satisfies Record<Exclude<PartnershipType, 'promoCode'>, number>

export type ConfigurablePartnershipType = keyof typeof PARTNERSHIP_DEFAULT_PERCENT

/** Purchase discounts never combine with any other price reduction. See the file header. */
export const PURCHASE_DISCOUNTS_STACK = false

export const PARTNER_STATUSES = ['active', 'paused', 'ended'] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

export const PARTNER_STATUS_OPTIONS: { label: string; value: PartnerStatus }[] = [
  { label: 'Aktiv', value: 'active' },
  { label: 'Pause', value: 'paused' },
  { label: 'Avsluttet', value: 'ended' },
]

export const PARTNER_ENTITY_TYPES = ['person', 'company'] as const
export type PartnerEntityType = (typeof PARTNER_ENTITY_TYPES)[number]

export const PARTNER_ENTITY_TYPE_OPTIONS: { label: string; value: PartnerEntityType }[] = [
  { label: 'Privatperson', value: 'person' },
  { label: 'Bedrift', value: 'company' },
]

/* ------------------------------ admin copy ------------------------------ */

export const PARTNERSHIP_DESCRIPTIONS: Record<PartnershipType, string> = {
  promoCode:
    'Kunden får rabatt med partnerens promokode, og partneren får provisjon. Provisjonssatsen settes på hver rabattkode under «Partner og provisjon» – den er den eneste satsen som brukes i beregningen.',
  businessSale:
    'Partneren finner og forhandler frem en bedriftsordre, og får provisjon av den endelige betalte vareverdien. Kunden får gjeldende mengderabatt.',
  retailerReferral:
    'Partneren introduserer en forhandler og får provisjon av forhandlerens betalte innkjøp. Partneren er ikke selv forhandleren – se «Forhandlerinnkjøp» for det.',
  dropshipping:
    'Partneren selger videre og ABOKS AS sender direkte til sluttkunden.',
  wholesale:
    'Partneren er selv forhandler og kjøper varer for videresalg. Ikke det samme som «Forhandlersalg».',
}

export const NO_STACKING_DESCRIPTION =
  'Gis av ordinær katalogpris og kombineres aldri med kampanjepris, mengderabatt, rabattkode eller partnerprovisjon. Foreløpig kun en avtalt sats – den brukes ikke automatisk på noen ordre.'

export const REFERRAL_RATE_DESCRIPTION =
  'Avtalt provisjonssats. Foreløpig kun registrert her – ingen ordre spores eller krediteres automatisk.'

/* ------------------------------ validation ------------------------------ */

export const MIN_PARTNERSHIP_PERCENT = 0
export const MAX_PARTNERSHIP_PERCENT = 100

/**
 * Validates one model's percentage. Required — and within 0–100 — only while that model is
 * selected on the partner; an unselected model's value is ignored.
 *
 * Returns `true` or a Norwegian message, the shape Payload field validators return.
 */
export function validatePartnershipPercent(
  value: unknown,
  options: { selected: boolean; label: string },
): true | string {
  if (!options.selected) return true
  if (value == null || value === '') return `${options.label} (%) må fylles ut.`
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return `${options.label} (%) må være et tall.`
  }
  if (value < MIN_PARTNERSHIP_PERCENT) return `${options.label} (%) kan ikke være negativ.`
  if (value > MAX_PARTNERSHIP_PERCENT) {
    return `${options.label} (%) kan ikke være høyere enn ${MAX_PARTNERSHIP_PERCENT}.`
  }
  return true
}

/** The selected models off a document, tolerating a missing or malformed value. */
export function selectedPartnershipTypes(data: unknown): PartnershipType[] {
  const raw = (data as { partnershipTypes?: unknown } | null | undefined)?.partnershipTypes
  if (!Array.isArray(raw)) return []
  return raw.filter((v): v is PartnershipType =>
    (PARTNERSHIP_TYPES as readonly string[]).includes(v as string),
  )
}

export const hasPartnershipType = (data: unknown, type: PartnershipType): boolean =>
  selectedPartnershipTypes(data).includes(type)
