import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { oereToKr, toOere } from '@/lib/money'
import { calculateCommission } from '@/lib/partner/commission'
import { computeSaleCommission } from '@/lib/partner/referral'
import { computeOrderFinancials, computeSummary } from './calc'
import {
  EMPTY_PARTNER_CHANNEL,
  EMPTY_PARTNER_PROGRAM,
  computeChannelSummary,
  computeChannelView,
  computePartnerProgram,
  type PartnerProgramData,
  type PartnerUsageInput,
  type PartnerWindow,
  type ReferralSaleInput,
} from './partnerProgram'
import type { AnalyticsOrder } from './types'

/* ------------------------------ fixtures ------------------------------ */

// October 2026 (Oslo) and the same-length window before it.
const OCT: PartnerWindow['period'] = { from: '2026-09-30T22:00:00.000Z', to: '2026-10-31T23:00:00.000Z' }
const SEP: PartnerWindow['period'] = { from: '2026-08-30T22:00:00.000Z', to: '2026-09-30T22:00:00.000Z' }

const windows = (currentOrders: string[] = [], previousOrders: string[] = []) => ({
  current: { period: OCT, orderIds: new Set(currentOrders) },
  previous: { period: SEP, orderIds: new Set(previousOrders) },
})

/** A partner usage whose snapshot comes from the real promo engine, as the webhook stores it. */
function usage(over: Partial<PartnerUsageInput> & { rate?: number; subtotal?: number; discount?: number } = {}): PartnerUsageInput {
  const { rate = 15, subtotal = 1000, discount = 100, ...rest } = over
  const result = calculateCommission({
    isPartnerCode: true,
    commissionRate: rate,
    commissionBase: 'orderAfterDiscount',
    subtotalBeforeDiscountOere: toOere(subtotal),
    discountAmountOere: toOere(discount),
    shippingOere: toOere(99),
  })
  return {
    id: 'u1',
    promoCodeId: 'code-anna',
    orderId: 'o1',
    isPartnerUsage: true,
    commissionAmount: oereToKr(result.commissionAmountOere),
    commissionBaseSnapshot: result.commissionBase,
    orderAmountAfterDiscount: oereToKr(result.merchandiseAfterDiscountOere),
    partnerNameSnapshot: 'Anna',
    ...rest,
  }
}

/** A referral sale whose commission comes from the real referral engine, as the sale hook stores it. */
function sale(
  over: Partial<ReferralSaleInput> & { eligible?: boolean; rate?: number; invoiced?: number; shipping?: number } = {},
): ReferralSaleInput {
  const { eligible, rate, invoiced = 10_000, shipping = 0, ...rest } = over
  const category = rest.category ?? 'businessSale'
  const calc = computeSaleCommission({
    category,
    commissionEligibility: eligible == null ? undefined : eligible ? 'eligible' : 'notEligible',
    commissionRate: rate,
    rateOverrideReason: rate == null ? undefined : 'Avtalt',
    invoicedTotal: invoiced,
    shippingAmount: shipping,
    vatTreatment: 'noVat',
  })
  assert.ok(calc.ok)
  const paymentStatus = rest.paymentStatus ?? 'paid'
  return {
    id: 's1',
    partnerId: 'p-anna',
    category,
    paymentStatus,
    commissionStatus:
      paymentStatus === 'paid' ? 'earned' : paymentStatus === 'pending' ? 'pending' : 'reversed',
    commissionAmount: oereToKr(calc.commissionOere),
    commissionBase: oereToKr(calc.baseOere),
    invoicedTotal: invoiced,
    shippingAmount: shipping,
    vatAmount: null,
    saleDate: '2026-10-10T10:00:00.000Z',
    orderId: null,
    productCost: null,
    actualShippingCost: null,
    ...rest,
  }
}

function data(over: Partial<PartnerProgramData> = {}): PartnerProgramData {
  return {
    partners: [
      { id: 'p-anna', name: 'Anna Influencer', status: 'active', partnerType: 'regular' },
      { id: 'p-shop', name: 'Nettbutikken AS', status: 'active', partnerType: 'retailer' },
      { id: 'p-old', name: 'Gammel Partner', status: 'ended', partnerType: 'regular' },
    ],
    promoCodes: [{ id: 'code-anna', code: 'ANNA10', partnerId: 'p-anna', partnerName: 'Anna Influencer' }],
    usages: [],
    orderStatuses: [{ id: 'o1', status: 'confirmed' }],
    payouts: [],
    sales: [],
    adjustments: [],
    ...over,
  }
}

