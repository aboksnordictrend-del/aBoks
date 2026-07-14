import type { Payload } from 'payload'
import type { Customer, Order } from '@/payload-types'
import { SKIP_ORDER_EMAIL_HOOKS, type OrderEmailContext } from './orderEmails'

/**
 * Keeps the `customers` collection in sync with the buyer data Kustom returns on an
 * order. Safe to call more than once for the same order: a replayed webhook finds the
 * existing customer by email, never creates a second one, and never overwrites a link
 * that is already there.
 *
 * Deliberately called *after* the order write has committed, never from an Orders
 * collection hook: a nested write that throws inside a hook kills the surrounding
 * transaction and would roll back the paid order itself (see orderEmails.ts).
 */

export type CustomerDetails = {
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
}

export type SyncAction = 'created' | 'updated' | 'found'

export type SyncResult = {
  customerId: number
  action: SyncAction
  linked: boolean
}

/** Trimmed value, or undefined when there is nothing meaningful to write. */
function clean(value?: string | null): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed.length > 0 ? trimmed : undefined
}

export function normalizeEmail(email?: string | null): string | undefined {
  return clean(email)?.toLowerCase()
}

export function customerDetailsFromOrder(order: Order): CustomerDetails {
  return {
    email: order.customerInfo?.email,
    firstName: order.customerInfo?.firstName,
    lastName: order.customerInfo?.lastName,
    phone: order.customerInfo?.phone,
    address: order.customerInfo?.address,
    postalCode: order.customerInfo?.postalCode,
    city: order.customerInfo?.city,
  }
}

function relationId(value: number | { id: number } | null | undefined): number | null {
  if (value == null) return null
  return typeof value === 'object' ? value.id : value
}

/**
 * Case-insensitive lookup. `equals` is case-sensitive in Postgres, so we widen the
 * query with `like` (which the Postgres adapter maps to ILIKE, i.e. a substring match)
 * and then keep only an exact match on the normalized address.
 */
async function findCustomerByEmail(payload: Payload, email: string): Promise<Customer | null> {
  const result = await payload.find({
    collection: 'customers',
    where: { email: { like: email } },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs.find((doc) => normalizeEmail(doc.email) === email) ?? null
}

/** Only non-empty, actually-changed values — an empty field never clobbers a stored one. */
function buildCustomerPatch(existing: Customer, details: CustomerDetails): Partial<Customer> {
  const patch: Partial<Customer> = {}

  const firstName = clean(details.firstName)
  if (firstName && firstName !== existing.firstName) patch.firstName = firstName

  const lastName = clean(details.lastName)
  if (lastName && lastName !== existing.lastName) patch.lastName = lastName

  const phone = clean(details.phone)
  if (phone && phone !== existing.phone) patch.phone = phone

  const street = clean(details.address)
  const postalCode = clean(details.postalCode)
  const city = clean(details.city)

  const addressChanged =
    (street && street !== existing.address?.street) ||
    (postalCode && postalCode !== existing.address?.postalCode) ||
    (city && city !== existing.address?.city)

  if (addressChanged) {
    patch.address = {
      street: street ?? existing.address?.street,
      postalCode: postalCode ?? existing.address?.postalCode,
      city: city ?? existing.address?.city,
    }
  }

  return patch
}

/**
 * Find-or-create the customer for an order and link the order to it.
 * Returns null when the order carries no usable email.
 */
export async function syncCustomerForOrder(
  payload: Payload,
  order: Order,
  options: { dryRun?: boolean } = {},
): Promise<SyncResult | null> {
  const { dryRun = false } = options
  const details = customerDetailsFromOrder(order)
  const email = normalizeEmail(details.email)

  if (!email) {
    console.warn(
      '[customer-sync] order %s has no customer email — skipping',
      order.orderNumber ?? order.id,
    )
    return null
  }

  let customer = await findCustomerByEmail(payload, email)
  let action: SyncAction

  if (customer) {
    const patch = buildCustomerPatch(customer, details)

    if (Object.keys(patch).length > 0) {
      if (!dryRun) {
        customer = await payload.update({
          collection: 'customers',
          id: customer.id,
          data: patch,
          overrideAccess: true,
        })
      }
      action = 'updated'
      console.log(
        '[customer-sync] customer updated: id=%s email=%s fields=%s',
        customer.id,
        email,
        Object.keys(patch).join(','),
      )
    } else {
      action = 'found'
      console.log('[customer-sync] customer found: id=%s email=%s', customer.id, email)
    }
  } else {
    if (dryRun) {
      console.log('[customer-sync] would create customer: email=%s', email)
      return { customerId: -1, action: 'created', linked: relationId(order.customer) == null }
    }

    try {
      customer = await payload.create({
        collection: 'customers',
        data: {
          email,
          firstName: clean(details.firstName),
          lastName: clean(details.lastName),
          phone: clean(details.phone),
          address: {
            street: clean(details.address),
            postalCode: clean(details.postalCode),
            city: clean(details.city),
          },
        },
        overrideAccess: true,
      })
      action = 'created'
      console.log('[customer-sync] customer created: id=%s email=%s', customer.id, email)
    } catch (err) {
      // Lost a race against a concurrent webhook: the unique email index rejected us,
      // so the winner's row is now there to be reused.
      const raced = await findCustomerByEmail(payload, email)
      if (!raced) throw err
      customer = raced
      action = 'found'
      console.log('[customer-sync] customer found after create race: id=%s email=%s', customer.id, email)
    }
  }

  const linkedCustomerId = relationId(order.customer)
  let linked = false

  if (linkedCustomerId == null) {
    if (!dryRun) {
      await payload.update({
        collection: 'orders',
        id: order.id,
        data: { customer: customer.id },
        overrideAccess: true,
        // Linking must never re-enter the order-email claim/sender.
        context: { [SKIP_ORDER_EMAIL_HOOKS]: true } satisfies OrderEmailContext,
      })
    }
    linked = true
    console.log(
      '[customer-sync] order linked to customer: order=%s customer=%s',
      order.orderNumber ?? order.id,
      customer.id,
    )
  }

  // Mirror the link on the customer's order list, without dropping the existing ones.
  const existingOrderIds = (customer.orders ?? []).map((o) => relationId(o as number | Order))
  if (!existingOrderIds.includes(order.id) && !dryRun) {
    await payload.update({
      collection: 'customers',
      id: customer.id,
      data: {
        orders: [...existingOrderIds.filter((id): id is number => id != null), order.id],
      },
      overrideAccess: true,
    })
  }

  return { customerId: customer.id, action, linked }
}

/** Never lets a customer-sync failure break the order flow that called it. */
export async function syncCustomerForOrderSafe(
  payload: Payload,
  order: Order,
): Promise<SyncResult | null> {
  try {
    return await syncCustomerForOrder(payload, order)
  } catch (err) {
    console.error(
      '[customer-sync] failed for order %s: %s',
      order.orderNumber ?? order.id,
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}
