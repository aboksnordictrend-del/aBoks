// Shared types for the analytics dashboard.
//
// Normalized order/line shapes decouple the pure calculation layer (calc.ts) from
// Payload's document shape, so calc.ts can be unit-tested with plain objects and is
// unaffected by future schema changes.

import type { Grouping, PresetKey } from './period'

/** One order line, normalized into the fields the calculations need. */
export interface AnalyticsLine {
  productId?: string
  /** Snapshot name — falls back to the live product/variant name for old orders. */
  productName: string
  variantName?: string
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
  /** Total paid by customers incl. VAT and shipping. */
  revenueGross: number
  /** Product + shipping revenue excl. VAT. */
  revenueNet: number
  vatAmount: number
  averageOrderValue: number
  unitsSold: number
  productCost: number
  /** netProductRevenue − productCost. */
  grossProfit: number
  marginPercent: number
  shippingCharged: number
  actualShippingCost: number
  shippingResult: number
  paymentFees: number
  adSpend: number
  /** revenueNet − productCost − actualShippingCost − paymentFees − adSpend. */
  contributionProfit: number
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
  revenue: number
  grossProfit: number
}

export interface ProductRow {
  key: string
  productName: string
  variantName?: string
  unitsSold: number
  revenueGross: number
  revenueNet: number
  cost: number
  grossProfit: number
  marginPercent: number
  revenueShare: number
  costEstimated: boolean
}

export interface VariantRow {
  variantName: string
  /** Live variant colour hex when known, else undefined (UI falls back to a palette). */
  colorHex?: string
  unitsSold: number
  revenueGross: number
  unitsShare: number
}

export interface RecentOrder {
  id: string
  orderNumber: string
  date: string
  status: string
  unitsSold: number
  revenueGross: number
  grossProfit: number
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
  channels: unknown[]
  recentOrders: RecentOrder[]
  warnings: Warning[]
}