const row = (result: ReturnType<typeof computePartnerProgram>, key: string) =>
  result.summary.rows.find((r) => r.key === key)

/* ------------------------------ promo code ------------------------------ */

describe('partner programme — promo code commission', () => {
  it('uses the stored commission: 15 % of goods after discount, shipping excluded', () => {
    const r = computePartnerProgram(data({ usages: [usage()] }), windows(['o1']))
    // 1000 − 100 discount = 900 goods; 15 % = 135. The 99 kr shipping is in neither figure.
    assert.equal(r.summary.metrics.promoSales.current, 900)
    assert.equal(r.summary.metrics.earnedCommission.current, 135)
    assert.equal(r.summary.earnedByMethod.promo, 135)
  })

  it('treats the rate stored on the code (via the usage snapshot) as authoritative', () => {
    const r = computePartnerProgram(data({ usages: [usage({ rate: 20 })] }), windows(['o1']))
    assert.equal(r.summary.metrics.earnedCommission.current, 180)
  })

  it('attributes the sale to the partner the code is linked to', () => {
    const r = computePartnerProgram(data({ usages: [usage()] }), windows(['o1']))
    const anna = row(r, 'p:p-anna')
    assert.ok(anna)
    assert.equal(anna.name, 'Anna Influencer')
    assert.equal(anna.partnerType, 'regular')
    assert.equal(anna.promoSales, 900)
    assert.equal(anna.earnedCommission, 135)
  })

  it('shows a partner code without a partner record as its own row', () => {
    const r = computePartnerProgram(
      data({
        promoCodes: [{ id: 'code-x', code: 'OLA', partnerId: null, partnerName: 'Ola Nordmann' }],
        usages: [usage({ promoCodeId: 'code-x', partnerNameSnapshot: 'Ola Nordmann' })],
      }),
      windows(['o1']),
    )
    const ola = row(r, 'c:code-x')
    assert.ok(ola)
    assert.equal(ola.name, 'Ola Nordmann')
    assert.equal(ola.partnerType, 'unlinked')
    assert.equal(ola.earnedCommission, 135)
  })

  it('excludes legacy usages without a financial snapshot and counts them for the note', () => {
    const legacy = usage({ id: 'u-legacy', commissionBaseSnapshot: null, orderAmountAfterDiscount: null })
    const r = computePartnerProgram(data({ usages: [legacy] }), windows(['o1']))
    assert.equal(r.summary.metrics.earnedCommission.current, 0)
    assert.equal(r.summary.quality.legacyUsagesInPeriod, 1)
  })
})

/* ------------------------------ referral sales ------------------------------ */

describe('partner programme — Bedriftssalg', () => {
  it('earns 25 % of the goods amount only when approved («Gir provisjon»)', () => {
    const r = computePartnerProgram(
      data({ sales: [sale({ eligible: true, invoiced: 10_000, shipping: 200 })] }),
      windows(),
    )
    // 10 000 − 200 shipping = 9 800 goods; 25 % = 2 450.
    assert.equal(r.summary.metrics.businessSales.current, 9800)
    assert.equal(r.summary.earnedByMethod.business, 2450)
  })

  it('counts an unapproved sale as a sale but earns nothing', () => {
    const r = computePartnerProgram(data({ sales: [sale({ eligible: false })] }), windows())
    assert.equal(r.summary.metrics.businessSales.current, 10_000)
    assert.equal(r.summary.metrics.earnedCommission.current, 0)
  })
})

describe('partner programme — Forhandlersalg', () => {
  it('earns 15 % on every paid purchase of the store, repeat purchases included', () => {
    const r = computePartnerProgram(
      data({
        sales: [
          sale({ id: 's1', category: 'retailStore', invoiced: 4000 }),
          sale({ id: 's2', category: 'retailStore', invoiced: 6000, saleDate: '2026-10-20T10:00:00.000Z' }),
        ],
      }),
      windows(),
    )
    assert.equal(r.summary.metrics.retailSales.current, 10_000)
    assert.equal(r.summary.earnedByMethod.retail, 1500)
  })
})

/* ------------------------------ refunds, cancellations, unpaid ------------------------------ */

