import type { CollectionAfterChangeHook } from 'payload'
import type { Review } from '@/payload-types'
import { createAdminReviewEmail } from '@/emails'
import { ADMIN_EMAIL } from '@/lib/orderEmails'
import { SITE_URL } from '@/lib/site'

/**
 * Product name for the notification, read from the snapshot stored at submission — the same
 * value the review itself displays, so the e-mail cannot disagree with it. Falls back to the
 * live relationship only when the snapshot is missing (a review created by hand in admin).
 */
function productNameOf(doc: Review): string {
  const snapshot = doc.productSnapshot?.title?.trim()
  if (snapshot) return snapshot

  const product = doc.product
  if (product && typeof product === 'object' && typeof product.title === 'string') {
    return product.title
  }
  return 'Ukjent produkt'
}

/**
 * Notifies the store when a new review lands. Runs on `create` only — an edit in the admin
 * panel (moderation, a status change) must never re-notify.
 *
 * As an afterChange hook this only ever runs once the review row is written, and it swallows
 * every send failure: the customer's submission must succeed regardless of whether we managed
 * to tell ourselves about it. The log line carries the review id and the transport error, and
 * deliberately nothing about the customer.
 */
export const notifyAdminNewReview: CollectionAfterChangeHook<Review> = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return

  try {
    const template = createAdminReviewEmail({
      customerName: doc.customerName,
      rating: doc.rating,
      text: doc.text,
      productName: productNameOf(doc),
      photoCount: doc.photos?.length ?? 0,
      adminUrl: `${SITE_URL}/admin/collections/reviews/${doc.id}`,
    })

    await req.payload.sendEmail({ to: ADMIN_EMAIL, ...template })
  } catch (err) {
    console.error(
      JSON.stringify({
        scope: 'reviews-admin-email',
        event: 'send-failed',
        reviewId: doc.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    )
  }
}
