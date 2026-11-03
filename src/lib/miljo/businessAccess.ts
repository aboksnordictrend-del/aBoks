import type { PayloadRequest } from 'payload'
import {
  BUSINESS_CUSTOMERS_SLUG,
  accountCanAuthenticate,
  isMiljoAccountUser,
  relationshipId,
} from './business'

/**
 * The ONE server-side answer to «which business customer may this Miljø account act for right
 * now?» — used by login, token refresh and every access rule that lets a business user see data.
 *
 * An account is authorised only when ALL of these hold, checked against the database on every
 * request (never trusted from the token or the request):
 *
 *   1. it is a `miljo-accounts` login;
 *   2. the account is «Aktiv» and its e-mail is verified;
 *   3. its business customer exists and is «Aktiv».
 *
 * So suspending a business customer («Sperret») — or leaving it «Venter» — closes every one of its
 * accounts on their next request, without touching the accounts themselves.
 *
 * The answer is memoised per request object: Payload calls access functions several times in one
 * request (collection, then fields), and the business customer should be read once.
 */

const memo = new WeakMap<object, Promise<number | string | null>>()

export const BUSINESS_CUSTOMER_ACCESS_STATUS = 'active'

export function resolveAuthorizedBusinessCustomerId(
  req: PayloadRequest,
  account: unknown = req.user,
): Promise<number | string | null> {
  if (!isMiljoAccountUser(account) || !accountCanAuthenticate(account)) return Promise.resolve(null)
  const customerId = relationshipId((account as { businessCustomer?: unknown }).businessCustomer)
  if (customerId == null) return Promise.resolve(null)

  // Keyed by the account object: Payload loads `req.user` afresh on every request, and the login
  // check passes the document it just loaded — so an answer is never reused across requests or
  // between two different principals.
  const key = account as object
  const cached = memo.get(key)
  if (cached) return cached

  const answer = req.payload
    .findByID({
      collection: BUSINESS_CUSTOMERS_SLUG,
      id: customerId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    .then((customer) =>
      customer && (customer as { status?: unknown }).status === BUSINESS_CUSTOMER_ACCESS_STATUS ? customerId : null,
    )
    .catch(() => null)
  memo.set(key, answer)
  return answer
}
