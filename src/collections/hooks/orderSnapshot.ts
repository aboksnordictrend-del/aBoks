import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import type { EconomySetting } from '@/payload-types'
import { round2 } from '@/lib/analytics/money'
import { VAT_RATE_PERCENT } from '@/lib/tax'
import { formatVariantDisplayName } from './variantDisplayName'

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
//
// Display-name snapshot: the same lookup also freezes `displayName` — the variant's own
// Visningsnavn ("aBoks Vegg – Mørk blå") — and normalises `variantName` to the variant's
// colour. This is what e-mails and the PDF receipt print, so a line can never be shown
// under a different product's name. It is a snapshot in the same sense as unitCost: never
// recomputed on update, so renaming a product leaves historical orders alone. On update we
// only *fill in* a line that has no name yet (a line added to an existing order, or a row
// predating the column); an existing name is never overwritten.

interface OrderLine {
  product?: number | { id: number } | null
  variant?: number | { id: number } | null
  displayName?: string | null
  variantName?: string | null
  quantity?: number | null
  lineTotal?: number | null
  /** This line's share of the order's promo discount, in kroner (Stage 7). */
  discountAmount?: number | null
  unitCost?: number | null
  vatRate?: number | null
  lineCost?: number | null
  lineProfit?: number | null
}

/** Minimal shapes of the two documents the snapshot reads. */
type VariantDoc = { id: number; product?: OrderLine['product']; name?: string | null; displayName?: string | null }
type ProductDoc = { id: number; title?: string | null; costPrice?: number | null }

function idOf(rel: OrderLine['product'] | OrderLine['variant']): number | null {
  if (rel == null) return null
  if (typeof rel === 'number') return rel
  if (typeof rel === 'object' && typeof rel.id === 'number') return rel.id
  return null
}

async function loadVariant(req: PayloadRequest, line: OrderLine): Promise<VariantDoc | null> {
  const variantId = idOf(line.variant)
  if (variantId == null) return null
  return (await req.payload.findByID({
    collection: 'product-variants',
    id: variantId,
    depth: 0,
  })) as VariantDoc | null
}

/**
 * Determine the parent Product id, backfilling `line.product` from the already-loaded
 * variant when the line only carries a variant. Both the `product` and `variant`
 * relationships end up persisted. Returns the parent product id (or null).
 */
function resolveParentProduct(
  req: PayloadRequest,
  line: OrderLine,
  variant: VariantDoc | null,
): number | null {
  const existing = idOf(line.product)
  if (existing != null) return existing
  if (variant == null) return null

  const productId = idOf(variant.product)
  if (productId == null) {
    req.payload.logger.warn(
      `[orderSnapshot] variant ${variant.id} has no parent product — product left empty, unitCost estimated`,
    )
    return null
  }
  line.product = productId // always persist both product and variant
  return productId
}

/**
 * The exact string the customer will see for this line, resolved once, at write time.
 *
 * Preference order — the variant's own Visningsnavn first, because that is literally what
 * the admin panel shows; then product title + colour, rebuilt with the *same* formatter the
 * variant uses; then the product title alone. Returns null when nothing can be resolved, so
 * the caller can fall back to whatever the line already carries instead of inventing a name.
 */
export function resolveLineDisplayName(
  line: OrderLine,
  variant: VariantDoc | null,
  product: ProductDoc | null,
): string | null {
  const fromVariant = variant?.displayName?.trim()
  if (fromVariant) return fromVariant

  const title = product?.title?.trim()
  const colorName = variant?.name?.trim() || line.variantName?.trim()
  if (title && colorName) return formatVariantDisplayName(title, colorName)
  if (title) return title
  return null
}

/**
 * Freeze the line's identity: `product`, `displayName`, `variantName` and the cost basis.
 * Returns the resolved `unitCost` (null = no Kostpris configured, stays "estimated").
 */
async function applyCreateSnapshot(req: PayloadRequest, line: OrderLine): Promise<number | null> {
  try {
    const variant = await loadVariant(req, line)
    const productId = resolveParentProduct(req, line, variant)
    const product =
      productId != null
        ? ((await req.payload.findByID({
            collection: 'products',
            id: productId,
            depth: 0,
          })) as ProductDoc | null)
        : null

    // Server-resolved name wins over anything the (public) checkout endpoint supplied.
    const resolved = resolveLineDisplayName(line, variant, product)
    if (resolved) line.displayName = resolved
    // The variant is authoritative for the colour too, so a mis-parsed Kustom line name
    // cannot leave a wrong "Fargenavn" behind.
    const colorName = variant?.name?.trim()
    if (colorName) line.variantName = colorName

    return typeof product?.costPrice === 'number' ? product.costPrice : null
  } catch (err) {
    // Never block order creation on a lookup — leave cost estimated and keep the name the
    // line already carries (the checkout supplies the variant's display name up front).
    req.payload.logger.error(
      `[orderSnapshot] snapshot resolution failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return null
  }
}

/**
 * Fill `displayName` for a line that still has none — a line added to an existing order, or
 * a row created before the column existed. Never overwrites a stored name.
 */
async function backfillDisplayName(req: PayloadRequest, line: OrderLine): Promise<void> {
  if (line.displayName?.trim()) return
  try {
    const variant = await loadVariant(req, line)
    const productId = idOf(line.product) ?? idOf(variant?.product ?? null)
    const product =
      productId != null
        ? ((await req.payload.findByID({
            collection: 'products',
            id: productId,
            depth: 0,
          })) as ProductDoc | null)
        : null
    const resolved = resolveLineDisplayName(line, variant, product)
    if (resolved) line.displayName = resolved
  } catch (err) {
    req.payload.logger.error(
      `[orderSnapshot] display-name backfill failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
  }
}

/**
 * lineCost = unitCost × quantity; lineProfit = (revenue actually received, ex-VAT) − lineCost.
 *
 * `lineTotal` is the line's pre-discount value and `discountAmount` its share of the order's
 * promo discount, so the revenue this line really earned is the difference. Without that
 * subtraction, every discounted line reported a profit it never made.
 *
 * The VAT formula is unchanged, and so is the cost side — a discount reduces what the
 * customer paid, never what the goods cost. A line with no discount behaves exactly as
 * before. Revenue is floored at zero so a malformed or oversized stored discount can never
 * invert the line.
 */
export function deriveLine(line: OrderLine): { lineCost: number | null; lineProfit: number | null } {
  if (typeof line.unitCost !== 'number') return { lineCost: null, lineProfit: null }
  const quantity = line.quantity ?? 0
  const lineCost = round2(line.unitCost * quantity)
  const vatRate = line.vatRate ?? 0
  const discount = typeof line.discountAmount === 'number' && line.discountAmount > 0 ? line.discountAmount : 0
  const grossRevenue = Math.max(0, (line.lineTotal ?? 0) - discount)
  const netLineRevenue = grossRevenue / (1 + vatRate / 100)
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
      // parent product, display name, cost and VAT are always taken from live data and the
      // tax source, never from client-supplied values. null unitCost = no Kostpris.
      line.unitCost = await applyCreateSnapshot(req, line)
      line.vatRate = VAT_RATE_PERCENT
    } else {
      await backfillDisplayName(req, line)
    }
    const derived = deriveLine(line)
    line.lineCost = derived.lineCost
    line.lineProfit = derived.lineProfit
  }

  return data
}
