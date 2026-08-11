import type { Payload } from 'payload'
import { stockAfterPurchase } from '@/lib/stock'

/**
 * Taking a confirmed order's goods out of stock.
 *
 * Lifted out of the Kustom push webhook so the rule can be tested without a database, a
 * payment provider or a network — the webhook now calls this and nothing else changes about
 * when it runs.
 *
 * ── Which counter is decremented ──
 *
 *   the line has a `variant` →  that variant's `inventory`   (unchanged behaviour)
 *   the line has only a `product` →  that product's `stock`
 *
 * Never both, and never a guess: a line that carries a variant is a variant line even if it
 * also carries its parent product (which every line written since the checkout rewrite does),
 * because the parent's own `stock` is not what was sold. See @/lib/stock.
 *
 * ── Idempotency ──
 *
 * There is none here, deliberately. This function is a plain "subtract", and it is the
 * *caller* that must run it exactly once per order — which the webhook does by reaching this
 * point only on the delivery that actually transitions the order into `confirmed`; a
 * re-delivered push takes the already-confirmed branch and returns long before. Putting a
 * second guard here would be a second source of truth about whether an order has been
 * fulfilled, and the two would eventually disagree.
 *
 * ── Failure ──
 *
 * Per line, and never fatal: a paid order must not be lost because one stock write failed.
 * Each failure is counted and logged, and the remaining lines are still processed.
 */

/** Either shape Payload hands back for a relationship, at depth 0 or populated. */
type Relationship = number | string | { id: number | string } | null | undefined

export interface DeductibleOrderLine {
  product?: Relationship
  variant?: Relationship
  quantity?: number | null
}

export interface StockDeductionResult {
  /** Variant rows written. */
  variants: number
  /** Product rows written (variant-less lines). */
  products: number
  /** Lines with no usable identifier or no quantity. */
  skipped: number
  /** Lines whose read or write threw. The order is never rolled back for these. */
  failed: number
}

function relId(rel: Relationship): string | null {
  if (rel == null) return null
  if (typeof rel === 'object') return rel.id != null ? String(rel.id) : null
  const id = String(rel).trim()
  return id ? id : null
}

type Logger = (message: string) => void

export async function deductOrderStock(
  payload: Payload,
  items: readonly DeductibleOrderLine[] | null | undefined,
  log: { info?: Logger; error?: Logger } = {},
): Promise<StockDeductionResult> {
  const result: StockDeductionResult = { variants: 0, products: 0, skipped: 0, failed: 0 }
  const info = log.info ?? ((message: string) => console.log(message))
  const error = log.error ?? ((message: string) => console.error(message))

  for (const item of items ?? []) {
    const quantity = typeof item?.quantity === 'number' ? item.quantity : 0
    if (quantity <= 0) {
      result.skipped += 1
      continue
    }

    const variantId = relId(item.variant)
    const productId = relId(item.product)

    if (variantId) {
      try {
        const variant = await payload.findByID({
          collection: 'product-variants',
          id: Number(variantId),
        })
        const next = stockAfterPurchase(variant.inventory, quantity)
        await payload.update({
          collection: 'product-variants',
          id: Number(variantId),
          data: { inventory: next },
        })
        result.variants += 1
        info(
          `[stock] variant=${variantId} (${variant.name ?? variant.sku}) ${variant.inventory} → ${next}`,
        )
      } catch (err) {
        result.failed += 1
        error(
          `[stock] variant update failed for ${variantId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      continue
    }

    if (productId) {
      try {
        const product = await payload.findByID({ collection: 'products', id: Number(productId) })
        const next = stockAfterPurchase(product.stock, quantity)
        await payload.update({
          collection: 'products',
          id: Number(productId),
          data: { stock: next },
        })
        result.products += 1
        info(`[stock] product=${productId} (${product.title}) ${product.stock} → ${next}`)
      } catch (err) {
        result.failed += 1
        error(
          `[stock] product update failed for ${productId}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      continue
    }

    // Neither identifier — nothing to decrement. A historical line with no relationships at
    // all, or a manual order line typed in by hand.
    result.skipped += 1
  }

  return result
}
