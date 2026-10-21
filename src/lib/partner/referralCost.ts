import { oereToKr, toOere } from '@/lib/money'
import { MAX_LINE_QUANTITY } from '@/lib/quantityLimits'

/**
 * Product cost on a manual referral sale («Henvisningssalg») — pure rules.
 *
 * The cost is never typed by hand. Each sale line names an existing product (and its variant, for
 * a variant-based product) and a quantity; the unit cost is the product's own «Total kostpris»
 * (`products.costPrice`), the figure the product administration already calculates from its
 * «Kostnadsberegning» items (`computeProductCostPrice`). That is the same source the webshop's
 * order snapshot uses (`orderSnapshot.ts`: variant → its product → costPrice), so a box sold to a
 * company costs exactly what the same box sold online costs.
 *
 * ── Snapshot ──
 *
 * While a sale is «Venter på betaling» the unit cost is re-read on every save. The save that makes
 * it «Betalt» is the last one: from then on the lines and their unit costs are frozen, so a later
 * change to a product's cost never rewrites a historical profit. A sale registered before lines
 * existed may have its lines added ONCE afterwards (they are snapshotted at that save).
 *
 * ── Unknown is never zero ──
 *
 * A product whose cost has not been set up (no cost items, or no costPrice at all) gives a NULL
 * unit cost, and then the sale's product cost is NULL too — never a sum that silently treats the
 * missing line as free. The same goes for the shipping ABOKS AS paid: empty means unknown, while
 * an explicit 0 is a real answer.
 *
 * None of this touches the commission: the commission base stays invoiced − shipping − other −
 * VAT, exactly as `./referral.ts` computes it.
 */

export const COST_LINES_DESCRIPTION =
  'Velg produkt, variant og antall. Kostpris per enhet hentes automatisk fra produktets «Total kostpris» og låses når salget settes til «Betalt».'

export const ACTUAL_SHIPPING_DESCRIPTION =
  'Det ABOKS AS faktisk betalte for frakten. La stå tom hvis ukjent – 0 betyr at frakten var gratis for ABOKS AS.'

export const LINKED_ORDER_COST_MESSAGE =
  'Salget er koblet til en nettbutikkordre. Varer, kostpris og frakt hentes fra ordren – la varelinjene og fraktkostnaden stå tomme.'

/** The fields of a product the unit cost is read from. */
export interface CostProduct {
  costPrice?: unknown
  costItems?: unknown
}

/**
 * The unit cost of one product, in kroner, or null when the product's cost is not set up.
 *
 * `computeProductCostPrice` writes 0 for a product without any cost items, so 0 alone cannot tell
 * «free» from «not configured». A cost counts only when it is a number AND the product has at
 * least one cost item — otherwise it is unknown.
 */
export function resolveProductUnitCost(product: CostProduct | null | undefined): number | null {
  if (!product) return null
  const cost = product.costPrice
  if (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0) return null
  if (!Array.isArray(product.costItems) || product.costItems.length === 0) return null
  return cost
}

export function validateLineQuantity(value: unknown): true | string {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return 'Antall må være et helt tall på minst 1.'
  }
  if (value > MAX_LINE_QUANTITY) return `Antall kan ikke være høyere enn ${MAX_LINE_QUANTITY}.`
  return true
}

export interface CostLine {
  quantity: number
  /** Kroner, or null when the product's cost is unknown. */
  unitCost: number | null
}

export interface SaleProductCost {
  /** Per line, in kroner; null for a line with unknown unit cost. */
  lineCosts: (number | null)[]
  /** Σ unitCost × quantity in kroner; null when there are no lines or any line is unknown. */
  productCost: number | null
}

/** Σ unitCost × quantity, in integer øre. Null as soon as one line is unknown. */
export function computeSaleProductCost(lines: readonly CostLine[]): SaleProductCost {
  let totalOere = 0
  let complete = lines.length > 0
  const lineCosts = lines.map((line) => {
    if (line.unitCost == null || !Number.isFinite(line.unitCost)) {
      complete = false
      return null
    }
    const oere = toOere(line.unitCost) * line.quantity
    totalOere += oere
    return oereToKr(oere)
  })
  return { lineCosts, productCost: complete ? oereToKr(totalOere) : null }
}

/**
 * The costs of one sale as the profit calculation needs them, or null when they are not reliably
 * known. Both the product cost and the shipping ABOKS AS paid must be known.
 */
export function knownSaleCosts(sale: { productCost: number | null; actualShippingCost: number | null }):
  | { productCost: number; shippingCost: number }
  | null {
  if (sale.productCost == null || sale.actualShippingCost == null) return null
  return { productCost: sale.productCost, shippingCost: sale.actualShippingCost }
}
