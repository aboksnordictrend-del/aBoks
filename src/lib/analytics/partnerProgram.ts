// Partner-programme analytics and the three-channel financial view (Nettbutikk / Partnersalg /
// ABOKS AS totalt). Pure: every row is fetched by `./partnerProgramQuery.ts` and handed in, so
// this module is unit-testable with plain objects (see partnerProgram.test.ts).
//
// ── No second commission engine ──
//
// Nothing here calculates a commission. Every amount is a figure the existing engines already
// stored and decided:
//
//   • Promokode — `promo-code-usages.commissionAmount`, written at payment by
//     `@/lib/partner/commission` (the rate stored on the promo code, merchandise after discount,
//     shipping excluded). WHICH usages count is decided by `computePartnerBalance`
//     (`@/lib/partner/balance`): partner usage, real Stage-3 snapshot, order still in a paid
//     status. Nothing is counted that the payout endpoint would not count.
//   • Bedriftssalg / Forhandlersalg — `referral-sales.commissionAmount`, frozen by the sale hook
//     through `computeSaleCommission` (25 % / 15 %, admin approval for Bedriftssalg). Totals per
//     partner come from `computeReferralTotals` (`@/lib/partner/referral`), the same function the
//     partner page and the payout panel use.
//
// ── Reporting basis ──
//
//   • Sales and earned commission: by TRANSACTION date. A promo usage follows its webshop order
//     (the order set the dashboard already loaded for the period, so Nettbutikk and
//     Partnerprogram always cover the same orders). A manual referral sale follows its
//     `saleDate`; one linked to a webshop order follows that order, like a promo usage.
//     Each is counted by its CURRENT status: a cancelled order or a refunded sale drops out of
//     every period, exactly as a cancelled order already drops out of the online revenue.
//   • Utbetalt provisjon: by the payout's own `payoutDate` — the real transfer, never re-dated to
//     when the commission was earned.
//   • Til utbetaling: a point-in-time balance as of today (all history), never a period figure.
//   • Provisjonsjusteringer: clawbacks created in the period. They are a settlement mechanism, not
//     a second reversal: the refunded sale has already left «Opptjent provisjon».
//
// ── Money ──
//
// Stored kroner are converted to øre once on the way in; every sum is integer øre. Kroner only
// in the result.

import { oereToKr, toOere } from '@/lib/money'
import {
  computePartnerBalance,
  type BalanceOrderInput,
  type BalancePayoutInput,
  type BalanceUsageInput,
} from '@/lib/partner/balance'
import { computeReferralTotals, isReferralCategory } from '@/lib/partner/referral'
import { knownSaleCosts } from '@/lib/partner/referralCost'
import { ratioEntry } from './marketing'
import type { Period } from './period'
import type { MarketingRatioEntry } from './types'

/* ------------------------------ input rows ------------------------------ */

export interface PartnerInput {
  id: string
  name: string
  /** active | paused | ended. */
  status: string | null
  /** regular | retailer | null (legacy, unclassified). */
  partnerType: string | null
}

export interface PartnerPromoCodeInput {
  id: string
  code: string
  partnerId: string | null
  partnerName: string | null
}

export interface PartnerUsageInput {
  id: string
  promoCodeId: string | null
  orderId: string | null
  isPartnerUsage: boolean | null
  commissionAmount: number | null
  commissionBaseSnapshot: string | null
  /** Merchandise after discount, gross, shipping excluded — the partner's sale. */
  orderAmountAfterDiscount: number | null
  partnerNameSnapshot: string | null
}

export interface PartnerPayoutInput {
  id: string
  /** promoCode | referral | null (legacy = promo). */
  source: string | null
  promoCodeId: string | null
  partnerId: string | null
  partnerNameSnapshot: string | null
  amount: number | null
  payoutDate: string | null
}

