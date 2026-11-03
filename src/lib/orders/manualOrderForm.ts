// Form behaviour of a manual order line in Payload Admin — pure, so it is tested without React.
//
// A line has ONE price field, `unitPrice`. It is either the STANDARD price (exactly the catalogue
// price for the current product and quantity) or an INDIVIDUAL price (anything else the
// administrator typed). No extra field records which: the comparison decides, so a price the
// administrator types that happens to equal the catalogue price simply is the standard price.
//
//   • product / variant changed → the new product's standard price. An individual price that is
//     replaced is reported, so the form can offer to keep it (nothing is lost without notice).
//   • quantity changed         → a standard price follows the quantity bands; an individual
//     price is kept.
//   • no catalogue price       → the price is left as it is and an error is shown.

import { samePrice } from './manualOrderPricing'

export interface LineState {
  /** Product id after resolving the variant's parent. */
  productKey: string | null
  variantKey: string | null
  quantity: number | null
  unitPrice: number | null
  /** Catalogue price for this product and quantity, null when unknown or missing. */
  catalogue: number | null
}

export type LineDecision =
  | { kind: 'keep' }
  | { kind: 'set'; unitPrice: number; replacedIndividual: number | null }
  | { kind: 'error'; message: string }

export const NO_CATALOGUE_PRICE_MESSAGE =
  'Produktet har ingen gyldig pris i katalogen. Skriv inn en enhetspris for linjen.'

const hasPrice = (v: number | null): v is number => typeof v === 'number' && Number.isFinite(v)

/** Was `unitPrice` the standard price in state `s`? An empty price counts as standard. */
export function isStandardPrice(s: Pick<LineState, 'unitPrice' | 'catalogue'>): boolean {
  return !hasPrice(s.unitPrice) || (hasPrice(s.catalogue) && samePrice(s.unitPrice, s.catalogue))
}

/**
 * What the price should become when the line moves from `prev` to `next` (both with their
 * catalogue price resolved). `prev` null = the line has just been added.
 */
export function decideLinePrice(prev: LineState | null, next: LineState): LineDecision {
  if (next.productKey == null) return { kind: 'keep' }
  const productChanged = !prev || prev.productKey !== next.productKey || prev.variantKey !== next.variantKey
  const quantityChanged = !!prev && prev.quantity !== next.quantity

  if (productChanged) {
    if (!hasPrice(next.catalogue)) return { kind: 'error', message: NO_CATALOGUE_PRICE_MESSAGE }
    const replacedIndividual = prev && prev.productKey != null && !isStandardPrice(prev) ? prev.unitPrice : null
    return samePrice(next.unitPrice, next.catalogue) && replacedIndividual == null
      ? { kind: 'keep' }
      : { kind: 'set', unitPrice: next.catalogue, replacedIndividual }
  }

  if (quantityChanged && prev && isStandardPrice(prev)) {
    if (!hasPrice(next.catalogue)) return { kind: 'error', message: NO_CATALOGUE_PRICE_MESSAGE }
    return samePrice(next.unitPrice, next.catalogue) ? { kind: 'keep' } : { kind: 'set', unitPrice: next.catalogue, replacedIndividual: null }
  }

  return { kind: 'keep' }
}
