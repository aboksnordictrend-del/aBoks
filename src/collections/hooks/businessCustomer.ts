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
  isEligibleOrderStatus,
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
 *   2. Eligible orders. Every order ADDED to the list must exist, be confirmed, shipped or delivered
 *      (an invoice order qualifies once confirmed), and belong to no other business customer — one
 *      order can never make two companies eligible. Orders already on the list are not re-checked,
 *      so a later cancellation does not block unrelated edits. A partial unique index on
 *      `business_customers_rels(orders_id)` backs the last rule against simultaneous saves.
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

const ids = (value: unknown): (number | string)[] =>
  Array.isArray(value) ? value.map(relationshipId).filter((id): id is number | string => id != null) : []

export const ORDER_NOT_FOUND_MESSAGE = 'Fant ikke ordren.'
export const ORDER_NOT_ELIGIBLE_MESSAGE =
  'Ordren gir ikke tilgang: den må være bekreftet, sendt eller levert. En ordre som venter på betaling eller er kansellert kan ikke brukes.'
export const ORGANIZATION_NOT_FOUND_MESSAGE = 'Fant ikke miljøorganisasjonen.'
export const CUSTOMER_HAS_ACCOUNT_MESSAGE =
  'Bedriftskunden kan ikke slettes fordi den har en Miljøkonto. Sett status til «Sperret» i stedet.'

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

  // ── 2. Eligible orders — only the ones this save adds ──
  if ('eligibleOrders' in doc) {
    const incoming = ids(doc.eligibleOrders)
    const stored = new Set(ids(original?.eligibleOrders).map(String))
    const added = [...new Set(incoming.map(String))].filter((id) => !stored.has(id))
    doc.eligibleOrders = [...new Set(incoming.map(String))].map((id) => incoming.find((x) => String(x) === id)!)

    for (const orderId of added) {
      const order = (await req.payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      })) as { status?: unknown; orderNumber?: unknown } | null
      if (!order) fail(req, selfId, 'eligibleOrders', ORDER_NOT_FOUND_MESSAGE)
      if (!isEligibleOrderStatus(order.status)) {
        fail(req, selfId, 'eligibleOrders', `${String(order.orderNumber ?? orderId)}: ${ORDER_NOT_ELIGIBLE_MESSAGE}`)
      }
      const taken = await req.payload.find({
        collection: BUSINESS_CUSTOMERS_SLUG,
        where: {
          and: [{ eligibleOrders: { in: [orderId] } }, ...(selfId != null ? [{ id: { not_equals: selfId } }] : [])],
        },
        depth: 0,
        limit: 1,
        pagination: false,
        overrideAccess: true,
        req,
      })
      if (taken.docs.length > 0) {
        const other = taken.docs[0] as { name?: unknown }
        fail(
          req,
          selfId,
          'eligibleOrders',
          `${String(order.orderNumber ?? orderId)} er allerede knyttet til bedriftskunden «${String(other.name ?? '')}». En ordre kan bare gi tilgang til én bedrift.`,
        )
      }
    }
  }

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

/** Refuses deleting a business customer that still has its Miljø account. */
export const guardBusinessCustomerDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const accounts = await req.payload.count({
    collection: MILJO_ACCOUNTS_SLUG,
    where: { businessCustomer: { equals: id } },
    overrideAccess: true,
    req,
  })
  if (accounts.totalDocs > 0) throw new APIError(CUSTOMER_HAS_ACCOUNT_MESSAGE, 409)
}
