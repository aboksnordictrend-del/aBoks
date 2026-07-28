/**
 * Shared partner-commission vocabulary: the commission-base enum, its Norwegian admin
 * labels, the rate bounds, and the wording that states — in one place — exactly what a
 * commission is calculated from.
 *
 * Deliberately dependency-free (no Payload import, no money helpers), mirroring
 * `@/lib/promo/constants`: the collections, the calculation module and any later admin
 * component can all import it without pulling the CMS, and the enum values exist in exactly
 * one place so the field options and the arithmetic can never disagree.
 *
 * ── What the commission is calculated from ──
 *
 * Three properties are fixed for this implementation, and every one of them is a deliberate
 * business decision rather than an accident of the data model:
 *
 *   • MERCHANDISE ONLY — the base is the goods subtotal. Shipping is never part of it.
 *   • SHIPPING EXCLUDED — the shop charges shipping to cover a real cost; paying a partner a
 *     share of it would pay them out of that cost. `shippingOere` is accepted by the
 *     calculation purely so a caller can hand over the whole verified snapshot, and it is
 *     never read into any base.
 *   • GROSS, INCLUDING VAT — catalogue prices are gross (see `@/lib/tax`, 25 %), and the
 *     merchandise subtotal carried on a paid order is gross. The commission is a share of
 *     that gross amount; no VAT is deducted first. This is the simple, explainable rule, and
 *     it is stated in the admin description below so nobody has to infer it from code.
 *
 * If any of these ever change, they change here and in `./commission.ts` — not in a caller.
 */

export const COMMISSION_BASES = ['orderAfterDiscount', 'orderBeforeDiscount'] as const
export type CommissionBase = (typeof COMMISSION_BASES)[number]

export const COMMISSION_BASE_OPTIONS: { label: string; value: CommissionBase }[] = [
  { label: 'Ordrebeløp etter rabatt', value: 'orderAfterDiscount' },
  { label: 'Ordrebeløp før rabatt', value: 'orderBeforeDiscount' },
]

/**
 * The base a code gets when none is configured, and the fallback a corrupt value degrades to.
 *
 * `orderAfterDiscount` is the conservative choice: it is the smaller of the two bases for any
 * discounted order, so an unreadable configuration can never inflate a payout.
 */
export const DEFAULT_COMMISSION_BASE: CommissionBase = 'orderAfterDiscount'

export const MIN_COMMISSION_RATE = 0
export const MAX_COMMISSION_RATE = 100

/**
 * Rates are held as a percent (10 = 10 %) but multiplied as integer basis points
 * (1000 = 10 %), the same representation `@/lib/tax` already uses for VAT. Two decimal places
 * of a percent is 0,01 % — far finer than any real partner agreement — and it is what lets
 * the whole calculation stay in exact integer arithmetic.
 */
export const COMMISSION_RATE_SCALE = 100
export const MAX_COMMISSION_RATE_BASIS_POINTS = MAX_COMMISSION_RATE * COMMISSION_RATE_SCALE

/** True while shipping is excluded from every commission base. Read by the tests. */
export const COMMISSION_EXCLUDES_SHIPPING = true
/** True while the base is the gross (VAT-inclusive) merchandise amount. Read by the tests. */
export const COMMISSION_BASE_INCLUDES_VAT = true

/**
 * Norwegian admin copy for the commission fields. Kept here so the collection (Stage 2), the
 * statistics panel and any documentation all state the same rule word for word.
 */
export const COMMISSION_SCOPE_DESCRIPTION =
  'Provisjon beregnes kun av varesummen, inkludert MVA. Frakt regnes aldri med.'

/* ------------------------------ payouts ------------------------------ */

/**
 * How a payout was actually paid. This is a RECORD of a transfer a human already made
 * manually — nothing in this system initiates a bank transfer or a Vipps payment.
 */
export const PAYOUT_METHODS = ['bankTransfer', 'vipps', 'other'] as const
export type PayoutMethod = (typeof PAYOUT_METHODS)[number]

export const PAYOUT_METHOD_OPTIONS: { label: string; value: PayoutMethod }[] = [
  { label: 'Bankoverføring', value: 'bankTransfer' },
  { label: 'Vipps', value: 'vipps' },
  { label: 'Annet', value: 'other' },
]

export const PAYOUT_REGISTER_DESCRIPTION =
  'Registrer en utbetaling som allerede er utført via bank, Vipps eller annen betalingsmåte. Systemet sender aldri penger selv.'

/**
 * The order statuses a paid usage must currently be in for its commission to count.
 *
 * An allowlist, not a denylist: `cancelled`, `pending`, a missing order and any status this
 * list does not know about are all excluded. Adding a status to the order model must never
 * silently start paying commission on it.
 */
export const COMMISSION_ORDER_STATUSES = ['confirmed', 'shipped', 'delivered'] as const
export type CommissionOrderStatus = (typeof COMMISSION_ORDER_STATUSES)[number]

export const COMMISSION_BASE_DESCRIPTION =
  '«Etter rabatt» bruker varesummen minus rabattkoden. «Før rabatt» bruker varesummen slik den var før rabatten. Frakt er utelatt i begge tilfeller.'
