import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCostPriceFromItems } from '@/collections/hooks/productCost'
import { MAX_LINE_QUANTITY } from '@/lib/quantityLimits'
import {
  computeSaleProductCost,
  knownSaleCosts,
  resolveProductUnitCost,
  validateLineQuantity,
} from './referralCost'

describe('resolveProductUnitCost — the product’s own «Total kostpris»', () => {
  it('reads the cost the product administration calculated from its cost items', () => {
    const costItems = [{ name: 'Produksjon', amount: 62.5 }, { name: 'Emballasje', amount: 7.25 }]
    const product = { costItems, costPrice: computeCostPriceFromItems(costItems) }
    assert.equal(resolveProductUnitCost(product), 69.75)
  })

  it('treats a product without cost items as unknown, not free', () => {
    // computeProductCostPrice writes 0 when there are no items.
    assert.equal(resolveProductUnitCost({ costItems: [], costPrice: 0 }), null)
    assert.equal(resolveProductUnitCost({ costPrice: 0 }), null)
  })

  it('treats a missing or unusable costPrice as unknown', () => {
    assert.equal(resolveProductUnitCost({ costItems: [{ amount: 10 }], costPrice: null }), null)
    assert.equal(resolveProductUnitCost({ costItems: [{ amount: 10 }], costPrice: Number.NaN }), null)
    assert.equal(resolveProductUnitCost(null), null)
  })
})

describe('computeSaleProductCost', () => {
  it('sums unit cost × quantity over several products and variants, in øre', () => {
    const result = computeSaleProductCost([
      { quantity: 120, unitCost: 69.75 },
      { quantity: 3, unitCost: 0.1 },
      { quantity: 7, unitCost: 0.2 },
    ])
    assert.deepEqual(result.lineCosts, [8370, 0.3, 1.4])
    assert.equal(result.productCost, 8371.7)
  })

  it('is null as soon as one line has no unit cost — never a partial sum', () => {
    const result = computeSaleProductCost([
      { quantity: 2, unitCost: 50 },
      { quantity: 1, unitCost: null },
    ])
    assert.deepEqual(result.lineCosts, [100, null])
    assert.equal(result.productCost, null)
  })

  it('is null for a sale without lines', () => {
    assert.equal(computeSaleProductCost([]).productCost, null)
  })
})

describe('validateLineQuantity', () => {
  it('accepts whole numbers from 1 to the shop-wide line limit', () => {
    assert.equal(validateLineQuantity(1), true)
    assert.equal(validateLineQuantity(MAX_LINE_QUANTITY), true)
  })

  it('refuses zero, negatives, fractions, non-numbers and values above the limit', () => {
    for (const value of [0, -1, 1.5, '3', null, MAX_LINE_QUANTITY + 1]) {
      assert.equal(typeof validateLineQuantity(value), 'string', String(value))
    }
  })
})

describe('knownSaleCosts', () => {
  it('needs both the product cost and the shipping cost; 0 shipping is a real value', () => {
    assert.deepEqual(knownSaleCosts({ productCost: 100, actualShippingCost: 0 }), { productCost: 100, shippingCost: 0 })
    assert.equal(knownSaleCosts({ productCost: 100, actualShippingCost: null }), null)
    assert.equal(knownSaleCosts({ productCost: null, actualShippingCost: 50 }), null)
  })
})
