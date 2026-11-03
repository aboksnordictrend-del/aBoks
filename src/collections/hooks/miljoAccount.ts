import {
  AuthenticationError,
  Forbidden,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeLoginHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload'
import {
  BUSINESS_CUSTOMERS_SLUG,
  MILJO_ACCOUNTS_SLUG,
  MILJO_AUTH_CONTEXT,
  MILJO_TRUSTED_ACCOUNT_CREATE,
  relationshipId,
} from '@/lib/miljo/business'
import { resolveAuthorizedBusinessCustomerId } from '@/lib/miljo/businessAccess'
import { isAdminUser } from '@/lib/security/staffAccess'

/**
 * The server-side rules of `miljo-accounts` («Miljøkontoer»).
 *
 *   • Who creates an account. An administrator, or trusted server code that says so explicitly
 *     with `req.context[MILJO_TRUSTED_ACCOUNT_CREATE] = true` — nobody else, on ANY path. This is
 *     not covered by `access.create`: Payload registers `POST /api/miljo-accounts/first-register` for
 *     every auth collection, and while the collection is empty it creates the document anonymously
 *     with `overrideAccess: true` — bypassing collection AND field access (status, verification).
 *     Without this rule anyone could create an active, «verified» account for any business customer.
 *   • Business customer. Must exist, and is permanent once the account is created: moving an
 *     account to another company would hand that company's data to whoever holds the password.
 *     (One account per business customer is the column's unique index.)
 *   • Sign-in. Only an «Aktiv» account with a verified e-mail, whose business customer is «Aktiv»,
 *     gets a token — on login and on refresh (see @/lib/miljo/businessAccess). A refusal is Payload's ordinary AuthenticationError, the same answer as a wrong
 *     password, so the response does not reveal whether the account exists or what state it is in.
 *   • Sign-in routes. Only /api/miljo/konto/* (Stage 2.2b) signs an account in; Payload's own
 *     login and refresh endpoints for this collection are refused (see guardMiljoAccountOperations).
 *   • Password reset. Payload's flow stays closed (it stores the reset token in plain text and
 *     sends its own e-mail); the Miljø routes run their own — see @/lib/miljo/account/service.
 */

export const BUSINESS_CUSTOMER_NOT_FOUND_MESSAGE = 'Fant ikke bedriftskunden.'
export const BUSINESS_CUSTOMER_LOCKED_MESSAGE =
  'Bedriftskunden kan ikke endres etter at kontoen er opprettet. Deaktiver kontoen og opprett en ny for den andre bedriften.'

type Doc = Record<string, unknown> & { id?: number | string }

function fail(req: PayloadRequest, id: unknown, path: string, message: string): never {
  throw new ValidationError({
    collection: MILJO_ACCOUNTS_SLUG,
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    errors: [{ path, message }],
    req,
  })
}

export const enforceMiljoAccountRules: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (!data) return data
  const doc = data as Doc
  const original = (operation === 'update' ? originalDoc : undefined) as Doc | undefined

  const incoming = 'businessCustomer' in doc ? relationshipId(doc.businessCustomer) : relationshipId(original?.businessCustomer)
  if (original && String(incoming) !== String(relationshipId(original.businessCustomer))) {
    fail(req, original.id, 'businessCustomer', BUSINESS_CUSTOMER_LOCKED_MESSAGE)
  }
  if (operation === 'create') {
    if (incoming == null) fail(req, undefined, 'businessCustomer', 'Velg bedriftskunde.')
    const customer = await req.payload.findByID({
      collection: BUSINESS_CUSTOMERS_SLUG,
      id: incoming,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    if (!customer) fail(req, undefined, 'businessCustomer', BUSINESS_CUSTOMER_NOT_FOUND_MESSAGE)
    doc.businessCustomer = incoming
  }
  return data
}

/** No token unless the account is active and verified AND its business customer is active. */
export const refuseInactiveLogin: CollectionBeforeLoginHook = async ({ user, req }) => {
  if ((await resolveAuthorizedBusinessCustomerId(req, user)) == null) throw new AuthenticationError(req.t)
}

/**
 * Creation only by an administrator or explicitly trusted server code (see the file header).
 * Sign-in and refresh only through the Miljø account routes, which set MILJO_AUTH_CONTEXT —
 * Payload's own endpoints would put the token in the shared `payload-token` cookie. Payload's
 * password reset stays closed: the Miljø routes run their own, with hashed one-time tokens.
 */
export const guardMiljoAccountOperations: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation === 'create' && !isAdminUser(req.user) && req.context?.[MILJO_TRUSTED_ACCOUNT_CREATE] !== true) {
    throw new Forbidden(req.t)
  }
  if (operation === 'forgotPassword' || operation === 'resetPassword') {
    throw new Forbidden(req.t)
  }
  if ((operation === 'login' || operation === 'refresh') && req.context?.[MILJO_AUTH_CONTEXT] !== true) {
    throw new Forbidden(req.t)
  }
  if (operation === 'refresh' && (await resolveAuthorizedBusinessCustomerId(req)) == null) {
    throw new AuthenticationError(req.t)
  }
  return args
}
