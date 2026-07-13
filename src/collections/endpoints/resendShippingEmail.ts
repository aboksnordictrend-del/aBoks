import type { Endpoint, PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import { claimEmailsAtomically } from '@/lib/emailClaim'
import {
  SKIP_ORDER_EMAIL_HOOKS,
  logOp,
  outcomeData,
  recordEmailOutcome,
  sendOrderEmail,
  type LogFields,
  type OrderEmailContext,
} from '@/lib/orderEmails'

/**
 * Explicit, admin-only retry for the shipping email. Never reachable from an
 * ordinary Save — only from the sidebar button or a direct POST.
 *
 * POST /api/orders/:id/resend-shipping-email        → refuses if already sent
 * POST /api/orders/:id/resend-shipping-email?force=true → resends anyway
 */
export const resendShippingEmail: Endpoint = {
  path: '/:id/resend-shipping-email',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const id = req.routeParams?.id as string | undefined
    if (!id) {
      return Response.json({ error: 'Missing order id' }, { status: 400 })
    }

    const force = req.searchParams?.get('force') === 'true'
    const { payload } = req

    let order: Order
    try {
      order = await payload.findByID({ collection: 'orders', id, overrideAccess: false, user: req.user })
    } catch {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    const fields: LogFields = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      previousStatus: order.status,
      newStatus: order.status,
      trigger: `manual-resend:${req.user.email ?? req.user.id}${force ? ':forced' : ''}`,
    }

    if (order.status !== 'shipped') {
      logOp('resend:rejected', fields, {
        ok: false,
        durationMs: 0,
        error: `Order status is '${order.status}', not 'shipped'`,
      })
      return Response.json(
        { error: 'Ordren er ikke merket som sendt. Sett status til «Sendt» først.' },
        { status: 409 },
      )
    }

    if (order.shippedEmailSentAt && !force) {
      logOp('resend:rejected', fields, {
        ok: false,
        durationMs: 0,
        error: `Already sent at ${order.shippedEmailSentAt}`,
      })
      return Response.json(
        {
          error: 'Sporingsmailen er allerede sendt.',
          shippedEmailSentAt: order.shippedEmailSentAt,
          hint: 'Bruk ?force=true for å sende på nytt.',
        },
        { status: 409 },
      )
    }

    logOp('resend:start', fields, { ok: true, durationMs: 0 })

    // Claim before sending, so two clicks on the button cannot produce two emails.
    // Unforced: a compare-and-set, so only one concurrent click wins.
    // Forced: the operator has explicitly asked for another copy, so we overwrite.
    const claimContext = { [SKIP_ORDER_EMAIL_HOOKS]: true } satisfies OrderEmailContext
    const claimedAt = new Date().toISOString()
    const claimStartedAt = Date.now()

    if (!force) {
      const claim = await claimEmailsAtomically(req, order.id, ['shipped'], claimedAt)
      if (claim.atomic && !claim.granted.includes('shipped')) {
        logOp('resend:rejected', fields, {
          ok: false,
          durationMs: Date.now() - claimStartedAt,
          error: 'Lost the claim race — another send is already in flight',
        })
        return Response.json(
          { error: 'En utsending pågår allerede for denne ordren.' },
          { status: 409 },
        )
      }
    }

    let claimed: Order
    try {
      claimed = await payload.update({
        collection: 'orders',
        id,
        data: {
          shippedEmailSentAt: claimedAt,
          shippedEmailMessageId: null,
          shippedEmailError: null,
        },
        // No transaction is open on an endpoint req, so this starts and commits its
        // own — the claim is durable *before* we talk to Zoho. `req` is passed anyway
        // so every order write in this flow follows the same rule, and the skip guard
        // keeps it from re-entering the email hooks.
        req,
        context: claimContext,
        overrideAccess: true,
      })
      logOp('payload.update:claim', fields, { ok: true, durationMs: Date.now() - claimStartedAt })
    } catch (err) {
      logOp('payload.update:claim', fields, {
        ok: false,
        durationMs: Date.now() - claimStartedAt,
        error: err instanceof Error ? err.message : String(err),
      })
      return Response.json({ error: 'Kunne ikke reservere utsending.' }, { status: 500 })
    }

    const result = await sendOrderEmail(payload, 'shipped', claimed, fields)
    const data = outcomeData('shipped', result)
    if (data) await recordEmailOutcome(req, order.id, data, fields)

    if (!result.ok) {
      return Response.json({ error: result.error, durationMs: result.durationMs }, { status: 502 })
    }

    return Response.json({
      ok: true,
      sentAt: claimedAt,
      messageId: result.messageId ?? null,
      durationMs: result.durationMs,
    })
  },
}
