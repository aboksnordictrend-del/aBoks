// Server-side Purchase: claim, send, record — the whole flow the Kustom webhook calls.
//
// The one hard rule: **this can never fail the caller.** A paid order has already been
// committed by the time we get here, and no Meta outage, timeout, misconfiguration or bug in
// this file may turn that into a non-2xx webhook response that makes Kustom re-deliver — or
// worse, into an exception that skips the steps after it. Every path returns a status object;
// nothing throws.

import type { Payload } from 'payload'
import type { Order } from '@/payload-types'
import type { KustomOrder } from '@/lib/kustom'
import { MetaError } from '../errors'
import { getMetaCapiConfig, type MetaCapiConfig } from './config'
import { createMetaPurchaseClaimStore, type MetaPurchaseClaimStore } from './claim'
import {
  buildPurchaseEventPayload,
  purchaseEventId,
  type PurchaseContent,
  type PurchaseEventInput,
} from './event'
import { sendPurchaseEvent, type SendEventResult } from './send'
import type { MetaAttribution } from './attribution'

export type PurchaseOnceStatus =
  /** Meta accepted the event and the receipt is on the order. */
  | 'sent'
  /** Another delivery already sent it, or is sending it right now. Nothing to do. */
  | 'already_sent'
  /** META_PIXEL_ID / META_CAPI_ACCESS_TOKEN are not set — the integration is off. */
  | 'not_configured'
  /** No SQL executor, so the single-send guarantee cannot be honoured. Nothing is sent. */
  | 'no_claim_store'
  /** Meta refused or was unreachable. The claim was released; the next delivery retries. */
  | 'failed'

export interface PurchaseOnceResult {
  status: PurchaseOnceStatus
  eventId: string
  /** Meta's accepted-event count, on success. */
  eventsReceived?: number
  /** Token-free reason, for the caller's own log line. */
  reason?: string
}

export interface SendPurchaseOnceDeps {
  config: MetaCapiConfig | null
  store: MetaPurchaseClaimStore | null
  send?: (config: MetaCapiConfig, payload: ReturnType<typeof buildPurchaseEventPayload>) => Promise<SendEventResult>
  now?: () => Date
  /** PII-free structured log. Never the payload, never the token. */
  log?: (fields: Record<string, unknown>) => void
}

export interface SendPurchaseOnceInput extends PurchaseEventInput {
  /** The Payload order row the claim columns live on. */
  orderId: number | string
  /** Already-recorded receipt, if the caller has the order in hand. Skips the SQL round trip. */
  alreadySentEventId?: string | null
}

const defaultLog = (fields: Record<string, unknown>) =>
  console.log(JSON.stringify({ scope: 'meta-capi', ...fields }))

/**
 * Claim → send → record, with the claim released again on failure.
 *
 * The ordering matters and is the opposite of what "do not mark it sent before Meta answers"
 * would naively suggest: the claim has to be taken *before* the call, because that is the
 * only moment at which a concurrent delivery can still be stopped. What is never written
 * before Meta answers is the receipt — `meta_purchase_event_id` — and a failed call clears
 * the claim, so the order ends up exactly as it started and stays retryable.
 */