export interface ReferralSaleInput {
  id: string
  partnerId: string | null
  category: string | null
  paymentStatus: string | null
  commissionStatus: string | null
  commissionAmount: number | null
  /** Eligible goods amount: invoiced − shipping − other charges − VAT. */
  commissionBase: number | null
  invoicedTotal: number | null
  shippingAmount: number | null
  vatAmount: number | null
  saleDate: string | null
  /** Set when the sale was a webshop order — its revenue is then already in Nettbutikk. */
  orderId: string | null
  /**
   * Σ unit cost × quantity of the sale's product lines, snapshotted from the products'
   * «Total kostpris». Null when the sale has no lines or a line's product has no cost set up.
   */
  productCost: number | null
  /** What ABOKS AS actually paid for shipping. Null = unknown (0 is a real value). */
  actualShippingCost: number | null
}

export interface ReferralAdjustmentInput {
  id: string
  partnerId: string | null
  /** ≤ 0. */
  amount: number | null
  settled: boolean
  createdAt: string | null
}

export interface PartnerProgramData {
  partners: PartnerInput[]
  promoCodes: PartnerPromoCodeInput[]
  usages: PartnerUsageInput[]
  /** Status of every order a usage points at (all history). */
  orderStatuses: BalanceOrderInput[]
  payouts: PartnerPayoutInput[]
  sales: ReferralSaleInput[]
  adjustments: ReferralAdjustmentInput[]
}

/** One reporting window: its dates and the webshop orders the dashboard loaded for it. */
export interface PartnerWindow {
  period: Period
  orderIds: ReadonlySet<string>
}

/* ------------------------------ output ------------------------------ */

export type PartnerTypeLabel = 'regular' | 'retailer' | 'unclassified' | 'unlinked'

export interface PartnerProgramRow {
  key: string
  partnerId?: string
  name: string
  /** `unlinked` = a partner code that is not linked to a partner record. */
  partnerType: PartnerTypeLabel
  status: string | null
  promoSales: number
  businessSales: number
  retailSales: number
  /** Own attribution, with an order counted once even if both a code and a referral cover it. */
  totalSales: number
  earnedCommission: number
  paidCommission: number
  /** As of today, all history. */
  outstanding: number
}

export interface PartnerProgramMetrics {
  partnerSales: MarketingRatioEntry
  promoSales: MarketingRatioEntry
  businessSales: MarketingRatioEntry
  retailSales: MarketingRatioEntry
  earnedCommission: MarketingRatioEntry
  paidCommission: MarketingRatioEntry
  adjustments: MarketingRatioEntry
  partnersWithActivity: MarketingRatioEntry
}

export interface PartnerProgramSummary {
  /** False for editors (financial data is admin-only) or when the data could not be loaded. */
  available: boolean
  activePartnersToday: number
  activeByType: { regular: number; retailer: number; unclassified: number }
  metrics: PartnerProgramMetrics
  /** Earned commission in the period, split by where it is charged. */
  commissionCharged: { online: number; partnerChannel: number }
  /** Earned commission in the period, split by method. */
  earnedByMethod: { promo: number; business: number; retail: number }
  /** Sales covered by both a promo code and a referral sale — counted once in Partnersalg. */
  overlapSales: number
  outstanding: { total: number; promo: number; referral: number }
  /** Open clawbacks owed back to ABOKS AS, as a positive figure, as of today. */
  outstandingClawback: number
  rows: PartnerProgramRow[]
  /** Counts for the data-quality notes. */
  quality: {
    legacyUsagesInPeriod: number
    unreadablePayouts: number
    unreadableReferralRows: number
  }
}

/** One channel's figures for one period. Kroner. */
export interface PartnerChannelFigures {
  /** Invoiced to the customer, incl. shipping and any VAT. */
  revenueGross: number
  /** Invoiced minus VAT. */
  revenueNet: number
  commission: number
  saleCount: number
  /** Product cost of the sales whose costs are known. */
  productCost: number
  /** Shipping ABOKS AS paid, for the sales whose costs are known. */
  shippingCost: number
  /** Sales without a reliable product or shipping cost. Profit is unavailable while > 0. */
  costMissingSales: number
  /**
   * revenueNet − commission − productCost − shippingCost. Exact when `costMissingSales` is 0;
   * otherwise an UPPER BOUND, because the missing costs are not deducted (and never assumed 0).
   */
  profitKnownCosts: number
}

