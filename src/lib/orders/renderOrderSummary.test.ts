import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOrderSummaryRows,
  discountLabel,
  hasDiscount,
  resolveDiscountAmount,
  type OrderSummaryInput,
} from './renderOrderSummary'

/** 449 kr goods + 69 kr shipping, WELCOME10 taking 44,90 off. */
const DISCOUNTED: OrderSummaryInput = {
  subtotal: 449,
  shipping: 69,
  total: 473.1,
  discount: { code: 'WELCOME10', discountAmount: 44.9 },
}

const PLAIN: OrderSummaryInput = { subtotal: 449, shipping: 69, total: 518 }

const labels = (order: OrderSummaryInput) => buildOrderSummaryRows(order).map((r) => r.label)
const keys = (order: OrderSummaryInput) => buildOrderSummaryRows(order).map((r) => r.key)
const rowFor = (order: OrderSummaryInput, key: string) =>
  buildOrderSummaryRows(order).find((r) => r.key === key)

describe('buildOrderSummaryRows — no promo', () => {
  it('produces exactly the three rows an ordinary order has always had', () => {
    assert.deepEqual(buildOrderSummaryRows(PLAIN), [
      { key: 'subtotal', label: 'Delsum', amount: 449 },
      { key: 'shipping', label: 'Frakt', amount: 69, free: false },
      { key: 'total', label: 'Totalt', amount: 518, strong: true },
    ])
  })

  it('never emits an empty, zero or placeholder discount row', () => {
    const noPromoShapes: OrderSummaryInput[] = [
      PLAIN,
      { ...PLAIN, discount: null },
      { ...PLAIN, discount: undefined },
      { ...PLAIN, discount: { code: 'WELCOME10', discountAmount: 0 } },
      { ...PLAIN, discount: { code: null, discountAmount: null } },
      { ...PLAIN, discount: { code: 'WELCOME10' } },
    ]
    for (const order of noPromoShapes) {
      assert.ok(!keys(order).includes('discount'), JSON.stringify(order.discount))
      assert.equal(hasDiscount(order), false)
      assert.ok(!labels(order).some((l) => l.includes('Rabatt')))
    }
  })

  it('marks free shipping', () => {
    const free = { subtotal: 898, shipping: 0, total: 898 }
    assert.equal(rowFor(free, 'shipping')?.free, true)
    assert.equal(rowFor(free, 'shipping')?.amount, 0)
  })
})

describe('buildOrderSummaryRows — with a promo', () => {
  it('puts Rabatt (CODE) between Frakt and Totalt', () => {
    assert.deepEqual(keys(DISCOUNTED), ['subtotal', 'shipping', 'discount', 'total'])
    assert.deepEqual(labels(DISCOUNTED), ['Delsum', 'Frakt', 'Rabatt (WELCOME10)', 'Totalt'])
  })

  it('shows the stored amount as a negative, and the stored total', () => {
    assert.equal(rowFor(DISCOUNTED, 'discount')?.amount, -44.9)
    assert.equal(rowFor(DISCOUNTED, 'subtotal')?.amount, 449, 'subtotal stays pre-discount')
    assert.equal(rowFor(DISCOUNTED, 'total')?.amount, 473.1)
  })

  it('stays internally consistent: subtotal − discount + shipping === total', () => {
    const rows = buildOrderSummaryRows(DISCOUNTED)
    const sum = rows
      .filter((r) => r.key !== 'total')
      .reduce((acc, r) => acc + r.amount, 0)
    assert.equal(Math.round(sum * 100), Math.round((rowFor(DISCOUNTED, 'total')!.amount) * 100))
  })

  it('renders a fixed-amount promo the same way', () => {
    const fixed: OrderSummaryInput = {
      subtotal: 449,
      shipping: 69,
      total: 418,
      discount: { code: 'ABOKS100', discountAmount: 100 },
    }
    assert.equal(rowFor(fixed, 'discount')?.label, 'Rabatt (ABOKS100)')
    assert.equal(rowFor(fixed, 'discount')?.amount, -100)
    assert.equal(rowFor(fixed, 'total')?.amount, 418)
  })

  it('keeps free shipping and a discount side by side', () => {
    const order: OrderSummaryInput = {
      subtotal: 700,
      shipping: 0,
      total: 600,
      discount: { code: 'SOMMER100', discountAmount: 100 },
    }
    assert.deepEqual(keys(order), ['subtotal', 'shipping', 'discount', 'total'])
    assert.equal(rowFor(order, 'shipping')?.free, true)
    assert.equal(rowFor(order, 'total')?.amount, 600)
  })

  it('handles a discount larger than the shipping fee', () => {
    const order: OrderSummaryInput = {
      subtotal: 449,
      shipping: 69,
      total: 118,
      discount: { code: 'STOR400', discountAmount: 400 },
    }
    assert.equal(rowFor(order, 'discount')?.amount, -400)
    assert.equal(rowFor(order, 'total')?.amount, 118)
  })

  it('falls back to a plain Rabatt label when the order carries no code', () => {
    // A webhook-reconstructed order can know the amount but not the code identity.
    const order: OrderSummaryInput = { ...DISCOUNTED, discount: { discountAmount: 44.9 } }
    assert.equal(rowFor(order, 'discount')?.label, 'Rabatt')
    assert.equal(discountLabel(null), 'Rabatt')
    assert.equal(discountLabel('  '), 'Rabatt')
    assert.equal(discountLabel(' WELCOME10 '), 'Rabatt (WELCOME10)')
  })
})

