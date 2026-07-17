// Server-side analytics aggregation. Runs inside the auth-guarded endpoint, reads
// orders from Payload, normalizes them, and returns the fully-aggregated response.
// Personal data (customerInfo) is never copied into the response.

import type { Payload } from 'payload'
import type { Order, Product, ProductVariant } from '../../payload-types'
import {
  computeComparison,
  computeProducts,
  computeRecentOrders,
  computeSummary,
  computeTimeline,
  computeVariants,
} from './calc'
import { resolvePeriod, type Grouping, type Period, type PresetKey } from './period'
import type { AnalyticsLine, AnalyticsOrder, AnalyticsResponse, Warning } from './types'

// Orders that represent real, paid revenue. Kustom's webhook sets `confirmed` after
// `checkout_complete`; `shipped`/`delivered` are later stages of the same paid order.
export const PAID_STATUSES = ['confirmed', 'shipped', 'delivered'] as const
// "Alle ordre" still excludes `cancelled` — a cancelled order is never revenue.
export const ALL_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'] as const

// Until per-line VAT is snapshotted (Stage 2), no order stores its VAT rate. The
// company is currently not MVA-registered, so we assume 0 % and surface a warning
// rather than silently inventing 25 %.
const ASSUMED_VAT_RATE = 0

const MAX_ORDERS = 20_000
const PAGE_SIZE = 250

export interface AnalyticsQuery {
  preset: PresetKey
  customFrom?: string
  customTo?: string
  paidOnly: boolean
  grouping?: Grouping
  now?: Date
}

/** Stage-2 fields are read optionally so this keeps working before/after the migration. */
interface OrderExtras {
  paidAt?: string | null
  actualShippingCost?: number | null
  paymentFee?: number | null
  extraCosts?: number | null
}
type LineExtras = { unitCost?: number | null; vatRate?: number | null }

function productName(line: Order['items'][number]): string {
  const p = line.product
  if (p && typeof p === 'object') return (p as Product).title
  return 'aBoks'
}

function variantName(line: Order['items'][number]): string | undefined {
  if (line.variantName) return line.variantName
  const v = line.variant
  if (v && typeof v === 'object') return (v as ProductVariant).name
  return undefined
}

function variantColor(line: Order['items'][number]): string | undefined {
  const v = line.variant
  if (v && typeof v === 'object') {
    const hex = (v as ProductVariant).colorHex
    if (typeof hex === 'string' && hex.trim()) return hex.trim()
  }
  return undefined
}

/**
 * Unit cost comes from the order's historical snapshot only. Old orders without a
 * snapshot are treated as estimated (0) and surfaced as a warning — the dashboard must
 * never recompute historical profit from the current Product.costPrice.
 */
function resolveUnitCost(line: Order['items'][number]): { unitCost: number; estimated: boolean } {
  const snapshot = (line as LineExtras).unitCost
  if (typeof snapshot === 'number') return { unitCost: snapshot, estimated: false }
  return { unitCost: 0, estimated: true }
}

function normalizeOrder(order: Order): AnalyticsOrder {
  const extras = order as Order & OrderExtras
  const lines: AnalyticsLine[] = (order.items ?? []).map((line) => {
    const { unitCost, estimated } = resolveUnitCost(line)
    const vat = (line as LineExtras).vatRate
    const vatStored = typeof vat === 'number'
    return {
      productId: typeof line.product === 'object' ? String(line.product?.id) : line.product != null ? String(line.product) : undefined,
      productName: productName(line),
      variantName: variantName(line),
      colorHex: variantColor(line),
      quantity: line.quantity ?? 0,
      unitPrice: line.unitPrice ?? 0,
      unitCost,
      costEstimated: estimated,
      vatRate: vatStored ? vat : ASSUMED_VAT_RATE,
      vatEstimated: !vatStored,
    }
  })

  return {
    id: String(order.id),
    orderNumber: order.orderNumber,
    status: order.status,
    date: extras.paidAt ?? order.createdAt,
    shippingCharged: order.shipping ?? 0,
    actualShippingCost: extras.actualShippingCost ?? 0,
    paymentFee: extras.paymentFee ?? 0,
    extraCosts: extras.extraCosts ?? 0,
    lines,
  }
}

