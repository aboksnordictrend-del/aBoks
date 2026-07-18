// Server-side analytics aggregation. Runs inside the auth-guarded endpoint, reads
// orders from Payload, normalizes them, and returns the fully-aggregated response.
// Personal data (customerInfo) is never copied into the response.

import type { Payload, Where } from 'payload'
import type { EconomySetting, MarketingExpense, Order, Product, ProductVariant } from '../../payload-types'
import {
  computeComparison,
  computeProducts,
  computeRecentOrders,
  computeSummary,
  computeTimeline,
  flattenVariants,
} from './calc'
import {
  computeAdSpend,
  computeCac,
  computeChannels,
  computeCostPerOrder,
  computeMarketingShare,
  computeRoas,
  ratioEntry,
  type MarketingExpenseInput,
} from './marketing'
import { round2 } from './money'
import { resolvePeriod, type Grouping, type Period, type PresetKey } from './period'
import type {
  AnalyticsLine,
  AnalyticsOrder,
  AnalyticsResponse,
  MarketingSummary,
  ProductWithoutSales,
  Summary,
  Warning,
} from './types'

// Orders that represent real, paid revenue. Kustom's webhook sets `confirmed` after
// `checkout_complete`; `shipped`/`delivered` are later stages of the same paid order.
export const PAID_STATUSES = ['confirmed', 'shipped', 'delivered'] as const
// "Alle ordre" still excludes `cancelled` — a cancelled order is never revenue.
export const ALL_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered'] as const
// Cancelled orders are counted (as a KPI) but never fetched into the revenue set.
export const CANCELLED_STATUSES = ['cancelled'] as const

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
  /** Marketing/economy figures are admin-only; false hides them from the response. */
  isAdmin?: boolean
}

/** Stage-2 fields are read optionally so this keeps working before/after the migration. */
interface OrderExtras {
  paidAt?: string | null
  actualShippingCost?: number | null
  paymentFee?: number | null
  extraCosts?: number | null
}
type LineExtras = { unitCost?: number | null; vatRate?: number | null }

function productId(line: Order['items'][number]): string | undefined {
  const p = line.product
  if (p && typeof p === 'object') return String((p as Product).id)
  return p != null ? String(p) : undefined
}

function productName(line: Order['items'][number]): string {
  const p = line.product
  if (p && typeof p === 'object') return (p as Product).title
  return 'aBoks'
}

interface VariantMeta {
  variantId?: string
  variantName?: string
  variantDisplayName?: string
  colorName?: string
  colorHex?: string
}

/** Read variant fields from the (depth-1) live relationship, falling back to snapshot text. */
function variantMeta(line: Order['items'][number]): VariantMeta {
  const v = line.variant
  if (v && typeof v === 'object') {
    const variant = v as ProductVariant
    const hex = typeof variant.colorHex === 'string' && variant.colorHex.trim() ? variant.colorHex.trim() : undefined
    const colorName = variant.name?.trim() || undefined
    return {
      variantId: String(variant.id),
      variantName: line.variantName?.trim() || colorName,
      variantDisplayName: variant.displayName?.trim() || undefined,
      colorName,
      colorHex: hex,
    }
  }
  // Variant is an id or absent — keep the snapshot colour label only.
  return {
    variantId: v != null ? String(v) : undefined,
    variantName: line.variantName?.trim() || undefined,
  }
}

