import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeComparison,
  computeOrderFinancials,
  computeProducts,
  computeRecentOrders,
  computeSummary,
  computeTimeline,
  computeVariants,
  flattenVariants,
  toNet,
} from './calc'
import { ordersCsv, productsCsv } from './csv'
import type { AnalyticsLine, AnalyticsOrder } from './types'

function line(over: Partial<AnalyticsLine> = {}): AnalyticsLine {
  return {
    productId: 'p1',
    productName: 'aBoks',
    variantId: 'v-sort',
    variantName: 'Sort',
    variantDisplayName: 'aBoks – Sort',
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
  it('is all zeros with no orders (no NaN/Infinity)', () => {
    const s = computeSummary([])
    assert.equal(s.orderCount, 0)
    assert.equal(s.paidOrders, 0)
    assert.equal(s.revenueGross, 0)
    assert.equal(s.averageOrderValue, 0)
    assert.equal(s.avgUnitsPerOrder, 0)
    assert.equal(s.avgUnitPrice, 0)
    assert.equal(s.marginPercent, 0)
    assert.equal(s.contributionProfit, 0)
    for (const v of Object.values(s)) assert.ok(Number.isFinite(v))
  })

  it('handles a single simple order (VAT 0)', () => {
    const s = computeSummary([order()])
    assert.equal(s.orderCount, 1)
    assert.equal(s.paidOrders, 1)
    assert.equal(s.revenueGross, 100)
    assert.equal(s.revenueNet, 100)
    assert.equal(s.productCost, 40)
    assert.equal(s.grossProfit, 60)
    assert.equal(s.averageOrderValue, 100)
    assert.equal(s.unitsSold, 1)
  })

  it('counts paid vs pending orders separately', () => {
    const s = computeSummary([order(), order({ id: '2', status: 'pending' })])
    assert.equal(s.orderCount, 2)
    assert.equal(s.paidOrders, 1)
  })

  it('passes cancelledOrders and adSpend through', () => {
    const s = computeSummary([order()], { cancelledOrders: 4, adSpend: 30 })
    assert.equal(s.cancelledOrders, 4)
    assert.equal(s.adSpend, 30)
    // contribution = net(100) − cost(40) − adSpend(30) = 30
    assert.equal(s.contributionProfit, 30)
  })

  it('computes avg units per order and avg unit price', () => {
    const s = computeSummary([
      order({ lines: [line({ quantity: 3, unitPrice: 100 })] }),
      order({ id: '2', lines: [line({ quantity: 2, unitPrice: 150 })] }),
    ])
    // units = 5, orders = 2 → 2.5 ; gross = 300 + 300 = 600 / 5 units = 120
    assert.equal(s.avgUnitsPerOrder, 2.5)
    assert.equal(s.avgUnitPrice, 120)
  })

  it('handles quantity > 1 and multiple lines', () => {
    const s = computeSummary([
      order({ lines: [line({ quantity: 3 }), line({ variantName: 'Creme', quantity: 2, unitPrice: 200, unitCost: 60 })] }),
    ])
    assert.equal(s.revenueGross, 700)
    assert.equal(s.productCost, 240)
    assert.equal(s.grossProfit, 460)
    assert.equal(s.unitsSold, 5)
  })

  it('applies 25% VAT to net revenue and margin', () => {
    const s = computeSummary([
      order({ lines: [line({ quantity: 2, unitPrice: 125, unitCost: 40, vatRate: 25 })] }),
    ])
    assert.equal(s.revenueGross, 250)
    assert.equal(s.revenueNet, 200)
    assert.equal(s.vatAmount, 50)
    assert.equal(s.grossProfit, 120)
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
    assert.equal(s.contributionProfit, -30)
  })

  it('subtracts payment fee and extra costs from contribution', () => {
    const s = computeSummary([order({ paymentFee: 5, extraCosts: 3 })])
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
  it('aggregates at product level with nested variants', () => {
    const rows = computeProducts([
      order({ lines: [line({ variantId: 'v-sort', variantName: 'Sort', quantity: 1, unitPrice: 100 })] }),
      order({ id: '2', lines: [
        line({ variantId: 'v-sort', variantName: 'Sort', quantity: 1, unitPrice: 100 }),
        line({ variantId: 'v-creme', variantName: 'Creme', quantity: 1, unitPrice: 300, costEstimated: true }),
      ] }),
    ])
    assert.equal(rows.length, 1) // one product
    const p = rows[0]
    assert.equal(p.productName, 'aBoks')
    assert.equal(p.orderCount, 2)
    assert.equal(p.unitsSold, 3)
    assert.equal(p.revenueGross, 500)
    assert.equal(p.revenueShare, 100)
    assert.equal(p.costEstimated, true) // bubbles up from a variant
    assert.equal(p.variants.length, 2)
    const sort = p.variants.find((v) => v.variantName === 'Sort')!
    const creme = p.variants.find((v) => v.variantName === 'Creme')!
    assert.equal(sort.unitsSold, 2)
    assert.equal(sort.revenueGross, 200)
    assert.equal(sort.orderCount, 2)
    assert.equal(creme.costEstimated, true)
    assert.equal(creme.revenueShare, 60) // 300 / 500
    assert.equal(creme.parentUnitsShare, 33.33) // 1 of 3 units, round2
    // variants sorted by revenue desc → Creme first
    assert.equal(p.variants[0].variantName, 'Creme')
  })

  it('default sort is gross revenue desc across products', () => {
    const rows = computeProducts([
      order({ lines: [line({ productId: 'p1', productName: 'A', quantity: 1, unitPrice: 100 })] }),
      order({ id: '2', lines: [line({ productId: 'p2', productName: 'B', quantity: 1, unitPrice: 300 })] }),
    ])
    assert.equal(rows[0].productName, 'B')
    assert.equal(rows[1].productName, 'A')
  })

  it('does NOT merge same colour name across different products', () => {
    const orders = [
      order({ lines: [line({ productId: 'p1', productName: 'aBoks', variantId: 'v1', variantName: 'Sort', quantity: 2 })] }),
      order({ id: '2', lines: [line({ productId: 'p2', productName: 'aBoks Mini', variantId: 'v2', variantName: 'Sort', quantity: 5 })] }),
    ]
    const rows = computeProducts(orders)
    assert.equal(rows.length, 2)
    const variants = computeVariants(orders)
    assert.equal(variants.length, 2) // two distinct "Sort" variants, not merged
    assert.equal(variants[0].unitsSold, 5) // Mini/Sort, sorted by units
  })

  it('groups old lines without productId by product name', () => {
    const rows = computeProducts([
      order({ lines: [line({ productId: undefined, variantId: undefined, productName: 'Gammelt produkt', variantName: 'Sort' })] }),
      order({ id: '2', lines: [line({ productId: undefined, variantId: undefined, productName: 'Gammelt produkt', variantName: 'Sort' })] }),
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].unitsSold, 2)
    assert.equal(rows[0].orderCount, 2)
  })

  it('propagates missing-VAT lines as gross==net', () => {
    const rows = computeProducts([
      order({ lines: [line({ vatRate: 0, vatEstimated: true, quantity: 2, unitPrice: 100 })] }),
    ])
    assert.equal(rows[0].revenueGross, 200)
    assert.equal(rows[0].revenueNet, 200)
  })

  it('returns empty array with no orders (no NaN shares)', () => {
    assert.deepEqual(computeProducts([]), [])
  })
})

describe('computeVariants / flattenVariants', () => {
  it('aggregates units and share by variant', () => {
    const rows = computeVariants([
      order({ lines: [line({ variantId: 'v-sort', variantName: 'Sort', quantity: 3 })] }),
      order({ id: '2', lines: [line({ variantId: 'v-creme', variantName: 'Creme', quantity: 1 })] }),
    ])
    assert.equal(rows[0].variantName, 'Sort')
    assert.equal(rows[0].unitsShare, 75)
    assert.equal(rows[0].displayName, 'aBoks – Sort')
  })

  it('flattenVariants keeps parent product reference', () => {
    const products = computeProducts([
      order({ lines: [line({ productId: 'p1', productName: 'aBoks', variantName: 'Sort' })] }),
    ])
    const flat = flattenVariants(products)
    assert.equal(flat[0].parentProductName, 'aBoks')
    assert.equal(flat[0].parentProductId, 'p1')
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
    assert.equal(withOrder[0].unitsSold, 1)
    // empty days are zero, not skipped or NaN
    const empty = points.filter((p) => p.orders === 0)
    assert.equal(empty.length, 2)
    for (const p of empty) {
      assert.equal(p.revenue, 0)
      assert.equal(p.marginPercent, 0)
    }
  })

  it('computes per-bucket margin', () => {
    const period = { from: '2026-03-09T23:00:00.000Z', to: '2026-03-10T23:00:00.000Z' }
    const points = computeTimeline(
      [order({ date: '2026-03-10T10:00:00.000Z', lines: [line({ quantity: 1, unitPrice: 100, unitCost: 40 })] })],
      period,
      'day',
    )
    const day = points.find((p) => p.orders > 0)!
    assert.equal(day.grossProfit, 60)
    assert.equal(day.marginPercent, 60)
  })
})

describe('computeComparison', () => {
  it('reports percentage change and null baseline', () => {
    const cur = computeSummary([order(), order({ id: '2' })])
    const prev = computeSummary([order()])
    const cmp = computeComparison(cur, prev)
    assert.equal(cmp.orderCount.changePercent, 100)
    const emptyCmp = computeComparison(cur, computeSummary([]))
    assert.equal(emptyCmp.orderCount.changePercent, null) // previous = 0 → no Infinity/NaN
  })
})

describe('computeRecentOrders', () => {
  it('includes cost, margin and customer name', () => {
    const rows = computeRecentOrders([
      order({ customerName: 'Ola Nordmann', lines: [line({ quantity: 2, unitPrice: 100, unitCost: 40 })] }),
    ])
    assert.equal(rows[0].customerName, 'Ola Nordmann')
    assert.equal(rows[0].cost, 80)
    assert.equal(rows[0].grossProfit, 120)
    assert.equal(rows[0].marginPercent, 60)
  })

  it('sorts newest first and respects the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      order({ id: String(i), date: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` }),
    )
    const rows = computeRecentOrders(many)
    assert.equal(rows.length, 8)
    assert.equal(rows[0].date.slice(0, 10), '2026-03-12')
  })
})

