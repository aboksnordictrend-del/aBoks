// The Purchase event body, built as a pure function so the whole shape — including what is
// deliberately absent — is unit-testable without a network call.

import type { MetaAttribution } from './attribution'
import { hashedEmail, hashedPhone } from './identity'
import { purchaseEventId } from './eventId'

// Re-exported so server callers have one import for the whole event concern. The definition
// lives in its own import-free module because the browser needs it too — see ./eventId.
export { purchaseEventId }

/** One line of the paid order, as Meta's `contents` wants it. */
export interface PurchaseContent {
  id: string
  quantity: number
  /** Unit price in kroner. */
  itemPrice: number
}

export interface PurchaseEventInput {
  kustomOrderId: string
  /** `AB-xxxxxx`. Falls back to the Kustom id if the number is not known yet. */
  orderNumber?: string | null
  /** The amount actually charged, in kroner. */
  value: number
  email?: string | null
  phone?: string | null
  attribution?: MetaAttribution | null
  contents: PurchaseContent[]
  /** Defaults to now. Injectable so the payload is deterministic in tests. */
  eventTimeMs?: number
  eventSourceUrl?: string
  /** Only ever passed when META_TEST_EVENT_CODE is set. */
  testEventCode?: string
}

export const DEFAULT_EVENT_SOURCE_URL = 'https://aboks.no/kasse/bekreftelse'

export interface MetaUserData {
  em?: string
  ph?: string
  client_ip_address?: string
  client_user_agent?: string
  fbp?: string
  fbc?: string
}

export interface MetaPurchaseEvent {
  event_name: 'Purchase'
  event_time: number
  event_id: string
  action_source: 'website'
  event_source_url: string
  user_data: MetaUserData
  custom_data: {
    value: number
    currency: 'NOK'
    order_id: string
    content_type: 'product'
    contents: Array<{ id: string; quantity: number; item_price: number }>
  }
}

export interface MetaPurchasePayload {
  data: [MetaPurchaseEvent]
  test_event_code?: string
}

/**
 * `user_data` with every unusable field left out.
 *
 * Meta treats a present-but-empty match key as a key that matches nobody, and an unhashed or
 * badly normalized one the same way — so the rule is: a field is either a correctly hashed,
 * non-empty value or it is not in the object at all. `em`/`ph` are hashed here and nowhere
 * else, which keeps the plaintext from ever reaching a caller that might log it.
 */
export function buildUserData(input: {
  email?: string | null
  phone?: string | null
  attribution?: MetaAttribution | null
}): MetaUserData {
  const em = hashedEmail(input.email)
  const ph = hashedPhone(input.phone)
  const a = input.attribution ?? {}

  return {
    ...(em ? { em } : {}),
    ...(ph ? { ph } : {}),
    ...(a.clientIpAddress ? { client_ip_address: a.clientIpAddress } : {}),
    ...(a.clientUserAgent ? { client_user_agent: a.clientUserAgent } : {}),
    ...(a.fbp ? { fbp: a.fbp } : {}),
    ...(a.fbc ? { fbc: a.fbc } : {}),
  }
}

/**
 * The complete request body.
 *
 * `test_event_code` sits at the top level (not inside the event) and is added only when the
 * env var is set — an empty or stale code sent to production would divert real conversions
 * into the Test Events tool, where they do not count.
 */
export function buildPurchaseEventPayload(input: PurchaseEventInput): MetaPurchasePayload {
  const eventTimeMs = input.eventTimeMs ?? Date.now()

  const event: MetaPurchaseEvent = {
    event_name: 'Purchase',
    event_time: Math.floor(eventTimeMs / 1000),
    event_id: purchaseEventId(input.kustomOrderId),
    action_source: 'website',
    event_source_url: input.eventSourceUrl ?? DEFAULT_EVENT_SOURCE_URL,
    user_data: buildUserData(input),
    custom_data: {
      value: input.value,
      currency: 'NOK',
      order_id: input.orderNumber?.trim() || input.kustomOrderId,
      content_type: 'product',
      contents: input.contents.map((line) => ({
        id: line.id,
        quantity: line.quantity,
        item_price: line.itemPrice,
      })),
    },
  }

  return {
    data: [event],
    ...(input.testEventCode ? { test_event_code: input.testEventCode } : {}),
  }
}
