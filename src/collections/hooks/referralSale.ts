import {
  APIError,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type PayloadRequest,
  type Where,
} from 'payload'
import { oereToKr, toOere } from '@/lib/money'
import {
  SALE_REQUIRES_CUSTOMER_STATUS,
  computeSaleCommission,
  deriveCommissionStatus,
  isReferralCategory,
  isSalePaymentStatus,
  toReferralSnapshotKr,
  validatePaymentTransition,
  validatePromoOverlap,
} from '@/lib/partner/referral'
import { lockSalePayoutLink } from '@/lib/partner/referralLocks'

/**
 * The server-side rules of `referral-sales` («Henvisningssalg»).
 *
 * One collection `beforeChange` hook, so every rule holds on every path — admin, REST and the
 * Local API with or without `overrideAccess` — and runs before field validation.
 *
 * ── What the administrator decides, and what the server decides ──
 *
 * The administrator types the sale: customer, date, references, the amounts, the VAT treatment,
 * whether it earns commission, the rate, and the PAYMENT status. Everything else is derived here
 * and any client value for it is overwritten: the partner and category (from the customer), the
 * commission base and amount, the COMMISSION status, the closing date, the promo commission found
 * on a linked order, the payout link (Stage 4 writes it, through `REFERRAL_PAYOUT_CONTEXT`) and who
 * registered the sale.
 *
 * ── Locked financial history ──
 *
 * While the payment status is «Venter på betaling» the sale can be corrected freely. From the
 * moment it is «Betalt», «Kansellert» or «Refundert» every financial field is frozen: only the
 * payment status may move on (paid → refunded, or paid → pending to undo a mistake before any
 * payout) and the internal note may change. A correction is a NEW sale pointing at the original
 * through «Korrigerer salg», after the original has been refunded or cancelled — the original is
 * never rewritten. Version history keeps every save.
 *
 * ── Double commission ──
 *
 *   • A Payload order can carry at most one active (pending or paid) referral sale. A database
 *     partial unique index on `order_id` backs this up (Stage 6).
 *   • If the linked order already produced promo-code commission, a sale that would earn
 *     commission too is refused until the administrator explicitly allows it with a reason.
 *   • An external reference that is the number of a webshop order must be linked as that order,
 *     so the two checks above cannot be bypassed by typing the order number as free text.
 */

export const REFERRAL_SALES = 'referral-sales'

/** `req.context` flag with which the Stage 4 payout endpoint — and only it — writes `payout`. */
export const REFERRAL_PAYOUT_CONTEXT = 'referralPayoutWrite'

export const CUSTOMER_NOT_APPROVED_MESSAGE =
  'Salg kan bare registreres på en godkjent henvist kunde. Sett kunden til «Godkjent» først.'

export const SALE_DELETE_MESSAGE =
  'Bare salg som fortsatt venter på betaling kan slettes. Et betalt, kansellert eller refundert salg er regnskapshistorikk – registrer en korreksjon i stedet.'

/** Frozen once the payment status has left «Venter på betaling». Label for the error message. */
export const LOCKED_FIELDS: Record<string, string> = {
  referredCustomer: 'Henvist kunde',
  saleDate: 'Salgsdato',
  order: 'Ordre',
  externalReference: 'Faktura- / ordrenummer',
  invoicedTotal: 'Fakturert beløp',
  shippingAmount: 'Frakt',
  otherExcludedAmount: 'Andre tillegg',
  vatTreatment: 'MVA-behandling',
  vatAmount: 'MVA-beløp',
  commissionEligibility: 'Provisjon',
  commissionRate: 'Provisjonssats',
  rateOverrideReason: 'Begrunnelse for sats',
  allowPromoOverlap: 'Tillat provisjon i tillegg til promokode',
  promoOverlapReason: 'Begrunnelse for dobbel provisjon',
  correctsSale: 'Korrigerer salg',
  paidAt: 'Betalt dato',
}

const MONEY_FIELDS = new Set(['invoicedTotal', 'shippingAmount', 'otherExcludedAmount', 'vatAmount'])
const RELATION_FIELDS = new Set(['referredCustomer', 'order', 'correctsSale'])
const DATE_FIELDS = new Set(['saleDate', 'paidAt'])

type Doc = Record<string, unknown> & { id?: number | string }

export const relationshipId = (value: unknown): number | string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

const effective = (data: Doc, original: Doc | undefined, key: string): unknown =>
  key in data ? data[key] : original?.[key]

