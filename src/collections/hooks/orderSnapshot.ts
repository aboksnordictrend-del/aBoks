import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import type { EconomySetting } from '@/payload-types'
import { round2 } from '@/lib/analytics/money'
import { VAT_RATE_PERCENT } from '@/lib/tax'

// Historical cost/VAT snapshot for order lines.
//
// On CREATE only, each line's `unitCost` is resolved server-side from the parent
// Product's Kostpris (never trusted from the client, never from the variant) and
// `vatRate` is captured from the single checkout tax source. Existing orders are never
// touched: on UPDATE we only re-derive `lineCost`/`lineProfit` from whatever
// `unitCost`/`vatRate` the line already carries, so an admin can correct a historical
// unitCost and the derived numbers follow — current product cost is never back-written
// into old orders.
//
// Cost source: the parent Product only. A line with a variant is resolved by loading the
// variant, following it to its parent Product, and reading that Product's costPrice.
// If no Product/Kostpris can be resolved, `unitCost` is left null so the dashboard keeps
// flagging the line as estimated (never silently 0).
//
// The same variant→product lookup also backfills the line's `product` relationship on
// create: Kustom only sends a variant reference, so without this the order line would
// store `variant` but leave `product` empty. Both are now always persisted.

interface OrderLine {
  product?: number | { id: number } | null
  variant?: number | { id: number } | null
  quantity?: number | null
  lineTotal?: number | null
  unitCost?: number | null
  vatRate?: number | null
  lineCost?: number | null
  lineProfit?: number | null
}

function idOf(rel: OrderLine['product'] | OrderLine['variant']): number | null {
  if (rel == null) return null
  if (typeof rel === 'number') return rel
  if (typeof rel === 'object' && typeof rel.id === 'number') return rel.id
  return null
}

async function costFromProduct(req: PayloadRequest, productId: number): Promise<number | null> {
  const product = await req.payload.findByID({ collection: 'products', id: productId, depth: 0 })
  return typeof product?.costPrice === 'number' ? product.costPrice : null
}

/**
 * Determine the parent Product id for a create-time line, backfilling `line.product`
 * from the variant's parent when the line only carries a variant. Both the `product` and
 * `variant` relationships end up persisted. Returns the parent product id (or null).
 */
async function resolveParentProduct(req: PayloadRequest, line: OrderLine): Promise<number | null> {
  const existing = idOf(line.product)
  if (existing != null) return existing

  const variantId = idOf(line.variant)
  if (variantId == null) return null

  const variant = await req.payload.findByID({
    collection: 'product-variants',
    id: variantId,
    depth: 0,
  })
  const productId = idOf(variant?.product as OrderLine['product'])
  if (productId == null) {
    req.payload.logger.warn(
      `[orderSnapshot] variant ${variantId} has no parent product — product left empty, unitCost estimated`,
    )
    return null
  }
  line.product = productId // always persist both product and variant
  return productId
}