export const EMPTY_PARTNER_CHANNEL: PartnerChannelFigures = {
  revenueGross: 0,
  revenueNet: 0,
  commission: 0,
  saleCount: 0,
  productCost: 0,
  shippingCost: 0,
  costMissingSales: 0,
  profitKnownCosts: 0,
}

/* ------------------------------ helpers ------------------------------ */

const EARNED_REFERRAL_STATUSES = new Set(['earned', 'paid'])

const oere = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? toOere(value) : 0

function inPeriod(value: string | null, period: Period): boolean {
  if (!value) return false
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return false
  return ms >= new Date(period.from).getTime() && ms < new Date(period.to).getTime()
}

/** Manual (non-webshop) partner sales of one window, in øre. */
interface ChannelAcc {
  revenueGross: number
  revenueNet: number
  commission: number
  saleCount: number
  productCost: number
  shippingCost: number
  costMissingSales: number
}

interface Acc {
  promoSales: number
  businessSales: number
  retailSales: number
  overlap: number
  promoCommission: number
  businessCommission: number
  retailCommission: number
  paid: number
}

const emptyAcc = (): Acc => ({
  promoSales: 0,
  businessSales: 0,
  retailSales: 0,
  overlap: 0,
  promoCommission: 0,
  businessCommission: 0,
  retailCommission: 0,
  paid: 0,
})

const accOf = (map: Map<string, Acc>, key: string): Acc => {
  let acc = map.get(key)
  if (!acc) {
    acc = emptyAcc()
    map.set(key, acc)
  }
  return acc
}

/** Resolves who a promo code, usage or payout belongs to. One key per partner. */
class KeyResolver {
  private codeById: Map<string, PartnerPromoCodeInput>
  readonly pseudoNames = new Map<string, string>()

  constructor(promoCodes: PartnerPromoCodeInput[]) {
    this.codeById = new Map(promoCodes.map((c) => [c.id, c]))
  }

  partner(partnerId: string | null, fallbackName: string | null): string {
    if (partnerId) return `p:${partnerId}`
    const name = fallbackName?.trim() || 'Ukjent partner'
    const key = `n:${name.toLowerCase()}`
    if (!this.pseudoNames.has(key)) this.pseudoNames.set(key, name)
    return key
  }

  promoCode(promoCodeId: string | null, fallbackName: string | null): string {
    const code = promoCodeId ? this.codeById.get(promoCodeId) : undefined
    if (code?.partnerId) return `p:${code.partnerId}`
    if (code) {
      const key = `c:${code.id}`
      if (!this.pseudoNames.has(key)) {
        this.pseudoNames.set(key, code.partnerName?.trim() || fallbackName?.trim() || code.code)
      }
      return key
    }
    return this.partner(null, fallbackName)
  }
}

const usageForBalance = (u: PartnerUsageInput): BalanceUsageInput => ({
  id: u.id,
  isPartnerUsage: u.isPartnerUsage,
  commissionAmount: u.commissionAmount,
  commissionBaseSnapshot: u.commissionBaseSnapshot,
  orderAmountAfterDiscount: u.orderAmountAfterDiscount,
  orderId: u.orderId,
})

/** Usages the promo accounting module counts, out of `usages`. */
function includedUsages(usages: PartnerUsageInput[], orderStatuses: BalanceOrderInput[]) {
  const balance = computePartnerBalance({
    usages: usages.map(usageForBalance),
    orders: orderStatuses,
    payouts: [],
  })
  const excluded = new Map(balance.excludedUsages.map((e) => [e.id, e.reason]))
  return {
    included: usages.filter((u) => !excluded.has(String(u.id))),
    legacy: [...excluded.values()].filter((r) => r === 'legacy_no_snapshot').length,
  }
}

