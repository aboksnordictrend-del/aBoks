/**
 * What one cart line costs, in the browser.
 *
 * The cart store, the cart page, the slide-out drawer and the analytics events all read a
 * line's price through these functions, and none of them multiplies `item.price × item.qty`
 * any more. That is the whole point: quantity pricing has to recalculate the *entire* line the
 * instant the quantity changes, and a component that does its own multiplication is a
 * component that will one day show the wrong price.
 *
 * ── Nothing here is authoritative ──
 *
 * This is display arithmetic. The cart lives in localStorage, entirely under the customer's
 * control, so every figure it produces is re-derived server-side by `priceCart()` before
 * anyone is charged — from the same table, in @/lib/quantityPricing, so the two agree. If a
 * stored line's price has gone stale (the catalogue changed since it was added), the server's
 * answer wins and the customer sees it at checkout, exactly as before.
 *
 * ── Why `item.price` is still read at all ──
 *
 * It is the line's 1–9 band: the price the product page showed when the line was added,
 * already through the sale rule. The volume bands come from the shared table, keyed by the
 * line's `productSlug`. A line with no slug, or a product with no configured bands, simply
 * keeps `item.price` at every quantity.
 */

import { oereToKr, toOere } from '../money'
import {
  getPricingTier,
  getUnitPriceOere,
  isQuoteThresholdReached,
  quoteThresholdFor,
} from '../quantityPricing'

/**
 * The parts of a cart line that decide its price. Structural, so the store's `CartItem`
 * satisfies it without conversion and a test can pass a plain object.
 */
export interface PricedCartLine {
  /** Payload slug. Absent only on a line persisted before the field existed. */
  productSlug?: string
  /** The line's catalogue unit price in kroner, sale already applied. */
  price: number
  qty: number
}

/** The line as the quantity-pricing engine wants to see it. */
function priceable(item: PricedCartLine) {
  // `sale` is deliberately null: `item.price` is ALREADY the sale-adjusted price, and passing
  // the sale window again would apply it twice.
  return { slug: item.productSlug ?? '', price: item.price, sale: null }
}

/** The effective unit price for this line's quantity, in integer øre. */
export function cartLineUnitPriceOere(item: PricedCartLine): number {
  return getUnitPriceOere(priceable(item), item.qty)
}

/** The effective unit price for this line's quantity, in kroner. */
export function cartLineUnitPrice(item: PricedCartLine): number {
  return oereToKr(cartLineUnitPriceOere(item))
}

/**
 * The line total, in integer øre. The effective price applies to every unit on the line.
 */
export function cartLineTotalOere(item: PricedCartLine): number {
  return cartLineUnitPriceOere(item) * Math.max(0, Math.floor(item.qty))
}

/** The line total, in kroner. */
export function cartLineTotal(item: PricedCartLine): number {
  return oereToKr(cartLineTotalOere(item))
}

/**
 * True when a volume band is actually active on this line — i.e. the customer is paying less
 * per unit than one of these would cost on its own. What the struck-through price is shown
 * for; false at quantity 1 and for any product without quantity pricing.
 */
export function cartLineHasVolumePrice(item: PricedCartLine): boolean {
  return cartLineUnitPriceOere(item) < toOere(item.price)
}

/** Has this line reached its product's quote threshold? Never affects the price. */
export function cartLineQuoteAvailable(item: PricedCartLine): boolean {
  return isQuoteThresholdReached({ slug: item.productSlug ?? '' }, item.qty)
}

/** The quantity at which this line's product offers a quote, or null when it never does. */
export function cartLineQuoteThreshold(item: PricedCartLine): number | null {
  return quoteThresholdFor({ slug: item.productSlug ?? '' })
}

/** Which band this line is in — used for the «kjøp N og betal …» hints. */
export function cartLinePricingTier(item: PricedCartLine) {
  return getPricingTier(priceable(item), item.qty)
}

/**
 * The cart's goods subtotal, in kroner.
 *
 * Summed in integer øre and converted once, so a cart of twelve 349-kroner boxes comes to
 * exactly 4 188 rather than 4 187.999999999999. Each line is priced by its own quantity —
 * quantities of different products are never added together to reach a band.
 */
export function cartSubtotal(items: PricedCartLine[]): number {
  return oereToKr(items.reduce((sum, item) => sum + cartLineTotalOere(item), 0))
}