const hasText = (value: unknown) => typeof value === 'string' && value.trim() !== ''
const text = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null)

/** The comparable form of a locked field, so a resubmitted unchanged form is never "a change". */
export function comparable(field: string, value: unknown): unknown {
  if (MONEY_FIELDS.has(field)) {
    return typeof value === 'number' && Number.isFinite(value) ? toOere(value) : null
  }
  if (RELATION_FIELDS.has(field)) {
    const id = relationshipId(value)
    return id == null ? null : String(id)
  }
  if (DATE_FIELDS.has(field)) {
    if (value == null || value === '') return null
    const ms = new Date(value as string).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (field === 'allowPromoOverlap') return value === true
  if (field === 'commissionRate') {
    return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null
  }
  return text(value)
}

function fail(req: PayloadRequest, id: unknown, path: string, message: string): never {
  throw new ValidationError({
    collection: REFERRAL_SALES,
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    errors: [{ path, message }],
    req,
  })
}

/** «Elkjøp Lørenskog – 17.10.2026»: the sale's title in lists and relationship pickers. */
export function saleTitle(customerName: unknown, saleDate: unknown): string {
  const name = hasText(customerName) ? String(customerName).trim() : 'Ukjent kunde'
  const ms = saleDate == null ? Number.NaN : new Date(saleDate as string).getTime()
  if (!Number.isFinite(ms)) return name
  const date = new Date(ms).toLocaleDateString('nb-NO', {
    timeZone: 'Europe/Oslo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  return `${name} – ${date}`
}

const ACTIVE_PAYMENT_STATUSES = ['pending', 'paid']

/** Up to five sales matching `where`, as plain records. */
async function findSales(req: PayloadRequest, where: Record<string, unknown>): Promise<Doc[]> {
  const result = await req.payload.find({
    collection: 'referral-sales',
    where: where as Where,
    depth: 0,
    limit: 5,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return result.docs as unknown as Doc[]
}

const notSelf = (selfId: unknown) => (selfId == null ? [] : [{ id: { not_equals: selfId } }])

/** Promo-code commission the order already produced, in øre. Only partner usages count. */
async function promoCommissionOnOrder(req: PayloadRequest, orderId: number | string): Promise<number> {
  const result = await req.payload.find({
    collection: 'promo-code-usages',
    where: { order: { equals: orderId } },
    depth: 0,
    limit: 100,
    pagination: false,
    overrideAccess: true,
    req,
  })
  return (result.docs as { isPartnerUsage?: unknown; commissionAmount?: unknown }[]).reduce((sum, usage) => {
    const amount = usage.commissionAmount
    return usage.isPartnerUsage === true && typeof amount === 'number' && Number.isFinite(amount) && amount > 0
      ? sum + toOere(amount)
      : sum
  }, 0)
}

export const enforceReferralSaleRules: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
  context,
}) => {
  if (!data) return data
  const doc = data as Doc
  const original = (operation === 'update' ? originalDoc : undefined) as Doc | undefined
  const selfId = original?.id

  // ── System fields: never taken from the request ──
  const payoutWrite = context?.[REFERRAL_PAYOUT_CONTEXT] === true
  let storedPayout = relationshipId(original?.payout)

  // A payment-status change on a stored sale re-reads the payout link under a row lock, so a
  // refund racing a payout sees the committed payout (and gets its clawback) instead of the
  // stale copy Payload read before the payout was written. See `@/lib/partner/referralLocks`.
  if (original && selfId != null && 'paymentStatus' in doc && doc.paymentStatus !== original.paymentStatus) {
    const locked = await lockSalePayoutLink(req, selfId)
    if (locked) storedPayout = locked.payoutId
  }

  doc.payout = payoutWrite ? relationshipId(doc.payout) : storedPayout
  const paidOut = storedPayout != null
  doc.createdBy = original ? relationshipId(original.createdBy) : relationshipId(req.user?.id)
  doc.currency = 'NOK'
  for (const key of ['partner', 'category', 'title', 'commissionBase', 'commissionAmount', 'promoCommissionOnOrder', 'closedAt']) {
    doc[key] = original?.[key] ?? null
  }
  doc.partner = relationshipId(doc.partner)

  // ── Payment status transition ──
  const storedPayment = original?.paymentStatus
  const payment = effective(doc, original, 'paymentStatus') ?? 'pending'
  doc.paymentStatus = payment
  const transition = validatePaymentTransition(original ? storedPayment : undefined, payment, { paidOut })
  if (transition !== true) fail(req, selfId, 'paymentStatus', transition)

  // ── Locked financial history ──
  const locked = isSalePaymentStatus(storedPayment) && storedPayment !== 'pending'
  if (locked && original) {
    const changed = Object.keys(LOCKED_FIELDS).filter(
      (field) => field in doc && comparable(field, doc[field]) !== comparable(field, original[field]),
    )
    if (changed.length > 0) {
      fail(
        req,
        selfId,
        changed[0],
        `Salget er låst fordi det er ${storedPayment === 'paid' ? 'betalt' : 'avsluttet'}. Disse feltene kan ikke endres: ${changed.map((f) => LOCKED_FIELDS[f]).join(', ')}. Registrer en korreksjon: sett salget til «Refundert» og registrer et nytt salg som korrigerer det.`,
      )
    }
  } else {
    await applyOpenSaleRules({ doc, original, operation, req, selfId, payment })
  }

  // ── Derived status and dates ──
  doc.commissionStatus = deriveCommissionStatus({ paymentStatus: payment, paidOut: payoutWrite ? doc.payout != null : paidOut })
  if (payment === 'paid' && effective(doc, original, 'paidAt') == null) doc.paidAt = new Date().toISOString()
  if (payment === 'pending') doc.paidAt = null
  if ((payment === 'cancelled' || payment === 'refunded') && storedPayment !== payment) {
    doc.closedAt = new Date().toISOString()
  }

  return data
}

/** Everything that may only happen while the sale is still «Venter på betaling» (or new). */
async function applyOpenSaleRules(args: {
  doc: Doc
  original: Doc | undefined
  operation: string
  req: PayloadRequest
  selfId: unknown
  payment: unknown
}) {
  const { doc, original, operation, req, selfId, payment } = args

  // ── Customer → partner, category, title ──
  const customerId = relationshipId(effective(doc, original, 'referredCustomer'))
  if (customerId == null) fail(req, selfId, 'referredCustomer', 'Velg henvist kunde.')
  const customer = (await req.payload.findByID({
    collection: 'referred-customers',
    id: customerId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as { id: number | string; name?: unknown; partner?: unknown; category?: unknown; status?: unknown } | null
  if (!customer) fail(req, selfId, 'referredCustomer', 'Fant ikke den henviste kunden.')

  const customerChanged = operation === 'create' || String(customerId) !== String(relationshipId(original?.referredCustomer))
  if (customerChanged && customer.status !== SALE_REQUIRES_CUSTOMER_STATUS) {
    fail(req, selfId, 'referredCustomer', CUSTOMER_NOT_APPROVED_MESSAGE)
  }
  if (!isReferralCategory(customer.category) || relationshipId(customer.partner) == null) {
    fail(req, selfId, 'referredCustomer', 'Den henviste kunden mangler partner eller kategori.')
  }
  doc.referredCustomer = customerId
  doc.partner = relationshipId(customer.partner)
  doc.category = customer.category
  doc.title = saleTitle(customer.name, effective(doc, original, 'saleDate'))
  const category = customer.category

  // ── Commission: the same function the live preview in the admin form uses ──
  const result = computeSaleCommission({
    category,
    commissionEligibility: effective(doc, original, 'commissionEligibility'),
    commissionRate: effective(doc, original, 'commissionRate'),
    rateOverrideReason: effective(doc, original, 'rateOverrideReason'),
    invoicedTotal: effective(doc, original, 'invoicedTotal'),
    shippingAmount: effective(doc, original, 'shippingAmount'),
    otherExcludedAmount: effective(doc, original, 'otherExcludedAmount'),
    vatTreatment: effective(doc, original, 'vatTreatment'),
    vatAmount: effective(doc, original, 'vatAmount'),
  })
  if (!result.ok) fail(req, selfId, result.field, result.message)
  doc.commissionEligibility = result.eligibility
  doc.commissionRate = result.rate
  const commission = { appliedRate: result.eligibility === 'eligible' ? result.rate : 0, commissionAmountOere: result.commissionOere }
  Object.assign(doc, toReferralSnapshotKr({ baseOere: result.baseOere, commission }))

  const active = ACTIVE_PAYMENT_STATUSES.includes(String(payment))

  // ── Linked webshop order: one active sale, and no silent double commission ──
  const orderId = relationshipId(effective(doc, original, 'order'))
  doc.order = orderId
  const externalReference = text(effective(doc, original, 'externalReference'))
  doc.externalReference = externalReference

  if (orderId == null && externalReference) {
    const orders = await req.payload.find({
      collection: 'orders',
      where: { orderNumber: { equals: externalReference } },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      req,
    })
    if (orders.docs.length > 0) {
      fail(
        req,
        selfId,
        'externalReference',
        `«${externalReference}» er en ordre fra nettbutikken. Velg den i feltet «Ordre» i stedet, slik at dobbel provisjon kan kontrolleres.`,
      )
    }
  }

  doc.promoCommissionOnOrder = null
  if (orderId != null) {
    if (active) {
      const others = await findSales(req, {
        and: [{ order: { equals: orderId } }, { paymentStatus: { in: ACTIVE_PAYMENT_STATUSES } }, ...notSelf(selfId)],
      })
      if (others.length > 0) {
        fail(
          req,
          selfId,
          'order',
          `Ordren er allerede registrert som henvisningssalg: «${String(others[0].title ?? others[0].id)}». Én ordre kan bare gi én henvisningsprovisjon.`,
        )
      }
    }
    const promoOere = await promoCommissionOnOrder(req, orderId)
    doc.promoCommissionOnOrder = promoOere > 0 ? oereToKr(promoOere) : null
    const overlap = validatePromoOverlap({
      promoCommissionOere: promoOere,
      referralCommissionOere: commission.commissionAmountOere,
      allowDouble: effective(doc, original, 'allowPromoOverlap'),
      reason: effective(doc, original, 'promoOverlapReason'),
    })
    if (overlap !== true) {
      fail(req, selfId, effective(doc, original, 'allowPromoOverlap') === true ? 'promoOverlapReason' : 'allowPromoOverlap', overlap)
    }
  }

  // ── The same invoice registered twice on one customer ──
  if (externalReference && active) {
    const same = await findSales(req, {
      and: [
        { referredCustomer: { equals: customerId } },
        { externalReference: { equals: externalReference } },
        { paymentStatus: { in: ACTIVE_PAYMENT_STATUSES } },
        ...notSelf(selfId),
      ],
    })
    if (same.length > 0) {
      fail(
        req,
        selfId,
        'externalReference',
        `Faktura- / ordrenummeret «${externalReference}» er allerede registrert på denne kunden: «${String(same[0].title ?? same[0].id)}».`,
      )
    }
  }

  // ── Correction of an earlier sale ──
  const correctsId = relationshipId(effective(doc, original, 'correctsSale'))
  doc.correctsSale = correctsId
  if (correctsId != null) {
    if (selfId != null && String(correctsId) === String(selfId)) {
      fail(req, selfId, 'correctsSale', 'Et salg kan ikke korrigere seg selv.')
    }
    const target = (await req.payload.findByID({
      collection: 'referral-sales',
      id: correctsId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })) as unknown as Doc | null
    if (!target) fail(req, selfId, 'correctsSale', 'Fant ikke salget som skal korrigeres.')
    if (String(relationshipId(target.referredCustomer)) !== String(customerId)) {
      fail(req, selfId, 'correctsSale', 'Et korrigerende salg må gjelde samme henviste kunde som salget det korrigerer.')
    }
    if (target.paymentStatus !== 'cancelled' && target.paymentStatus !== 'refunded') {
      fail(
        req,
        selfId,
        'correctsSale',
        'Sett først det opprinnelige salget til «Refundert» eller «Kansellert», og registrer deretter det korrigerte salget.',
      )
    }
    if (active) {
      const otherCorrections = await findSales(req, {
        and: [{ correctsSale: { equals: correctsId } }, { paymentStatus: { in: ACTIVE_PAYMENT_STATUSES } }, ...notSelf(selfId)],
      })
      if (otherCorrections.length > 0) {
        fail(
          req,
          selfId,
          'correctsSale',
          `Salget er allerede korrigert av «${String(otherCorrections[0].title ?? otherCorrections[0].id)}».`,
        )
      }
    }
  }
}

/** Only a sale still awaiting payment, and never paid out, may be deleted. */
export const guardReferralSaleDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const sale = (await req.payload.findByID({
    collection: 'referral-sales',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as unknown as Doc | null
  if (!sale) return
  if (sale.paymentStatus !== 'pending' || relationshipId(sale.payout) != null) {
    throw new APIError(SALE_DELETE_MESSAGE, 409)
  }
}
