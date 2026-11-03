import { ValidationError, type CollectionBeforeChangeHook, type FieldAccess, type RelationshipField } from 'payload'
import {
  BUSINESS_CUSTOMERS_SLUG,
  ORDER_BUSINESS_LINK_CONTEXT,
  isEligibleOrderStatus,
  relationshipId,
} from '@/lib/miljo/business'
import { isAdminUser } from '@/lib/security/staffAccess'

/**
 * Orders ↔ Bedriftskunder — ONE authoritative link: `orders.businessCustomer`.
 *
 * The order holds the link (a single column), so an order can belong to at most one business
 * customer by construction — no unique index or synchronisation needed, and a change of company
 * is one atomic write. The business customer shows its orders through a read-only `join` field on
 * this column (`BusinessCustomers.orders`): there is no second writable list and no hook that
 * mirrors one side to the other, so nothing can drift or loop.
 *
 * ── Who may set it ──
 *
 * An administrator, or trusted server code that says so with `req.context[ORDER_BUSINESS_LINK_CONTEXT]`.
 * Field access hides and strips it for everyone else in the admin and REST API; this hook covers the
 * paths field access does not — the Local API with `overrideAccess` (checkout pre-create, the Kustom
 * webhook, any future server code). On those paths a value that would CHANGE the link is ignored and
 * the stored value is kept, so a forged `businessCustomer` can never be accepted and can never make a
 * checkout fail.
 *
 * ── Validation of a new link ──
 *
 *   • the business customer must exist;
 *   • the order must be eligible when it is linked: confirmed, shipped or delivered (an invoice order
 *     qualifies once confirmed). The status of the same save counts, so «confirm and link» works in
 *     one step.
 *
 * Removing the link (an administrator clearing the field) is always allowed.
 *
 * ── An order that later becomes ineligible ──
 *
 * Cancelling a linked order does NOT remove the link: it is history, and is kept. Whether an order
 * makes a company eligible is decided from its status at the time of use — see
 * `orderGrantsEligibility` in @/lib/miljo/business — never from the link alone.
 */

export const ORDER_BUSINESS_CUSTOMER_NOT_FOUND_MESSAGE = 'Fant ikke bedriftskunden.'
export const ORDER_NOT_ELIGIBLE_FOR_BUSINESS_MESSAGE =
  'Ordren kan bare knyttes til en bedriftskunde når den er bekreftet, sendt eller levert. Bekreft ordren først (det kan gjøres i samme lagring).'

const adminOnlyField: FieldAccess = ({ req }) => isAdminUser(req.user)

/** The field on `orders`. Shared with tests so they exercise the exact config. */
export const orderBusinessCustomerField: RelationshipField = {
  name: 'businessCustomer',
  type: 'relationship',
  relationTo: BUSINESS_CUSTOMERS_SLUG,
  label: 'Bedriftskunde',
  index: true,
  access: { read: adminOnlyField, create: adminOnlyField, update: adminOnlyField },
  admin: {
    position: 'sidebar',
    description:
      'Valgfritt. Bedriften ordren gjelder, for aBoks Miljøregistrering. Ordren må være bekreftet, sendt eller levert. En ordre kan bare tilhøre én bedrift.',
  },
}

type Doc = Record<string, unknown> & { id?: number | string }

function fail(req: Parameters<CollectionBeforeChangeHook>[0]['req'], id: unknown, message: string): never {
  throw new ValidationError({
    collection: 'orders',
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    errors: [{ path: 'businessCustomer', message }],
    req,
  })
}

export const enforceOrderBusinessCustomer: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (!data || !('businessCustomer' in data)) return data
  const doc = data as Doc
  const original = (operation === 'update' ? originalDoc : undefined) as Doc | undefined
  const stored = relationshipId(original?.businessCustomer)
  const incoming = relationshipId(doc.businessCustomer)

  if (String(incoming) === String(stored)) {
    doc.businessCustomer = stored
    return data
  }

  const trusted = isAdminUser(req.user) || req.context?.[ORDER_BUSINESS_LINK_CONTEXT] === true
  if (!trusted) {
    // Checkout, the Kustom webhook, an editor: never changes the link.
    doc.businessCustomer = stored
    return data
  }

  if (incoming == null) {
    doc.businessCustomer = null
    return data
  }

  const customer = await req.payload.findByID({
    collection: BUSINESS_CUSTOMERS_SLUG,
    id: incoming,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  if (!customer) fail(req, original?.id, ORDER_BUSINESS_CUSTOMER_NOT_FOUND_MESSAGE)

  const status = 'status' in doc ? doc.status : original?.status
  if (!isEligibleOrderStatus(status)) fail(req, original?.id, ORDER_NOT_ELIGIBLE_FOR_BUSINESS_MESSAGE)

  doc.businessCustomer = incoming
  return data
}