describe('partner programme — refunds and cancellations', () => {
  it('excludes promo commission on a cancelled or pending order', () => {
    for (const status of ['cancelled', 'pending']) {
      const r = computePartnerProgram(
        data({ usages: [usage()], orderStatuses: [{ id: 'o1', status }] }),
        windows(['o1']),
      )
      assert.equal(r.summary.metrics.earnedCommission.current, 0, status)
      assert.equal(r.summary.metrics.promoSales.current, 0, status)
    }
  })

  it('excludes unpaid, cancelled and refunded referral sales from sales and commission', () => {
    const r = computePartnerProgram(
      data({
        sales: [
          sale({ id: 's1', eligible: true, paymentStatus: 'pending' }),
          sale({ id: 's2', eligible: true, paymentStatus: 'cancelled' }),
          sale({ id: 's3', eligible: true, paymentStatus: 'refunded' }),
        ],
      }),
      windows(),
    )
    assert.equal(r.summary.metrics.businessSales.current, 0)
    assert.equal(r.summary.metrics.earnedCommission.current, 0)
    assert.equal(r.partnerChannel.current.revenueGross, 0)
    assert.equal(r.summary.outstanding.total, 0)
  })
})

/* ------------------------------ adjustments ------------------------------ */

describe('partner programme — commission adjustments', () => {
  it('reports clawbacks created in the period and deducts open ones from Til utbetaling', () => {
    const r = computePartnerProgram(
      data({
        sales: [
          sale({ id: 's1', eligible: true }), // earned 2 500, unpaid
          // Refunded after payout: reversed, its clawback is the adjustment below.
          sale({ id: 's2', eligible: true, paymentStatus: 'refunded', commissionStatus: 'reversed' }),
        ],
        adjustments: [{ id: 'a1', partnerId: 'p-anna', amount: -2500 + 1000, settled: false, createdAt: '2026-10-15T10:00:00.000Z' }],
      }),
      windows(),
    )
    assert.equal(r.summary.metrics.adjustments.current, -1500)
    assert.equal(r.summary.outstandingClawback, 1500)
    // 2 500 earned unpaid − 1 500 open clawback.
    assert.equal(r.summary.outstanding.referral, 1000)
    // The refunded sale is already out of earned commission — the adjustment is not deducted again.
    assert.equal(r.summary.metrics.earnedCommission.current, 2500)
  })

  it('ignores a settled adjustment in the outstanding balance', () => {
    const r = computePartnerProgram(
      data({
        sales: [sale({ eligible: true })],
        adjustments: [{ id: 'a1', partnerId: 'p-anna', amount: -500, settled: true, createdAt: '2026-08-01T10:00:00.000Z' }],
      }),
      windows(),
    )
    assert.equal(r.summary.outstanding.referral, 2500)
    assert.equal(r.summary.metrics.adjustments.current, 0, 'created outside the period')
  })
})

/* ------------------------------ paid vs unpaid ------------------------------ */

describe('partner programme — paid versus unpaid commission', () => {
  it('counts payouts by payout date and keeps Til utbetaling as an all-history balance', () => {
    const r = computePartnerProgram(
      data({
        usages: [usage()], // 135 earned in October
        sales: [sale({ eligible: true, saleDate: '2026-09-10T10:00:00.000Z', commissionStatus: 'paid' })], // earned September, paid
        payouts: [
          { id: 'pay-promo', source: 'promoCode', promoCodeId: 'code-anna', partnerId: 'p-anna', partnerNameSnapshot: 'Anna', amount: 35, payoutDate: '2026-10-05T10:00:00.000Z' },
          { id: 'pay-ref', source: 'referral', promoCodeId: null, partnerId: 'p-anna', partnerNameSnapshot: 'Anna', amount: 2500, payoutDate: '2026-10-02T10:00:00.000Z' },
        ],
      }),
      windows(['o1']),
    )
    // Both payouts fall in October, even though the referral commission was earned in September.
    assert.equal(r.summary.metrics.paidCommission.current, 2535)
    assert.equal(r.summary.metrics.earnedCommission.current, 135, 'September commission is not October earnings')
    // Promo: 135 − 35. Referral: fully paid.
    assert.equal(r.summary.outstanding.promo, 100)
    assert.equal(r.summary.outstanding.referral, 0)
    assert.equal(row(r, 'p:p-anna')?.outstanding, 100)
  })

  it('attributes a legacy promo payout without a partner link through its promo code', () => {
    const r = computePartnerProgram(
      data({
        usages: [usage()],
        payouts: [{ id: 'pay', source: null, promoCodeId: 'code-anna', partnerId: null, partnerNameSnapshot: 'Anna', amount: 135, payoutDate: '2026-10-05T10:00:00.000Z' }],
      }),
      windows(['o1']),
    )
    assert.equal(row(r, 'p:p-anna')?.paidCommission, 135)
    assert.equal(r.summary.outstanding.total, 0)
  })
})