describe('resolveDiscountAmount — historical correctness', () => {
  it('prefers the stored snapshot amount over anything derivable', () => {
    // Even if the other figures disagreed, the stored amount is what was charged.
    assert.equal(resolveDiscountAmount(DISCOUNTED), 44.9)
  })

  it('falls back to the amount implied by the stored figures for legacy orders', () => {
    // An order predating the discount group, or one an admin adjusted by hand — this is
    // exactly what the PDF receipt has always inferred, so those keep rendering as before.
    assert.equal(resolveDiscountAmount({ subtotal: 449, shipping: 69, total: 473.1 }), 44.9)
  })

  it('ignores floating-point dust', () => {
    assert.equal(resolveDiscountAmount({ subtotal: 449, shipping: 69, total: 517.999 }), 0)
  })

  it('never produces a negative discount', () => {
    // A total larger than subtotal + shipping (a surcharge, or bad data) is not a discount.
    assert.equal(resolveDiscountAmount({ subtotal: 449, shipping: 69, total: 600 }), 0)
  })

  it('is unaffected by a promo that has since expired or been deleted', () => {
    // The helper is given the stored snapshot only — there is no promo record to consult and
    // no code path that could look one up.
    const historic: OrderSummaryInput = {
      subtotal: 449,
      shipping: 69,
      total: 473.1,
      discount: { code: 'UTGATT2024', discountAmount: 44.9 },
    }
    assert.deepEqual(labels(historic), ['Delsum', 'Frakt', 'Rabatt (UTGATT2024)', 'Totalt'])
    assert.equal(rowFor(historic, 'discount')?.amount, -44.9)
  })

  it('is unaffected by a later product price or shipping change', () => {
    // Same stored order rendered twice; nothing outside the argument can influence it.
    const first = buildOrderSummaryRows(DISCOUNTED)
    const second = buildOrderSummaryRows({ ...DISCOUNTED })
    assert.deepEqual(first, second)
    // The catalogue could now say 549 kr and shipping could be free — irrelevant.
    assert.equal(first[0].amount, 449)
    assert.equal(first[1].amount, 69)
  })

  it('treats a missing shipping value as zero', () => {
    assert.deepEqual(buildOrderSummaryRows({ subtotal: 449, total: 449 }), [
      { key: 'subtotal', label: 'Delsum', amount: 449 },
      { key: 'shipping', label: 'Frakt', amount: 0, free: true },
      { key: 'total', label: 'Totalt', amount: 449, strong: true },
    ])
  })
})

describe('multi-line and multi-quantity orders', () => {
  it('remains an order-level row regardless of how many lines there are', () => {
    // The helper only ever sees order-level totals — line counts cannot change its output.
    const order: OrderSummaryInput = {
      subtotal: 1_646,
      shipping: 0,
      total: 1_481.4,
      discount: { code: 'VAR10', discountAmount: 164.6 },
    }
    assert.deepEqual(keys(order), ['subtotal', 'shipping', 'discount', 'total'])
    assert.equal(rowFor(order, 'discount')?.amount, -164.6)
  })
})
