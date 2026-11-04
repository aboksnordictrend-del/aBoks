import type { PayloadRequest } from 'payload'
import {
  BUSINESS_CUSTOMERS_SLUG,
  MILJO_ELIGIBLE_ORDER_STATUSES,
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
 *   3. its business customer exists and is «Aktiv» — «Sperret» is an administrator's block and
 *      always wins;
 *   4. the business customer's access basis holds: either an administrator granted it access by
 *      agreement (`accessBasis: 'agreement'`, Stage 2.5 — municipalities and pilots without a web
 *      order), or it has at least one linked order that is confirmed, shipped or delivered. With a
 *      purchase basis, access lasts as long as the company has a valid aBoks purchase: when every
 *      linked order is «Kansellert» (the project's only record of a cancellation or full refund),
 *      access pauses by itself, and a newly linked purchase restores it — no state to keep in sync,
 *      and the registration history is never touched. Partial refunds are not modelled.
 *
 * So suspending a business customer — or leaving it «Venter», or losing its last valid order —
 * closes every one of its accounts on their next request, without touching the accounts.
 *
 * The answer is memoised per request object: Payload calls access functions several times in one
 * request (collection, then fields), and the business customer should be read once.
 */

const memo = new WeakMap<object, Promise<number | string | null>>()

export const BUSINESS_CUSTOMER_ACCESS_STATUS = 'active'

/** Does this business customer have at least one linked, currently valid order? */
export async function hasValidLinkedOrder(req: PayloadRequest, customerId: number | string): Promise<boolean> {
  const result = await req.payload.count({
    collection: 'orders',
    where: { and: [{ businessCustomer: { equals: customerId } }, { status: { in: [...MILJO_ELIGIBLE_ORDER_STATUSES] } }] },
    overrideAccess: true,
    req,
  })
  return result.totalDocs > 0
}

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

  const answer = (async () => {
    const customer = await req.payload.findByID({
      collection: BUSINESS_CUSTOMERS_SLUG,
      id: customerId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    if (!customer || (customer as { status?: unknown }).status !== BUSINESS_CUSTOMER_ACCESS_STATUS) return null
    if ((customer as { accessBasis?: unknown }).accessBasis === 'agreement') return customerId
    return (await hasValidLinkedOrder(req, customerId)) ? customerId : null
  })().catch(() => null)
  memo.set(key, answer)
  return answer
}
