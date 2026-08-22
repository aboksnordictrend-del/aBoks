import type { Endpoint, PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { createReviewInvitationEmail } from '@/emails'
import { SITE_URL } from '@/lib/site'
import { checkInvitationEligibility, eligibilityMessage } from '@/lib/reviews'
import {
  revokeActiveInvitationsForOrder,
  stampOrderReviewInvitationSentAt,
} from '@/lib/reviewInvitationDb'
import {
  generateRawToken,
  hashToken,
  invitationExpiry,
  reviewInvitationUrl,
} from '@/lib/reviewToken'

/**
 * Admin-only action to send a review invitation for a delivered order.
 *
 *   POST /api/orders/:id/send-review-invitation             → refuses if one already exists
 *   POST /api/orders/:id/send-review-invitation?resend=true → revokes the active link, sends anew
 *
 * Prepared for a future automated cron send (7–10 days after delivery): the eligibility,
 * token, and email logic all live here and in @/lib/reviews, so a scheduled job would just
 * call the same building blocks. No cron is wired up yet (spec §6).
 *
 * The raw token is generated here and placed ONLY in the email URL — never stored, never
 * logged. Only its SHA-256 hash is persisted.
 */
export const sendReviewInvitation: Endpoint = {
  path: '/:id/send-review-invitation',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const id = req.routeParams?.id as string | undefined
    if (!id) return Response.json({ error: 'Missing order id' }, { status: 400 })

    const resend = req.searchParams?.get('resend') === 'true'
    const { payload } = req

    let order: Order
    try {
      order = await payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: false, user: req.user })
    } catch {
      return Response.json({ error: 'Fant ikke ordren.' }, { status: 404 })
    }

    const logBase = { scope: 'reviews-invitation', orderId: order.id, orderNumber: order.orderNumber }

    const { eligible, reason } = checkInvitationEligibility(order as unknown as Parameters<typeof checkInvitationEligibility>[0])
    if (!eligible) {
      console.warn(JSON.stringify({ ...logBase, event: 'rejected', reason }))
      return Response.json({ error: eligibilityMessage(reason) }, { status: 409 })
    }

    // Existing invitations for this order (newest first).
    const existing = await payload.find({
      collection: 'review-invitations',
      where: { order: { equals: order.id } },
      sort: '-createdAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const activeOrUsed = existing.docs.filter((d) => d.status === 'active' || d.status === 'used')

    if (activeOrUsed.length > 0 && !resend) {
      const latest = activeOrUsed[0]
      return Response.json(
        {
          error:
            latest.status === 'used'
              ? 'Kunden har allerede sendt inn en anmeldelse for denne ordren.'
              : 'Det finnes allerede en aktiv invitasjon for denne ordren.',
          status: latest.status,
          sentAt: latest.sentAt ?? null,
          hint: 'Bruk «Send på nytt» for å tilbakekalle den gamle lenken og sende en ny.',
        },
        { status: 409 },
      )
    }

    // Controlled resend: revoke every currently-active link so the old URL stops working.
    if (resend) {
      const revoked = await revokeActiveInvitationsForOrder(payload, order.id)
      if (revoked > 0) console.log(JSON.stringify({ ...logBase, event: 'revoked-previous', count: revoked }))
    }

    // Generate the secure one-time token. Raw value never leaves this function except in
    // the email URL below.
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const sentAt = new Date().toISOString()
    const email = order.customerInfo!.email!

    const customerRaw =
      order.customer && typeof order.customer === 'object'
        ? (order.customer as { id: number }).id
        : order.customer
    const customerId = typeof customerRaw === 'number' ? customerRaw : undefined

    let invitationId: number | string
    try {
      const created = await payload.create({
        collection: 'review-invitations',
        data: {
          email,
          order: order.id,
          ...(customerId ? { customer: customerId } : {}),
          tokenHash,
          status: 'active',
          expiresAt: invitationExpiry(),
          sentAt,
          resendCount: resend ? existing.totalDocs : 0,
        },
        overrideAccess: true,
      })
      invitationId = created.id
    } catch (err) {
      console.error(JSON.stringify({ ...logBase, event: 'create-failed', error: err instanceof Error ? err.message : String(err) }))
      return Response.json({ error: 'Kunne ikke opprette invitasjonen.' }, { status: 500 })
    }

    // Send the email. On failure, revoke the just-created invitation so no usable link is
    // left dangling that the customer never received.
    const reviewUrl = reviewInvitationUrl(rawToken, SITE_URL)
    const template = createReviewInvitationEmail({
      firstName: order.customerInfo?.firstName?.trim() || '',
      reviewUrl,
    })

    try {
      await payload.sendEmail({ to: email, ...template })
    } catch (err) {
      await payload.update({
        collection: 'review-invitations',
        id: invitationId,
        data: { status: 'revoked' },
        overrideAccess: true,
      }).catch(() => {})
      console.error(JSON.stringify({ ...logBase, event: 'email-failed', invitationId, error: err instanceof Error ? err.message : String(err) }))
      return Response.json({ error: 'Invitasjonen kunne ikke sendes på e-post.' }, { status: 502 })
    }

    // The e-mail is out. Only now is the order's `reviewInvitationSentAt` stamped — every
    // path above returns before reaching this line, so an ineligible order, a refused
    // duplicate or a failed send can never move the timestamp. A resend passes through here
    // too, which is exactly why the column ends up holding the last successful send.
    //
    // Writing the receipt is not allowed to turn a delivered e-mail into an error: the
    // customer has the link either way, so a stamp failure is logged and the response stays
    // a success.
    try {
      const stamped = await stampOrderReviewInvitationSentAt(payload, order.id, sentAt)
      if (!stamped) {
        console.warn(JSON.stringify({ ...logBase, event: 'sent-at-not-stamped', invitationId }))
      }
    } catch (err) {
      console.error(JSON.stringify({ ...logBase, event: 'sent-at-stamp-failed', invitationId, error: err instanceof Error ? err.message : String(err) }))
    }

    console.log(JSON.stringify({ ...logBase, event: 'sent', invitationId, resend }))
    return Response.json({ ok: true, invitationId, sentAt, resend })
  },
}