/* ------------------------------ double counting ------------------------------ */

describe('partner programme — duplicate transaction prevention', () => {
  const overlapData = () =>
    data({
      usages: [usage()], // promo on order o1: 900 goods, 135 commission
      // The same webshop order also registered as a Bedriftssalg (explicitly allowed overlap).
      sales: [sale({ eligible: true, invoiced: 900, orderId: 'o1', saleDate: '2026-10-01T10:00:00.000Z' })],
    })

  it('counts an order covered by both a code and a referral sale once in Partnersalg', () => {
    const r = computePartnerProgram(overlapData(), windows(['o1']))
    assert.equal(r.summary.metrics.promoSales.current, 900)
    assert.equal(r.summary.metrics.businessSales.current, 900)
    assert.equal(r.summary.overlapSales, 900)
    assert.equal(r.summary.metrics.partnerSales.current, 900)
    assert.equal(row(r, 'p:p-anna')?.totalSales, 900)
  })

  it('never adds a webshop-linked referral sale to partner-channel revenue', () => {
    const r = computePartnerProgram(overlapData(), windows(['o1']))
    assert.equal(r.partnerChannel.current.revenueGross, 0)
    assert.equal(r.partnerChannel.current.saleCount, 0)
  })

  it('charges both real commissions to the webshop order, once each', () => {
    const r = computePartnerProgram(overlapData(), windows(['o1']))
    // 135 promo + 25 % of 900 = 225 referral.
    assert.equal(r.onlineCommissionByOrder.current.get('o1'), 360)
    assert.equal(r.summary.commissionCharged.online, 360)
    assert.equal(r.summary.commissionCharged.partnerChannel, 0)
    assert.equal(r.summary.metrics.earnedCommission.current, 360)
  })

  it('follows the order, not the sale date, for a webshop-linked referral sale', () => {
    // The order belongs to September's order set; the sale date says October.
    const r = computePartnerProgram(overlapData(), windows([], ['o1']))
    assert.equal(r.summary.metrics.businessSales.current, 0)
    assert.equal(r.summary.metrics.businessSales.previous, 900)
  })
})

/* ------------------------------ dates ------------------------------ */

describe('partner programme — date filtering', () => {
  it('uses the sale date for manual sales and the comparison window for the previous period', () => {
    const r = computePartnerProgram(
      data({
        sales: [
          sale({ id: 's-oct', category: 'retailStore', invoiced: 2000, saleDate: '2026-10-31T22:30:00.000Z' }), // 31 Oct 23:30 Oslo
          sale({ id: 's-nov', category: 'retailStore', invoiced: 3000, saleDate: '2026-10-31T23:00:00.000Z' }), // 1 Nov 00:00 Oslo
          sale({ id: 's-sep', category: 'retailStore', invoiced: 1000, saleDate: '2026-09-15T10:00:00.000Z' }),
        ],
      }),
      windows(),
    )
    assert.equal(r.summary.metrics.retailSales.current, 2000)
    assert.equal(r.summary.metrics.retailSales.previous, 1000)
    assert.equal(r.summary.metrics.retailSales.changePercent, 100)
  })

  it('counts promo usages only for the orders loaded for the period', () => {
    const r = computePartnerProgram(data({ usages: [usage()] }), windows(['other-order']))
    assert.equal(r.summary.metrics.promoSales.current, 0)
    // …but the balance as of today still includes it.
    assert.equal(r.summary.outstanding.promo, 135)
  })
})

/* ------------------------------ partner-level totals ------------------------------ */

