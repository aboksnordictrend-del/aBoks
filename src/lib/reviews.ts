/**
 * Core review-system logic that is independent of Payload collection wiring: which orders
 * may be invited, which products a customer is allowed to review, the public-safe DTO for
 * the form, and the aggregate rating maths for the public page. Kept pure where possible
 * so it can be unit-tested without a database.
 */

// ── Order shape (only the fields we read) ────────────────────────────────────

export type OrderStatusLike =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | (string & {})

export interface OrderItemLike {
  product?: unknown
  variant?: unknown
  variantName?: string | null
  quantity?: number | null
}

export interface OrderLike {
  id: number | string
  status?: OrderStatusLike | null
  customerInfo?: {
    email?: string | null
    firstName?: string | null
    lastName?: string | null
    city?: string | null
  } | null
  customer?: unknown
  items?: OrderItemLike[] | null
}

// ── Invitation eligibility (spec §3) ─────────────────────────────────────────

export type EligibilityReason =
  | 'ok'
  | 'not-found'
  | 'cancelled'
  | 'not-delivered'
  | 'no-items'
  | 'no-email'

/** Pure gate: may we create a review invitation for this order? */
export function checkInvitationEligibility(order: OrderLike | null | undefined): {
  eligible: boolean
  reason: EligibilityReason
} {
  if (!order) return { eligible: false, reason: 'not-found' }
  if (order.status === 'cancelled') return { eligible: false, reason: 'cancelled' }
  if (order.status !== 'delivered') return { eligible: false, reason: 'not-delivered' }
  if (!order.items || order.items.length === 0) return { eligible: false, reason: 'no-items' }
  if (!order.customerInfo?.email) return { eligible: false, reason: 'no-email' }
  return { eligible: true, reason: 'ok' }
}

/** Norwegian message for an ineligible order, for the admin toast. */
export function eligibilityMessage(reason: EligibilityReason): string {
  switch (reason) {
    case 'cancelled':
      return 'Ordren er kansellert.'
    case 'not-delivered':
      return 'Ordren må ha status «Levert» før du kan sende anmeldelsesinvitasjon.'
    case 'no-items':
      return 'Ordren har ingen produkter.'
    case 'no-email':
      return 'Ordren mangler e-postadresse til kunden.'
    case 'not-found':
      return 'Fant ikke ordren.'
    default:
      return 'Kan ikke sende invitasjon for denne ordren.'
  }
}

// ── Reviewable-products DTO (spec §19: never leak the whole order) ────────────

/** Only the fields the public form is allowed to see about a purchased product. */
export interface ReviewableProduct {
  /** Product document id, as a string. */
  productId: string
  title: string
  variantName?: string
  color?: string
  quantity: number
}

/** The minimal, safe payload handed to the private review page. No PII beyond first name. */
export interface ReviewFormDTO {
  firstName: string
  products: ReviewableProduct[]
}

function idOf(rel: unknown): string | null {
  if (rel == null) return null
  if (typeof rel === 'string' || typeof rel === 'number') return String(rel)
  if (typeof rel === 'object' && 'id' in (rel as Record<string, unknown>)) {
    return String((rel as { id: unknown }).id)
  }
  return null
}

function titleOf(rel: unknown, fallback = 'aBoks'): string {
  if (rel && typeof rel === 'object' && 'title' in (rel as Record<string, unknown>)) {
    const t = (rel as { title?: unknown }).title
    if (typeof t === 'string' && t.trim()) return t.trim()
  }
  return fallback
}

function colorOf(variant: unknown): string | undefined {
  if (variant && typeof variant === 'object') {
    const v = variant as Record<string, unknown>
    if (typeof v.name === 'string' && v.name.trim()) return v.name.trim()
  }
  return undefined
}

/**
 * Distinct purchased products, keyed by product + variant, so a customer sees exactly the
 * items on the order (spec §3). Quantities of the same model/variant are summed. Depth ≥1
 * is assumed so `product`/`variant` are populated objects; ids alone still work.
 */
export function buildReviewableProducts(order: OrderLike): ReviewableProduct[] {
  const byKey = new Map<string, ReviewableProduct>()

  for (const item of order.items ?? []) {
    const productId = idOf(item.product)
    if (!productId) continue
    const variantName = item.variantName?.trim() || colorOf(item.variant)
    const key = `${productId}::${variantName ?? ''}`
    const qty = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1

    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += qty
    } else {
      byKey.set(key, {
        productId,
        title: titleOf(item.product),
        variantName,
        color: colorOf(item.variant),
        quantity: qty,
      })
    }
  }

  return [...byKey.values()]
}

