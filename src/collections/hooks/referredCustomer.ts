import {
  APIError,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
} from 'payload'
import {
  OPEN_REFERRED_CUSTOMER_STATUSES,
  isOpenReferredCustomerStatus,
  normalizeCustomerName,
  registrationKey,
} from '@/lib/partner/referral'

/**
 * The server-side rules of `referred-customers` («Henviste kunder»).
 *
 * One collection `beforeChange` hook, because every rule needs the stored document and some need
 * other documents — and because collection hooks run on every path: the admin, REST and the Local
 * API with or without `overrideAccess`. Collection `beforeChange` runs BEFORE field validation, so
 * the derived keys below are in place when the document is saved.
 *
 *   1. Derived keys. `registrationKey` and `nameKey` are always recomputed here from the visible
 *      fields; a value sent by a client is overwritten, never trusted.
 *   2. Partner. A NEW assignment — on create, or when the partner is changed — must be an ACTIVE,
 *      REGULAR partner. An existing assignment stays valid after its partner is paused or ended,
 *      so the record (and its sales history) stays editable.
 *   3. Lock. Partner and category can be corrected until the first sale is registered; after that
 *      they are refused, so a sale's commission history always belongs to the partner and the
 *      category it was earned under.
 *   4. Duplicates. Only between OPEN records (pending / approved):
 *        • same registration number → hard block. The administrator resolves it by setting the
 *          existing record to «Inaktiv» or «Avvist» first; nothing is reassigned silently.
 *        • same name, where the registration numbers do not prove two different companies →
 *          blocked until the administrator ticks «Bekreft: ikke duplikat» and gives a reason. The
 *          confirmation is stored for that exact name + registration; changing either resets it
 *          (and its reason), so an old confirmation can never authorise a new conflict.
 *      A database partial unique index on `registration_key` (open records only) backs the first
 *      rule against two simultaneous saves.
 *
 * Every refusal is a `ValidationError` (HTTP 400) with a Norwegian message on the field the
 * administrator has to change.
 */

export const PARTNER_NOT_ELIGIBLE_MESSAGE =
  'Kunden kan bare knyttes til en aktiv vanlig partner. Nettbutikker / forhandlere, partnere på pause og avsluttede partnere kan ikke velges.'

export const PARTNER_LOCKED_MESSAGE =
  'Partneren kan ikke endres etter at det er registrert salg på kunden. Sett kunden til «Inaktiv» og opprett en ny registrering dersom kunden skal flyttes.'

export const CATEGORY_LOCKED_MESSAGE =
  'Kategorien kan ikke endres etter at det er registrert salg på kunden.'

export const CUSTOMER_HAS_SALES_MESSAGE =
  'Kunden kan ikke slettes fordi det er registrert salg på den. Sett status til «Inaktiv» i stedet.'

export const DUPLICATE_REASON_MESSAGE = 'Skriv hvorfor dette ikke er et duplikat.'

type Doc = Record<string, unknown> & { id?: number | string }

const relationshipId = (value: unknown): number | string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

const sameId = (a: unknown, b: unknown) => {
  const x = relationshipId(a)
  const y = relationshipId(b)
  return x == null ? y == null : y != null && String(x) === String(y)
}

/** The value a save will leave on the document: the incoming one if sent, the stored one otherwise. */
const effective = (data: Doc, original: Doc | undefined, key: string): unknown =>
  key in data ? data[key] : original?.[key]

const hasText = (value: unknown) => typeof value === 'string' && value.trim() !== ''

/** Number of sales registered on a customer, in any status. */
export async function countReferralSales(req: PayloadRequest, customerId: number | string): Promise<number> {
  const result = await req.payload.count({
    collection: 'referral-sales',
    where: { referredCustomer: { equals: customerId } },
    overrideAccess: true,
    req,
  })
  return result.totalDocs
}

function fail(req: PayloadRequest, id: unknown, path: string, message: string): never {
  throw new ValidationError({
    collection: 'referred-customers',
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    errors: [{ path, message }],
    req,
  })
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Venter',
  approved: 'Godkjent',
  rejected: 'Avvist',
  inactive: 'Inaktiv',
}

/** «Navn» (partner Ola, status Godkjent) — enough for the administrator to find the record. */
function describe(doc: Doc): string {
  const partner = doc.partner as { name?: unknown } | null | undefined
  const partnerName = partner && typeof partner === 'object' && hasText(partner.name) ? String(partner.name) : 'ukjent partner'
  const status = STATUS_LABEL[String(doc.status)] ?? String(doc.status)
  return `«${String(doc.name ?? '')}» (id ${String(doc.id)}, partner ${partnerName}, status ${status})`
}

