import { ValidationError, type PayloadRequest } from 'payload'
import { toOere } from '@/lib/money'
import { parseKroner } from '@/lib/partner/referral'
import {
  LINKED_ORDER_COST_MESSAGE,
  computeSaleProductCost,
  resolveProductUnitCost,
  validateLineQuantity,
} from '@/lib/partner/referralCost'

/**
 * Product cost and ABOKS AS's own shipping cost on a referral sale («Varer og kostnader»).
 *
 * Called from `enforceReferralSaleRules` on every save, after the payment-status and locking rules,
 * so it holds on every path (admin, REST, Local API). The unit cost always comes from the product's
 * «Total kostpris» on the server — any client value for `unitCost`, `lineCost` or `productCost` is
 * overwritten. See `@/lib/partner/referralCost` for the rules themselves.
 *
 *   • Open sale («Venter på betaling», or new): lines may change freely and the unit cost is
 *     re-read on every save — including the save that sets «Betalt», which is the snapshot.
 *   • Paid / cancelled / refunded: the lines and their unit costs are frozen. A sale that has no
 *     lines yet (registered before they existed, or saved without them) may receive them ONCE; they
 *     are snapshotted at that save. The shipping cost may likewise be filled in once when empty.
 *   • Linked to a webshop order: no lines and no shipping cost — the order already carries both,
 *     and counting them here as well would count the cost twice.
 *
 * None of this affects the commission.
 */

const SALES = 'referral-sales'

type Doc = Record<string, unknown> & { id?: number | string }

interface Line {
  id?: unknown
  product: number | string | null
  variant: number | string | null
  quantity: unknown
}

const relId = (value: unknown): number | string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

const linesOf = (value: unknown): Line[] =>
  Array.isArray(value)
    ? value.map((row) => {
        const r = (row ?? {}) as Record<string, unknown>
        return { id: r.id, product: relId(r.product), variant: relId(r.variant), quantity: r.quantity }
      })
    : []

const lineKey = (l: Line) => `${String(l.product)}|${String(l.variant)}|${String(l.quantity)}`
const sameLines = (a: Line[], b: Line[]) => a.length === b.length && a.every((l, i) => lineKey(l) === lineKey(b[i]))

const moneyKey = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? toOere(value) : null)

function fail(req: PayloadRequest, id: unknown, path: string, message: string): never {
  throw new ValidationError({
    collection: SALES,
    id: typeof id === 'number' || typeof id === 'string' ? id : undefined,
    errors: [{ path, message }],
    req,
  })
}

