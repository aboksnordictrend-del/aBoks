import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateCommission } from '@/lib/partner/commission'
import {
  CORPORATE_EXAMPLE,
  EARNINGS_EXAMPLE,
  EARNINGS_ORDER_COUNTS,
  STANDARD_EXAMPLE,
  calculatePartnerExample,
  earningsSeries,
  formatNok,
  formatPercent,
  normalizeExampleInput,
} from './calculator'

const NBSP = ' '

describe('partner example — published scenarios', () => {
  it('standard order: 1 000 → 900 paid → 135 commission', () => {
    const { perOrder } = calculatePartnerExample(STANDARD_EXAMPLE)
    assert.equal(perOrder.originalOere, 100_000)
    assert.equal(perOrder.corporateDiscountOere, 0)
    assert.equal(perOrder.partnerDiscountOere, 10_000)
    assert.equal(perOrder.customerPaysOere, 90_000)
    assert.equal(perOrder.commissionOere, 13_500)
    assert.equal(perOrder.retainedOere, 76_500)
  })

  it('corporate order: discounts stack — 50 000 → 40 000 → 36 000 → 5 400 commission', () => {
    const { perOrder } = calculatePartnerExample(CORPORATE_EXAMPLE)
    assert.equal(perOrder.corporateDiscountOere, 1_000_000)
    assert.equal(perOrder.afterCorporateOere, 4_000_000)
    // 10 % of the price AFTER the corporate discount — not of the original 50 000.
    assert.equal(perOrder.partnerDiscountOere, 400_000)
    assert.equal(perOrder.customerPaysOere, 3_600_000)
    assert.equal(perOrder.commissionOere, 540_000)
    assert.equal(perOrder.retainedOere, 3_060_000)
  })

  it('stacking is not "best discount only"', () => {
    const { perOrder } = calculatePartnerExample(CORPORATE_EXAMPLE)
    assert.notEqual(perOrder.customerPaysOere, 4_000_000)
    assert.equal(perOrder.corporateDiscountOere + perOrder.partnerDiscountOere, 1_400_000)
  })

  it('earnings chart: 1 080 / 2 700 / 5 400 / 10 800 kr at 800 kr per order', () => {
    const series = earningsSeries(EARNINGS_EXAMPLE, EARNINGS_ORDER_COUNTS)
    assert.deepEqual(
      series.map((p) => p.commissionOere),
      [108_000, 270_000, 540_000, 1_080_000],
    )
  })
})

describe('partner example — follows the commission engine', () => {
  it('matches calculateCommission on the paid-order inputs for many orders', () => {
    for (const orderValueKr of [1, 99.99, 333.33, 849, 12_345.67, 50_000]) {
      for (const corporateDiscountPercent of [0, 7.5, 20, 33]) {
        const { perOrder: o } = calculatePartnerExample({ orderValueKr, corporateDiscountPercent })
        const engine = calculateCommission({
          isPartnerCode: true,
          commissionRate: 15,
          commissionBase: 'orderAfterDiscount',
          subtotalBeforeDiscountOere: o.afterCorporateOere,
          discountAmountOere: o.partnerDiscountOere,
        })
        assert.equal(o.commissionOere, engine.commissionAmountOere)
        // The engine's base is exactly what the customer paid for the goods.
        assert.equal(engine.commissionBasisOere, o.customerPaysOere)
      }
    }
  })

  it('every split adds back up per order, in whole øre', () => {
    for (const orderValueKr of [1, 99.99, 333.33, 849, 12_345.67]) {
      for (const corporateDiscountPercent of [0, 7.5, 20, 33]) {
        const { perOrder: o } = calculatePartnerExample({ orderValueKr, corporateDiscountPercent })
        assert.equal(o.originalOere - o.corporateDiscountOere - o.partnerDiscountOere, o.customerPaysOere)
        assert.equal(o.commissionOere + o.retainedOere, o.customerPaysOere)
        for (const value of Object.values(o)) assert.ok(Number.isInteger(value))
      }
    }
  })

  it('no VAT field exists in the example result', () => {
    const { perOrder } = calculatePartnerExample(CORPORATE_EXAMPLE)
    for (const key of Object.keys(perOrder)) assert.doesNotMatch(key, /vat|net/i)
  })

  it('totals multiply the per-order figures', () => {
    const { perOrder, total, input } = calculatePartnerExample({ ...STANDARD_EXAMPLE, orders: 3 })
    assert.equal(input.orders, 3)
    assert.equal(total.commissionOere, perOrder.commissionOere * 3)
    assert.equal(total.customerPaysOere, 270_000)
  })

  it('clamps and defaults invalid input instead of throwing', () => {
    const input = normalizeExampleInput({
      orderValueKr: Number.NaN,
      orders: 2.6,
      corporateDiscountPercent: 90,
    })
    assert.equal(input.orderValueKr, 0)
    assert.equal(input.orders, 3)
    assert.equal(input.corporateDiscountPercent, 50)
    assert.equal(input.partnerDiscountPercent, 10)
    assert.equal(input.commissionPercent, 15)
    assert.equal(normalizeExampleInput({ orderValueKr: -5, orders: 0 }).orders, 1)
    assert.equal(normalizeExampleInput({ orderValueKr: -5 }).orderValueKr, 0)
  })
})

describe('formatting', () => {
  it('formats whole kroner without decimals and keeps øre when present', () => {
    assert.equal(formatNok(540_000), `5${NBSP}400${NBSP}kr`)
    assert.equal(formatNok(432_050), `4${NBSP}320,50${NBSP}kr`)
    assert.equal(formatNok(0), `0${NBSP}kr`)
  })

  it('never emits a narrow no-break space (hydration-safe)', () => {
    assert.ok(!formatNok(123_456_789).includes(' '))
  })

  it('formats percentages the Norwegian way', () => {
    assert.equal(formatPercent(10), `10${NBSP}%`)
    assert.equal(formatPercent(7.5), `7,5${NBSP}%`)
  })
})
