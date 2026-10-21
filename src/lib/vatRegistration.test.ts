import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Order } from '@/payload-types'
import { buildWarnings, normalizeOrder } from '@/lib/analytics/aggregate'
import { computeOrderFinancials, computeProducts, computeSummary } from '@/lib/analytics/calc'
import { EMPTY_PARTNER_CHANNEL, computeChannelView } from '@/lib/analytics/partnerProgram'
import { VAT_RATE_PERCENT } from '@/lib/tax'
import {
  VAT_REGISTRATION_PERIODS,
  isVatRegisteredOn,
  outputVatFor,
  type VatRegistrationPeriod,
} from './vatRegistration'

/** A hypothetical registration effective 1 January 2027 (Oslo). */
const REGISTERED_2027: VatRegistrationPeriod[] = [{ from: '2027-01-01' }]

/**
 * A stored webshop order exactly as checkout writes it: every line carries the nominal 25 %
 * from `@/lib/tax`, whether or not VAT was really charged.
 */
function storedOrder(date: string, over: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderNumber: 'AB-000001',
    status: 'delivered',
    createdAt: date,
    updatedAt: date,
    paidAt: date,
    shipping: 99,
    total: 1349,
    actualShippingCost: 80,
    paymentFee: 30,
    extraCosts: 0,
    items: [
      { productName: 'aBoks', quantity: 2, unitPrice: 625, unitCost: 150, vatRate: 25 },
    ],
    ...over,
  } as unknown as Order
}

/* ------------------------------ the rule ------------------------------ */

describe('VAT registration — the rule', () => {
  it('is not registered today (no periods declared)', () => {
    assert.deepEqual(VAT_REGISTRATION_PERIODS, [])
    assert.equal(isVatRegisteredOn('2026-10-21T10:00:00.000Z'), false)
  })

  it('uses the Oslo calendar day of the sale, inclusive at both ends', () => {
    const periods = [{ from: '2027-01-01', to: '2027-12-31' }]
    // 31 Dec 2026 23:30 Oslo is still 2026 even though it is 22:30 UTC.
    assert.equal(isVatRegisteredOn('2026-12-31T22:30:00.000Z', periods), false)
    assert.equal(isVatRegisteredOn('2026-12-31T23:00:00.000Z', periods), true) // 1 Jan 00:00 Oslo
    assert.equal(isVatRegisteredOn('2027-12-31T22:00:00.000Z', periods), true) // 31 Dec 23:00 Oslo
    assert.equal(isVatRegisteredOn('2027-12-31T23:00:00.000Z', periods), false) // 1 Jan 2028
  })

  it('ignores the stored nominal rate while not registered', () => {
    assert.deepEqual(outputVatFor({ saleDate: '2026-08-01T10:00:00.000Z', storedRate: 25 }), { rate: 0, treatment: 'notRegistered' })
  })

  it('uses the stored rate inside a registration period, and flags a missing one', () => {
    assert.deepEqual(outputVatFor({ saleDate: '2027-03-01T10:00:00.000Z', storedRate: 25 }, REGISTERED_2027), { rate: 25, treatment: 'stored' })
    assert.deepEqual(outputVatFor({ saleDate: '2027-03-01T10:00:00.000Z', storedRate: 15 }, REGISTERED_2027), { rate: 15, treatment: 'stored' })
    assert.deepEqual(outputVatFor({ saleDate: '2027-03-01T10:00:00.000Z', storedRate: null }, REGISTERED_2027), { rate: VAT_RATE_PERCENT, treatment: 'assumed' })
  })

  it('treats an unreadable date as not registered rather than guessing', () => {
    assert.equal(isVatRegisteredOn('not a date', REGISTERED_2027), false)
  })
})

/* ------------------------------ revenue before and after registration ------------------------------ */

