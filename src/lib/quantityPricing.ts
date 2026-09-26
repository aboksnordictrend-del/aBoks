/**
 * Quantity pricing — the ONE authoritative definition, for the whole application.
 *
 * The cart, the slide-out drawer, the product page, the server-side checkout pricer, the
 * Kustom order lines, the stored order, /bedrifter and the four solution pages all read
 * their unit price from this module. There is deliberately no second table, no per-component
 * threshold and no `if (quantity >= 20)` anywhere else in the codebase.
 *
 * ── The two concepts, kept apart ──
 *
 * A **pricing tier** decides what a unit costs. A **quote threshold** decides whether the
 * customer is additionally offered a tailored B2B quote. They are different things and are
 * modelled separately:
 *
 *   standard product   1–9 · 10–19 · 20+          quoteThreshold 40
 *   aBoks XL           1–3 · 4–6  · 7+            quoteThreshold 11
 *
 * 40 units of a standard product is NOT a fourth tier. It is the 20+ price — the same unit
 * price 39 units pay — plus a «Be om tilbud» offer beside the ordinary checkout. The same is
 * true of 11 units of aBoks XL against the 7+ price. Nothing here ever reads
 * `quoteThreshold` when choosing a price, and nothing ever reads a tier when deciding
 * whether a quote is available.
 *
 * ── Where the numbers come from ──
 *
 * The first band is always the product's own catalogue price — Payload's `products.price`,
 * through the existing sale rule in @/lib/pricing. It is not restated here, so changing a
 * product's price in the CMS changes its 1–9 price with nothing to remember, and the two can
 * never disagree.
 *
 * The volume bands below are explicit kroner amounts, per product. They are NOT derived:
 * there is no `basePrice - 50` anywhere, because the tiers are expected to be tuned per
 * product and per tier.
 *
 * ── Price applies to ALL units ──
 *
 * Reaching a band reprices the whole line, not the units above the boundary. 10 × 349/299 is
 * 2 990, never 9 × 349 + 1 × 299. See `getLineTotalOere`.
 *
 * ── Quantity is per product ──
 *
 * A band is chosen from one product's own quantity. Nothing in this module can see a cart, so
 * quantities of different products cannot be combined into a tier by accident — the callers
 * ask one product at a time, and a solution package of 3 + 12 + 25 is three independent
 * questions, never a 40.
 */

import { getEffectivePrice, type SaleInfo } from './pricing'
import { oereToKr, toOere } from './money'

/* ────────────────────────────── types ────────────────────────────── */

/**
 * One volume band, as configured: the quantity it starts at and the explicit unit price it
 * charges. The band runs until the next one starts, and the last band has no upper bound.
 */
export interface VolumeTierConfig {
  /** First quantity this band applies from, inclusive. Always ≥ 2. */
  minQuantity: number
  /** Unit price in kroner. Explicit — never computed from another band. */
  unitPrice: number
}

/** A product's complete quantity-pricing configuration. */
export interface QuantityPricingConfig {
  /**
   * The volume bands, ascending, NOT including the 1–n band: that one is always the
   * product's live catalogue price, so it cannot drift away from what the shop charges.
   */
  volumeTiers: VolumeTierConfig[]
  /**
   * The quantity from which a tailored quote is offered. Purely a CTA threshold — it never
   * changes a price. Set above the last band's `minQuantity`, never equal to it, or the
   * offer would look like a fourth discount.
   */
  quoteThreshold: number
}

/**
 * The minimum a caller has to know about a product to price it.
 *
 * Structural on purpose: the cart's `CartItem`, the solution pages' `ConfigurableProduct`,
 * the server's catalogue row and a plain `{ slug, price }` from a test all satisfy it without
 * conversion.
 */
export interface QuantityPricedProduct {
  /** Payload slug — the key this module's configuration is written against. */
  slug: string
  /** Catalogue list price in kroner (`products.price`). */
  price: number
  /** The product's sale window, when the caller has one. */
  sale?: SaleInfo | null
}

