import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
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

/** Follow a variant to its parent Product and read that Product's costPrice. */
async function costViaVariant(req: PayloadRequest, variantId: number): Promise<number | null> {
  const variant = await req.payload.findByID({
    collection: 'product-variants',
    id: variantId,
    depth: 0,
  })
  const productId = idOf(variant?.product as OrderLine['product'])
  if (productId == null) {
    req.payload.logger.warn(
      `[orderSnapshot] variant ${variantId} has no parent product — unitCost left estimated`,
    )
    return null
  }
  return costFromProduct(req, productId)
}

/** Resolve unit cost from the parent Product; null when no Kostpris is configured. */
async function resolveUnitCost(req: PayloadRequest, line: OrderLine): Promise<number | null> {
  try {
    const variantId = idOf(line.variant)
    if (variantId != null) return await costViaVariant(req, variantId)
    const productId = idOf(line.product)
    if (productId != null) return await costFromProduct(req, productId)
  } catch (err) {
    // Never block order creation on a cost lookup — leave it estimated.
    req.payload.logger.error(
      `[orderSnapshot] cost lookup failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
  }
  return null
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

export const snapshotOrderCosts: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  const lines = data?.items
  if (!Array.isArray(lines)) return data

  for (const line of lines as OrderLine[]) {
    if (operation === 'create') {
      // Server-formed snapshot: the orders-create endpoint is public (checkout), so
      // cost/VAT are always taken from live Product/Variant data and the tax source,
      // never from client-supplied values. null unitCost = no Kostpris configured.
      line.unitCost = await resolveUnitCost(req, line)
      line.vatRate = VAT_RATE_PERCENT
    }
    const derived = deriveLine(line)
    line.lineCost = derived.lineCost
    line.lineProfit = derived.lineProfit
  }

  return data
}
