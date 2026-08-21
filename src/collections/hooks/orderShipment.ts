import { APIError, type CollectionBeforeValidateHook } from 'payload'
import type { Order } from '@/payload-types'
import {
  SHIPMENT_REQUIRED_MESSAGE,
  normalizeTrackingNumber,
  shipmentTransitionProblems,
} from '@/lib/orders/shipment'

/**
 * Resolves a field's value for this write.
 *
 * Presence, not truthiness. Payload's admin resubmits the whole document, but a REST/local
 * PATCH may send only the fields it means to change — a field absent from `data` is untouched
 * and must fall back to what is already stored, while a field present as `''` or `null` is a
 * deliberate clearing and must be read as empty.
 */
function effective(data: Partial<Order>, originalDoc: Partial<Order> | undefined, field: keyof Order): unknown {
  return field in data ? data[field] : originalDoc?.[field]
}

/**
 * Normalises the `Sendingsnummer` and refuses the save when an order is moved to «Sendt»
 * without shipment information.
 *
 * It is `beforeValidate` (collection level) so it runs before `claimOrderEmails`: a rejected
 * transition never reaches the claim, so nothing is stamped as sent and no e-mail goes out.
 * Collection hooks do not run in the admin's form-state pass, so this fires only on a real
 * save — exactly like `assignOrderNumber` above it.
 *
 * The thrown `APIError` carries per-field errors under `data.errors`, which Payload's admin
 * form dispatches onto the two fields (so each says what *it* is missing) while the error's
 * own message becomes the toast. Status 400 makes it a public, operational error rather than
 * a logged 500.
 *
 * @see shipmentTransitionProblems — when the requirement applies, and why old orders are safe.
 */
export const validateShipment: CollectionBeforeValidateHook<Order> = ({
  data,
  originalDoc,
  operation,
}) => {
  if (!data) return data

  // Store the trimmed form, so a stray space can never become a tracking block in an e-mail
  // or slip past the emptiness check below.
  if ('trackingNumber' in data) {
    data.trackingNumber = normalizeTrackingNumber(data.trackingNumber)
  }

  const problems = shipmentTransitionProblems({
    operation,
    nextStatus: (effective(data, originalDoc, 'status') ?? null) as string | null,
    previousStatus: originalDoc?.status ?? null,
    shippingCarrier: effective(data, originalDoc, 'shippingCarrier'),
    trackingNumber: effective(data, originalDoc, 'trackingNumber'),
  })

  if (problems.length > 0) {
    throw new APIError(SHIPMENT_REQUIRED_MESSAGE, 400, { errors: problems }, true)
  }

  return data
}