/** One resolved band of a product's price table, ready to price or to display. */
export interface PricingTier {
  /** 0 for the catalogue band, 1 for the first volume band, and so on. */
  index: number
  /** First quantity in the band, inclusive. */
  minQuantity: number
  /** Last quantity in the band, inclusive. `null` on the open-ended final band. */
  maxQuantity: number | null
  unitPriceOere: number
  /** The same price in kroner, for display. */
  unitPrice: number
  /** False for the catalogue band, true for every volume band. */
  isVolumeTier: boolean
}

/* ────────────────────────────── configuration ────────────────────────────── */

/**
 * Quantity pricing per product, keyed by Payload slug.
 *
 * The slug is the key because it is already this project's cross-environment product
 * identifier — @/lib/bedrifterDocuments, @/lib/bedrifterSolutions and the solution content
 * modules are all written against it, and unlike a database id it means the same thing in
 * development and in production. A product with no entry here simply has no quantity pricing
 * and keeps its ordinary price at every quantity (see `getUnitPriceOere`).
 *
 * Renaming a slug in the CMS therefore silently removes that product's quantity pricing —
 * that is the one maintenance cost of this choice, and it is the same cost the documents,
 * the solutions and the calculator already carry.
 *
 * ── The numbers ──
 *
 * Every model steps down 50 kroner per band from its catalogue price. The bands themselves —
 * 10 / 20 with a quote from 40, and aBoks XL's own 4 / 7 with a quote from 11 — are the
 * current structure, and this file is where they are defined.
 */
export const QUANTITY_PRICING: Record<string, QuantityPricingConfig> = {
  // Catalogue price 449 kr.
  aboks: {
    volumeTiers: [
      { minQuantity: 10, unitPrice: 399 },
      { minQuantity: 20, unitPrice: 349 },
    ],
    quoteThreshold: 40,
  },

  // Catalogue price 349 kr.
  'aboks-mini': {
    volumeTiers: [
      { minQuantity: 10, unitPrice: 299 },
      { minQuantity: 20, unitPrice: 249 },
    ],
    quoteThreshold: 40,
  },

  // Catalogue price 349 kr.
  'aboks-nano': {
    volumeTiers: [
      { minQuantity: 10, unitPrice: 299 },
      { minQuantity: 20, unitPrice: 249 },
    ],
    quoteThreshold: 40,
  },

  // Catalogue price 549 kr.
  'aboks-vegg': {
    volumeTiers: [
      { minQuantity: 10, unitPrice: 499 },
      { minQuantity: 20, unitPrice: 449 },
    ],
    quoteThreshold: 40,
  },

  // Catalogue price 549 kr.
  'aboks-office': {
    volumeTiers: [
      { minQuantity: 10, unitPrice: 499 },
      { minQuantity: 20, unitPrice: 449 },
    ],
    quoteThreshold: 40,
  },

  /**
   * Catalogue price 299 kr, confirmed against the product data.
   *
   * 299 / 249 / 199, continuing the same 50-kroner step per band as the rest of the
   * catalogue. Quote threshold 40, as for every other standard product.
   */
  'aboks-spesial': {
    volumeTiers: [
      { minQuantity: 10, unitPrice: 249 },
      { minQuantity: 20, unitPrice: 199 },
    ],
    quoteThreshold: 40,
  },

  /**
   * aBoks XL is the exception, on both counts: its own bands (1–3 / 4–6 / 7+) and its own
   * quote threshold (11). The standard 10 / 20 / 40 boundaries deliberately do not apply to
   * it — it is a shared collection point, bought a few at a time, not per desk.
   *
   * Catalogue price 849 kr.
   */
  'aboks-xl': {
    volumeTiers: [
      { minQuantity: 4, unitPrice: 799 },
      { minQuantity: 7, unitPrice: 749 },
    ],
    quoteThreshold: 11,
  },

  /*
   * Deliberately absent: the accessories (AA-Modul, AAA-Modul, BB-Modul and the GP battery
   * multipacks, all 99 kr). No price sheet exists for any of them, and the 50-kroner step the
   * boxes use would reach −1 kr by the third band. They keep their ordinary price at every
   * quantity, which is exactly what an unconfigured product does.
   */
}