/* ------------------------------ one window ------------------------------ */

interface WindowResult {
  byKey: Map<string, Acc>
  /** Commission charged to each webshop order (øre): promo usages + linked referral sales. */
  commissionByOrder: Map<string, number>
  channel: ChannelAcc
  overlap: number
  adjustments: number
  legacyUsages: number
  activeKeys: Set<string>
}

function computeWindow(data: PartnerProgramData, keys: KeyResolver, window: PartnerWindow): WindowResult {
  const byKey = new Map<string, Acc>()
  const commissionByOrder = new Map<string, number>()
  const activeKeys = new Set<string>()
  const addOrderCommission = (orderId: string, amount: number) =>
    commissionByOrder.set(orderId, (commissionByOrder.get(orderId) ?? 0) + amount)

  // ── Promokode: usages on the period's webshop orders, counted by the balance module ──
  const windowUsages = data.usages.filter((u) => u.orderId != null && window.orderIds.has(u.orderId))
  const { included, legacy } = includedUsages(windowUsages, data.orderStatuses)
  // Orders whose promo sale is already counted, per partner and overall.
  const promoOrderKeys = new Map<string, Set<string>>()

  for (const usage of included) {
    const key = keys.promoCode(usage.promoCodeId, usage.partnerNameSnapshot)
    const acc = accOf(byKey, key)
    const commission = oere(usage.commissionAmount)
    acc.promoSales += oere(usage.orderAmountAfterDiscount)
    acc.promoCommission += commission
    activeKeys.add(key)
    const orderId = usage.orderId as string
    addOrderCommission(orderId, commission)
    let set = promoOrderKeys.get(orderId)
    if (!set) promoOrderKeys.set(orderId, (set = new Set()))
    set.add(key)
  }

  // ── Bedriftssalg / Forhandlersalg ──
  const channel: ChannelAcc = {
    revenueGross: 0,
    revenueNet: 0,
    commission: 0,
    saleCount: 0,
    productCost: 0,
    shippingCost: 0,
    costMissingSales: 0,
  }
  let overlap = 0
  const salesByKey = new Map<string, ReferralSaleInput[]>()

  for (const sale of data.sales) {
    const inWindow = sale.orderId != null ? window.orderIds.has(sale.orderId) : inPeriod(sale.saleDate, window.period)
    if (!inWindow) continue
    const key = keys.partner(sale.partnerId, null)
    const list = salesByKey.get(key) ?? []
    list.push(sale)
    salesByKey.set(key, list)

    if (sale.paymentStatus !== 'paid' || !isReferralCategory(sale.category)) continue
    const acc = accOf(byKey, key)
    const goods = oere(sale.commissionBase)
    const commission = EARNED_REFERRAL_STATUSES.has(String(sale.commissionStatus)) ? oere(sale.commissionAmount) : 0
    if (sale.category === 'businessSale') acc.businessSales += goods
    else acc.retailSales += goods
    activeKeys.add(key)

    if (sale.orderId != null) {
      // A webshop order: revenue and costs are already in Nettbutikk, so is its commission.
      addOrderCommission(sale.orderId, commission)
      const promoKeys = promoOrderKeys.get(sale.orderId)
      if (promoKeys) {
        overlap += goods
        if (promoKeys.has(key)) acc.overlap += goods
      }
    } else {
      channel.revenueGross += oere(sale.invoicedTotal)
      channel.revenueNet += oere(sale.invoicedTotal) - oere(sale.vatAmount)
      channel.commission += commission
      channel.saleCount += 1
      const costs = knownSaleCosts(sale)
      if (costs) {
        channel.productCost += toOere(costs.productCost)
        channel.shippingCost += toOere(costs.shippingCost)
      } else {
        channel.costMissingSales += 1
      }
    }
  }

  // Commission per method from the referral accounting module itself.
  for (const [key, list] of salesByKey) {
    const totals = computeReferralTotals(
      list.map((s) => ({
        category: s.category,
        commissionStatus: s.commissionStatus,
        commissionAmountOere: typeof s.commissionAmount === 'number' ? toOere(s.commissionAmount) : null,
      })),
      [],
    )
    const acc = accOf(byKey, key)
    acc.businessCommission += totals.earnedTotalOere.businessSale
    acc.retailCommission += totals.earnedTotalOere.retailStore
  }

  // ── Payouts: by their own payout date ──
  for (const payout of data.payouts) {
    if (!inPeriod(payout.payoutDate, window.period)) continue
    const key =
      payout.source === 'referral' || payout.partnerId
        ? keys.partner(payout.partnerId, payout.partnerNameSnapshot)
        : keys.promoCode(payout.promoCodeId, payout.partnerNameSnapshot)
    accOf(byKey, key).paid += oere(payout.amount)
  }

  let adjustments = 0
  for (const adjustment of data.adjustments) {
    if (inPeriod(adjustment.createdAt, window.period)) adjustments += oere(adjustment.amount)
  }

  return { byKey, commissionByOrder, channel, overlap, adjustments, legacyUsages: legacy, activeKeys }
}