/** First + last name from the order's snapshot, for the admin-only recent list. */
function customerName(order: Order): string | undefined {
  const info = order.customerInfo
  const name = [info?.firstName, info?.lastName]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join(' ')
  return name || undefined
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
    const meta = variantMeta(line)
    return {
      productId: productId(line),
      productName: productName(line),
      variantId: meta.variantId,
      variantName: meta.variantName,
      variantDisplayName: meta.variantDisplayName,
      colorName: meta.colorName,
      colorHex: meta.colorHex,
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
    customerName: customerName(order),
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

function buildWarnings(
  orders: AnalyticsOrder[],
  opts: {
    paidAtMissing: number
    paidOnly: boolean
    settings: EconomySetting | null
    expenses: MarketingExpenseInput[]
    cacUnkeyed: number
  },
): Warning[] {
  const warnings: Warning[] = []

  let missingCostLines = 0
  let vatEstimatedLines = 0
  let noProductLines = 0
  let noVariantLines = 0
  for (const o of orders) {
    for (const l of o.lines) {
      if (l.costEstimated) missingCostLines += 1
      if (l.vatEstimated) vatEstimatedLines += 1
      if (!l.productId) noProductLines += 1
      if (!l.variantId) noVariantLines += 1
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

  if (noProductLines > 0) {
    warnings.push({
      code: 'no-product',
      count: noProductLines,
      message: `${noProductLines} ordrelinjer mangler produktkobling — de grupperes på produktnavn i stedet for produkt-ID.`,
    })
  }

  if (noVariantLines > 0) {
    warnings.push({
      code: 'no-variant',
      count: noVariantLines,
      message: `${noVariantLines} ordrelinjer mangler variantkobling — variantstatistikken for disse bygger på fargenavn.`,
    })
  }

  if (opts.paidOnly && opts.paidAtMissing > 0) {
    warnings.push({
      code: 'no-paidat',
      count: opts.paidAtMissing,
      message: `${opts.paidAtMissing} ordre mangler betalt-dato — for disse brukes opprettelsesdato som salgsdato.`,
    })
  }

  // --- Stage 4: economy/marketing advisory warnings ---
  const s = opts.settings

  if (s?.kustomEnabled) {
    const feeMissing = orders.filter((o) => !o.paymentFee).length
    if (feeMissing > 0) {
      warnings.push({
        code: 'fee-zero',
        count: feeMissing,
        message: `${feeMissing} ordre har betalingsgebyr = 0 selv om automatisk gebyr er på. Eldre ordre beregnes ikke på nytt.`,
      })
    }
  }

  if (s?.applyDefaultShippingCost) {
    const shipMissing = orders.filter((o) => !o.actualShippingCost).length
    if (shipMissing > 0) {
      warnings.push({
        code: 'shipping-zero',
        count: shipMissing,
        message: `${shipMissing} ordre har faktisk fraktkostnad = 0 selv om standard fraktkostnad er på. Eldre ordre endres ikke.`,
      })
    }
  }

  const noChannel = opts.expenses.filter((e) => !e.channel).length
  if (noChannel > 0) {
    warnings.push({
      code: 'expense-no-channel',
      count: noChannel,
      message: `${noChannel} markedsføringskostnader mangler kanal.`,
    })
  }

  const badPeriod = opts.expenses.filter(
    (e) => e.periodFrom && e.periodTo && String(e.periodTo) < String(e.periodFrom),
  ).length
  if (badPeriod > 0) {
    warnings.push({
      code: 'expense-bad-period',
      count: badPeriod,
      message: `${badPeriod} markedsføringskostnader har ugyldig periode (periode til før periode fra).`,
    })
  }

  if (opts.cacUnkeyed > 0) {
    warnings.push({
      code: 'cac-unkeyed',
      count: opts.cacUnkeyed,
      message: `${opts.cacUnkeyed} betalte ordre mangler både kunde og e-post — CAC kan ikke ta hensyn til disse.`,
    })
  }

  return warnings
}

/** Count orders in a period+status set without fetching their documents. */
async function countOrders(
  payload: Payload,
  period: Period,
  statuses: readonly string[],
): Promise<number> {
  const result = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { status: { in: [...statuses] } },
        { createdAt: { greater_than_equal: period.from } },
        { createdAt: { less_than: period.to } },
      ],
    },
    depth: 0,
    limit: 1,
    pagination: true,
  })
  return result.totalDocs
}

interface CatalogVariant {
  id: string
  displayName: string
  productName: string
  inventory?: number
}