async function findOpen(req: PayloadRequest, where: Record<string, unknown>, selfId: unknown): Promise<Doc[]> {
  const and: Record<string, unknown>[] = [where, { status: { in: [...OPEN_REFERRED_CUSTOMER_STATUSES] } }]
  if (selfId != null) and.push({ id: { not_equals: selfId } })
  const result = await req.payload.find({
    collection: 'referred-customers',
    where: { and } as never,
    depth: 1,
    limit: 5,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return result.docs as unknown as Doc[]
}

export const enforceReferredCustomerRules: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data) return data
  const doc = data as Doc
  const original = (operation === 'update' ? originalDoc : undefined) as Doc | undefined
  const selfId = original?.id

  // ── 1. Derived keys — always recomputed, never taken from the request ──
  const name = effective(doc, original, 'name')
  const regKey = registrationKey(effective(doc, original, 'organizationNumber'), effective(doc, original, 'country'))
  const nameKey = normalizeCustomerName(name)
  doc.registrationKey = regKey
  doc.nameKey = nameKey

  // ── 2. Partner eligibility, for a new assignment only ──
  const partnerChanged = operation === 'create' || ('partner' in doc && !sameId(doc.partner, original?.partner))
  const partnerId = relationshipId(effective(doc, original, 'partner'))
  if (partnerChanged && partnerId != null) {
    const partner = (await req.payload.findByID({
      collection: 'partners',
      id: partnerId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })) as { partnerType?: unknown; status?: unknown } | null
    if (!partner || partner.partnerType !== 'regular' || partner.status !== 'active') {
      fail(req, selfId, 'partner', PARTNER_NOT_ELIGIBLE_MESSAGE)
    }
  }

  // ── 3. Partner and category lock once a sale exists ──
  const categoryChanged = operation === 'update' && 'category' in doc && doc.category !== original?.category
  if (operation === 'update' && selfId != null && (partnerChanged || categoryChanged)) {
    const sales = await countReferralSales(req, selfId)
    if (sales > 0) {
      fail(req, selfId, partnerChanged ? 'partner' : 'category', partnerChanged ? PARTNER_LOCKED_MESSAGE : CATEGORY_LOCKED_MESSAGE)
    }
  }

  // ── 4. Duplicates among open records ──
  //
  // The name-match confirmation belongs to one identity: the name and registration it was given
  // for (`duplicateConfirmedFor`). The checkbox itself is an action for a single save and is
  // always stored unticked, so a form that resends a stale tick cannot re-authorise anything.
  const identity = `${nameKey ?? ''}|${regKey ?? ''}`
  const storedIdentity = `${(original?.nameKey as string | null | undefined) ?? ''}|${(original?.registrationKey as string | null | undefined) ?? ''}`
  const identityChanged = operation === 'create' || identity !== storedIdentity
  const freshConfirmation = doc.duplicateConfirmed === true
  doc.duplicateConfirmed = false

  // System-written; a client value is never trusted.
  doc.duplicateConfirmedFor = original?.duplicateConfirmedFor ?? null
  doc.duplicateConfirmedAt = original?.duplicateConfirmedAt ?? null
  doc.duplicateConfirmedBy = relationshipId(original?.duplicateConfirmedBy)

  // A changed identity resets any confirmation given for the old one — and its explanation, which
  // stays readable in the version history. A tick in this same save is a new decision and keeps
  // the reason typed with it.
  if (identityChanged && doc.duplicateConfirmedFor !== identity) {
    doc.duplicateConfirmedFor = null
    doc.duplicateConfirmedAt = null
    doc.duplicateConfirmedBy = null
    if (!freshConfirmation) doc.duplicateReason = null
  }

  const status = effective(doc, original, 'status')
  if (!isOpenReferredCustomerStatus(status)) return data
  if (!identityChanged && isOpenReferredCustomerStatus(original?.status)) return data

  if (regKey) {
    const same = await findOpen(req, { registrationKey: { equals: regKey } }, selfId)
    if (same.length > 0) {
      fail(
        req,
        selfId,
        'organizationNumber',
        `Denne kunden er allerede registrert: ${same.map(describe).join('; ')}. Sett den eksisterende registreringen til «Inaktiv» eller «Avvist» før kunden kan registreres på nytt.`,
      )
    }
  }

  if (nameKey) {
    const sameName = (await findOpen(req, { nameKey: { equals: nameKey } }, selfId)).filter(
      // Two different registration numbers prove two different companies with the same name.
      (other) => !(regKey && other.registrationKey && other.registrationKey !== regKey),
    )
    if (sameName.length > 0 && doc.duplicateConfirmedFor !== identity) {
      if (!freshConfirmation) {
        fail(
          req,
          selfId,
          'duplicateConfirmed',
          `En kunde med samme navn er allerede registrert: ${sameName.map(describe).join('; ')}. Kontroller at dette ikke er samme kunde, kryss av for «Bekreft: ikke duplikat» og skriv en begrunnelse.`,
        )
      }
      if (!hasText(effective(doc, original, 'duplicateReason'))) {
        fail(req, selfId, 'duplicateReason', DUPLICATE_REASON_MESSAGE)
      }
      doc.duplicateConfirmedFor = identity
      doc.duplicateConfirmedAt = new Date().toISOString()
      doc.duplicateConfirmedBy = relationshipId(req.user?.id)
    }
  }

  return data
}

/** Refuses deleting a customer that sales are registered on — that would orphan commission history. */
export const guardReferredCustomerDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if ((await countReferralSales(req, id)) > 0) throw new APIError(CUSTOMER_HAS_SALES_MESSAGE, 409)
}
