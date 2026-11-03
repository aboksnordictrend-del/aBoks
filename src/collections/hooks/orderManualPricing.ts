import { ValidationError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import { toOere } from '@/lib/money'
import {
  PRICE_MISSING_MESSAGE,
  SHIPPING_INVALID_MESSAGE,
  TOTAL_NEGATIVE_MESSAGE,
  catalogueUnitPrice,
  lineTotalKr,
  sumOrderTotals,
  validateQuantity,
  validateUnitPrice,
  type PricedProductDoc,
} from '@/lib/orders/manualOrderPricing'
import { isStaffUser } from '@/lib/security/staffAccess'

/**
 * Server-side prices and totals for orders created or edited BY STAFF (Payload Admin or the REST
 * API as a `users` login). See @/lib/orders/manualOrderPricing for the money model.
 *
 * ── Which orders ──
 *
 * Only requests with a staff `req.user`. Checkout's pending pre-create and the Kustom webhook run
 * through the Local API with no user, so this hook returns immediately for them: their amounts are
 * exactly what Kustom charged and are never recalculated here.
 *
 * ── What the server decides ──
 *
 *   • `unitPrice` is the administrator's: the standard catalogue price filled in by the form, or
 *     an individual (contract) price typed over it. A line sent WITHOUT a unit price gets the
 *     catalogue price — the same function checkout charges with. It is validated: ≥ 0, øre.
 *   • `lineTotal`, `subtotal` and `total` are never taken from the request. They are derived:
 *     lineTotal = unitPrice × quantity, subtotal = Σ lineTotal,
 *     total = subtotal + shipping − discount.discountAmount (the frozen promo discount; 0 without).
 *   • A line's variant must belong to its product, and a product with variants needs a variant —
 *     a price can never come from another product.
 *
 * ── Existing orders ──
 *
 * On an update the amounts are recalculated ONLY when a financial input changed: a line added,
 * removed, or its product, variant, quantity or unit price changed, or shipping or the discount
 * changed. Otherwise every stored amount is put back exactly as it was — opening and saving an old
 * order (e.g. to change its status) never rewrites its money, and a client cannot slip in other
 * totals. Unchanged lines are never re-priced from today's catalogue and are not re-validated, so a
 * historical line can never block an edit elsewhere. Cost, MVA and profit stay with
 * `snapshotOrderCosts`, which runs after this hook and derives from the final line totals.
 */

type Rel = number | string | { id?: unknown } | null | undefined
interface Line {
  id?: string | null
  product?: Rel
  variant?: Rel
  quantity?: unknown
  unitPrice?: unknown
  lineTotal?: unknown
  [key: string]: unknown
}
interface OrderData {
  items?: Line[] | null
  shipping?: unknown
  subtotal?: unknown
  total?: unknown
  discount?: { discountAmount?: unknown } | null
  [key: string]: unknown
}

const idOf = (rel: Rel): string | null => {
  if (rel == null || rel === '') return null
  if (typeof rel === 'object') return rel.id == null ? null : String(rel.id)
  return String(rel)
}
const oere = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? toOere(v) : null)

function fail(req: PayloadRequest, id: unknown, path: string, message: string): never {
  throw new ValidationError({
    collection: 'orders',
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    errors: [{ path, message }],
    req,
  })
}

/** Did this line change in a way that affects its money? A line without a stored twin is new. */
function lineChanged(line: Line, stored: Line | undefined): boolean {
  if (!stored) return true
  return (
    idOf(line.product) !== idOf(stored.product) ||
    idOf(line.variant) !== idOf(stored.variant) ||
    line.quantity !== stored.quantity ||
    oere(line.unitPrice) !== oere(stored.unitPrice)
  )
}

export function financialInputsChanged(data: OrderData, original: OrderData): boolean {
  const lines = data.items ?? []
  const storedLines = original.items ?? []
  if (lines.length !== storedLines.length) return true
  const byId = new Map(storedLines.map((l) => [String(l.id), l]))
  if (lines.some((line) => line.id == null || lineChanged(line, byId.get(String(line.id))))) return true
  if ('shipping' in data && (oere(data.shipping) ?? 0) !== (oere(original.shipping) ?? 0)) return true
  if (data.discount && 'discountAmount' in data.discount) {
    if ((oere(data.discount.discountAmount) ?? 0) !== (oere(original.discount?.discountAmount) ?? 0)) return true
  }
  return false
}