/* ------------------------------ balances (as of today) ------------------------------ */

function computeOutstanding(data: PartnerProgramData, keys: KeyResolver) {
  const byKey = new Map<string, { promo: number; referral: number }>()
  const add = (key: string, field: 'promo' | 'referral', amount: number) => {
    const entry = byKey.get(key) ?? { promo: 0, referral: 0 }
    entry[field] += amount
    byKey.set(key, entry)
  }

  // Promokode: per promo code, exactly as the payout endpoint balances it.
  const usagesByCode = new Map<string, PartnerUsageInput[]>()
  for (const usage of data.usages) {
    const code = usage.promoCodeId ?? `none:${usage.partnerNameSnapshot ?? ''}`
    usagesByCode.set(code, [...(usagesByCode.get(code) ?? []), usage])
  }
  const payoutsByCode = new Map<string, BalancePayoutInput[]>()
  for (const payout of data.payouts) {
    if (payout.source === 'referral' || !payout.promoCodeId) continue
    payoutsByCode.set(payout.promoCodeId, [
      ...(payoutsByCode.get(payout.promoCodeId) ?? []),
      { id: payout.id, amount: payout.amount },
    ])
  }

  let unreadablePayouts = 0
  for (const code of new Set([...usagesByCode.keys(), ...payoutsByCode.keys()])) {
    const usages = usagesByCode.get(code) ?? []
    const balance = computePartnerBalance({
      usages: usages.map(usageForBalance),
      orders: data.orderStatuses,
      payouts: payoutsByCode.get(code) ?? [],
    })
    unreadablePayouts += balance.unreadablePayouts.length
    const key = code.startsWith('none:')
      ? keys.partner(null, usages[0]?.partnerNameSnapshot ?? null)
      : keys.promoCode(code, usages[0]?.partnerNameSnapshot ?? null)
    add(key, 'promo', balance.availableToPayOere)
  }

  // Bedriftssalg / Forhandlersalg: per partner, as the referral payout panel balances it.
  const salesByPartner = new Map<string, ReferralSaleInput[]>()
  for (const sale of data.sales) {
    const key = keys.partner(sale.partnerId, null)
    salesByPartner.set(key, [...(salesByPartner.get(key) ?? []), sale])
  }
  const adjustmentsByPartner = new Map<string, ReferralAdjustmentInput[]>()
  for (const adjustment of data.adjustments) {
    const key = keys.partner(adjustment.partnerId, null)
    adjustmentsByPartner.set(key, [...(adjustmentsByPartner.get(key) ?? []), adjustment])
  }

  let clawback = 0
  let unreadableReferralRows = 0
  for (const key of new Set([...salesByPartner.keys(), ...adjustmentsByPartner.keys()])) {
    const totals = computeReferralTotals(
      (salesByPartner.get(key) ?? []).map((s) => ({
        category: s.category,
        commissionStatus: s.commissionStatus,
        commissionAmountOere: typeof s.commissionAmount === 'number' ? toOere(s.commissionAmount) : null,
      })),
      (adjustmentsByPartner.get(key) ?? []).map((a) => ({
        amountOere: typeof a.amount === 'number' ? toOere(a.amount) : null,
        settled: a.settled,
      })),
    )
    add(key, 'referral', totals.payableOere)
    clawback += totals.outstandingClawbackOere
    unreadableReferralRows += totals.unreadableRows
  }

  return { byKey, clawback, unreadablePayouts, unreadableReferralRows }
}

