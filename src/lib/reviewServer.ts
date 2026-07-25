import 'server-only'
import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'
import type { Order, Review, ReviewInvitation, ReviewPhoto, Product } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import { computeReviewAggregate, formatReviewDate, type ReviewAggregate } from '@/lib/reviews'
import { hashToken, isWellFormedToken } from '@/lib/reviewToken'
import {
  buildReviewFormDTO,
  classifyInvitation,
  findReviewable,
  mayPublishPhotos,
  productInOrder,
  publicDisplayName,
  type ReviewFormDTO,
} from '@/lib/reviews'
import { claimInvitationUsed, releaseInvitationClaim } from '@/lib/reviewInvitationDb'
import type { CleanReviewInput } from '@/lib/reviewValidation'
import { processReviewPhoto, safePhotoFilename, PHOTO_LIMITS } from '@/lib/reviewPhotos'

/**
 * Server-only orchestration for the private review flow. All token handling and DB writes
 * happen here, behind overrideAccess; the frontend never touches Payload directly and the
 * raw token is compared only by its hash.
 */

export type InvitationState = 'valid' | 'expired' | 'used' | 'revoked' | 'invalid'

export interface ResolvedInvitation {
  state: InvitationState
  /** Only present when state === 'valid'. Safe, minimal DTO for the form. */
  dto?: ReviewFormDTO
}

/** Loads and validates an invitation from the raw URL token. Never leaks order internals. */
export async function resolveInvitation(rawToken: string): Promise<ResolvedInvitation> {
  if (!isWellFormedToken(rawToken)) return { state: 'invalid' }

  const payload = await getPayloadClient()
  const tokenHash = hashToken(rawToken)

  const found = await payload.find({
    collection: 'review-invitations',
    where: { tokenHash: { equals: tokenHash } },
    limit: 1,
    depth: 2, // populate order → items → product/variant for the DTO
    overrideAccess: true,
  })

  const invitation = found.docs[0] as (ReviewInvitation & { order?: Order }) | undefined
  if (!invitation) return { state: 'invalid' }

  const state = classifyInvitation(invitation)

  if (state === 'expired' && invitation.status !== 'expired') {
    // Lazily flip a time-expired invitation so the admin list reflects reality.
    await payload
      .update({ collection: 'review-invitations', id: invitation.id, data: { status: 'expired' }, overrideAccess: true })
      .catch(() => {})
  }
  if (state !== 'valid') return { state }

  const order = invitation.order
  if (!order || typeof order !== 'object') return { state: 'invalid' }

  return { state: 'valid', dto: buildReviewFormDTO(order as unknown as Parameters<typeof buildReviewFormDTO>[0]) }
}

// ── Submission ────────────────────────────────────────────────────────────────

export type SubmitReason = 'invalid' | 'expired' | 'used' | 'product-mismatch' | 'error'

export type SubmitOutcome =
  | { ok: true; reviewId: number }
  | { ok: false; reason: SubmitReason; message: string }

const REASON_MESSAGE: Record<SubmitReason, string> = {
  invalid: 'Lenken er ugyldig eller ikke lenger aktiv.',
  expired: 'Denne lenken har utløpt.',
  used: 'Takk! Denne lenken er allerede brukt.',
  'product-mismatch': 'Det valgte produktet finnes ikke på denne ordren.',
  error: 'Noe gikk galt. Prøv igjen senere.',
}

async function storePhotos(
  payload: Payload,
  buffers: Buffer[],
): Promise<{ ids: number[] }> {
  const ids: number[] = []
  for (const buf of buffers.slice(0, PHOTO_LIMITS.maxPhotos)) {
    const processed = await processReviewPhoto(buf)
    if (!processed.ok) continue // silently skip a bad photo; the review still goes through
    const created = await payload.create({
      collection: 'review-photos',
      data: { alt: 'Kundebilde av aBoks' },
      file: {
        data: processed.photo.buffer,
        mimetype: processed.photo.mimeType,
        name: safePhotoFilename(),
        size: processed.photo.buffer.length,
      },
      overrideAccess: true,
    })
    ids.push(created.id)
  }
  return { ids }
}

/**
 * Full submission: re-validate token state, verify the product was purchased, atomically
 * consume the invitation, store processed photos, then create the pending review and link
 * it back. Designed so two concurrent submits cannot create two reviews — the atomic claim
 * lets exactly one caller through (spec §9, §17.20).
 */
