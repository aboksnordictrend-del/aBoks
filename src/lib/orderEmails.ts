import type { Payload, PayloadRequest } from 'payload'
import type { Order } from '@/payload-types'
import {
  createOrderConfirmationEmail,
  createAdminOrderEmail,
  createOrderShippedEmail,
  createOrderDeliveredEmail,
  type EmailTemplate,
} from '@/emails'
import { getEmailSendTimeoutMs, verifyMailTransport } from './mailTransport'
import { generateReceiptPdf } from './receiptPdf'

export const ADMIN_EMAIL = 'post@aboks.no'

/** Set on req.context by our own writes so the order-email hooks don't re-enter. */
export const SKIP_ORDER_EMAIL_HOOKS = 'skipOrderEmailHooks'

/** Set on req.context by the beforeChange claim, read by the afterChange sender. */
export const CLAIMED_EMAILS = 'claimedOrderEmails'

export type ClaimableEmail = 'confirmation' | 'admin' | 'shipped' | 'receipt'

export type OrderEmailContext = {
  [SKIP_ORDER_EMAIL_HOOKS]?: boolean
  [CLAIMED_EMAILS]?: ClaimableEmail[]
}

/**
 * Always read the flags off `req.context` at the moment of use — never cache the
 * object. Payload's createLocalReq does `req.context = { ...req.context, ...context }`,
 * so every nested local-API call *replaces* req.context with a fresh object; a
 * captured reference goes stale the first time we write back to the order.
 */
export function shouldSkipOrderEmailHooks(req: { context?: unknown }): boolean {
  return (req.context as OrderEmailContext | undefined)?.[SKIP_ORDER_EMAIL_HOOKS] === true
}

export function readClaims(req: { context?: unknown }): ClaimableEmail[] {
  return (req.context as OrderEmailContext | undefined)?.[CLAIMED_EMAILS] ?? []
}

export function writeClaims(req: { context?: unknown }, claims: ClaimableEmail[]): void {
  if (!req.context) (req as { context: OrderEmailContext }).context = {}
  ;(req.context as OrderEmailContext)[CLAIMED_EMAILS] = claims
}

// ── Decision logic (pure — unit tested) ──────────────────────────────────────

type ClaimInput = {
  operation: 'create' | 'update'
  /** Status the document will have after this write. */
  nextStatus?: Order['status'] | null
  /** Status the document had before this write (undefined on create). */
  previousStatus?: Order['status'] | null
  confirmationEmailSentAt?: string | null
  adminEmailSentAt?: string | null
  shippedEmailSentAt?: string | null
  receiptEmailSentAt?: string | null
}

/**
 * Which emails this write is allowed to claim. An email is claimable only on the
 * transition into the triggering status, and only if it has never been sent — so
 * re-saving an order that is already 'shipped' claims nothing.
 */
export function emailsToClaim(input: ClaimInput): ClaimableEmail[] {
  const claims: ClaimableEmail[] = []

  const justConfirmed =
    input.nextStatus === 'confirmed' &&
    (input.operation === 'create' || input.previousStatus !== 'confirmed')

  if (justConfirmed) {
    if (!input.confirmationEmailSentAt) claims.push('confirmation')
    if (!input.adminEmailSentAt) claims.push('admin')
  }

  const justShipped =
    input.operation === 'update' &&
    input.nextStatus === 'shipped' &&
    input.previousStatus !== 'shipped'

  if (justShipped && !input.shippedEmailSentAt) claims.push('shipped')

  // The receipt email fires once, on the first transition into 'delivered'. Like the
  // shipped email it is update-only and gated by its sentinel, so re-saving an order that
  // is already delivered — or moving away and back — never resends it.
  const justDelivered =
    input.operation === 'update' &&
    input.nextStatus === 'delivered' &&
    input.previousStatus !== 'delivered'

  if (justDelivered && !input.receiptEmailSentAt) claims.push('receipt')

  return claims
}

// ── Templates (content and recipients unchanged) ─────────────────────────────

export function customerNameOf(doc: Order): string {
  return (
    [doc.customerInfo?.firstName, doc.customerInfo?.lastName].filter(Boolean).join(' ') || 'Kunde'
  )
}

function itemsOf(doc: Order) {
  return (doc.items ?? []).map((item) => ({
    variantName: item.variantName ?? undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }))
}

function shippingAddressOf(doc: Order) {
  return {
    address: doc.customerInfo?.address ?? '',
    postalCode: doc.customerInfo?.postalCode ?? '',
    city: doc.customerInfo?.city ?? '',
  }
}