/* ------------------------------ public entry point ------------------------------ */

export interface PartnerProgramResult {
  summary: PartnerProgramSummary
  /** Commission charged to each webshop order, in kroner — feeds Nettbutikk's profit. */
  onlineCommissionByOrder: { current: Map<string, number>; previous: Map<string, number> }
  partnerChannel: { current: PartnerChannelFigures; previous: PartnerChannelFigures }
}

const sumAcc = (map: Map<string, Acc>, pick: (a: Acc) => number): number =>
  [...map.values()].reduce((sum, a) => sum + pick(a), 0)

const earnedOf = (a: Acc) => a.promoCommission + a.businessCommission + a.retailCommission

function channelFigures(w: WindowResult): PartnerChannelFigures {
  return {
    revenueGross: oereToKr(w.channel.revenueGross),
    revenueNet: oereToKr(w.channel.revenueNet),
    commission: oereToKr(w.channel.commission),
    saleCount: w.channel.saleCount,
    productCost: oereToKr(w.channel.productCost),
    shippingCost: oereToKr(w.channel.shippingCost),
    costMissingSales: w.channel.costMissingSales,
    profitKnownCosts: oereToKr(
      w.channel.revenueNet - w.channel.commission - w.channel.productCost - w.channel.shippingCost,
    ),
  }
}

const toKrMap = (map: Map<string, number>) => new Map([...map].map(([k, v]) => [k, oereToKr(v)]))

function totalsOf(w: WindowResult) {
  const promo = sumAcc(w.byKey, (a) => a.promoSales)
  const business = sumAcc(w.byKey, (a) => a.businessSales)
  const retail = sumAcc(w.byKey, (a) => a.retailSales)
  return {
    promo,
    business,
    retail,
    partnerSales: promo + business + retail - w.overlap,
    earned: sumAcc(w.byKey, earnedOf),
    paid: sumAcc(w.byKey, (a) => a.paid),
  }
}