/** Published products' active variants — used to surface variants with no sales. */
async function fetchCatalogVariants(payload: Payload): Promise<CatalogVariant[]> {
  const products = await payload.find({
    collection: 'products',
    where: { published: { equals: true } },
    depth: 0,
    limit: 500,
  })
  const publishedIds = new Set(products.docs.map((p) => String(p.id)))
  const titleById = new Map(products.docs.map((p) => [String(p.id), p.title]))
  if (publishedIds.size === 0) return []

  const variants = await payload.find({
    collection: 'product-variants',
    depth: 0,
    limit: 1000,
  })

  const out: CatalogVariant[] = []
  for (const v of variants.docs) {
    const parentId = typeof v.product === 'object' ? String((v.product as { id: number }).id) : String(v.product)
    if (!publishedIds.has(parentId)) continue
    out.push({
      id: String(v.id),
      displayName: v.displayName?.trim() || v.name || `Variant ${v.id}`,
      productName: titleById.get(parentId) ?? 'aBoks',
      inventory: typeof v.inventory === 'number' ? v.inventory : undefined,
    })
  }
  return out
}

/**
 * Variants of published products with zero sales in the period. `lastSoldAt` is a
 * best-effort lookup over recent orders containing those variants (one bounded query,
 * no N+1). Any failure degrades gracefully to an empty list — this block is informational.
 */