/** Product + variant check and the catalogue price for a line that needs one. */
async function resolveLine(req: PayloadRequest, line: Line, index: number, selfId: unknown, needsPrice: boolean) {
  const path = (field: string) => `items.${index}.${field}`
  const variantId = idOf(line.variant)
  let productId = idOf(line.product)

  if (variantId != null) {
    const variant = (await req.payload.findByID({
      collection: 'product-variants',
      id: variantId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })) as { product?: Rel } | null
    if (!variant) fail(req, selfId, path('variant'), 'Fant ikke varianten.')
    const parent = idOf(variant.product)
    if (productId != null && parent !== productId) fail(req, selfId, path('variant'), 'Varianten tilhører et annet produkt.')
    productId = parent
    if (parent != null && line.product == null) line.product = Number.isNaN(Number(parent)) ? parent : Number(parent)
  }
  if (productId == null) fail(req, selfId, path('product'), 'Velg produkt.')

  const product = (await req.payload.findByID({
    collection: 'products',
    id: productId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as (PricedProductDoc & { title?: string | null }) | null
  if (!product) fail(req, selfId, path('product'), 'Fant ikke produktet.')

  if (variantId == null) {
    const variants = await req.payload.count({
      collection: 'product-variants',
      where: { product: { equals: productId } },
      overrideAccess: true,
      req,
    })
    if (variants.totalDocs > 0) fail(req, selfId, path('variant'), `Velg variant for «${product.title ?? 'produktet'}».`)
  }

  if (needsPrice) {
    const price = catalogueUnitPrice(product, line.quantity as number)
    if (price == null) fail(req, selfId, path('unitPrice'), PRICE_MISSING_MESSAGE)
    line.unitPrice = price
  }
}

export const normalizeManualOrderPricing: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  if (!data || !isStaffUser(req.user)) return data
  const doc = data as OrderData
  const original = (operation === 'update' ? originalDoc : undefined) as OrderData | undefined
  const selfId = (original as { id?: unknown } | undefined)?.id

  // A partial update that does not touch the lines (status, shipment, notes …) never touches money.
  if (original && !Array.isArray(doc.items) && !('shipping' in doc) && !(doc.discount && 'discountAmount' in doc.discount)) {
    delete doc.subtotal
    delete doc.total
    return data
  }

  const lines = Array.isArray(doc.items) ? doc.items : (original?.items ?? [])
  if (Array.isArray(doc.items)) doc.items = lines

  if (original && !financialInputsChanged({ ...doc, items: lines }, original)) {
    // Nothing financial changed: every stored amount stays exactly as it is.
    const byId = new Map((original.items ?? []).map((l) => [String(l.id), l]))
    for (const line of lines) line.lineTotal = byId.get(String(line.id))?.lineTotal ?? line.lineTotal
    doc.subtotal = original.subtotal
    doc.total = original.total
    return data
  }

  const storedById = new Map((original?.items ?? []).map((l) => [String(l.id), l]))
  for (const [index, line] of lines.entries()) {
    const stored = line.id != null ? storedById.get(String(line.id)) : undefined
    if (stored && !lineChanged(line, stored)) continue // historical line: not re-priced, not re-validated

    const quantityError = validateQuantity(line.quantity)
    if (quantityError) fail(req, selfId, `items.${index}.quantity`, quantityError)
    const needsPrice = line.unitPrice == null || line.unitPrice === ''
    if (!needsPrice) {
      const priceError = validateUnitPrice(line.unitPrice)
      if (priceError) fail(req, selfId, `items.${index}.unitPrice`, priceError)
    }
    await resolveLine(req, line, index, selfId, needsPrice)
  }

  const shipping = 'shipping' in doc ? doc.shipping : original?.shipping
  if (shipping != null && (typeof shipping !== 'number' || !Number.isFinite(shipping) || shipping < 0)) {
    fail(req, selfId, 'shipping', SHIPPING_INVALID_MESSAGE)
  }
  const discountAmount =
    doc.discount && 'discountAmount' in doc.discount ? doc.discount.discountAmount : original?.discount?.discountAmount

  // A historical line keeps its stored line total; a new or changed line is unitPrice × quantity.
  const lineTotals = lines.map((line) => {
    const stored = line.id != null ? storedById.get(String(line.id)) : undefined
    return stored && !lineChanged(line, stored)
      ? (stored.lineTotal as number)
      : lineTotalKr(line.unitPrice as number, line.quantity as number)
  })
  const totals = sumOrderTotals(lineTotals, shipping as number | null | undefined, discountAmount as number | null | undefined)
  if (totals.total < 0) fail(req, selfId, 'total', TOTAL_NEGATIVE_MESSAGE)

  lines.forEach((line, i) => {
    line.lineTotal = totals.lineTotals[i]
  })
  doc.subtotal = totals.subtotal
  doc.total = totals.total
  return data
}