/** Builds the template + recipient for one claimable email, or null if unsendable. */
export function buildOrderEmail(
  kind: ClaimableEmail,
  doc: Order,
): { to: string; template: EmailTemplate } | null {
  const customerEmail = doc.customerInfo?.email
  if (!customerEmail) return null

  const customerName = customerNameOf(doc)

  if (kind === 'confirmation') {
    return {
      to: customerEmail,
      template: createOrderConfirmationEmail({
        customerName,
        customerEmail,
        orderNumber: doc.orderNumber,
        items: itemsOf(doc),
        subtotal: doc.subtotal,
        shipping: doc.shipping ?? 0,
        total: doc.total,
        shippingAddress: shippingAddressOf(doc),
      }),
    }
  }

  if (kind === 'admin') {
    return {
      to: ADMIN_EMAIL,
      template: createAdminOrderEmail({
        customerName,
        customerEmail,
        customerPhone: doc.customerInfo?.phone ?? undefined,
        orderNumber: doc.orderNumber,
        items: itemsOf(doc),
        subtotal: doc.subtotal,
        shipping: doc.shipping ?? 0,
        total: doc.total,
        shippingAddress: shippingAddressOf(doc),
      }),
    }
  }

  if (kind === 'shipped') {
    return {
      to: customerEmail,
      template: createOrderShippedEmail({
        customerName,
        customerEmail,
        orderNumber: doc.orderNumber,
        items: itemsOf(doc),
        total: doc.total,
      }),
    }
  }

  return {
    to: customerEmail,
    template: createOrderDeliveredEmail({
      firstName: doc.customerInfo?.firstName?.trim() || customerName,
      customerEmail,
      orderNumber: doc.orderNumber,
    }),
  }
}

// ── Structured timing logs ───────────────────────────────────────────────────

export type LogFields = {
  orderId: number | string
  orderNumber: string
  previousStatus?: string | null
  newStatus?: string | null
  trigger?: string
}

export function logOp(
  operation: string,
  fields: LogFields,
  outcome: { ok: boolean; durationMs: number; error?: string; messageId?: string },
): void {
  const line = JSON.stringify({
    scope: 'orders-email',
    operation,
    ...fields,
    durationMs: outcome.durationMs,
    ok: outcome.ok,
    ...(outcome.messageId ? { messageId: outcome.messageId } : {}),
    ...(outcome.error ? { error: outcome.error } : {}),
  })

  if (outcome.ok) console.log(line)
  else console.error(line)
}

