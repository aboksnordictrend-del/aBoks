import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateExpense,
  computeAdSpend,
  computeCac,
  computeChannels,
  computeCostPerOrder,
  computeMarketingShare,
  computeRoas,
  ratioEntry,
  type MarketingExpenseInput,
} from './marketing'
import { marketingCsv } from './csv'
import { resolvePeriod } from './period'

const july = resolvePeriod('custom', { customFrom: '2026-07-01', customTo: '2026-07-31' })
const midJuly = resolvePeriod('custom', { customFrom: '2026-07-10', customTo: '2026-07-19' })
const oneDay = resolvePeriod('custom', { customFrom: '2026-07-15', customTo: '2026-07-15' })
const august = resolvePeriod('custom', { customFrom: '2026-08-01', customTo: '2026-08-31' })

function expense(over: Partial<MarketingExpenseInput> = {}): MarketingExpenseInput {
  return {
    channel: 'meta',
    amountExVat: 3100,
    date: '2026-07-15T09:00:00.000Z',
    periodFrom: '2026-07-01T00:00:00.000Z',
    periodTo: '2026-07-31T00:00:00.000Z',
    ...over,
  }
}

describe('allocateExpense — date range', () => {
  it('allocates the full amount when the whole range is inside the period', () => {
    assert.equal(allocateExpense(expense(), july), 3100)
  })
  it('allocates proportionally on partial overlap (10 of 31 days)', () => {
    // 3100 / 31 * 10 = 1000
    assert.equal(allocateExpense(expense(), midJuly), 1000)
  })
  it('allocates a single day as 1/31', () => {
    assert.equal(allocateExpense(expense(), oneDay), 100)
  })
  it('allocates nothing when there is no overlap', () => {
    assert.equal(allocateExpense(expense(), august), 0)
  })
})

describe('allocateExpense — single date (no range)', () => {
  const single = expense({ periodFrom: null, periodTo: null, date: '2026-07-15T09:00:00.000Z' })
  it('counts the full amount on its date within the period', () => {
    assert.equal(allocateExpense(single, july), 3100)
    assert.equal(allocateExpense(single, oneDay), 3100)
  })
  it('counts nothing outside the period', () => {
    assert.equal(allocateExpense(single, august), 0)
  })
})

describe('allocateExpense — leap-year month boundary', () => {
  it('spreads across all 29 days of a leap February', () => {
    const leapFeb = resolvePeriod('custom', { customFrom: '2028-02-01', customTo: '2028-02-29' })
    const feb = expense({
      amountExVat: 2900,
      date: '2028-02-10T09:00:00.000Z',
      periodFrom: '2028-02-01T00:00:00.000Z',
      periodTo: '2028-02-29T00:00:00.000Z',
    })
    assert.equal(allocateExpense(feb, leapFeb), 2900) // 2900/29*29
    const firstTen = resolvePeriod('custom', { customFrom: '2028-02-01', customTo: '2028-02-10' })
    assert.equal(allocateExpense(feb, firstTen), 1000) // 2900/29*10
  })
})

describe('computeAdSpend & computeChannels', () => {
  const expenses: MarketingExpenseInput[] = [
    expense({ channel: 'meta', amountExVat: 3100 }), // full in July
    expense({ channel: 'google', amountExVat: 1000, periodFrom: null, periodTo: null, date: '2026-07-05T09:00:00.000Z' }),
    expense({ channel: 'meta', amountExVat: 500, periodFrom: null, periodTo: null, date: '2026-07-20T09:00:00.000Z' }),
  ]
  it('sums allocated ex-VAT spend for the period', () => {
    assert.equal(computeAdSpend(expenses, july), 4600) // 3100 + 1000 + 500
  })
  it('aggregates per channel with share, sorted desc, no revenue attribution', () => {
    const channels = computeChannels(expenses, july)
    assert.equal(channels[0].channel, 'meta')
    assert.equal(channels[0].amountExVat, 3600)
    assert.equal(channels[0].label, 'Meta Ads')
    const google = channels.find((c) => c.channel === 'google')!
    assert.equal(google.amountExVat, 1000)
    // shares sum ~100, no NaN
    const totalShare = channels.reduce((s, c) => s + c.share, 0)
    assert.ok(Math.abs(totalShare - 100) < 0.1)
  })
})

describe('ratios — null-safe (no NaN/Infinity)', () => {
  it('ROAS with cost and when cost = 0', () => {
    assert.equal(computeRoas(10000, 2500), 4)
    assert.equal(computeRoas(10000, 0), null)
  })
  it('CAC with and without new customers', () => {
    assert.equal(computeCac(2000, 5), 400)
    assert.equal(computeCac(2000, 0), null)
  })
  it('cost per order and marketing share', () => {
    assert.equal(computeCostPerOrder(1000, 8), 125)
    assert.equal(computeCostPerOrder(1000, 0), null)
    assert.equal(computeMarketingShare(1000, 5000), 20)
    assert.equal(computeMarketingShare(1000, 0), null)
  })
  it('ratioEntry yields null change against a null/zero previous', () => {
    assert.deepEqual(ratioEntry(4, null), { current: 4, previous: null, changePercent: null })
    assert.deepEqual(ratioEntry(4, 0), { current: 4, previous: 0, changePercent: null })
    assert.equal(ratioEntry(6, 4).changePercent, 50)
    // every field finite or null — never NaN/Infinity
    for (const v of Object.values(ratioEntry(6, 4))) {
      if (v != null) assert.ok(Number.isFinite(v))
    }
  })
})

describe('marketingCsv', () => {
  it('BOM + Norwegian characters + escaping, one row per record', () => {
    const csv = marketingCsv([
      expense({ channel: 'meta', amount: 3875, vatRate: 25, amountExVat: 3100, description: 'Sommer, "kampanje"\nJuli', externalReference: 'FAK-1' }),
    ])
    assert.ok(csv.startsWith('﻿')) // UTF-8 BOM
    assert.ok(csv.includes('Meta Ads'))
    assert.ok(csv.includes('"Sommer, ""kampanje""\nJuli"')) // comma/quote/newline escaped
    assert.ok(csv.includes('FAK-1'))
  })
})