export async function submitReview(
  rawToken: string,
  input: CleanReviewInput,
  photoBuffers: Buffer[],
  /** Variant name the customer selected (from the reviewable-products list), if any. */
  chosenVariantName?: string,
): Promise<SubmitOutcome> {
  if (!isWellFormedToken(rawToken)) return { ok: false, reason: 'invalid', message: REASON_MESSAGE.invalid }

  const payload = await getPayloadClient()
  const tokenHash = hashToken(rawToken)

  const found = await payload.find({
    collection: 'review-invitations',
    where: { tokenHash: { equals: tokenHash } },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })
  const invitation = found.docs[0] as (ReviewInvitation & { order?: Order }) | undefined
  if (!invitation) return { ok: false, reason: 'invalid', message: REASON_MESSAGE.invalid }

  const state = classifyInvitation(invitation)
  if (state === 'used') return { ok: false, reason: 'used', message: REASON_MESSAGE.used }
  if (state === 'expired') return { ok: false, reason: 'expired', message: REASON_MESSAGE.expired }
  if (state !== 'valid') return { ok: false, reason: 'invalid', message: REASON_MESSAGE.invalid }

  const order = invitation.order
  if (!order || typeof order !== 'object') {
    return { ok: false, reason: 'invalid', message: REASON_MESSAGE.invalid }
  }

  const orderLike = order as unknown as Parameters<typeof productInOrder>[0]
  if (!productInOrder(orderLike, input.productId)) {
    return { ok: false, reason: 'product-mismatch', message: REASON_MESSAGE['product-mismatch'] }
  }

  // Atomically consume the invitation. Whoever loses this race gets "already used" and no
  // review is created for them.
  const usedAt = new Date().toISOString()
  const won = await claimInvitationUsed(payload, invitation.id, usedAt)
  if (!won) return { ok: false, reason: 'used', message: REASON_MESSAGE.used }

  try {
    const products = buildReviewFormDTO(orderLike).products
    const reviewable = findReviewable(products, input.productId, chosenVariantName)
    const variantName = reviewable?.variantName

    // Store photos only when the customer consented to publishing them. Without consent we
    // do not retain the images at all (privacy-first, spec §14).
    const photoIds = input.consentToPublishPhotos ? (await storePhotos(payload, photoBuffers)).ids : []

    const customerId =
      order.customer && typeof order.customer === 'object'
        ? (order.customer as { id: number }).id
        : (order.customer as number | null | undefined) ?? undefined

    const review = await payload.create({
      collection: 'reviews',
      data: {
        rating: input.rating,
        title: input.title,
        text: input.text,
        customerName: input.customerName,
        customerCity: input.customerCity,
        product: Number(input.productId),
        variantName,
        productSnapshot: {
          title: reviewable?.title ?? undefined,
          variantName: variantName ?? undefined,
          color: reviewable?.color ?? undefined,
        },
        photos: photoIds.length > 0 ? photoIds : undefined,
        status: 'pending',
        // Server-owned: never trust the client for this (spec §2, §9.9).
        verifiedPurchase: true,
        consentToPublishName: input.consentToPublishName,
        consentToPublishPhotos: input.consentToPublishPhotos,
        order: order.id,
        ...(customerId ? { customer: customerId } : {}),
        invitation: invitation.id,
        submittedAt: usedAt,
      },
      overrideAccess: true,
    })

    // Link the invitation to its review.
    await payload
      .update({ collection: 'review-invitations', id: invitation.id, data: { review: review.id }, overrideAccess: true })
      .catch(() => {})

    console.log(JSON.stringify({ scope: 'reviews-submit', event: 'created', reviewId: review.id, invitationId: invitation.id }))
    return { ok: true, reviewId: review.id }
  } catch (err) {
    // Roll back the claim so the customer can retry with the same link.
    await releaseInvitationClaim(payload, invitation.id)
    console.error(JSON.stringify({ scope: 'reviews-submit', event: 'error', invitationId: invitation.id, error: err instanceof Error ? err.message : String(err) }))
    return { ok: false, reason: 'error', message: REASON_MESSAGE.error }
  }
}

// ── Public read model (spec §12, §13) ────────────────────────────────────────

/** Public-safe representation of an approved review. No PII beyond the chosen display name. */
export interface PublicReview {
  id: number
  rating: number
  title?: string
  text: string
  /** Chosen name if consented, otherwise the neutral "Verifisert kunde". */
  displayName: string
  city?: string
  productTitle: string
  productSlug?: string
  variantName?: string
  color?: string
  /** ISO date for machine use. */
  dateIso: string
  /** Norwegian formatted date for display. */
  dateLabel: string
  verifiedPurchase: boolean
  /** Only populated for approved reviews whose author consented to photo publication. */
  photos: { url: string; width?: number; height?: number }[]
}

