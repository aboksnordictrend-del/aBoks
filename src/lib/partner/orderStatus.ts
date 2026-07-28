import { COMMISSION_ORDER_STATUSES, type CommissionOrderStatus } from './constants'

/**
 * Does this order status count towards partner commission?
 *
 * An allowlist check, so it fails closed by construction: `cancelled`, `pending`, an empty
 * string, null and any status added to the order model in future all return false until this
 * list is deliberately changed. Kept apart from `./constants.ts` so that file stays free of
 * logic, and apart from `./balance.ts` so the rule can be reused by the Stage 5 statistics
 * without importing the accounting module.
 */
export function isCommissionOrderStatus(value: unknown): value is CommissionOrderStatus {
  return (
    typeof value === 'string' &&
    (COMMISSION_ORDER_STATUSES as readonly string[]).includes(value)
  )
}

export { COMMISSION_ORDER_STATUSES, type CommissionOrderStatus }