describe('partner programme — partner-level totals', () => {
  it('builds one row per partner across all methods, and sums reconcile with the metrics', () => {
    const r = computePartnerProgram(
      data({
        usages: [usage()],
        sales: [
          sale({ id: 's1', eligible: true, invoiced: 4000 }),
          sale({ id: 's2', category: 'retailStore', invoiced: 2000 }),
        ],
      }),
      windows(['o1']),
    )
    const anna = row(r, 'p:p-anna')
    assert.ok(anna)
    assert.equal(anna.promoSales, 900)
    assert.equal(anna.businessSales, 4000)
    assert.equal(anna.retailSales, 2000)
    assert.equal(anna.totalSales, 6900)
    assert.equal(anna.earnedCommission, 135 + 1000 + 300)
    assert.equal(r.summary.metrics.partnersWithActivity.current, 1)

    const sum = r.summary.rows.reduce((s, x) => s + x.earnedCommission, 0)
    assert.equal(sum, r.summary.metrics.earnedCommission.current)
  })

  it('lists active partners of both types, and leaves ended partners without figures out', () => {
    const r = computePartnerProgram(data(), windows())
    assert.ok(row(r, 'p:p-anna'))
    assert.equal(row(r, 'p:p-shop')?.partnerType, 'retailer')
    assert.equal(row(r, 'p:p-shop')?.totalSales, 0)
    assert.equal(row(r, 'p:p-old'), undefined)
    assert.equal(r.summary.activePartnersToday, 2)
    assert.deepEqual(r.summary.activeByType, { regular: 1, retailer: 1, unclassified: 0 })
  })

  it('keeps an ended partner listed while commission is still owed', () => {
    const r = computePartnerProgram(
      data({ sales: [sale({ partnerId: 'p-old', eligible: true, saleDate: '2026-01-10T10:00:00.000Z' })] }),
      windows(),
    )
    assert.equal(row(r, 'p:p-old')?.outstanding, 2500)
    assert.equal(row(r, 'p:p-old')?.status, 'ended')
  })
})

/* ------------------------------ profit ------------------------------ */

function order(over: Partial<AnalyticsOrder> = {}): AnalyticsOrder {
  return {
    id: 'o1',
    orderNumber: 'AB-000001',
    status: 'confirmed',
    date: '2026-10-10T10:00:00.000Z',
    shippingCharged: 99,
    discountAmount: 100,
    actualShippingCost: 80,
    paymentFee: 20,
    extraCosts: 0,
    lines: [
      { productName: 'aBoks', quantity: 2, unitPrice: 500, discountAllocated: 100, unitCost: 150, costEstimated: false, vatRate: 0, vatEstimated: false },
    ],
    ...over,
  }
}

describe('profit — partner commission in the webshop result', () => {
  it('deducts the stored commission exactly once from contributionProfit', () => {
    const without = computeSummary([order()])
    const withCommission = computeSummary([order({ partnerCommission: 135 })])
    assert.equal(withCommission.partnerCommission, 135)
    assert.equal(withCommission.contributionProfit, without.contributionProfit - 135)
    // Revenue and gross profit are untouched — commission is an expense, not a discount.
    assert.equal(withCommission.revenueGross, without.revenueGross)
    assert.equal(withCommission.grossProfit, without.grossProfit)
  })

  it('leaves an order without commission exactly as before', () => {
    // 900 goods + 99 shipping − 300 cost − 80 shipping − 20 fee = 599.
    assert.equal(computeSummary([order()]).contributionProfit, 599)
    assert.equal(computeSummary([order()]).partnerCommission, 0)
  })

  it('carries the commission into the per-order financials (CSV)', () => {
    const row = computeOrderFinancials(order({ partnerCommission: 135 }))
    assert.equal(row.partnerCommission, 135)
    assert.equal(row.contributionProfit, 599 - 135)
  })

  it('does not deduct a payout as an expense on top of the earned commission', () => {
    const program = computePartnerProgram(
      data({
        usages: [usage()],
        payouts: [{ id: 'pay', source: 'promoCode', promoCodeId: 'code-anna', partnerId: 'p-anna', partnerNameSnapshot: 'Anna', amount: 135, payoutDate: '2026-10-05T10:00:00.000Z' }],
      }),
      windows(['o1']),
    )
    const commission = program.onlineCommissionByOrder.current.get('o1')
    assert.equal(commission, 135, 'the payout does not add to the charge')
    const s = computeSummary([order({ partnerCommission: commission })])
    assert.equal(s.contributionProfit, 599 - 135)
  })
})