/* ────────────────────────────── the engine ────────────────────────────── */

/** This product's configuration, or null when it has no quantity pricing. */
export function quantityPricingFor(
  product: Pick<QuantityPricedProduct, 'slug'>,
): QuantityPricingConfig | null {
  const slug = product?.slug?.trim()
  if (!slug) return null
  return QUANTITY_PRICING[slug] ?? null
}

/** Does this product have quantity pricing at all? */
export function hasQuantityPricing(product: Pick<QuantityPricedProduct, 'slug'>): boolean {
  return quantityPricingFor(product) !== null
}

/**
 * The product's ordinary unit price in øre — catalogue price through the existing sale rule.
 * This is the 1–n band, and it is what an unconfigured product pays at every quantity.
 */
export function baseUnitPriceOere(product: QuantityPricedProduct): number {
  return toOere(getEffectivePrice(product.price, product.sale ?? null))
}

/** A whole number of units, at least one. Anything else is not a quantity. */
function normalizeQuantity(quantity: number): number {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return 1
  return Math.max(1, Math.floor(quantity))
}

/**
 * The product's complete price table: the catalogue band followed by its volume bands, with
 * every boundary and every price resolved.
 *
 * This is what /bedrifter renders. An unconfigured product returns the single open-ended
 * catalogue band, which is the truthful table for it.
 */
export function getPricingTiers(product: QuantityPricedProduct): PricingTier[] {
  const baseOere = baseUnitPriceOere(product)
  const config = quantityPricingFor(product)

  const volume = [...(config?.volumeTiers ?? [])]
    .filter((tier) => Number.isFinite(tier.minQuantity) && tier.minQuantity >= 2)
    .sort((a, b) => a.minQuantity - b.minQuantity)

  const tiers: PricingTier[] = [
    {
      index: 0,
      minQuantity: 1,
      maxQuantity: volume.length > 0 ? volume[0].minQuantity - 1 : null,
      unitPriceOere: baseOere,
      unitPrice: oereToKr(baseOere),
      isVolumeTier: false,
    },
  ]

  volume.forEach((tier, i) => {
    const next = volume[i + 1]
    // A volume price is only ever a *reduction*. Should a sale drop the catalogue price below
    // a configured band — or should the band be left stale after a price cut — the customer
    // pays the lower of the two rather than more than the shop is advertising.
    const unitPriceOere = Math.min(baseOere, toOere(tier.unitPrice))
    tiers.push({
      index: i + 1,
      minQuantity: tier.minQuantity,
      maxQuantity: next ? next.minQuantity - 1 : null,
      unitPriceOere,
      unitPrice: oereToKr(unitPriceOere),
      isVolumeTier: true,
    })
  })

  return tiers
}

/**
 * The band this quantity falls in. Never null: an unconfigured product has exactly one band,
 * and every configured table starts at 1.
 */
export function getPricingTier(product: QuantityPricedProduct, quantity: number): PricingTier {
  const qty = normalizeQuantity(quantity)
  const tiers = getPricingTiers(product)
  // Highest band whose minimum this quantity has reached. The table is ascending, so the last
  // match wins and the open-ended final band catches everything above it.
  let match = tiers[0]
  for (const tier of tiers) {
    if (qty >= tier.minQuantity) match = tier
  }
  return match
}

/**
 * The band above the one this quantity is in, or null when the customer is already in the
 * last one. What a «Kjøp 10 og betal 399 kr per stk.» hint is built from.
 */
export function getNextPricingTier(
  product: QuantityPricedProduct,
  quantity: number,
): PricingTier | null {
  const current = getPricingTier(product, quantity)
  const tiers = getPricingTiers(product)
  return tiers.find((tier) => tier.index === current.index + 1) ?? null
}

