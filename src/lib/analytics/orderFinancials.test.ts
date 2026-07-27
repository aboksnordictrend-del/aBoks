import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  lineGrossOf,
  resolveLineDiscounts,
  resolveOrderDiscount,
  storedOrderFinancials,
  type StoredOrderMoney,
} from './orderFinancials'

/** 449 kr goods + 69 kr shipping, WELCOME10 taking 44,90 off, as Stage 7 stores it. */
const STAGE7: StoredOrderMoney = {
  subtotal: 449,
  shipping: 69,
  total: 473.1,
  discount: { code: 'WELCOME10', discountAmount: 44.9 },
  items: [{ quantity: 1, unitPrice: 449, lineTotal: 449, discountAmount: 44.9 }],
}

const PLAIN: StoredOrderMoney = {
  subtotal: 449,
  shipping: 69,
  total: 518,
  items: [{ quantity: 1, unitPrice: 449, lineTotal: 449 }],
}

describe('resolveOrderDiscount — precedence', () => {
  it('prefers the explicit stored order discount', () => {
    assert.equal(resolveOrderDiscount(STAGE7), 44.9)
  })

  it('falls back to the sum of stored line allocations', () => {
    const noGroup: StoredOrderMoney = {
      ...STAGE7,
      discount: null,
      items: [
        { quantity: 1, unitPrice: 449, lineTotal: 449, discountAmount: 30 },
        { quantity: 1, unitPrice: 299, lineTotal: 299, discountAmount: 14.9 },
      ],
    }
    assert.equal(resolveOrderDiscount(noGroup), 44.9)
  })

  it('falls back to the legacy inference, rounded to øre', () => {
    // 449 + 69 − 473.1 is 44.899999999999984 in binary floating point.
    const legacy: StoredOrderMoney = { subtotal: 449, shipping: 69, total: 473.1 }
    assert.equal(resolveOrderDiscount(legacy), 44.9)
  })

  it('reports no discount for an ordinary order', () => {
    assert.equal(resolveOrderDiscount(PLAIN), 0)
  })

  it('never produces a negative discount', () => {
    assert.equal(resolveOrderDiscount({ subtotal: 449, shipping: 69, total: 600 }), 0)
    assert.equal(
      resolveOrderDiscount({ ...PLAIN, discount: { discountAmount: -50 } }),
      0,
    )
  })

  it('survives malformed legacy input without NaN', () => {
    const malformed: StoredOrderMoney = {
      subtotal: undefined,
      shipping: null,
      total: Number.NaN as unknown as number,
      items: null,
    }
    const value = resolveOrderDiscount(malformed)
    assert.ok(Number.isFinite(value))
    assert.equal(value, 0)
  })

  it('does not depend on the promo record still existing', () => {
    // No relation, no code — just the stored amount.
    assert.equal(resolveOrderDiscount({ ...STAGE7, discount: { discountAmount: 44.9 } }), 44.9)
  })
})