export function computePartnerProgram(
  data: PartnerProgramData,
  windows: { current: PartnerWindow; previous: PartnerWindow },
): PartnerProgramResult {
  const keys = new KeyResolver(data.promoCodes)
  const current = computeWindow(data, keys, windows.current)
  const previous = computeWindow(data, keys, windows.previous)
  const outstanding = computeOutstanding(data, keys)

  const cur = totalsOf(current)
  const prev = totalsOf(previous)
  const entry = (c: number, p: number) => ratioEntry(oereToKr(c), oereToKr(p))

  // ── Rows ──
  const partnerById = new Map(data.partners.map((p) => [p.id, p]))
  const rowKeys = new Set<string>([
    ...data.partners.filter((p) => p.status === 'active').map((p) => `p:${p.id}`),
    ...current.byKey.keys(),
    ...[...outstanding.byKey].filter(([, v]) => v.promo + v.referral > 0).map(([k]) => k),
  ])

  const rows: PartnerProgramRow[] = []
  for (const key of rowKeys) {
    const acc = current.byKey.get(key) ?? emptyAcc()
    const owed = outstanding.byKey.get(key) ?? { promo: 0, referral: 0 }
    const partner = key.startsWith('p:') ? partnerById.get(key.slice(2)) : undefined
    const partnerType: PartnerTypeLabel = !key.startsWith('p:')
      ? 'unlinked'
      : partner?.partnerType === 'regular' || partner?.partnerType === 'retailer'
        ? partner.partnerType
        : 'unclassified'
    rows.push({
      key,
      partnerId: key.startsWith('p:') ? key.slice(2) : undefined,
      name: partner?.name ?? keys.pseudoNames.get(key) ?? (key.startsWith('p:') ? `Partner ${key.slice(2)}` : 'Ukjent partner'),
      partnerType,
      status: partner?.status ?? null,
      promoSales: oereToKr(acc.promoSales),
      businessSales: oereToKr(acc.businessSales),
      retailSales: oereToKr(acc.retailSales),
      totalSales: oereToKr(acc.promoSales + acc.businessSales + acc.retailSales - acc.overlap),
      earnedCommission: oereToKr(earnedOf(acc)),
      paidCommission: oereToKr(acc.paid),
      outstanding: oereToKr(owed.promo + owed.referral),
    })
  }
  rows.sort((a, b) => b.totalSales - a.totalSales || b.earnedCommission - a.earnedCommission || a.name.localeCompare(b.name, 'nb'))

  const activeByType = { regular: 0, retailer: 0, unclassified: 0 }
  for (const p of data.partners) {
    if (p.status !== 'active') continue
    if (p.partnerType === 'regular') activeByType.regular += 1
    else if (p.partnerType === 'retailer') activeByType.retailer += 1
    else activeByType.unclassified += 1
  }

  const owedPromo = [...outstanding.byKey.values()].reduce((s, v) => s + v.promo, 0)
  const owedReferral = [...outstanding.byKey.values()].reduce((s, v) => s + v.referral, 0)
  const channelCurrent = channelFigures(current)

  const summary: PartnerProgramSummary = {
    available: true,
    activePartnersToday: activeByType.regular + activeByType.retailer + activeByType.unclassified,
    activeByType,
    metrics: {
      partnerSales: entry(cur.partnerSales, prev.partnerSales),
      promoSales: entry(cur.promo, prev.promo),
      businessSales: entry(cur.business, prev.business),
      retailSales: entry(cur.retail, prev.retail),
      earnedCommission: entry(cur.earned, prev.earned),
      paidCommission: entry(cur.paid, prev.paid),
      adjustments: entry(current.adjustments, previous.adjustments),
      partnersWithActivity: ratioEntry(current.activeKeys.size, previous.activeKeys.size),
    },
    commissionCharged: {
      online: oereToKr(cur.earned - current.channel.commission),
      partnerChannel: channelCurrent.commission,
    },
    earnedByMethod: {
      promo: oereToKr(sumAcc(current.byKey, (a) => a.promoCommission)),
      business: oereToKr(sumAcc(current.byKey, (a) => a.businessCommission)),
      retail: oereToKr(sumAcc(current.byKey, (a) => a.retailCommission)),
    },
    overlapSales: oereToKr(current.overlap),
    outstanding: {
      total: oereToKr(owedPromo + owedReferral),
      promo: oereToKr(owedPromo),
      referral: oereToKr(owedReferral),
    },
    outstandingClawback: oereToKr(outstanding.clawback),
    rows,
    quality: {
      legacyUsagesInPeriod: current.legacyUsages,
      unreadablePayouts: outstanding.unreadablePayouts,
      unreadableReferralRows: outstanding.unreadableReferralRows,
    },
  }

  return {
    summary,
    onlineCommissionByOrder: {
      current: toKrMap(current.commissionByOrder),
      previous: toKrMap(previous.commissionByOrder),
    },
    partnerChannel: { current: channelCurrent, previous: channelFigures(previous) },
  }
}

const EMPTY_ENTRY: MarketingRatioEntry = { current: 0, previous: 0, changePercent: null }

