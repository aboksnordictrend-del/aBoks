/**
 * The one place that knows which carriers aBoks ships with, what they are called in front of
 * a customer, and where a customer goes to track a parcel.
 *
 * Every consumer — the Payload field options, the shipped e-mail, the manual resend endpoint
 * and the tests — reads this map. Nothing anywhere else may hard-code a carrier name or a
 * tracking URL, so the admin panel, the e-mail and the CTA button can never disagree.
 *
 * ── Why a key, never a URL, crosses a boundary ──
 *
 * The order stores an enum key (`postnord`), never a link. `trackingUrlFor()` is the only way
 * to turn that key into a URL, and it answers `null` for anything it does not recognise. A
 * carrier value that somehow reached the database through a route other than the admin panel
 * therefore renders no button at all — it can never become an arbitrary href in an e-mail we
 * send in the shop's name.
 *
 * ── Why the URLs carry no tracking parameter ──
 *
 * These are the carriers' own tracking landing pages. None of the three documents a stable
 * query-parameter form for deep-linking a consignment number, so the button opens the page
 * and the e-mail prints the `Sendingsnummer` next to it for the customer to paste. Inventing
 * an undocumented parameter would produce links that silently rot.
 *
 * Deliberately dependency-free (no Payload import), exactly like @/lib/promo/constants — the
 * collection, the e-mail layer and the endpoint all import it without pulling in the CMS.
 */

export type ShippingCarrierConfig = {
  /** Customer-facing name, printed verbatim in e-mails and shown in the admin. */
  name: string
  /** The carrier's public tracking page. */
  trackingUrl: string
}

export const SHIPPING_CARRIERS = {
  postnord: {
    name: 'PostNord',
    trackingUrl: 'https://www.postnord.no/',
  },
  posten: {
    name: 'Posten',
    trackingUrl: 'https://www.posten.no/',
  },
  helthjem: {
    name: 'Helthjem',
    trackingUrl: 'https://helthjem.no/sporing',
  },
} as const satisfies Record<string, ShippingCarrierConfig>

export type ShippingCarrier = keyof typeof SHIPPING_CARRIERS

/** The stored enum values, in the order they are offered in the admin. */
export const SHIPPING_CARRIER_VALUES = Object.keys(SHIPPING_CARRIERS) as ShippingCarrier[]

/** Radio options for the Payload field — labels come from the map, never retyped. */
export const SHIPPING_CARRIER_OPTIONS: { label: string; value: ShippingCarrier }[] =
  SHIPPING_CARRIER_VALUES.map((value) => ({ label: SHIPPING_CARRIERS[value].name, value }))

/**
 * `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `'toString' in
 * SHIPPING_CARRIERS` is true and would let `toString` through as a carrier — and then
 * `SHIPPING_CARRIERS['toString'].name` is the string `'toString'`, which is exactly the kind
 * of value that must never reach a customer's e-mail.
 */
export function isShippingCarrier(value: unknown): value is ShippingCarrier {
  return typeof value === 'string' && Object.hasOwn(SHIPPING_CARRIERS, value)
}

/** The carrier key if it is one we support, otherwise null. The only trust boundary. */
export function normalizeShippingCarrier(value: unknown): ShippingCarrier | null {
  return isShippingCarrier(value) ? value : null
}

/** Customer-facing carrier name, or null for a missing/unknown value. */
export function carrierNameOf(value: unknown): string | null {
  const carrier = normalizeShippingCarrier(value)
  return carrier ? SHIPPING_CARRIERS[carrier].name : null
}

/** Tracking-page URL, or null for a missing/unknown value. Never derived from input. */
export function trackingUrlFor(value: unknown): string | null {
  const carrier = normalizeShippingCarrier(value)
  return carrier ? SHIPPING_CARRIERS[carrier].trackingUrl : null
}

/**
 * Trim, and treat a blank string as absent. A `Sendingsnummer` of `"   "` is not a
 * consignment number, and storing it would let an empty tracking block into an e-mail.
 */
export function normalizeTrackingNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

// ── Validation ───────────────────────────────────────────────────────────────

/** The message the admin sees when an order is pushed to «Sendt» without shipment data. */
export const SHIPMENT_REQUIRED_MESSAGE =
  'Velg transportør og legg inn sendingsnummer før ordren settes til Sendt.'

export const CARRIER_REQUIRED_MESSAGE = 'Velg transportør før ordren settes til «Sendt».'
export const TRACKING_NUMBER_REQUIRED_MESSAGE =
  'Legg inn sendingsnummer før ordren settes til «Sendt».'

export type ShipmentField = 'shippingCarrier' | 'trackingNumber'

export type ShipmentProblem = {
  /** Field path, as Payload's admin form addresses it. */
  path: ShipmentField
  message: string
}

export type ShipmentInput = {
  shippingCarrier?: unknown
  trackingNumber?: unknown
}

/**
 * Which shipment fields are missing (or hold an unsupported carrier). Pure — it says nothing
 * about *when* the requirement applies; that is `shipmentTransitionProblems`' job.
 */
export function shipmentProblems(input: ShipmentInput): ShipmentProblem[] {
  const problems: ShipmentProblem[] = []

  if (!normalizeShippingCarrier(input.shippingCarrier)) {
    problems.push({ path: 'shippingCarrier', message: CARRIER_REQUIRED_MESSAGE })
  }

  if (!normalizeTrackingNumber(input.trackingNumber)) {
    problems.push({ path: 'trackingNumber', message: TRACKING_NUMBER_REQUIRED_MESSAGE })
  }

  return problems
}

export type ShipmentTransitionInput = ShipmentInput & {
  operation: 'create' | 'update'
  /** Status the document will have after this write. */
  nextStatus?: string | null
  /** Status the document had before this write (undefined on create). */
  previousStatus?: string | null
}

/**
 * Shipment data is required on exactly one event: the transition of an existing order into
 * `shipped`. That is deliberately the *same* condition `emailsToClaim` uses to claim the
 * shipped e-mail — the rule is "if this save sends the customer a tracking e-mail, it must
 * have something to track", so the two can never drift apart.
 *
 * Everything else is left alone, which is what keeps the feature backward compatible:
 *
 *  • An order that is already `shipped` — every historical one — can be re-saved, re-noted,
 *    corrected and moved to `delivered` with both fields empty. No existing row is made
 *    invalid merely by being read or edited.
 *  • `pending`, `confirmed` and `cancelled` never require shipment data.
 *  • Create is exempt: the Kustom webhook creates orders as `pending`/`confirmed`, and a
 *    create never sends a shipped e-mail either.
 */
export function shipmentTransitionProblems(input: ShipmentTransitionInput): ShipmentProblem[] {
  const entersShipped =
    input.operation === 'update' &&
    input.nextStatus === 'shipped' &&
    input.previousStatus !== 'shipped'

  return entersShipped ? shipmentProblems(input) : []
}