async function computeProductsWithoutSales(
  payload: Payload,
  soldVariantIds: Set<string>,
): Promise<ProductWithoutSales[]> {
  try {
    const catalog = await fetchCatalogVariants(payload)
    const unsold = catalog.filter((v) => !soldVariantIds.has(v.id))
    if (unsold.length === 0) return []

    const unsoldIds = unsold.map((v) => v.id)
    const lastSold = new Map<string, string>()
    try {
      const recent = await payload.find({
        collection: 'orders',
        where: { 'items.variant': { in: unsoldIds } },
        depth: 0,
        limit: 500,
        sort: '-createdAt',
      })
      // Sorted newest-first: the first time we see a variant is its latest sale.
      for (const order of recent.docs) {
        const when = (order as Order & OrderExtras).paidAt ?? order.createdAt
        for (const line of order.items ?? []) {
          const vid = typeof line.variant === 'object' ? String((line.variant as { id: number }).id) : line.variant != null ? String(line.variant) : undefined
          if (vid && unsoldIds.includes(vid) && !lastSold.has(vid)) lastSold.set(vid, when)
        }
      }
    } catch {
      // lastSoldAt is optional — ignore lookup failures.
    }

    return unsold.map((v) => ({
      variantId: v.id,
      name: v.displayName,
      parentProductName: v.productName,
      inventory: v.inventory,
      lastSoldAt: lastSold.get(v.id),
    }))
  } catch (err) {
    payload.logger.warn(
      `[analytics] products-without-sales lookup failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
    return []
  }
}

/* ------------------------------ Marketing / economy (Stage 4) ------------------------------ */

/** Load the economy-settings global (for data-quality warnings). Null on failure. */
async function loadEconomySettings(payload: Payload): Promise<EconomySetting | null> {
  try {
    return await payload.findGlobal({ slug: 'economy-settings' })
  } catch {
    return null
  }
}

/** Fetch marketing expenses whose date OR period range overlaps [from, to). One query. */
async function fetchMarketingExpenses(
  payload: Payload,
  from: string,
  to: string,
): Promise<MarketingExpenseInput[]> {
  const result = await payload.find({
    collection: 'marketing-expenses',
    where: {
      or: [
        { and: [{ date: { greater_than_equal: from } }, { date: { less_than: to } }] },
        { and: [{ periodFrom: { less_than: to } }, { periodTo: { greater_than_equal: from } }] },
      ],
    },
    depth: 0,
    limit: 5000,
  })
  return result.docs.map((e: MarketingExpense) => {
    const amount = typeof e.amount === 'number' ? e.amount : 0
    const vat = typeof e.vatRate === 'number' ? e.vatRate : 0
    const exVat = typeof e.amountExVat === 'number' ? e.amountExVat : round2(amount / (1 + vat / 100))
    return {
      channel: e.channel,
      amountExVat: exVat,
      date: e.date,
      periodFrom: e.periodFrom,
      periodTo: e.periodTo,
      amount,
      vatRate: vat,
      description: e.description,
      externalReference: e.externalReference,
    }
  })
}

/** Stable customer key: relationship id, else lowercased email. Null when neither exists. */
function customerKey(order: Order): string | null {
  const c = order.customer
  if (c != null) return `c:${typeof c === 'object' ? (c as { id: number }).id : c}`
  const email = order.customerInfo?.email
  if (typeof email === 'string' && email.trim()) return `e:${email.trim().toLowerCase()}`
  return null
}

/**
 * New customers acquired in the period: paid orders whose buyer had no earlier paid order.
 * Two bounded queries (period + prior history for those buyers), no N+1. `unkeyed` counts
 * paid orders in the period with neither a customer link nor an email (CAC cannot see them).
 */
async function computeNewCustomers(
  payload: Payload,
  period: Period,
): Promise<{ count: number; unkeyed: number }> {
  const inPeriod = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { status: { in: [...PAID_STATUSES] } },
        { createdAt: { greater_than_equal: period.from } },
        { createdAt: { less_than: period.to } },
      ],
    },
    depth: 0,
    limit: MAX_ORDERS,
  })

  const periodKeys = new Set<string>()
  let unkeyed = 0
  const ids: number[] = []
  const emails: string[] = []
  for (const o of inPeriod.docs) {
    const key = customerKey(o)
    if (!key) {
      unkeyed += 1
      continue
    }
    if (!periodKeys.has(key)) {
      periodKeys.add(key)
      if (key.startsWith('c:')) ids.push(Number(key.slice(2)))
      else emails.push(key.slice(2))
    }
  }
  if (periodKeys.size === 0) return { count: 0, unkeyed }

  // Buyers who already had a paid order before this period are not new.
  const orClauses: Where[] = []
  if (ids.length) orClauses.push({ customer: { in: ids } })
  if (emails.length) orClauses.push({ 'customerInfo.email': { in: emails } })
  const prior = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { status: { in: [...PAID_STATUSES] } },
        { createdAt: { less_than: period.from } },
        { or: orClauses },
      ],
    },
    depth: 0,
    limit: MAX_ORDERS,
  })
  const priorKeys = new Set<string>()
  for (const o of prior.docs) {
    const key = customerKey(o)
    if (key) priorKeys.add(key)
  }

  let count = 0
  for (const key of periodKeys) if (!priorKeys.has(key)) count += 1
  return { count, unkeyed }
}

/** Build the marketing summary (ratios, channels) for the current period. */
function buildMarketing(
  expenses: MarketingExpenseInput[],
  currentPeriod: Period,
  previousPeriod: Period,
  summary: Summary,
  previousSummary: Summary,
): MarketingSummary {
  const adSpend = summary.adSpend
  const adSpendPrev = previousSummary.adSpend

  return {
    roas: ratioEntry(
      computeRoas(summary.revenueGross, adSpend),
      computeRoas(previousSummary.revenueGross, adSpendPrev),
    ),
    cac: ratioEntry(
      computeCac(adSpend, summary.newCustomers),
      computeCac(adSpendPrev, previousSummary.newCustomers),
    ),
    costPerOrder: ratioEntry(
      computeCostPerOrder(adSpend, summary.paidOrders),
      computeCostPerOrder(adSpendPrev, previousSummary.paidOrders),
    ),
    marketingShare: ratioEntry(
      computeMarketingShare(adSpend, summary.revenueNet),
      computeMarketingShare(adSpendPrev, previousSummary.revenueNet),
    ),
    channels: computeChannels(expenses, currentPeriod),
    attributionConnected: false,
  }
}

const EMPTY_MARKETING: MarketingSummary = {
  roas: { current: null, previous: null, changePercent: null },
  cac: { current: null, previous: null, changePercent: null },
  costPerOrder: { current: null, previous: null, changePercent: null },
  marketingShare: { current: null, previous: null, changePercent: null },
  channels: [],
  attributionConnected: false,
}

export async function runAnalyticsDetailed(
  payload: Payload,
  query: AnalyticsQuery,
): Promise<{ response: AnalyticsResponse; current: AnalyticsOrder[]; expenses: MarketingExpenseInput[] }> {
  const resolved = resolvePeriod(query.preset, {
    customFrom: query.customFrom,
    customTo: query.customTo,
    now: query.now,
  })
  const grouping: Grouping = query.grouping ?? resolved.suggestedGrouping
  const statuses = query.paidOnly ? PAID_STATUSES : ALL_STATUSES
  const isAdmin = query.isAdmin !== false // default admin unless explicitly told otherwise

  const currentPeriod = { from: resolved.from, to: resolved.to }
  const previousPeriod = resolved.previous

  const [currentRaw, previousRaw, cancelledCurrent, cancelledPrevious] = await Promise.all([
    fetchOrders(payload, currentPeriod, statuses),
    fetchOrders(payload, previousPeriod, statuses),
    countOrders(payload, currentPeriod, CANCELLED_STATUSES),
    countOrders(payload, previousPeriod, CANCELLED_STATUSES),
  ])

  // Marketing + economy figures are admin-only (§12). For editors these stay zero/empty.
  const settings = isAdmin ? await loadEconomySettings(payload) : null
  const [expenses, newCurrent, newPrevious] = isAdmin
    ? await Promise.all([
        fetchMarketingExpenses(payload, previousPeriod.from, currentPeriod.to),
        computeNewCustomers(payload, currentPeriod),
        computeNewCustomers(payload, previousPeriod),
      ])
    : [[] as MarketingExpenseInput[], { count: 0, unkeyed: 0 }, { count: 0, unkeyed: 0 }]

  const adSpendCurrent = computeAdSpend(expenses, currentPeriod)
  const adSpendPrevious = computeAdSpend(expenses, previousPeriod)

  // Orders without a stored paidAt (only relevant when filtering on paid orders).
  const paidAtMissing = currentRaw.filter((o) => !(o as Order & OrderExtras).paidAt).length

  const current = currentRaw.map(normalizeOrder)
  const previous = previousRaw.map(normalizeOrder)

  const summary = computeSummary(current, {
    cancelledOrders: cancelledCurrent,
    adSpend: adSpendCurrent,
    newCustomers: newCurrent.count,
  })
  const previousSummary = computeSummary(previous, {
    cancelledOrders: cancelledPrevious,
    adSpend: adSpendPrevious,
    newCustomers: newPrevious.count,
  })

  const products = computeProducts(current)
  const soldVariantIds = new Set<string>()
  for (const p of products) for (const v of p.variants) if (v.variantId) soldVariantIds.add(v.variantId)
  const productsWithoutSales = await computeProductsWithoutSales(payload, soldVariantIds)

  const marketing = isAdmin
    ? buildMarketing(expenses, currentPeriod, previousPeriod, summary, previousSummary)
    : EMPTY_MARKETING

  const response: AnalyticsResponse = {
    period: { from: resolved.from, to: resolved.to, preset: resolved.preset, grouping },
    filters: { paidOnly: query.paidOnly, statuses: [...statuses] },
    summary,
    comparison: computeComparison(summary, previousSummary),
    timeline: computeTimeline(current, currentPeriod, grouping),
    products,
    variants: flattenVariants(products),
    productsWithoutSales,
    marketing,
    recentOrders: computeRecentOrders(current),
    warnings: buildWarnings(current, {
      paidAtMissing,
      paidOnly: query.paidOnly,
      settings,
      expenses,
      cacUnkeyed: newCurrent.unkeyed,
    }),
  }

  return { response, current, expenses }
}

export async function runAnalytics(
  payload: Payload,
  query: AnalyticsQuery,
): Promise<AnalyticsResponse> {
  const { response } = await runAnalyticsDetailed(payload, query)
  return response
}