/** The effective unit price, in integer øre. The authoritative figure. */
export function getUnitPriceOere(product: QuantityPricedProduct, quantity: number): number {
  return getPricingTier(product, quantity).unitPriceOere
}

/** The effective unit price, in kroner, for display. */
export function getUnitPrice(product: QuantityPricedProduct, quantity: number): number {
  return oereToKr(getUnitPriceOere(product, quantity))
}

/**
 * The line total, in integer øre.
 *
 * The effective price applies to **all** units of the line — this is the whole point of the
 * rule, and it is why the multiplication happens after the band has been chosen.
 */
export function getLineTotalOere(product: QuantityPricedProduct, quantity: number): number {
  return getUnitPriceOere(product, quantity) * normalizeQuantity(quantity)
}

/** The line total, in kroner, for display. */
export function getLineTotal(product: QuantityPricedProduct, quantity: number): number {
  return oereToKr(getLineTotalOere(product, quantity))
}

/**
 * Is a tailored quote offered at this quantity?
 *
 * Entirely independent of the price: this answers «should we also show Be om tilbud», and the
 * unit price at that quantity is whatever the last band charges, unchanged. A product with no
 * quantity pricing offers no threshold — its B2B enquiries go through /bedrifter as before.
 */
export function isQuoteThresholdReached(
  product: Pick<QuantityPricedProduct, 'slug'>,
  quantity: number,
): boolean {
  const config = quantityPricingFor(product)
  if (!config) return false
  return normalizeQuantity(quantity) >= config.quoteThreshold
}

/** The quantity at which this product offers a quote, or null when it never does. */
export function quoteThresholdFor(product: Pick<QuantityPricedProduct, 'slug'>): number | null {
  return quantityPricingFor(product)?.quoteThreshold ?? null
}

/* ────────────────────────────── presentation helpers ────────────────────────────── */

/** «1–9 stk.», «20–39 stk.», «40+ stk.» — one band's quantity range, written out. */
export function formatTierRange(tier: Pick<PricingTier, 'minQuantity' | 'maxQuantity'>): string {
  if (tier.maxQuantity === null) return `${tier.minQuantity}+ stk.`
  if (tier.maxQuantity === tier.minQuantity) return `${tier.minQuantity} stk.`
  return `${tier.minQuantity}–${tier.maxQuantity} stk.`
}

/**
 * The rows /bedrifter prints for one product: its price bands, and then the quote band.
 *
 * The quote row is the reason this exists rather than `getPricingTiers` being rendered
 * directly. A table has to show the customer «40+ → Be om tilbud», while the pricing engine
 * knows perfectly well that 40 units still pay the 20+ price — so the last *price* band is
 * closed at the threshold for display only, and the quote row carries the same unit price it
 * always did.
 */
export interface PriceTableRow {
  /** «1–9 stk.» */
  range: string
  unitPrice: number
  /** True on the row that offers a quote rather than being a new price. */
  isQuoteRow: boolean
}

export function buildPriceTableRows(product: QuantityPricedProduct): PriceTableRow[] {
  const tiers = getPricingTiers(product)
  const threshold = quoteThresholdFor(product)
  const rows: PriceTableRow[] = []

  for (const tier of tiers) {
    const openEnded = tier.maxQuantity === null
    // The final band is closed just under the threshold, so the quote row can start at it.
    const maxQuantity =
      openEnded && threshold !== null && threshold > tier.minQuantity ? threshold - 1 : tier.maxQuantity
    rows.push({
      range: formatTierRange({ minQuantity: tier.minQuantity, maxQuantity }),
      unitPrice: tier.unitPrice,
      isQuoteRow: false,
    })
  }

  if (threshold !== null) {
    const last = tiers[tiers.length - 1]
    rows.push({
      // The published price still applies here — the row offers a quote *as well*.
      range: formatTierRange({ minQuantity: threshold, maxQuantity: null }),
      unitPrice: last.unitPrice,
      isQuoteRow: true,
    })
  }

  return rows
}
