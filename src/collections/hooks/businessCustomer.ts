import {
  APIError,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
} from 'payload'
import { normalizeOrganizationNumber, validateOrganizationNumber } from '@/lib/partner/referral'
import {
  BUSINESS_CUSTOMERS_SLUG,
  MILJO_ACCOUNTS_SLUG,
  relationshipId,
} from '@/lib/miljo/business'
import { ENV_ORGANIZATIONS_SLUG } from '@/lib/miljo/constants'

/**
 * The server-side rules of `business-customers` («Bedriftskunder»).
 *
 * One collection `beforeChange` hook, so every rule holds on every path — admin, REST and the Local
 * API with or without `overrideAccess` — and runs before field validation.
 *
 *   1. Identity. The organisation number is stored as its 9 digits (spaces, «NO» and «MVA» are
 *      removed) and must pass Brønnøysund's modulus-11 check; the contact e-mail is lower-cased.
 *      The database's unique index on `organization_number` refuses a second customer for the same
 *      company.
 *   2. Orders are NOT linked here: the one authoritative link is `orders.businessCustomer`, set on
 *      the order (see ./orderBusinessCustomer) and shown here through a read-only join.
 *   3. Environmental organisation. Must exist; the unique index on the column keeps it to one
 *      business customer.
 *   4. Activation timestamp. `activatedAt` is set the first time the status becomes «Aktiv» and is
 *      never written by a client.
 *
 * Every refusal is a `ValidationError` (HTTP 400) with a Norwegian message on the field to change.
 */

type Doc = Record<string, unknown> & { id?: number | string }

const effective = (data: Doc, original: Doc | undefined, key: string): unknown =>
  key in data ? data[key] : original?.[key]

function fail(req: PayloadRequest, id: unknown, path: string, message: string): never {
  throw new ValidationError({
    collection: BUSINESS_CUSTOMERS_SLUG,
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    errors: [{ path, message }],
    req,
  })
}

export const ORGANIZATION_NOT_FOUND_MESSAGE = 'Fant ikke miljøorganisasjonen.'
export const CUSTOMER_HAS_ACCOUNT_MESSAGE =
  'Bedriftskunden kan ikke slettes fordi den har en Miljøkonto. Sett status til «Sperret» i stedet.'
export const CUSTOMER_HAS_ORDERS_MESSAGE =
  'Bedriftskunden kan ikke slettes fordi ordrer er knyttet til den. Fjern koblingen på ordrene, eller sett status til «Sperret».'

export const enforceBusinessCustomerRules: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (!data) return data
  const doc = data as Doc
  const original = (operation === 'update' ? originalDoc : undefined) as Doc | undefined
  const selfId = original?.id

  // ── 1. Identity ──
  if ('organizationNumber' in doc || operation === 'create') {
    const raw = effective(doc, original, 'organizationNumber')
    const check = validateOrganizationNumber(raw)
    if (check !== true) fail(req, selfId, 'organizationNumber', check)
    const digits = normalizeOrganizationNumber(raw)
    if (digits == null) fail(req, selfId, 'organizationNumber', 'Organisasjonsnummer må fylles ut.')
    doc.organizationNumber = digits
  }
  if (typeof doc.contactEmail === 'string') doc.contactEmail = doc.contactEmail.trim().toLowerCase()

  // ── 3. Environmental organisation ──
  if ('environmentalOrganization' in doc) {
    const orgId = relationshipId(doc.environmentalOrganization)
    doc.environmentalOrganization = orgId
    const changed = String(orgId) !== String(relationshipId(original?.environmentalOrganization))
    if (orgId != null && changed) {
      const org = await req.payload.findByID({
        collection: ENV_ORGANIZATIONS_SLUG,
        id: orgId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })
      if (!org) fail(req, selfId, 'environmentalOrganization', ORGANIZATION_NOT_FOUND_MESSAGE)
    }
  }

  // ── 4. Activation timestamp — system-written ──
  doc.activatedAt = original?.activatedAt ?? null
  if (effective(doc, original, 'status') === 'active' && doc.activatedAt == null) {
    doc.activatedAt = new Date().toISOString()
  }

  return data
}

/**
 * Refuses deleting a business customer that still has its Miljø account or linked orders — the
 * order links are history and must never disappear as a side effect. (The database backs this with
 * RESTRICT on `orders.business_customer_id`.)
 */
export const guardBusinessCustomerDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const accounts = await req.payload.count({
    collection: MILJO_ACCOUNTS_SLUG,
    where: { businessCustomer: { equals: id } },
    overrideAccess: true,
    req,
  })
  if (accounts.totalDocs > 0) throw new APIError(CUSTOMER_HAS_ACCOUNT_MESSAGE, 409)
  const orders = await req.payload.count({
    collection: 'orders',
    where: { businessCustomer: { equals: id } },
    overrideAccess: true,
    req,
  })
  if (orders.totalDocs > 0) throw new APIError(CUSTOMER_HAS_ORDERS_MESSAGE, 409)
}