describe('VAT registration — webshop revenue and profit', () => {
  const before = normalizeOrder(storedOrder('2026-09-15T10:00:00.000Z'), REGISTERED_2027)
  const after = normalizeOrder(storedOrder('2027-02-15T10:00:00.000Z'), REGISTERED_2027)

  it('keeps the full amount paid as revenue for a sale before registration', () => {
    const s = computeSummary([before])
    assert.equal(s.revenueGross, 1349)
    assert.equal(s.revenueNet, 1349, 'goods 1 250 + shipping 99, no output VAT')
    assert.equal(s.vatAmount, 0)
    // 1 250 − 300 cost
    assert.equal(s.grossProfit, 950)
    assert.equal(s.contributionProfit, 1349 - 300 - 80 - 30)
  })

  it('deducts the stored 25 % for a sale after registration', () => {
    const s = computeSummary([after])
    assert.equal(s.revenueGross, 1349)
    assert.equal(s.revenueNet, 1000 + 99)
    assert.equal(s.vatAmount, 250)
    assert.equal(s.grossProfit, 700)
  })

  it('keeps each sale on its own treatment when a period mixes both', () => {
    const s = computeSummary([before, { ...after, id: '2' }])
    assert.equal(s.vatAmount, 250)
    assert.equal(s.revenueNet, 1349 + 1099)
  })

  it('never changes a historical sale when a registration is added later', () => {
    const today = computeSummary([normalizeOrder(storedOrder('2026-09-15T10:00:00.000Z'))])
    const afterRegistering = computeSummary([before])
    assert.deepEqual(afterRegistering, today)
  })

  it('carries the treatment through per-order financials (CSV) and product rows', () => {
    assert.equal(computeOrderFinancials(before).vatAmount, 0)
    assert.equal(computeOrderFinancials(after).vatAmount, 250)
    assert.equal(computeProducts([before])[0].revenueNet, 1250)
  })

  it('leaves product cost untouched by the VAT treatment', () => {
    assert.equal(computeSummary([before]).productCost, computeSummary([after]).productCost)
  })

  it('notes the ignored nominal rate instead of the missing-rate warning', () => {
    const warnings = buildWarnings([before], {
      paidAtMissing: 0,
      paidOnly: true,
      settings: null,
      expenses: [],
      cacUnkeyed: 0,
      variantBasedProductIds: null,
    })
    assert.equal(warnings.find((w) => w.code === 'vat-not-registered')?.count, 1)
    assert.equal(warnings.find((w) => w.code === 'vat-not-stored'), undefined)
  })

  it('does not touch the stored order record', () => {
    const order = storedOrder('2026-09-15T10:00:00.000Z')
    normalizeOrder(order, REGISTERED_2027)
    assert.equal((order.items[0] as { vatRate?: number }).vatRate, 25)
  })
})

/* ------------------------------ partner commission and combined profit ------------------------------ */

describe('VAT registration — partner commission and combined profit', () => {
  it('deducts the same stored partner commission whatever the VAT treatment', () => {
    const before = { ...normalizeOrder(storedOrder('2026-09-15T10:00:00.000Z')), partnerCommission: 168.75 }
    const s = computeSummary([before])
    assert.equal(s.partnerCommission, 168.75)
    assert.equal(s.contributionProfit, 1349 - 300 - 80 - 30 - 168.75)
  })

  it('feeds the corrected webshop profit into ABOKS AS totalt, once', () => {
    const online = computeSummary([normalizeOrder(storedOrder('2026-09-15T10:00:00.000Z'))])
    const partner = { ...EMPTY_PARTNER_CHANNEL, revenueGross: 5000, revenueNet: 5000, commission: 750, saleCount: 1, productCost: 1500, shippingCost: 100, profitKnownCosts: 2650 }
    const view = computeChannelView(online, partner)
    assert.equal(view.profitOnline, 939)
    assert.equal(view.profitTotal, 939 + 2650)
    assert.equal(view.revenueTotal, 1349 + 5000)
  })
})

/* ------------------------------ marketing cost in profit ------------------------------ */

describe('VAT registration — marketing cost in Nettbutikk and ABOKS AS totalt', () => {
  it('deducts the marketing cost incl. VAT once, from Nettbutikk only', async () => {
    const { computeAdSpend } = await import('@/lib/analytics/marketing')
    const july = { from: '2026-06-30T22:00:00.000Z', to: '2026-07-31T22:00:00.000Z' }
    const adSpend = computeAdSpend(
      [{ channel: 'meta', amount: 125, vatRate: 25, amountExVat: 100, date: '2026-07-15T10:00:00.000Z' }],
      july,
    )
    assert.equal(adSpend, 125)
    const online = computeSummary([normalizeOrder(storedOrder('2026-07-15T10:00:00.000Z'))], { adSpend })
    assert.equal(online.contributionProfit, 1349 - 300 - 80 - 30 - 125)
    const partner = { ...EMPTY_PARTNER_CHANNEL, revenueGross: 1000, revenueNet: 1000, commission: 150, saleCount: 1, productCost: 300, shippingCost: 50, profitKnownCosts: 500 }
    const view = computeChannelView(online, partner)
    assert.equal(view.profitTotal, online.contributionProfit + 500, 'marketing is not deducted a second time')
  })
})