/** Backfill `line.product` and resolve `unitCost` from the parent Product. */
async function applyCreateSnapshot(req: PayloadRequest, line: OrderLine): Promise<number | null> {
  try {
    const productId = await resolveParentProduct(req, line)
    return productId != null ? await costFromProduct(req, productId) : null
  } catch (err) {
    // Never block order creation on a lookup — leave cost estimated.
    req.payload.logger.error(
      `[orderSnapshot] snapshot resolution failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return null
  }
}

/** lineCost = unitCost × quantity; lineProfit = (lineTotal ex-VAT) − lineCost. */
export function deriveLine(line: OrderLine): { lineCost: number | null; lineProfit: number | null } {
  if (typeof line.unitCost !== 'number') return { lineCost: null, lineProfit: null }
  const quantity = line.quantity ?? 0
  const lineCost = round2(line.unitCost * quantity)
  const vatRate = line.vatRate ?? 0
  const netLineRevenue = (line.lineTotal ?? 0) / (1 + vatRate / 100)
  return { lineCost, lineProfit: round2(netLineRevenue - lineCost) }
}

// --- Economy-settings automation (paymentFee + actualShippingCost) ---
//
// Both are snapshotted ONCE, at order creation, from the admin's Økonomiinnstillinger.
// They are never recomputed on update, so a manual correction is always preserved. The
// Kustom fee IS the stored paymentFee (fixedFee + base×percentageFee/100); feeVatRate is
// NOT added on top — it exists only for an optional net/VAT split in the analytics layer.

interface OrderEconomyData {
  total?: number | null
  subtotal?: number | null
  shipping?: number | null
  paymentFee?: number | null
  actualShippingCost?: number | null
  paymentFeeSource?: 'auto' | 'manual' | null
}

const numOr0 = (v: unknown): number => (typeof v === 'number' ? v : 0)

async function loadEconomySettings(req: PayloadRequest): Promise<EconomySetting | null> {
  try {
    return await req.payload.findGlobal({ slug: 'economy-settings' })
  } catch {
    return null // never block order creation on a settings read
  }
}

/** Kustom fee = fixedFee + base × percentageFee/100. Null when automation is off. */
export function computeKustomFee(settings: EconomySetting | null, order: OrderEconomyData): number | null {
  if (!settings?.kustomEnabled) return null
  const base =
    settings.calculateFrom === 'productTotalOnly' ? numOr0(order.subtotal) : numOr0(order.total)
  return round2(numOr0(settings.fixedFee) + (base * numOr0(settings.percentageFee)) / 100)
}

/** Standard actual shipping cost. Null when automation is off. */
export function computeDefaultShipping(settings: EconomySetting | null, order: OrderEconomyData): number | null {
  if (!settings?.applyDefaultShippingCost) return null
  // Free shipping to the customer still costs the business — unless explicitly told otherwise.
  if (numOr0(order.shipping) === 0 && settings.freeShippingStillHasCost === false) return 0
  return numOr0(settings.defaultShippingCost)
}

async function applyEconomyAutomation(
  req: PayloadRequest,
  data: OrderEconomyData,
  operation: string,
  originalDoc: OrderEconomyData | undefined,
): Promise<void> {
  if (operation === 'create') {
    const settings = await loadEconomySettings(req)
    if (data.paymentFee == null) {
      const fee = computeKustomFee(settings, data)
      if (fee != null) {
        data.paymentFee = fee
        data.paymentFeeSource = 'auto'
      }
    } else {
      // An explicit fee supplied at creation is treated as a manual value.
      data.paymentFeeSource = 'manual'
    }
    if (data.actualShippingCost == null) {
      const ship = computeDefaultShipping(settings, data)
      if (ship != null) data.actualShippingCost = ship
    }
    return
  }

  // Update: never recompute. Only flip the source to 'manual' when the fee was actually
  // edited by hand — a partial system update (status change) leaves paymentFee undefined
  // and must not touch the source.
  if (data.paymentFee !== undefined && originalDoc && data.paymentFee !== originalDoc.paymentFee) {
    data.paymentFeeSource = 'manual'
  }
}

export const snapshotOrderCosts: CollectionBeforeChangeHook = async ({ data, operation, req, originalDoc }) => {
  if (data) {
    await applyEconomyAutomation(
      req,
      data as OrderEconomyData,
      operation,
      originalDoc as OrderEconomyData | undefined,
    )
  }

  const lines = data?.items
  if (!Array.isArray(lines)) return data

  for (const line of lines as OrderLine[]) {
    if (operation === 'create') {
      // Server-formed snapshot: the orders-create endpoint is public (checkout), so the
      // parent product, cost and VAT are always taken from live data and the tax source,
      // never from client-supplied values. null unitCost = no Kostpris configured.
      line.unitCost = await applyCreateSnapshot(req, line)
      line.vatRate = VAT_RATE_PERCENT
    }
    const derived = deriveLine(line)
    line.lineCost = derived.lineCost
    line.lineProfit = derived.lineProfit
  }

  return data
}
