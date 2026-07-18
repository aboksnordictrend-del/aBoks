// Shared types for the analytics dashboard.
//
// Normalized order/line shapes decouple the pure calculation layer (calc.ts) from
// Payload's document shape, so calc.ts can be unit-tested with plain objects and is
// unaffected by future schema changes.

import type { Grouping, PresetKey } from './period'

export type { Period } from './period'

/** One order line, normalized into the fields the calculations need. */
export interface AnalyticsLine {
  productId?: string
  /** Snapshot name — falls back to the live product/variant name for old orders. */
  productName: string
  /** Stable variant id from the live relationship, when present. */
  variantId?: string
  /** Colour/variant label — snapshot text, else the live variant name. */
  variantName?: string
  /** Live variant display name ("aBoks – Sort"), when the relationship is present. */
  variantDisplayName?: string
  /** Live colour name ("Sort"), when the relationship is present. */
  colorName?: string
  /** Variant colour hex from the live variant, when the relationship is present. */
  colorHex?: string
  quantity: number
  /** Gross unit price incl. VAT, in kroner (as charged to the customer). */
  unitPrice: number
  /** Cost per unit excl. VAT, in kroner. 0 when unknown. */
  unitCost: number
  /** True when unitCost had no snapshot/live source and was assumed 0. */
  costEstimated: boolean
  /** VAT rate in percent (e.g. 25 or 0). */
  vatRate: number
  /** True when the line had no stored VAT rate and one was assumed. */
  vatEstimated: boolean
}

/** One order, normalized. */
export interface AnalyticsOrder {
  id: string
  orderNumber: string
  status: string
  /**
   * Customer display name (first + last) for the recent-orders list only. This is the
   * one piece of personal data that leaves the aggregation, and only for the 8-row admin
   * list — it is never written to CSV or any aggregate figure.
   */
  customerName?: string
  /** Sale date — paidAt when available, else createdAt. UTC ISO. */
  date: string
  /** Shipping the customer paid, in kroner. */
  shippingCharged: number
  /** Real shipping cost to the business, in kroner (0 until entered). */
  actualShippingCost: number
  /** Payment processor fee, in kroner (0 until entered). */
  paymentFee: number
  /** Any extra variable costs booked on the order, in kroner. */
  extraCosts: number
  lines: AnalyticsLine[]
}

export interface Summary {
  orderCount: number
  /** Orders in a paid status (confirmed/shipped/delivered) within the set. */
  paidOrders: number
  /** Cancelled orders in the period (fetched separately — never counted as revenue). */
  cancelledOrders: number
  /** Total paid by customers incl. VAT and shipping. */
  revenueGross: number
  /** Product + shipping revenue excl. VAT. */
  revenueNet: number
  vatAmount: number
  averageOrderValue: number
  unitsSold: number
  /** Average number of units per order (unitsSold / orderCount). */
  avgUnitsPerOrder: number
  /** Average gross price per sold unit (product gross / unitsSold). */
  avgUnitPrice: number
  productCost: number
  /** netProductRevenue − productCost. */
  grossProfit: number
  marginPercent: number
  shippingCharged: number
  actualShippingCost: number
  shippingResult: number
  paymentFees: number
  /** Ex-VAT marketing spend allocated to the period (Stage 4). */
  adSpend: number
  /** New customers (first-ever paid order) acquired in the period (Stage 4). */
  newCustomers: number
  /**
   * revenueNet − productCost − actualShippingCost − paymentFees − adSpend − extraCosts.
   * Identical to "Markedsføringsresultat" (§9) once ad spend is wired.
   */
  contributionProfit: number
}

/** A current/previous marketing ratio + its change. current/previous are null when undefined. */
export interface MarketingRatioEntry {
  current: number | null
  previous: number | null
  changePercent: number | null
}

/** Ex-VAT ad spend for one channel (no revenue attribution in Stage 4). */
export interface ChannelRow {
  channel: string
  label: string
  amountExVat: number
  share: number
}