export function buildReviewFormDTO(order: OrderLike): ReviewFormDTO {
  return {
    firstName: order.customerInfo?.firstName?.trim() || '',
    products: buildReviewableProducts(order),
  }
}

/** Verifies that `productId` was actually purchased on this order (spec §3, §9.8). */
export function productInOrder(order: OrderLike, productId: string): boolean {
  return (order.items ?? []).some((item) => idOf(item.product) === String(productId))
}

/** Finds the reviewable entry for a product id + optional variant, for the snapshot. */
export function findReviewable(
  products: ReviewableProduct[],
  productId: string,
  variantName?: string,
): ReviewableProduct | undefined {
  const wantVariant = variantName?.trim()
  return (
    products.find((p) => p.productId === productId && (p.variantName ?? '') === (wantVariant ?? '')) ??
    products.find((p) => p.productId === productId)
  )
}

// ── Invitation state classification (pure; spec §4, §8) ──────────────────────

export type InvitationClass = 'valid' | 'expired' | 'used' | 'invalid'

export interface InvitationStateInput {
  status?: 'active' | 'used' | 'expired' | 'revoked' | (string & {}) | null
  usedAt?: string | null
  expiresAt?: string | null
}

/**
 * Decides how an invitation should be treated, without any I/O. Revoked is mapped to
 * `invalid` on purpose — the public must not be able to tell "revoked" from "never existed"
 * (spec §8). A used token stays used; an expired-by-time token is `expired`.
 */
export function classifyInvitation(inv: InvitationStateInput, now: number = Date.now()): InvitationClass {
  if (!inv || inv.status === 'revoked') return 'invalid'
  if (inv.status === 'used' || inv.usedAt) return 'used'
  const expiresMs = inv.expiresAt ? new Date(inv.expiresAt).getTime() : NaN
  if (inv.status === 'expired' || (Number.isFinite(expiresMs) && expiresMs <= now)) return 'expired'
  if (inv.status === 'active') return 'valid'
  return 'invalid'
}

// ── Privacy display helpers (pure; spec §14) ─────────────────────────────────

/** Name shown publicly: the chosen name only with consent, else the neutral fallback. */
export function publicDisplayName(consentToPublishName: boolean, customerName?: string | null): string {
  if (consentToPublishName && customerName && customerName.trim()) return customerName.trim()
  return 'Verifisert kunde'
}

/** Whether a review's photos may be shown publicly (consent gate; approval is separate). */
export function mayPublishPhotos(consentToPublishPhotos: boolean): boolean {
  return consentToPublishPhotos === true
}

// ── Aggregate rating maths for the public page (spec §12) ─────────────────────

export interface ReviewLike {
  rating: number
  photoCount?: number
}

export interface ReviewAggregate {
  count: number
  average: number
  /** Distribution keyed by star value 1–5 → number of approved reviews. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>
  withPhotos: number
  /** Percentage (0–100, rounded) of reviews rated 4 or 5. */
  positivePercent: number
}

/** Aggregate over ALREADY-approved reviews only. Never invents numbers. */
export function computeReviewAggregate(reviews: ReviewLike[]): ReviewAggregate {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  let withPhotos = 0

  for (const r of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5
    distribution[star] += 1
    sum += star
    if ((r.photoCount ?? 0) > 0) withPhotos += 1
  }

  const count = reviews.length
  const average = count === 0 ? 0 : Math.round((sum / count) * 10) / 10
  const positive = distribution[4] + distribution[5]
  const positivePercent = count === 0 ? 0 : Math.round((positive / count) * 100)

  return { count, average, distribution, withPhotos, positivePercent }
}

/** Norwegian one-decimal rating, e.g. 4.8 → "4,8". */
export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

/** Norwegian long date, e.g. "3. juli 2026". Deterministic (no locale drift). */
const NB_MONTHS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]
export function formatReviewDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCDate()}. ${NB_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

// The atomic invitation lifecycle SQL (claim/release/revoke) lives in the server-only
// module @/lib/reviewInvitationDb, so importing this pure module from a client component
// (e.g. the Stars display uses formatRating) never drags the Postgres adapter into the
// browser bundle.