export const EMPTY_PARTNER_PROGRAM: PartnerProgramSummary = {
  available: false,
  activePartnersToday: 0,
  activeByType: { regular: 0, retailer: 0, unclassified: 0 },
  metrics: {
    partnerSales: EMPTY_ENTRY,
    promoSales: EMPTY_ENTRY,
    businessSales: EMPTY_ENTRY,
    retailSales: EMPTY_ENTRY,
    earnedCommission: EMPTY_ENTRY,
    paidCommission: EMPTY_ENTRY,
    adjustments: EMPTY_ENTRY,
    partnersWithActivity: EMPTY_ENTRY,
  },
  commissionCharged: { online: 0, partnerChannel: 0 },
  earnedByMethod: { promo: 0, business: 0, retail: 0 },
  overlapSales: 0,
  outstanding: { total: 0, promo: 0, referral: 0 },
  outstandingClawback: 0,
  rows: [],
  quality: { legacyUsagesInPeriod: 0, unreadablePayouts: 0, unreadableReferralRows: 0 },
}

/* ------------------------------ three channel views ------------------------------ */

export interface ChannelPeriodView {
  revenueOnline: number
  revenuePartner: number
  revenueTotal: number
  profitOnline: number
  /** Null while any manual partner sale in the period lacks its product or shipping cost. */
  profitPartner: number | null
  profitTotal: number | null
  /** Online profit + partner profit with only the KNOWN costs deducted — an upper bound. */
  profitTotalUpperBound: number
}

export interface ChannelSummary {
  revenueOnline: MarketingRatioEntry
  revenuePartner: MarketingRatioEntry
  revenueTotal: MarketingRatioEntry
  profitOnline: MarketingRatioEntry
  profitPartner: MarketingRatioEntry
  profitTotal: MarketingRatioEntry
  profitTotalUpperBound: MarketingRatioEntry
  /** The current period's partner-channel breakdown, for the notes. */
  partner: PartnerChannelFigures
  /** Manual sales in the period without reliable costs — profit is unavailable while > 0. */
  partnerCostMissingSales: number
}

/**
 * Nettbutikk / Partnersalg / ABOKS AS totalt for one period.
 *
 *   Nettbutikk  — the existing order figures, unchanged: `revenueGross` and
 *                 `contributionProfit` (which already carries promo commission and the
 *                 commission of referral sales made through the webshop).
 *   Partnersalg — manual referral sales NOT linked to a webshop order. Revenue = invoiced
 *                 amount; profit = revenue ex VAT − commission − product cost (snapshotted from
 *                 the products' «Total kostpris») − shipping ABOKS AS paid. As soon as one sale
 *                 lacks either cost the profit is unavailable (null), never computed as if the
 *                 missing cost were 0.
 *   Totalt      — the two added. Shared costs (marketing) sit only in Nettbutikk, so nothing is
 *                 counted twice.
 */
export function computeChannelView(
  online: { revenueGross: number; contributionProfit: number },
  partner: PartnerChannelFigures,
): ChannelPeriodView {
  const profitPartner = partner.costMissingSales > 0 ? null : partner.profitKnownCosts
  const round = (kr: number) => oereToKr(toOere(kr))
  return {
    revenueOnline: online.revenueGross,
    revenuePartner: partner.revenueGross,
    revenueTotal: round(online.revenueGross + partner.revenueGross),
    profitOnline: online.contributionProfit,
    profitPartner,
    profitTotal: profitPartner == null ? null : round(online.contributionProfit + profitPartner),
    profitTotalUpperBound: round(online.contributionProfit + partner.profitKnownCosts),
  }
}

export function computeChannelSummary(
  current: ChannelPeriodView,
  previous: ChannelPeriodView,
  partner: PartnerChannelFigures,
): ChannelSummary {
  const e = (key: keyof ChannelPeriodView) => ratioEntry(current[key], previous[key])
  return {
    revenueOnline: e('revenueOnline'),
    revenuePartner: e('revenuePartner'),
    revenueTotal: e('revenueTotal'),
    profitOnline: e('profitOnline'),
    profitPartner: e('profitPartner'),
    profitTotal: e('profitTotal'),
    profitTotalUpperBound: e('profitTotalUpperBound'),
    partner,
    partnerCostMissingSales: partner.costMissingSales,
  }
}