describe('computeOrderFinancials', () => {
  it('produces a per-order CSV row without PII', () => {
    const row = computeOrderFinancials(
      order({ shippingCharged: 69, actualShippingCost: 50, paymentFee: 4, extraCosts: 2, lines: [line({ quantity: 2, unitPrice: 125, unitCost: 40, vatRate: 25 })] }),
    )
    assert.equal(row.revenueGross, 319)
    assert.equal(row.revenueNet, 269)
    assert.equal(row.vatAmount, 50)
    assert.equal(row.grossProfit, 120)
    assert.equal(row.extraCosts, 2)
    // contribution = 269 - 80 - 50 - 4 - 2 = 133
    assert.equal(row.contributionProfit, 133)
  })
})

describe('CSV export', () => {
  const period = { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T00:00:00.000Z' }

  it('starts with a UTF-8 BOM and preserves Norwegian characters', () => {
    const products = computeProducts([
      order({ lines: [line({ productName: 'aBoks Olivengrønn', variantName: 'Grønn', variantDisplayName: 'aBoks – Grønn' })] }),
    ])
    const csv = productsCsv(products, period)
    assert.ok(csv.startsWith('﻿'))
    assert.ok(csv.includes('Grønn'))
    assert.ok(csv.includes('Olivengrønn'))
    assert.ok(csv.includes('2026-03-01'))
  })

  it('escapes commas, quotes and newlines without breaking columns', () => {
    const products = computeProducts([
      order({ lines: [line({ productName: 'Rar, "produkt"\nnavn', variantName: 'Sort' })] }),
    ])
    const csv = productsCsv(products, period)
    // the quote inside the field is doubled and the whole field is wrapped in quotes
    assert.ok(csv.includes('"Rar, ""produkt""\nnavn"'))
  })

  it('orders CSV uses semicolon delimiter and includes extra costs', () => {
    const csv = ordersCsv([order({ extraCosts: 7 })])
    assert.ok(csv.includes('Ekstra kostnader'))
    const headerLine = csv.replace('﻿', '').split('\r\n')[0]
    assert.ok(headerLine.includes(';'))
  })
})

/* ------------------------------ discounted orders ------------------------------ */

describe('discounted orders — revenue', () => {
  it('leaves an order with no discount exactly as before', () => {
    const s = computeSummary([order({ shippingCharged: 69 })])
    assert.equal(s.revenueGross, 169)
    assert.equal(s.discountTotal, 0)
    assert.equal(s.grossProfit, 60) // 100 net − 40 cost
  })

  it('uses the paid amount for a percentage-discounted order', () => {
    const discounted = order({
      shippingCharged: 69,
      discountAmount: 10,
      promoCode: 'WELCOME10',
      lines: [line({ discountAllocated: 10 })],
    })
    const s = computeSummary([discounted])
    assert.equal(s.revenueGross, 159, '100 − 10 + 69')
    assert.equal(s.discountTotal, 10)
  })

  it('uses the paid amount for a fixed-discount order', () => {
    const s = computeSummary([
      order({ discountAmount: 25, lines: [line({ discountAllocated: 25 })] }),
    ])
    assert.equal(s.revenueGross, 75)
  })

  it('does not reduce shipping', () => {
    const s = computeSummary([
      order({ shippingCharged: 69, discountAmount: 10, lines: [line({ discountAllocated: 10 })] }),
    ])
    assert.equal(s.shippingCharged, 69)
  })

  it('never subtracts the discount twice', () => {
    // Product revenue is reduced once, inside the line; discountTotal is reporting only.
    const s = computeSummary([
      order({ shippingCharged: 69, discountAmount: 10, lines: [line({ discountAllocated: 10 })] }),
    ])
    assert.equal(s.revenueGross, 159)
    assert.equal(s.revenueGross + s.discountTotal, 169, 'the pre-discount amount')
  })

  it('sums discounted lines plus shipping to the paid total', () => {
    const o = order({
      shippingCharged: 69,
      discountAmount: 30,
      lines: [
        line({ variantId: 'a', quantity: 2, unitPrice: 100, discountAllocated: 20 }),
        line({ variantId: 'b', quantity: 1, unitPrice: 50, discountAllocated: 10 }),
      ],
    })
    const s = computeSummary([o])
    assert.equal(s.revenueGross, 289, '(200−20) + (50−10) + 69')
  })

  it('reduces the average order value and the average unit price', () => {
    const s = computeSummary([
      order({ discountAmount: 20, lines: [line({ quantity: 2, discountAllocated: 20 })] }),
    ])
    assert.equal(s.averageOrderValue, 180)
    assert.equal(s.avgUnitPrice, 90)
  })
})

describe('discounted orders — cost, profit and margin', () => {
  const discounted = order({
    discountAmount: 20,
    lines: [line({ unitPrice: 100, unitCost: 40, vatRate: 0, discountAllocated: 20 })],
  })

  it('leaves product cost untouched by the discount', () => {
    assert.equal(computeSummary([discounted]).productCost, 40)
  })

  it('reduces gross profit by exactly the discount', () => {
    const before = computeSummary([order()]).grossProfit
    assert.equal(computeSummary([discounted]).grossProfit, before - 20)
  })

  it('computes margin on the discounted revenue', () => {
    const s = computeSummary([discounted])
    // (80 − 40) / 80
    assert.equal(s.marginPercent, 50)
  })

  it('reduces contribution profit by the discount, not twice', () => {
    const s = computeSummary([discounted])
    assert.equal(s.contributionProfit, 40, '80 revenue − 40 cost')
  })

  it('produces no Infinity or NaN at zero revenue', () => {
    const s = computeSummary([
      order({ discountAmount: 100, lines: [line({ discountAllocated: 100 })] }),
    ])
    assert.equal(s.revenueGross, 0)
    assert.equal(s.marginPercent, 0)
    assert.ok(Number.isFinite(s.grossProfit))
  })

  it('never produces negative line revenue from malformed input', () => {
    const s = computeSummary([
      order({ lines: [line({ unitPrice: 100, discountAllocated: 500 })] }),
    ])
    assert.equal(s.revenueGross, 0)
    assert.ok(Number.isFinite(s.revenueNet))
  })
})

describe('discounted orders — VAT and net revenue', () => {
  it('computes VAT from the discounted amount', () => {
    const s = computeSummary([
      order({ discountAmount: 25, lines: [line({ unitPrice: 125, vatRate: 25, discountAllocated: 25 })] }),
    ])
    // Paid 100 incl. 25 % → net 80, VAT 20.
    assert.equal(s.revenueGross, 100)
    assert.equal(s.revenueNet, 80)
    assert.equal(s.vatAmount, 20)
    assert.equal(s.revenueGross - s.vatAmount, s.revenueNet)
  })
})

describe('discounted orders — products, variants, timeline, recent, CSV', () => {
  const o = order({
    shippingCharged: 69,
    discountAmount: 30,
    promoCode: 'WELCOME10',
    lines: [
      line({ variantId: 'a', variantName: 'Sort', quantity: 2, unitPrice: 100, discountAllocated: 20 }),
      line({ variantId: 'b', variantName: 'Blå', quantity: 1, unitPrice: 50, discountAllocated: 10 }),
    ],
  })

  it('reduces product revenue by the allocated discount', () => {
    const [product] = computeProducts([o])
    assert.equal(product.revenueGross, 220, '180 + 40')
  })

  it('reduces variant revenue by each line’s own allocation', () => {
    const variants = computeVariants([o])
    assert.equal(variants.find((v) => v.variantId === 'a')?.revenueGross, 180)
    assert.equal(variants.find((v) => v.variantId === 'b')?.revenueGross, 40)
  })

  it('reduces timeline revenue', () => {
    const points = computeTimeline([o], { from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T00:00:00.000Z' }, 'month')
    assert.equal(points[0].revenue, 289)
  })

  it('reduces recent-order revenue and profit', () => {
    const [recent] = computeRecentOrders([o])
    assert.equal(recent.revenueGross, 289)
    assert.equal(recent.cost, 120, 'cost is unaffected by the discount')
  })

  it('reports the promo on the order financial row', () => {
    const row = computeOrderFinancials(o)
    assert.equal(row.promoCode, 'WELCOME10')
    assert.equal(row.discountAmount, 30)
    assert.equal(row.revenueGross, 289)
    assert.equal(row.revenueBeforeDiscount, 319)
  })

  it('leaves the promo columns blank for an ordinary order', () => {
    const row = computeOrderFinancials(order())
    assert.equal(row.promoCode, '')
    assert.equal(row.discountAmount, 0)
  })

  it('writes the promo columns into the orders CSV', () => {
    const csv = ordersCsv([o])
    assert.ok(csv.includes('Rabattkode'))
    assert.ok(csv.includes('WELCOME10'))
    assert.ok(csv.includes('289'), 'revenue equals the paid amount')
  })

  it('keeps the products CSV consistent with the discounted product rows', () => {
    const csv = productsCsv(computeProducts([o]), { from: '2026-03-01', to: '2026-03-31' })
    assert.ok(csv.includes('180'))
    assert.ok(!csv.includes('319'), 'no pre-discount revenue leaks into the export')
  })
})