describe('resolveLineDiscounts', () => {
  it('reads the stored allocation rather than allocating again', () => {
    assert.deepEqual(resolveLineDiscounts(STAGE7), [44.9])
  })

  it('prefers the stored allocation over any fallback', () => {
    // The stored shares deliberately differ from a proportional split; they must win.
    const order: StoredOrderMoney = {
      subtotal: 748,
      shipping: 0,
      total: 703.1,
      discount: { discountAmount: 44.9 },
      items: [
        { quantity: 1, unitPrice: 449, lineTotal: 449, discountAmount: 44.9 },
        { quantity: 1, unitPrice: 299, lineTotal: 299, discountAmount: 0 },
      ],
    }
    assert.deepEqual(resolveLineDiscounts(order), [44.9, 0])
  })

  it('allocates a legacy order-level discount proportionally', () => {
    const legacy: StoredOrderMoney = {
      subtotal: 748,
      shipping: 0,
      total: 673.2,
      items: [
        { quantity: 1, unitPrice: 449, lineTotal: 449 },
        { quantity: 1, unitPrice: 299, lineTotal: 299 },
      ],
    }
    const shares = resolveLineDiscounts(legacy)
    assert.equal(Math.round(shares.reduce((a, b) => a + b, 0) * 100), 7480)
    assert.ok(shares[0] > shares[1], 'the larger line takes the larger share')
  })

  it('allocates deterministically, to the øre, across awkward splits', () => {
    const legacy: StoredOrderMoney = {
      subtotal: 300,
      shipping: 0,
      total: 299,
      items: [
        { quantity: 1, unitPrice: 100, lineTotal: 100 },
        { quantity: 1, unitPrice: 100, lineTotal: 100 },
        { quantity: 1, unitPrice: 100, lineTotal: 100 },
      ],
    }
    const first = resolveLineDiscounts(legacy)
    for (let i = 0; i < 20; i++) assert.deepEqual(resolveLineDiscounts(legacy), first)
    assert.equal(Math.round(first.reduce((a, b) => a + b, 0) * 100), 100)
  })

  it('handles multiple quantities', () => {
    const legacy: StoredOrderMoney = {
      subtotal: 1_396,
      shipping: 0,
      total: 1_256.4,
      items: [
        { quantity: 2, unitPrice: 449, lineTotal: 898 },
        { quantity: 2, unitPrice: 249, lineTotal: 498 },
      ],
    }
    const shares = resolveLineDiscounts(legacy)
    assert.equal(Math.round(shares.reduce((a, b) => a + b, 0) * 100), 13_960)
  })

  it('never lets a line discount exceed the line itself', () => {
    // A fixed discount bigger than one of the lines.
    const legacy: StoredOrderMoney = {
      subtotal: 468,
      shipping: 0,
      total: 68,
      items: [
        { quantity: 1, unitPrice: 449, lineTotal: 449 },
        { quantity: 1, unitPrice: 19, lineTotal: 19 },
      ],
    }
    const shares = resolveLineDiscounts(legacy)
    assert.ok(shares[0] <= 449)
    assert.ok(shares[1] <= 19)
    assert.equal(Math.round(shares.reduce((a, b) => a + b, 0) * 100), 40_000)
  })

  it('returns zeros for an order with no discount', () => {
    assert.deepEqual(resolveLineDiscounts(PLAIN), [0])
  })

  it('handles an order with no items', () => {
    assert.deepEqual(resolveLineDiscounts({ subtotal: 0, shipping: 0, total: 0 }), [])
  })
})

describe('lineGrossOf', () => {
  it('prefers the stored line total', () => {
    assert.equal(lineGrossOf({ quantity: 2, unitPrice: 449, lineTotal: 898 }), 898)
  })

  it('derives from quantity × unitPrice when no line total is stored', () => {
    assert.equal(lineGrossOf({ quantity: 2, unitPrice: 449 }), 898)
  })

  it('is zero, not NaN, for a malformed line', () => {
    assert.equal(lineGrossOf({}), 0)
    assert.equal(lineGrossOf({ quantity: null, unitPrice: undefined }), 0)
  })
})

describe('storedOrderFinancials', () => {
  it('reports the paid total from the stored total', () => {
    const f = storedOrderFinancials(STAGE7)
    assert.equal(f.productSubtotalGross, 449)
    assert.equal(f.shippingGross, 69)
    assert.equal(f.discountGross, 44.9)
    assert.equal(f.paidTotalGross, 473.1)
    assert.equal(f.productRevenueAfterDiscount, 404.1)
  })

  it('stays consistent: goods after discount + shipping === paid total', () => {
    const f = storedOrderFinancials(STAGE7)
    assert.equal(
      Math.round((f.productRevenueAfterDiscount + f.shippingRevenue) * 100),
      Math.round(f.paidTotalGross * 100),
    )
  })

  it('leaves an ordinary order untouched', () => {
    const f = storedOrderFinancials(PLAIN)
    assert.equal(f.discountGross, 0)
    assert.equal(f.paidTotalGross, 518)
    assert.equal(f.productRevenueAfterDiscount, 449)
  })

  it('never reports negative goods revenue for inconsistent legacy data', () => {
    const broken: StoredOrderMoney = { subtotal: 100, shipping: 0, total: 0, discount: { discountAmount: 500 } }
    const f = storedOrderFinancials(broken)
    assert.equal(f.productRevenueAfterDiscount, 0)
    assert.ok(Number.isFinite(f.paidTotalGross))
  })

  it('is unaffected by later catalogue or shipping changes', () => {
    // The function's whole world is its argument; nothing outside it can move a figure.
    assert.deepEqual(storedOrderFinancials(STAGE7), storedOrderFinancials({ ...STAGE7 }))
  })
})