describe('profit — three channel views', () => {
  it('reconciles Nettbutikk + Partnersalg = ABOKS AS totalt', () => {
    const program = computePartnerProgram(
      data({ sales: [sale({ category: 'retailStore', invoiced: 4000, shipping: 0 })] }),
      windows(),
    )
    const online = computeSummary([order()])
    const view = computeChannelView(online, program.partnerChannel.current)
    assert.equal(view.revenueOnline, 999)
    assert.equal(view.revenuePartner, 4000)
    assert.equal(view.revenueTotal, 4999)
    // A manual sale without product lines → profit is unavailable, never «free goods».
    assert.equal(view.profitPartner, null)
    assert.equal(view.profitTotal, null)
    // Upper bound: online 599 + (4000 − 600 commission), no cost deducted because none is known.
    assert.equal(view.profitTotalUpperBound, 599 + 3400)
    assert.equal(program.summary.commissionCharged.partnerChannel, 600)
  })

  it('gives an exact combined profit when the period has no manual partner sales', () => {
    const view = computeChannelView(computeSummary([order({ partnerCommission: 135 })]), EMPTY_PARTNER_CHANNEL)
    assert.equal(view.profitPartner, 0)
    assert.equal(view.profitTotal, 464)
    assert.equal(view.profitOnline, 464)
  })

  it('exposes nullable comparison entries and the missing-cost count', () => {
    const program = computePartnerProgram(data({ sales: [sale({ category: 'retailStore' })] }), windows())
    const current = computeChannelView(computeSummary([order()]), program.partnerChannel.current)
    const previous = computeChannelView(computeSummary([]), program.partnerChannel.previous)
    const summary = computeChannelSummary(current, previous, program.partnerChannel.current)
    assert.equal(summary.profitTotal.current, null)
    assert.equal(summary.profitTotal.changePercent, null)
    assert.equal(summary.revenuePartner.current, 10_000)
    assert.equal(summary.partnerCostMissingSales, 1)
  })

  it('splits earned commission between the channels without loss', () => {
    const program = computePartnerProgram(
      data({
        usages: [usage()],
        sales: [sale({ id: 's1', eligible: true, invoiced: 4000 }), sale({ id: 's2', eligible: true, invoiced: 1000, orderId: 'o1' })],
      }),
      windows(['o1']),
    )
    const { online, partnerChannel } = program.summary.commissionCharged
    assert.equal(online + partnerChannel, program.summary.metrics.earnedCommission.current)
    const byOrder = [...program.onlineCommissionByOrder.current.values()].reduce((s, v) => s + v, 0)
    assert.equal(byOrder, online)
  })
})

/* ------------------------------ empty ------------------------------ */

describe('partner programme — empty data', () => {
  it('returns zeros and no rows when there are no partners and no transactions', () => {
    const r = computePartnerProgram(
      { partners: [], promoCodes: [], usages: [], orderStatuses: [], payouts: [], sales: [], adjustments: [] },
      windows(),
    )
    assert.equal(r.summary.available, true)
    assert.equal(r.summary.rows.length, 0)
    assert.equal(r.summary.metrics.partnerSales.current, 0)
    assert.equal(r.summary.metrics.partnerSales.changePercent, null)
    assert.equal(r.summary.outstanding.total, 0)
    assert.equal(r.onlineCommissionByOrder.current.size, 0)
    assert.deepEqual(r.partnerChannel.current, EMPTY_PARTNER_CHANNEL)
  })

  it('marks the placeholder for editors as unavailable', () => {
    assert.equal(EMPTY_PARTNER_PROGRAM.available, false)
    assert.equal(EMPTY_PARTNER_PROGRAM.rows.length, 0)
  })
})

/* ------------------------------ Partnersalg with product lines ------------------------------ */