export async function sendPurchaseOnce(
  deps: SendPurchaseOnceDeps,
  input: SendPurchaseOnceInput,
): Promise<PurchaseOnceResult> {
  const eventId = purchaseEventId(input.kustomOrderId)
  const log = deps.log ?? defaultLog
  const now = deps.now ?? (() => new Date())

  const base = {
    orderId: String(input.orderId),
    kustomOrderId: input.kustomOrderId,
    orderNumber: input.orderNumber ?? null,
    eventId,
  }

  if (input.alreadySentEventId) {
    log({ event: 'skipped', reason: 'already_sent', ...base })
    return { status: 'already_sent', eventId, reason: 'already_sent' }
  }

  if (!deps.config) {
    log({ event: 'skipped', reason: 'not_configured', ...base })
    return { status: 'not_configured', eventId, reason: 'not_configured' }
  }

  if (!deps.store) {
    // Sending without a claim would risk duplicate conversions on a re-delivered webhook,
    // which is worse than a missing one — a missing conversion is visibly missing.
    log({ event: 'skipped', reason: 'no_claim_store', ...base })
    return { status: 'no_claim_store', eventId, reason: 'no_claim_store' }
  }

  const claimedAt = now().toISOString()
  let won: boolean
  try {
    won = await deps.store.claim(input.orderId, claimedAt)
  } catch (err) {
    log({
      event: 'claim-failed',
      ...base,
      error: err instanceof Error ? err.message : 'unknown',
    })
    return { status: 'failed', eventId, reason: 'claim_error' }
  }

  if (!won) {
    log({ event: 'skipped', reason: 'already_claimed', ...base })
    return { status: 'already_sent', eventId, reason: 'already_claimed' }
  }

  const payload = buildPurchaseEventPayload({
    ...input,
    eventTimeMs: input.eventTimeMs ?? now().getTime(),
    testEventCode: input.testEventCode ?? deps.config.testEventCode,
  })

  const send = deps.send ?? ((config, body) => sendPurchaseEvent(config, body))

  try {
    const result = await send(deps.config, payload)
    await deps.store.markSent(input.orderId, eventId, now().toISOString())
    log({
      event: 'sent',
      ...base,
      eventsReceived: result.eventsReceived,
      ...(result.fbTraceId ? { fbtraceId: result.fbTraceId } : {}),
      ...(payload.test_event_code ? { testEvent: true } : {}),
    })
    return { status: 'sent', eventId, eventsReceived: result.eventsReceived }
  } catch (err) {
    // Safe diagnostics only: order identifiers, the HTTP status and Meta's own error code
    // and message. Never the payload (hashed identifiers, IP, user agent) and never the token.
    const detail =
      err instanceof MetaError
        ? {
            httpStatus: err.httpStatus ?? null,
            metaCode: err.detail.code ?? null,
            metaSubcode: err.detail.errorSubcode ?? null,
            metaMessage: err.detail.message ?? null,
            fbtraceId: err.detail.fbtraceId ?? null,
          }
        : { error: err instanceof Error ? err.message : 'unknown' }

    log({ event: 'send-failed', ...base, ...detail })

    try {
      await deps.store.release(input.orderId)
    } catch (releaseErr) {
      // The claim is stuck, so this order will never retry. Loud, but still not fatal.
      log({
        event: 'release-failed',
        ...base,
        error: releaseErr instanceof Error ? releaseErr.message : 'unknown',
      })
    }

    return { status: 'failed', eventId, reason: 'meta_error' }
  }
}

/** Kustom's physical lines, in the shape `contents` wants. Øre → kroner. */
export function contentsFromKustomOrder(kustomOrder: KustomOrder): PurchaseContent[] {
  return (kustomOrder.order_lines ?? [])
    .filter((line) => line.type === 'physical')
    .map((line) => ({
      id: line.reference,
      quantity: line.quantity,
      itemPrice: line.unit_price / 100,
    }))
}

/** The attribution captured at checkout, read back off the stored order. */
export function attributionFromOrder(order: Pick<Order, 'meta'>): MetaAttribution {
  const meta = order.meta
  if (!meta) return {}
  return {
    ...(meta.fbp ? { fbp: meta.fbp } : {}),
    ...(meta.fbc ? { fbc: meta.fbc } : {}),
    ...(meta.clientIpAddress ? { clientIpAddress: meta.clientIpAddress } : {}),
    ...(meta.clientUserAgent ? { clientUserAgent: meta.clientUserAgent } : {}),
  }
}

export interface OrderPurchaseInput {
  order: Order
  kustomOrder: KustomOrder
  /** Absolute URL of the confirmation page for this deployment. */
  eventSourceUrl?: string
}

/**
 * The webhook's entry point: everything above, wired to the real config, the real database
 * and the real Graph API, with the event assembled from the confirmed order.
 *
 * The money comes from Kustom's `order_amount` — the amount actually charged — rather than
 * from any locally recomputed figure, so the conversion value can never drift from what the
 * customer paid. The identifiers come from Kustom's address too, because that is what the
 * customer typed into the payment sheet.
 */
export async function sendOrderPurchaseEvent(
  payload: Payload,
  input: OrderPurchaseInput,
): Promise<PurchaseOnceResult> {
  const { order, kustomOrder } = input
  const address = kustomOrder.billing_address ?? kustomOrder.shipping_address

  return sendPurchaseOnce(
    {
      config: getMetaCapiConfig(),
      store: createMetaPurchaseClaimStore(payload),
    },
    {
      orderId: order.id,
      kustomOrderId: kustomOrder.order_id,
      orderNumber: order.orderNumber,
      value: kustomOrder.order_amount / 100,
      email: address?.email ?? order.customerInfo?.email ?? null,
      phone: address?.phone ?? order.customerInfo?.phone ?? null,
      attribution: attributionFromOrder(order),
      contents: contentsFromKustomOrder(kustomOrder),
      alreadySentEventId: order.meta?.purchaseEventId ?? null,
      ...(input.eventSourceUrl ? { eventSourceUrl: input.eventSourceUrl } : {}),
    },
  )
}