export interface MarketingSummary {
  roas: MarketingRatioEntry
  cac: MarketingRatioEntry
  costPerOrder: MarketingRatioEntry
  marketingShare: MarketingRatioEntry
  channels: ChannelRow[]
  /** False in Stage 4 — per-channel revenue/ROAS is not attributed yet. */
  attributionConnected: boolean
}

export interface ComparisonEntry {
  current: number
  previous: number
  /** Percent change, null when previous is 0 (render as "—"). */
  changePercent: number | null
}

export type Comparison = Record<keyof Summary, ComparisonEntry>

export interface TimelinePoint {
  key: string
  label: string
  orders: number
  unitsSold: number
  revenue: number
  /** Net (excl. VAT) product+shipping revenue — basis for margin. */
  net: number
  grossProfit: number
  marginPercent: number
}

/** One variant/colour row, with full financials and share breakdowns. */
export interface VariantRow {
  /** Stable key: variantId when known, else `${productKey}::${label}`. */
  key: string
  variantId?: string
  /** Preferred display: live displayName ("aBoks – Sort"), else a composed fallback. */
  displayName: string
  /** Colour/variant label ("Sort"). */
  variantName: string
  parentProductId?: string
  parentProductName: string
  /** Live variant colour hex when known, else undefined (UI falls back to a palette). */
  colorHex?: string
  orderCount: number
  unitsSold: number
  revenueGross: number
  revenueNet: number
  cost: number
  grossProfit: number
  marginPercent: number
  /** Share of this variant's units among all variants of its parent product. */
  parentUnitsShare: number
  /** Share of this variant's units among all sold units in the period. */
  unitsShare: number
  /** Share of this variant's gross revenue among all revenue in the period. */
  revenueShare: number
  costEstimated: boolean
}

/** One product row, aggregated across its variants (which are nested for drill-down). */
export interface ProductRow {
  /** Stable key: productId when known, else `name:${productName}`. */
  key: string
  productId?: string
  productName: string
  /** Distinct orders containing this product. */
  orderCount: number
  unitsSold: number
  revenueGross: number
  revenueNet: number
  cost: number
  grossProfit: number
  marginPercent: number
  revenueShare: number
  /** Average gross price per sold unit. */
  avgUnitPrice: number
  /** Average units of this product per order that contains it. */
  avgUnitsPerOrder: number
  costEstimated: boolean
  /** This product's variants, sorted by gross revenue desc. */
  variants: VariantRow[]
}

export interface RecentOrder {
  id: string
  orderNumber: string
  /** Customer name (admin-only list). Undefined when the order has no stored name. */
  customerName?: string
  date: string
  status: string
  unitsSold: number
  revenueGross: number
  cost: number
  grossProfit: number
  marginPercent: number
}

/** A published product's variant with no sales in the selected period. */
export interface ProductWithoutSales {
  variantId?: string
  /** Variant display name, else the product title. */
  name: string
  parentProductName: string
  /** Current stock for the variant, when available. */
  inventory?: number
  /** Last time this variant was ever sold (any period), best-effort. */
  lastSoldAt?: string
}

export interface Warning {
  code: string
  message: string
  count?: number
}

/** One order's financial breakdown for the CSV export (no personal data). */
export interface OrderFinancialRow {
  orderNumber: string
  date: string
  status: string
  unitsSold: number
  revenueGross: number
  revenueNet: number
  vatAmount: number
  productCost: number
  shippingCharged: number
  actualShippingCost: number
  paymentFee: number
  extraCosts: number
  grossProfit: number
  contributionProfit: number
}

export interface AnalyticsResponse {
  period: { from: string; to: string; preset: PresetKey; grouping: Grouping }
  filters: { paidOnly: boolean; statuses: string[] }
  summary: Summary
  comparison: Comparison
  timeline: TimelinePoint[]
  products: ProductRow[]
  variants: VariantRow[]
  productsWithoutSales: ProductWithoutSales[]
  marketing: MarketingSummary
  recentOrders: RecentOrder[]
  warnings: Warning[]
}
