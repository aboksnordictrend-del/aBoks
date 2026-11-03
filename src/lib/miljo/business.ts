// aBoks Miljøregistrering — business customers and their login accounts (Stage 1 foundation).
//
// Pure: no Payload runtime import, so collections, hooks, access rules and tests share one
// definition of who a business user is and what they may reach.
//
//   • `business-customers` («Bedriftskunder») — a company that may use Miljøregistrering: its
//     identity (name, Norwegian organisation number), the contact e-mail that ownership is verified
//     against, the AB- orders that make it eligible and the environmental organisation it runs.
//   • `miljo-accounts` («Miljøkontoer») — ONE shared login per business customer. A separate Payload
//     auth collection: it is never staff (see @/lib/security/staffAccess, which requires the `users`
//     collection) and never reaches the admin panel.

export const BUSINESS_CUSTOMERS_SLUG = 'business-customers' as const
export const MILJO_ACCOUNTS_SLUG = 'miljo-accounts' as const

/* ------------------------------ business customer ------------------------------ */

export const BUSINESS_CUSTOMER_STATUSES = ['pending', 'active', 'suspended'] as const
export type BusinessCustomerStatus = (typeof BUSINESS_CUSTOMER_STATUSES)[number]

export const BUSINESS_CUSTOMER_STATUS_OPTIONS: { label: string; value: BusinessCustomerStatus }[] = [
  { label: 'Venter', value: 'pending' },
  { label: 'Aktiv', value: 'active' },
  { label: 'Sperret', value: 'suspended' },
]

/**
 * Order statuses that make an order count as an eligible purchase. Invoice orders qualify once
 * confirmed — payment is not required before activation (approved business decision) — so this is
 * every status except «Venter» (a checkout that was never paid) and «Kansellert».
 */
export const MILJO_ELIGIBLE_ORDER_STATUSES = ['confirmed', 'shipped', 'delivered'] as const

export function isEligibleOrderStatus(status: unknown): boolean {
  return typeof status === 'string' && (MILJO_ELIGIBLE_ORDER_STATUSES as readonly string[]).includes(status)
}

/**
 * `req.context` flag with which trusted server code — and only it — sets or changes
 * `orders.businessCustomer` without an administrator. Never set from a request.
 */
export const ORDER_BUSINESS_LINK_CONTEXT = 'miljoOrderBusinessLink'

/**
 * Does this order, right now, make `businessCustomerId` eligible for Miljøregistrering? Linked to
 * that business customer AND currently confirmed, shipped or delivered. A link is kept when an
 * order is later cancelled (history), so the link alone never decides — the current status does.
 */
export function orderGrantsEligibility(order: unknown, businessCustomerId: number | string): boolean {
  if (!order || typeof order !== 'object') return false
  const { businessCustomer, status } = order as { businessCustomer?: unknown; status?: unknown }
  const linked = relationshipId(businessCustomer)
  return linked != null && String(linked) === String(businessCustomerId) && isEligibleOrderStatus(status)
}

/* ------------------------------ miljø account ------------------------------ */

/**
 * `req.context` flag with which trusted server code — and only it — creates a Miljø account
 * without an administrator (e.g. the activation flow in a later stage). Never set from a request.
 */
export const MILJO_TRUSTED_ACCOUNT_CREATE = 'miljoTrustedAccountCreate'

/**
 * `req.context` flag set only by the Miljø account routes (/api/miljo/konto/*, Stage 2.2b) when
 * they sign an account in. Payload's own `/api/miljo-accounts/login` and `/refresh-token` are
 * refused without it, so a Miljø token is never placed in the admin's `payload-token` cookie
 * (docs/MILJO-SESSION-ISOLATION.md). Never set from a request.
 */
export const MILJO_AUTH_CONTEXT = 'miljoAccountAuthRoute'

export const MILJO_ACCOUNT_STATUSES = ['invited', 'active', 'disabled'] as const
export type MiljoAccountStatus = (typeof MILJO_ACCOUNT_STATUSES)[number]

export const MILJO_ACCOUNT_STATUS_OPTIONS: { label: string; value: MiljoAccountStatus }[] = [
  { label: 'Invitert', value: 'invited' },
  { label: 'Aktiv', value: 'active' },
  { label: 'Deaktivert', value: 'disabled' },
]

type AccountLike = {
  collection?: unknown
  status?: unknown
  emailVerifiedAt?: unknown
  businessCustomer?: unknown
}

/** The id of a relationship value — a raw id or a populated document. */
export function relationshipId(value: unknown): number | string | null {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

/** Authenticated through `miljo-accounts`, whatever its state. */
export function isMiljoAccountUser(user: unknown): boolean {
  return !!user && typeof user === 'object' && (user as AccountLike).collection === MILJO_ACCOUNTS_SLUG
}

/**
 * The ACCOUNT-level half of authorisation: status «Aktiv» AND a verified e-mail. Not enough on its
 * own — the business customer must be «Aktiv» too; every caller that grants access uses
 * `resolveAuthorizedBusinessCustomerId` (@/lib/miljo/businessAccess), which checks both. Read from
 * the document Payload loads on every request, so deactivating an account takes effect on its next
 * request, not when its token expires.
 */
export function accountCanAuthenticate(account: unknown): boolean {
  if (!account || typeof account !== 'object') return false
  const { status, emailVerifiedAt } = account as AccountLike
  return status === 'active' && typeof emailVerifiedAt === 'string' && emailVerifiedAt !== ''
}