describe('profit — Partnersalg with product lines and shipping cost', () => {
  it('deducts product cost, ABOKS AS shipping and commission once each', () => {
    const program = computePartnerProgram(
      data({
        sales: [
          // Forhandlersalg: 6 000 invoiced incl. 200 shipping charged → 5 800 goods, 870 commission.
          sale({ id: 's1', category: 'retailStore', invoiced: 6000, shipping: 200, productCost: 2100, actualShippingCost: 180 }),
        ],
      }),
      windows(),
    )
    const partner = program.partnerChannel.current
    assert.equal(partner.revenueGross, 6000)
    assert.equal(partner.commission, 870)
    assert.equal(partner.productCost, 2100)
    assert.equal(partner.shippingCost, 180)
    assert.equal(partner.costMissingSales, 0)
    // 6 000 − 870 − 2 100 − 180.
    assert.equal(partner.profitKnownCosts, 2850)

    const view = computeChannelView(computeSummary([order()]), partner)
    assert.equal(view.profitPartner, 2850)
    assert.equal(view.profitTotal, 599 + 2850)
    assert.equal(view.revenueTotal, 999 + 6000)
  })

  it('keeps the profit unavailable while one sale lacks product lines or shipping cost', () => {
    const program = computePartnerProgram(
      data({
        sales: [
          sale({ id: 's1', category: 'retailStore', invoiced: 6000, productCost: 2100, actualShippingCost: 0 }),
          sale({ id: 's2', category: 'retailStore', invoiced: 1000, productCost: 300, actualShippingCost: null }),
          sale({ id: 's3', category: 'retailStore', invoiced: 1000, productCost: null, actualShippingCost: 50 }),
        ],
      }),
      windows(),
    )
    const partner = program.partnerChannel.current
    assert.equal(partner.costMissingSales, 2)
    // Only s1's costs are deducted — the missing ones are never treated as 0 in an exact figure.
    assert.equal(partner.productCost, 2100)
    const view = computeChannelView(computeSummary([order()]), partner)
    assert.equal(view.profitPartner, null)
    assert.equal(view.profitTotal, null)
    // 8 000 − 1 200 commission − 2 100 known cost, labelled an upper bound.
    assert.equal(view.profitTotalUpperBound, 599 + 4700)
  })

  it('never takes cost from a webshop-linked referral sale — the order already carries it', () => {
    const program = computePartnerProgram(
      data({ sales: [sale({ eligible: true, orderId: 'o1', productCost: 999, actualShippingCost: 99 })] }),
      windows(['o1']),
    )
    assert.equal(program.partnerChannel.current.productCost, 0)
    assert.equal(program.partnerChannel.current.costMissingSales, 0)
  })
})

/* ------------------------------ VAT ------------------------------ */

describe('VAT — manual referral sales follow each sale’s own VAT treatment', () => {
  it('deducts no VAT from a sale registered without VAT (ABOKS AS is not VAT-registered)', () => {
    const calc = computeSaleCommission({ category: 'retailStore', invoicedTotal: 10_000, shippingAmount: 0, vatTreatment: 'noVat' })
    assert.ok(calc.ok)
    assert.equal(calc.baseOere, toOere(10_000), 'the full goods amount is the base')
    const program = computePartnerProgram(data({ sales: [sale({ category: 'retailStore' })] }), windows())
    assert.equal(program.partnerChannel.current.revenueNet, program.partnerChannel.current.revenueGross)
  })

  it('refuses a VAT amount on a sale registered without VAT', () => {
    const calc = computeSaleCommission({ category: 'retailStore', invoicedTotal: 10_000, vatTreatment: 'noVat', vatAmount: 2000 })
    assert.equal(calc.ok, false)
  })

  it('deducts VAT only when the sale was explicitly invoiced with VAT and the amount entered', () => {
    const calc = computeSaleCommission({ category: 'retailStore', invoicedTotal: 12_500, vatTreatment: 'vatDeducted', vatAmount: 2500 })
    assert.ok(calc.ok)
    assert.equal(calc.baseOere, toOere(10_000))
    const program = computePartnerProgram(
      data({ sales: [sale({ category: 'retailStore', invoiced: 12_500, vatAmount: 2500, commissionBase: 10_000, commissionAmount: 1500 })] }),
      windows(),
    )
    assert.equal(program.partnerChannel.current.revenueGross, 12_500)
    assert.equal(program.partnerChannel.current.revenueNet, 10_000)
  })

  it('reads the stored commission rather than recalculating historical records', () => {
    // A sale stored with a commission that differs from today's formula keeps its stored figure.
    const program = computePartnerProgram(
      data({ sales: [sale({ category: 'retailStore', commissionAmount: 1234 })] }),
      windows(),
    )
    assert.equal(program.summary.earnedByMethod.retail, 1234)
  })
})
