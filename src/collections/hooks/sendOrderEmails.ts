import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'
import type { Order } from '@/payload-types'
import { claimEmailsAtomically } from '@/lib/emailClaim'
import {
  emailsToClaim,
  type ClaimableEmail,
  logOp,
  outcomeData,
  readClaims,
  recordEmailOutcome,
  sendOrderEmail,
  shouldSkipOrderEmailHooks,
  writeClaims,
  type LogFields,
} from '@/lib/orderEmails'

const SENT_AT_DATA_FIELD = {
  confirmation: 'confirmationEmailSentAt',
  admin: 'adminEmailSentAt',
  shipped: 'shippedEmailSentAt',
  receipt: 'receiptEmailSentAt',
} as const

/**
 * Claims the emails this write is allowed to send, by stamping the `*EmailSentAt`
 * sentinels into the *same* UPDATE as the status change.
 *
 * This is what makes the flow idempotent. The claim commits atomically with the
 * status, so a second Save — or a retry after a 504 — sees the sentinel already set
 * and claims nothing, which means no duplicate email. The sentinel is released again
 * in afterChange if the send fails, so a genuine failure stays retryable.
 */
export const claimOrderEmails: CollectionBeforeChangeHook<Order> = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (shouldSkipOrderEmailHooks(req)) return data

  const candidates = emailsToClaim({
    operation,
    nextStatus: (data.status ?? originalDoc?.status) as Order['status'],
    previousStatus: originalDoc?.status,
    confirmationEmailSentAt: data.confirmationEmailSentAt ?? originalDoc?.confirmationEmailSentAt,
    adminEmailSentAt: data.adminEmailSentAt ?? originalDoc?.adminEmailSentAt,
    shippedEmailSentAt: data.shippedEmailSentAt ?? originalDoc?.shippedEmailSentAt,
  })

  writeClaims(req, [])
  if (candidates.length === 0) return data

  const claimedAt = new Date().toISOString()
  let granted = candidates

  // On update the row already exists, so the claim can be a real compare-and-set and
  // two overlapping saves cannot both win. On create there is no row to contend for.
  if (operation === 'update' && originalDoc?.id != null) {
    const result = await claimEmailsAtomically(req, originalDoc.id, candidates, claimedAt)

    if (result.atomic) {
      granted = result.granted
      // Write back the authoritative sentinels — including the ones we lost — so this
      // save cannot clobber a concurrent winner's claim back to null.
      for (const [kind, value] of Object.entries(result.values)) {
        data[SENT_AT_DATA_FIELD[kind as ClaimableEmail]] = value
      }
    } else {
      console.warn('[orders-email] no SQL executor for atomic claim — falling back')
      for (const kind of candidates) data[SENT_AT_DATA_FIELD[kind]] = claimedAt
    }
  } else {
    for (const kind of candidates) data[SENT_AT_DATA_FIELD[kind]] = claimedAt
  }

  if (granted.includes('shipped')) {
    data.shippedEmailError = null
    data.shippedEmailMessageId = null
  }

  if (granted.includes('receipt')) {
    data.receiptEmailError = null
    data.receiptEmailMessageId = null
  }

  writeClaims(req, granted)

  return data
}

/**
 * Sends whatever the beforeChange hook claimed. Every send is bounded by a hard
 * timeout, so a slow or unreachable Zoho can never hold the PATCH open long enough
 * to reach Vercel's FUNCTION_INVOCATION_TIMEOUT. A failed send never fails the save:
 * it releases the claim and records the error instead.
 */
export const sendOrderEmails: CollectionAfterChangeHook<Order> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (shouldSkipOrderEmailHooks(req)) return

  const claims = readClaims(req)
  if (claims.length === 0) return

  // Consume the claims before doing any awaiting: one write sends one set of emails,
  // and nothing downstream can replay them.
  writeClaims(req, [])

  const fields: LogFields = {
    orderId: doc.id,
    orderNumber: doc.orderNumber,
    previousStatus: operation === 'create' ? null : previousDoc?.status,
    newStatus: doc.status,
    trigger: 'hook',
  }

  const hookStartedAt = Date.now()
  logOp('hook:start', fields, { ok: true, durationMs: 0 })

  for (const kind of claims) {
    const result = await sendOrderEmail(req.payload, kind, doc, fields)
    const data = outcomeData(kind, result)
    // Same req → joins the open transaction; skipOrderEmailHooks → cannot re-enter.
    if (data) await recordEmailOutcome(req, doc.id, data, fields)
  }

  logOp('hook:end', fields, { ok: true, durationMs: Date.now() - hookStartedAt })
}