/** Times an awaited operation and logs it, whatever the result. */
export async function timed<T>(
  operation: string,
  fields: LogFields,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await fn()
    logOp(operation, fields, { ok: true, durationMs: Date.now() - startedAt })
    return result
  } catch (err) {
    logOp(operation, fields, {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

// ── Sending ──────────────────────────────────────────────────────────────────

export type SendResult =
  | { ok: true; messageId?: string; durationMs: number }
  | { ok: false; error: string; durationMs: number }

class EmailTimeoutError extends Error {
  constructor(ms: number) {
    super(`Email send timed out after ${ms}ms`)
    this.name = 'EmailTimeoutError'
  }
}

/**
 * Sends one email with a hard upper bound. The SMTP transport has its own
 * connection/greeting/socket timeouts; this race is the backstop that guarantees
 * the caller (an order save) is never held open indefinitely. Never throws.
 */
export async function sendOrderEmail(
  payload: Payload,
  kind: ClaimableEmail,
  doc: Order,
  fields: LogFields,
  timeoutMs: number = getEmailSendTimeoutMs(),
): Promise<SendResult> {
  const startedAt = Date.now()

  const built = buildOrderEmail(kind, doc)
  if (!built) {
    const result = {
      ok: false as const,
      error: 'Missing customer email',
      durationMs: Date.now() - startedAt,
    }
    logOp(`send:${kind}`, fields, result)
    return result
  }

  // The receipt email carries a generated PDF. Build it *before* the send: a PDF failure
  // must abort the send so the claim is released and nothing is ever marked as sent.
  let attachments: Array<{ filename: string; content: Buffer; contentType: string }> | undefined
  if (kind === 'receipt') {
    try {
      const pdf = await generateReceiptPdf(doc)
      attachments = [
        {
          filename: `Kvittering-${doc.orderNumber}.pdf`,
          content: Buffer.from(pdf),
          contentType: 'application/pdf',
        },
      ]
    } catch (err) {
      const result = {
        ok: false as const,
        error: `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - startedAt,
      }
      logOp(`send:${kind}`, fields, result)
      return result
    }
  }

  // Fire-and-forget diagnostic; resolves from cache after the first call.
  void verifyMailTransport()

  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const sent = await Promise.race([
      payload.sendEmail({ to: built.to, ...built.template, ...(attachments ? { attachments } : {}) }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new EmailTimeoutError(timeoutMs)), timeoutMs)
      }),
    ])

    const messageId =
      sent && typeof sent === 'object' && 'messageId' in sent
        ? String((sent as { messageId?: unknown }).messageId ?? '')
        : undefined

    const result = {
      ok: true as const,
      messageId: messageId || undefined,
      durationMs: Date.now() - startedAt,
    }
    logOp(`send:${kind}`, fields, result)
    return result
  } catch (err) {
    const result = {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    }
    logOp(`send:${kind}`, fields, result)
    return result
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const SENT_AT_FIELD = {
  confirmation: 'confirmationEmailSentAt',
  admin: 'adminEmailSentAt',
  shipped: 'shippedEmailSentAt',
  receipt: 'receiptEmailSentAt',
} as const

/**
 * Field patch recording the outcome of a send, or null when nothing needs writing.
 * The `*EmailSentAt` claim was already written by the caller *before* sending, so a
 * successful send only has to add metadata — a success never needs to re-stamp it.
 */
export function outcomeData(kind: ClaimableEmail, result: SendResult): Partial<Order> | null {
  if (result.ok) {
    if (kind === 'shipped') {
      return {
        shippedEmailMessageId: result.messageId ?? null,
        shippedEmailError: null,
      } as Partial<Order>
    }
    if (kind === 'receipt') {
      return {
        receiptEmailMessageId: result.messageId ?? null,
        receiptEmailError: null,
      } as Partial<Order>
    }
    return null
  }

  // Release the claim so a retry is possible; never mark a failed send as sent.
  const data: Record<string, unknown> = { [SENT_AT_FIELD[kind]]: null }
  if (kind === 'shipped') {
    data.shippedEmailMessageId = null
    data.shippedEmailError = result.error.slice(0, 500)
  }
  if (kind === 'receipt') {
    data.receiptEmailMessageId = null
    data.receiptEmailError = result.error.slice(0, 500)
  }
  return data as Partial<Order>
}

/**
 * Writes the send outcome back onto the order.
 *
 * `req` MUST be passed. Verified against payload@3.85 internals:
 *
 *  • createLocalReq mutates and returns the *same* req, so `transactionID` carries
 *    over; initTransaction() then returns false ("we already have a transaction,
 *    we're not in charge of committing it"). No second transaction, no second pool
 *    connection.
 *  • updateByID computes `shouldCommit = !disableTransaction && await initTransaction(req)`,
 *    which is false here — the nested write cannot commit or clear the outer
 *    transaction. The PATCH stays in charge of its own commit.
 *  • The row is already write-locked by *this* transaction, so the write takes the
 *    lock it already holds and cannot block.
 *
 * Omitting `req` is what caused the production hang: the update opened a second,
 * independent transaction on another connection, which blocked forever on the row
 * lock held by the still-open outer transaction — a deadlock Postgres cannot detect
 * (the outer side waits in application code, not on a lock), so it ran until
 * Vercel's FUNCTION_INVOCATION_TIMEOUT.
 *
 * `context.skipOrderEmailHooks` stops the nested write from re-entering the claim
 * or the sender, so it can never trigger another email.
 *
 * Failures are swallowed: a throwing nested write calls killTransaction() on the
 * shared req, which would roll back the *order save itself*. We keep the payload to
 * nullable scalar columns on an already-locked row so this stays practically
 * unreachable, and log loudly if it ever happens.
 */
export async function recordEmailOutcome(
  req: PayloadRequest,
  orderId: number | string,
  data: Partial<Order>,
  fields: LogFields,
): Promise<void> {
  const startedAt = Date.now()
  try {
    await req.payload.update({
      collection: 'orders',
      id: orderId,
      data,
      req,
      context: { [SKIP_ORDER_EMAIL_HOOKS]: true } satisfies OrderEmailContext,
      overrideAccess: true,
    })
    logOp('payload.update:record-outcome', fields, { ok: true, durationMs: Date.now() - startedAt })
  } catch (err) {
    logOp('payload.update:record-outcome', fields, {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