/** Fetch every order in [from, to) with the given statuses, paginating past the first page. */
async function fetchOrders(
  payload: Payload,
  period: Period,
  statuses: readonly string[],
): Promise<Order[]> {
  const docs: Order[] = []
  let page = 1
  for (;;) {
    const result = await payload.find({
      collection: 'orders',
      where: {
        and: [
          { status: { in: [...statuses] } },
          { createdAt: { greater_than_equal: period.from } },
          { createdAt: { less_than: period.to } },
        ],
      },
      depth: 1,
      limit: PAGE_SIZE,
      page,
      sort: '-createdAt',
      // No overrideAccess: the endpoint already gated on req.user; default read access
      // (req.user present) is exactly what we want.
    })
    docs.push(...result.docs)
    if (!result.hasNextPage || docs.length >= MAX_ORDERS) break
    page += 1
  }
  return docs
}

function buildWarnings(orders: AnalyticsOrder[]): Warning[] {
  const warnings: Warning[] = []

  let missingCostLines = 0
  let vatEstimatedLines = 0
  for (const o of orders) {
    for (const l of o.lines) {
      if (l.costEstimated) missingCostLines += 1
      if (l.vatEstimated) vatEstimatedLines += 1
    }
  }

  if (missingCostLines > 0) {
    warnings.push({
      code: 'missing-cost',
      count: missingCostLines,
      message: `${missingCostLines} ordrelinjer bruker estimert kostpris (historisk kostpris mangler). Marginen kan være unøyaktig.`,
    })
  }

  if (vatEstimatedLines > 0) {
    warnings.push({
      code: 'vat-not-stored',
      count: vatEstimatedLines,
      message: `${vatEstimatedLines} ordrelinjer mangler lagret MVA-sats — for disse antas 0 % MVA.`,
    })
  }

  return warnings
}

export async function runAnalyticsDetailed(
  payload: Payload,
  query: AnalyticsQuery,
): Promise<{ response: AnalyticsResponse; current: AnalyticsOrder[] }> {
  const resolved = resolvePeriod(query.preset, {
    customFrom: query.customFrom,
    customTo: query.customTo,
    now: query.now,
  })
  const grouping: Grouping = query.grouping ?? resolved.suggestedGrouping
  const statuses = query.paidOnly ? PAID_STATUSES : ALL_STATUSES

  const [currentRaw, previousRaw] = await Promise.all([
    fetchOrders(payload, { from: resolved.from, to: resolved.to }, statuses),
    fetchOrders(payload, resolved.previous, statuses),
  ])

  const current = currentRaw.map(normalizeOrder)
  const previous = previousRaw.map(normalizeOrder)

  const summary = computeSummary(current)
  const previousSummary = computeSummary(previous)

  const response: AnalyticsResponse = {
    period: { from: resolved.from, to: resolved.to, preset: resolved.preset, grouping },
    filters: { paidOnly: query.paidOnly, statuses: [...statuses] },
    summary,
    comparison: computeComparison(summary, previousSummary),
    timeline: computeTimeline(current, { from: resolved.from, to: resolved.to }, grouping),
    products: computeProducts(current),
    variants: computeVariants(current),
    channels: [], // wired in Stage 4 (attribution/UTM)
    recentOrders: computeRecentOrders(current),
    warnings: buildWarnings(current),
  }

  return { response, current }
}

export async function runAnalytics(
  payload: Payload,
  query: AnalyticsQuery,
): Promise<AnalyticsResponse> {
  const { response } = await runAnalyticsDetailed(payload, query)
  return response
}
