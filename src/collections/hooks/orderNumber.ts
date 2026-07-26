import type { CollectionBeforeValidateHook } from 'payload'
import type { Order } from '@/payload-types'
import { allocateOrderNumber } from '@/lib/orderNumber'

/**
 * Fills in `orderNumber` on create, before Payload validates the required field.
 *
 * It has to be `beforeValidate` (collection level): Payload runs field validation as part
 * of the *beforeChange* field traversal, i.e. after both collection-level beforeValidate
 * and beforeChange hooks — but a value assigned in beforeValidate is also what the rest of
 * the create sees. The admin's Ordrenummer input is read-only and therefore submits
 * nothing, so without this hook the required check rejected every manually created order.
 *
 * A number supplied by the caller is never touched: the checkout allocates its number up
 * front because Kustom needs it as `merchant_reference` before the order row exists, and
 * the webhook replays that same number. Updates are left alone entirely, so existing
 * order numbers can never be rewritten.
 */
export const assignOrderNumber: CollectionBeforeValidateHook<Order> = async ({
  data,
  operation,
  req,
}) => {
  if (operation !== 'create' || !data) return data
  if (typeof data.orderNumber === 'string' && data.orderNumber.trim() !== '') return data

  data.orderNumber = await allocateOrderNumber(req.payload)
  return data
}