export interface PublicReviewsData {
  reviews: PublicReview[]
  aggregate: ReviewAggregate
  /** Distinct products among approved reviews, for the filter dropdown. */
  products: { slug: string; title: string }[]
}

function productOf(rel: Review['product']): { title: string; slug?: string; id?: number } {
  if (rel && typeof rel === 'object') {
    const p = rel as Product
    return { title: p.title ?? 'aBoks', slug: p.slug ?? undefined, id: p.id }
  }
  return { title: 'aBoks' }
}

function photoUrls(review: Review): PublicReview['photos'] {
  if (!mayPublishPhotos(!!review.consentToPublishPhotos) || !Array.isArray(review.photos)) return []
  const out: PublicReview['photos'] = []
  for (const ph of review.photos) {
    if (ph && typeof ph === 'object') {
      const photo = ph as ReviewPhoto
      if (photo.url) out.push({ url: photo.url, width: photo.width ?? undefined, height: photo.height ?? undefined })
    }
  }
  return out
}

function toPublicReview(review: Review): PublicReview {
  const product = productOf(review.product)
  const dateIso = review.approvedAt || review.submittedAt || review.createdAt
  return {
    id: review.id,
    rating: review.rating,
    title: review.title?.trim() || undefined,
    text: review.text,
    // Name is published only with explicit consent (spec §14).
    displayName: publicDisplayName(!!review.consentToPublishName, review.customerName),
    city: review.customerCity?.trim() || undefined,
    productTitle: review.productSnapshot?.title?.trim() || product.title,
    productSlug: product.slug,
    variantName: review.variantName?.trim() || review.productSnapshot?.variantName?.trim() || undefined,
    color: review.productSnapshot?.color?.trim() || undefined,
    dateIso,
    dateLabel: formatReviewDate(dateIso),
    verifiedPurchase: !!review.verifiedPurchase,
    photos: photoUrls(review),
  }
}

/** How many approved reviews we load onto the public page in one go. */
const PUBLIC_REVIEW_CAP = 300

const EMPTY_DATA: PublicReviewsData = {
  reviews: [],
  aggregate: computeReviewAggregate([]),
  products: [],
}

async function loadApprovedReviews(): Promise<PublicReviewsData> {
  const payload = await getPayloadClient()
  let result
  try {
    result = await payload.find({
      collection: 'reviews',
      where: { status: { equals: 'approved' } },
      sort: '-approvedAt',
      limit: PUBLIC_REVIEW_CAP,
      depth: 1,
      overrideAccess: true,
    })
  } catch (err) {
    // Before the migration is applied (e.g. a build against a DB without the reviews table)
    // treat the page as empty rather than failing the render.
    console.error(JSON.stringify({ scope: 'reviews-public', event: 'load-failed', error: err instanceof Error ? err.message : String(err) }))
    return EMPTY_DATA
  }

  const reviews = result.docs.map(toPublicReview)
  const aggregate = computeReviewAggregate(reviews.map((r) => ({ rating: r.rating, photoCount: r.photos.length })))

  const productMap = new Map<string, string>()
  for (const r of reviews) if (r.productSlug) productMap.set(r.productSlug, r.productTitle)
  const products = [...productMap.entries()]
    .map(([slug, title]) => ({ slug, title }))
    .sort((a, b) => a.title.localeCompare(b.title, 'nb'))

  return { reviews, aggregate, products }
}

/** Cached public reviews data. Invalidated by the `reviews` tag on any review change. */
export const getApprovedReviewsData = unstable_cache(loadApprovedReviews, ['approved-reviews'], {
  revalidate: 3600,
  tags: ['reviews'],
})

/** Per-product approved-review summary for the product page rating badge + schema (spec §13). */
async function loadProductReviewSummary(productId: string): Promise<{ count: number; average: number }> {
  const payload = await getPayloadClient()
  try {
    const result = await payload.find({
      collection: 'reviews',
      where: { and: [{ status: { equals: 'approved' } }, { product: { equals: productId } }] },
      limit: PUBLIC_REVIEW_CAP,
      depth: 0,
      overrideAccess: true,
    })
    const agg = computeReviewAggregate(result.docs.map((r) => ({ rating: (r as Review).rating })))
    return { count: agg.count, average: agg.average }
  } catch {
    // Reviews table not present yet (pre-migration build) → no rating shown.
    return { count: 0, average: 0 }
  }
}

export const getProductReviewSummary = (productId: string) =>
  unstable_cache(() => loadProductReviewSummary(productId), ['product-review-summary', productId], {
    revalidate: 3600,
    tags: ['reviews'],
  })()
