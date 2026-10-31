import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
} from 'payload'
import {
  BATTERY_DELIVERIES_SLUG,
  BATTERY_REGISTRATIONS_SLUG,
  ENV_ORGANIZATIONS_SLUG,
  isBatteryCategory,
} from '@/lib/miljo/constants'
import { generatePublicCode } from '@/lib/miljo/code'
import { lineTotal } from '@/lib/miljo/stats'

/**
 * Server rules for Miljøregistrering. They run for every write — admin form, REST and local API
 * (including overrideAccess) — so none of them depends on the admin UI behaving.
 *
 *   • Organisation: the public code is generated on create and can only change through the
 *     rotation endpoint; the PIN hash and attempt counter can only change through the PIN
 *     endpoint / SQL. «Andre» needs a description of what the container permits.
 *   • Registrations and deliveries: the originally submitted values never change.
 *   • Audit rows: append-only — no update, no delete.
 *   • Deletes: an organisation with history cannot be deleted (deactivate instead); registrations
 *     and deliveries cannot be deleted (invalidate instead).
 */

/** Context flags set only by the admin endpoints in src/collections/endpoints/miljo.ts. */
export interface MiljoContext {
  miljoRotateCode?: boolean
  miljoSetPin?: boolean
}

type Doc = Record<string, unknown>

function fail(path: string, message: string): never {
  throw new APIError(message, 400, { errors: [{ path, message }] }, true)
}

async function codeInUse(req: PayloadRequest, code: string): Promise<boolean> {
  const found = await req.payload.find({
    collection: ENV_ORGANIZATIONS_SLUG,
    where: { or: [{ publicCode: { equals: code } }, { 'codeHistory.code': { equals: code } }] },
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    select: { publicCode: true },
  })
  return found.docs.length > 0
}

export async function newUniqueCode(req: PayloadRequest): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generatePublicCode()
    if (!(await codeInUse(req, code))) return code
  }
  throw new APIError('Kunne ikke lage en unik kode. Prøv igjen.', 500, undefined, true)
}

const PROTECTED_ORG_FIELDS = ['pinHash', 'pinSetAt', 'pinEncrypted', 'pinAttemptCount', 'pinAttemptWindowStart'] as const

export const enforceOrganizationRules: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  const ctx = (context ?? {}) as MiljoContext
  const original = (originalDoc ?? {}) as Doc

  if (operation === 'create') {
    data.publicCode = await newUniqueCode(req)
    data.codeHistory = []
    for (const f of PROTECTED_ORG_FIELDS) data[f] = null
    data.pinAttemptCount = 0
  } else {
    if (!ctx.miljoRotateCode) {
      data.publicCode = original.publicCode
      data.codeHistory = original.codeHistory
    }
    // Without the PIN endpoint's flag, the stored values win. The attempt counter is owned by the
    // atomic SQL in @/lib/miljo/pinAttempts, so a form save must not write back a stale copy.
    if (!ctx.miljoSetPin) {
      for (const f of PROTECTED_ORG_FIELDS) {
        if (f === 'pinHash' || f === 'pinSetAt' || f === 'pinEncrypted') {
          if (f in original) data[f] = original[f]
          else delete data[f]
        } else delete data[f]
      }
    }
  }

  const categories = Array.isArray(data.allowedCategories) ? data.allowedCategories.filter(isBatteryCategory) : []
  data.allowedCategories = [...new Set(categories)]
  if (categories.includes('other') && !String(data.otherCategoryDescription ?? '').trim()) {
    fail(
      'otherCategoryDescription',
      '«Andre» kan bare aktiveres når det er beskrevet hvilke batterityper beholderen faktisk tar imot.',
    )
  }
  return data
}

export const guardOrganizationDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of [BATTERY_REGISTRATIONS_SLUG, BATTERY_DELIVERIES_SLUG] as const) {
    const { totalDocs } = await req.payload.count({
      collection,
      where: { organization: { equals: id } },
      overrideAccess: true,
      req,
    })
    if (totalDocs > 0) {
      throw new APIError(
        'Organisasjonen har registreringer eller leveranser og kan ikke slettes. Sett den til inaktiv i stedet.',
        400,
        undefined,
        true,
      )
    }
  }
}

const REGISTRATION_ORIGINALS = [
  'organization',
  'organizationName',
  'registeredAt',
  'submittedLines',
  'submittedTotal',
  'submissionKey',
  'method',
  'source',
] as const

/** Originals are frozen after create; the total always follows the current lines. */
export const enforceRegistrationRules: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation === 'update' && originalDoc) {
    for (const f of REGISTRATION_ORIGINALS) data[f] = (originalDoc as Doc)[f]
  }
  const lines = Array.isArray(data.lines) ? (data.lines as { quantity?: number }[]) : []
  data.totalQuantity = lineTotal(lines.map((l) => ({ quantity: Number(l.quantity) || 0 })))
  return data
}

const DELIVERY_ORIGINALS = ['organization', 'organizationName', 'registeredAt', 'submittedValues', 'submissionKey', 'source'] as const

/** «Dokumentert med kvittering» only with an attached document — on every write path. */
export const DOCUMENTED_NEEDS_DOCUMENT = '«Dokumentert med kvittering» krever at leveransen har et vedlegg.'

export const enforceDeliveryRules: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation === 'update' && originalDoc) {
    for (const f of DELIVERY_ORIGINALS) data[f] = (originalDoc as Doc)[f]
  }
  const status = data.documentationStatus ?? (originalDoc as Doc | undefined)?.documentationStatus
  const document = 'document' in data ? data.document : (originalDoc as Doc | undefined)?.document
  if (status === 'documented' && (document == null || document === '')) fail('documentationStatus', DOCUMENTED_NEEDS_DOCUMENT)
  return data
}

export const appendOnly: CollectionBeforeChangeHook = ({ data, operation }) => {
  if (operation !== 'create') throw new APIError('Endringsloggen kan ikke endres.', 403, undefined, true)
  return data
}

export const refuseDelete =
  (message: string): CollectionBeforeDeleteHook =>
  () => {
    throw new APIError(message, 403, undefined, true)
  }
