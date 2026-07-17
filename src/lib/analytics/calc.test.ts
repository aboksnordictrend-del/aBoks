import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeComparison,
  computeOrderFinancials,
  computeProducts,
  computeSummary,
  computeTimeline,
  computeVariants,
  toNet,
} from './calc'
import type { AnalyticsLine, AnalyticsOrder } from './types'

function line(over: Partial<AnalyticsLine> = {}): AnalyticsLine {
  return {
    productName: 'aBoks',
    variantName: 'Sort',
    quantity: 1,
    unitPrice: 100,
    unitCost: 40,
    costEstimated: false,
    vatRate: 0,
    vatEstimated: false,
    ...over,
  }
}

function order(over: Partial<AnalyticsOrder> = {}): AnalyticsOrder {
  return {
    id: '1',
    orderNumber: 'AB-000001',
    status: 'confirmed',
    date: '2026-03-10T10:00:00.000Z',
    shippingCharged: 0,
    actualShippingCost: 0,
    paymentFee: 0,
    extraCosts: 0,
    lines: [line()],
    ...over,
  }
}

describe('toNet', () => {
  it('returns gross unchanged at 0% VAT', () => {
    assert.equal(toNet(100, 0), 100)
  })
  it('strips 25% VAT', () => {
    assert.equal(toNet(125, 25), 100)
  })
})

describe('computeSummary', () => {
  it('is all zeros with no orders (no NaN)', () => {
    const s = computeSummary([])
    assert.equal(s.orderCount, 0)
    assert.equal(s.revenueGross, 0)
    assert.equal(s.averageOrderValue, 0)
    assert.equal(s.marginPercent, 0)
    assert.equal(s.contributionProfit, 0)
  })

  it('handles a single simple order (VAT 0)', () => {
    const s = computeSummary([order()])
    assert.equal(s.orderCount, 1)
    assert.equal(s.revenueGross, 100)
    assert.equal(s.revenueNet, 100)
    assert.equal(s.productCost, 40)
    assert.equal(s.grossProfit, 60)
    assert.equal(s.averageOrderValue, 100)
    assert.equal(s.unitsSold, 1)
  })

  it('handles quantity > 1 and multiple lines', () => {
    const s = computeSummary([
      order({ lines: [line({ quantity: 3 }), line({ variantName: 'Creme', quantity: 2, unitPrice: 200, unitCost: 60 })] }),
    ])
    // gross = 3*100 + 2*200 = 700 ; cost = 3*40 + 2*60 = 240
    assert.equal(s.revenueGross, 700)
    assert.equal(s.productCost, 240)
    assert.equal(s.grossProfit, 460)
    assert.equal(s.unitsSold, 5)
  })

  it('applies 25% VAT to net revenue and margin', () => {
    const s = computeSummary([
      order({ lines: [line({ quantity: 2, unitPrice: 125, unitCost: 40, vatRate: 25 })] }),
    ])
    assert.equal(s.revenueGross, 250) // paid incl VAT
    assert.equal(s.revenueNet, 200) // ex VAT
    assert.equal(s.vatAmount, 50)
    assert.equal(s.grossProfit, 120) // 200 - 80
    assert.equal(s.marginPercent, 60)
    assert.equal(s.contributionProfit, 120)
  })

  it('free shipping vs. customer-paid shipping', () => {
    assert.equal(computeSummary([order({ shippingCharged: 0 })]).shippingCharged, 0)
    const paid = computeSummary([order({ shippingCharged: 69 })])
    assert.equal(paid.shippingCharged, 69)
    assert.equal(paid.revenueGross, 169)
  })

  it('actual shipping higher than charged reduces contribution', () => {
    const s = computeSummary([order({ shippingCharged: 0, actualShippingCost: 90 })])
    assert.equal(s.shippingResult, -90)
    // contribution = net(100) - cost(40) - actualShip(90) = -30
    assert.equal(s.contributionProfit, -30)
  })

  it('subtracts payment fee and extra costs from contribution', () => {
    const s = computeSummary([order({ paymentFee: 5, extraCosts: 3 })])
    // net(100) - cost(40) - fee(5) - extra(3) = 52
    assert.equal(s.contributionProfit, 52)
  })

  it('missing cost (0) yields full margin but is still finite', () => {
    const s = computeSummary([order({ lines: [line({ unitCost: 0, costEstimated: true })] })])
    assert.equal(s.productCost, 0)
    assert.equal(s.grossProfit, 100)
    assert.equal(s.marginPercent, 100)
  })
})

describe('computeProducts', () => {
  it('groups by product+variant, computes share, flags estimates', () => {
    const rows = computeProducts([
      order({ lines: [line({ variantName: 'Sort', quantity: 1, unitPrice: 100 })] }),
      order({ lines: [line({ variantName: 'Sort', quantity: 1, unitPrice: 100 }), line({ variantName: 'Creme', quantity: 1, unitPrice: 300, costEstimated: true })] }),
    ])
    const sort = rows.find((r) => r.variantName === 'Sort')!
    const creme = rows.find((r) => r.variantName === 'Creme')!
    assert.equal(sort.unitsSold, 2)
    assert.equal(sort.revenueGross, 200)
    assert.equal(creme.costEstimated, true)
    // total gross = 500 → creme share 60%
    assert.equal(creme.revenueShare, 60)
    // sorted by revenue desc → Creme first (300 > 200)
    assert.equal(rows[0].variantName, 'Creme')
  })

  it('returns empty array with no orders', () => {
    assert.deepEqual(computeProducts([]), [])
  })
})

describe('computeVariants', () => {
  it('aggregates units and share by variant', () => {
    const rows = computeVariants([
      order({ lines: [line({ variantName: 'Sort', quantity: 3 })] }),
      order({ lines: [line({ variantName: 'Creme', quantity: 1 })] }),
    ])
    assert.equal(rows[0].variantName, 'Sort')
    assert.equal(rows[0].unitsShare, 75)
  })
})

describe('computeTimeline', () => {
  it('fills empty buckets with zero across the range', () => {
    const period = { from: '2026-03-09T23:00:00.000Z', to: '2026-03-12T23:00:00.000Z' }
    const points = computeTimeline([order({ date: '2026-03-10T10:00:00.000Z' })], period, 'day')
    assert.equal(points.length, 3)
    const withOrder = points.filter((p) => p.orders > 0)
    assert.equal(withOrder.length, 1)
    assert.equal(withOrder[0].revenue, 100)
  })
})

describe('computeComparison', () => {
  it('reports percentage change and null baseline', () => {
    const cur = computeSummary([order(), order()]) // 2 orders
    const prev = computeSummary([order()]) // 1 order
    const cmp = computeComparison(cur, prev)
    assert.equal(cmp.orderCount.changePercent, 100)
    const emptyCmp = computeComparison(cur, computeSummary([]))
    assert.equal(emptyCmp.orderCount.changePercent, null)
  })
})

describe('computeOrderFinancials', () => {
  it('produces a per-order CSV row without PII', () => {
    const row = computeOrderFinancials(
      order({ shippingCharged: 69, actualShippingCost: 50, paymentFee: 4, lines: [line({ quantity: 2, unitPrice: 125, unitCost: 40, vatRate: 25 })] }),
    )
    assert.equal(row.revenueGross, 319) // 250 + 69
    assert.equal(row.revenueNet, 269) // 200 + 69
    assert.equal(row.vatAmount, 50)
    assert.equal(row.grossProfit, 120)
    // contribution = 269 - 80 - 50 - 4 = 135
    assert.equal(row.contributionProfit, 135)
  })
})