/** Validates the lines and writes them back with server-resolved unit and line costs. */
async function snapshotLines(req: PayloadRequest, selfId: unknown, lines: Line[]): Promise<{ rows: Record<string, unknown>[]; productCost: number | null }> {
  if (lines.length === 0) return { rows: [], productCost: null }

  lines.forEach((line, i) => {
    if (line.product == null) fail(req, selfId, `items.${i}.product`, 'Velg produkt.')
    const quantity = validateLineQuantity(line.quantity)
    if (quantity !== true) fail(req, selfId, `items.${i}.quantity`, quantity)
  })

  const productIds = [...new Set(lines.map((l) => String(l.product)))]
  const variantIds = [...new Set(lines.map((l) => l.variant).filter((v) => v != null).map(String))]
  const common = { depth: 0, limit: 0, pagination: false as const, overrideAccess: true, req }

  const [products, chosenVariants, variantParents] = await Promise.all([
    req.payload.find({ collection: 'products', where: { id: { in: productIds } }, select: { costPrice: true, costItems: true }, ...common }),
    variantIds.length > 0
      ? req.payload.find({ collection: 'product-variants', where: { id: { in: variantIds } }, select: { product: true }, ...common })
      : Promise.resolve({ docs: [] as { id: number; product?: unknown }[] }),
    // Which of these products are variant-based — the same rule `@/lib/stock` uses.
    req.payload.find({ collection: 'product-variants', where: { product: { in: productIds } }, select: { product: true }, ...common }),
  ])

  const productById = new Map(products.docs.map((p) => [String(p.id), p as unknown as { costPrice?: unknown; costItems?: unknown }]))
  const variantProduct = new Map(chosenVariants.docs.map((v) => [String(v.id), String(relId(v.product))]))
  const variantBased = new Set(variantParents.docs.map((v) => String(relId(v.product))))

  const resolved = lines.map((line, i) => {
    const product = productById.get(String(line.product))
    if (!product) fail(req, selfId, `items.${i}.product`, 'Fant ikke produktet.')
    if (line.variant != null) {
      if (variantProduct.get(String(line.variant)) !== String(line.product)) {
        fail(req, selfId, `items.${i}.variant`, 'Varianten hører ikke til det valgte produktet.')
      }
    } else if (variantBased.has(String(line.product))) {
      fail(req, selfId, `items.${i}.variant`, 'Velg variant (farge / type) for dette produktet.')
    }
    return { line, unitCost: resolveProductUnitCost(product) }
  })

  const cost = computeSaleProductCost(resolved.map((r) => ({ quantity: r.line.quantity as number, unitCost: r.unitCost })))
  const rows = resolved.map((r, i) => ({
    ...(r.line.id != null ? { id: r.line.id } : {}),
    product: r.line.product,
    variant: r.line.variant,
    quantity: r.line.quantity as number,
    unitCost: r.unitCost,
    lineCost: cost.lineCosts[i],
  }))
  return { rows, productCost: cost.productCost }
}

export async function applyReferralSaleCosts(args: {
  doc: Doc
  original: Doc | undefined
  req: PayloadRequest
  selfId: unknown
  /** True when the stored sale is no longer «Venter på betaling». */
  locked: boolean
}): Promise<void> {
  const { doc, original, req, selfId, locked } = args

  const orderId = relId('order' in doc ? doc.order : original?.order)
  const storedLines = linesOf(original?.items)
  const incomingLines = 'items' in doc ? linesOf(doc.items) : null
  const lines = incomingLines ?? storedLines
  const shipping = 'actualShippingCost' in doc ? doc.actualShippingCost : original?.actualShippingCost
  const storedShipping = original?.actualShippingCost

  if (orderId != null) {
    if (lines.length > 0) fail(req, selfId, 'items', LINKED_ORDER_COST_MESSAGE)
    if (shipping != null && shipping !== '') fail(req, selfId, 'actualShippingCost', LINKED_ORDER_COST_MESSAGE)
    doc.items = []
    doc.productCost = null
    doc.actualShippingCost = null
    return
  }

  // ── Shipping ABOKS AS paid: kroner with at most two decimals; empty = unknown ──
  const parsed = parseKroner(shipping)
  if (!parsed.ok || (parsed.oere != null && parsed.oere < 0)) {
    fail(req, selfId, 'actualShippingCost', 'Fraktkostnaden må være et beløp i kroner (minst 0) med høyst to desimaler.')
  }
  if (locked && storedShipping != null && moneyKey(shipping) !== moneyKey(storedShipping)) {
    fail(req, selfId, 'actualShippingCost', 'Fraktkostnaden er låst fordi salget ikke lenger venter på betaling.')
  }
  doc.actualShippingCost = parsed.oere == null ? null : parsed.oere / 100

  // ── Lines ──
  if (locked && storedLines.length > 0) {
    if (incomingLines && !sameLines(incomingLines, storedLines)) {
      fail(
        req,
        selfId,
        'items',
        'Varelinjene og kostprisen er låst fordi salget ikke lenger venter på betaling. Registrer et korrigerende salg dersom varene var feil.',
      )
    }
    // Keep the snapshot exactly as stored.
    doc.items = original?.items
    doc.productCost = typeof original?.productCost === 'number' ? original.productCost : null
    return
  }

  const { rows, productCost } = await snapshotLines(req, selfId, lines)
  doc.items = rows
  doc.productCost = productCost
}
