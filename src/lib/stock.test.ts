import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  availableStock,
  canFulfil,
  isSoldOut,
  normalizeStock,
  productStock,
  stockAfterPurchase,
  variantStock,
} from './stock'

/**
 * The one stock rule, tested at the level it is written: a product with variants is answered
 * from the chosen variant, a product without them from its own `stock`, and never both.
 */

describe('normalizeStock', () => {
  it('reads a stored count', () => {
    assert.equal(normalizeStock(0), 0)
    assert.equal(normalizeStock(12), 12)
  })

  it('reads anything missing or broken as nothing to sell', () => {
    // A product row written before the `stock` column existed has null here, and every one of
    // these must mean "sold out" rather than "unlimited".
    assert.equal(normalizeStock(null), 0)
    assert.equal(normalizeStock(undefined), 0)
    assert.equal(normalizeStock(NaN), 0)
    assert.equal(normalizeStock(Infinity), 0)
    assert.equal(normalizeStock('7'), 0)
    assert.equal(normalizeStock({}), 0)
  })

  it('never reports a negative or a fraction of a unit', () => {
    assert.equal(normalizeStock(-5), 0)
    assert.equal(normalizeStock(2.9), 2)
  })
})

describe('availableStock — which source answers', () => {
  const product = { stock: 12 }
  const variants = [{ inventory: 4 }, { inventory: 0 }]

  it('uses the product’s own stock when there are no variants', () => {
    assert.equal(availableStock(product, []), 12)
    assert.equal(availableStock(product, null), 12)
    assert.equal(availableStock(product, undefined), 12)
  })

  it('uses the chosen variant and ignores the product entirely when there are variants', () => {
    assert.equal(availableStock(product, variants, variants[0]), 4)
    // The sold-out colour is sold out, however much stock sits on the parent product.
    assert.equal(availableStock(product, variants, variants[1]), 0)
  })

  it('reports nothing buyable for a variant product with no variant chosen', () => {
    assert.equal(availableStock(product, variants), 0)
  })

  it('reads a variant-less product with no stored stock as sold out', () => {
    assert.equal(availableStock({}, []), 0)
    assert.equal(availableStock({ stock: null }, []), 0)
    assert.equal(availableStock(null, []), 0)
  })
})

describe('variantStock / productStock', () => {
  it('read their own field and nothing else', () => {
    assert.equal(variantStock({ inventory: 6 }), 6)
    assert.equal(variantStock({ inventory: null }), 0)
    assert.equal(variantStock(null), 0)

    assert.equal(productStock({ stock: 6 }), 6)
    assert.equal(productStock({ stock: null }), 0)
    assert.equal(productStock(null), 0)
  })
})

describe('isSoldOut / canFulfil', () => {
  it('treats zero as Utsolgt', () => {
    assert.equal(isSoldOut(0), true)
    assert.equal(isSoldOut(1), false)
  })

  it('allows exactly what is on the shelf, never more', () => {
    assert.equal(canFulfil(2, 1), true)
    assert.equal(canFulfil(2, 2), true)
    assert.equal(canFulfil(2, 3), false)
    assert.equal(canFulfil(0, 1), false)
    // A zero or negative request is not a purchase.
    assert.equal(canFulfil(5, 0), false)
    assert.equal(canFulfil(5, -1), false)
  })
})

describe('stockAfterPurchase', () => {
  it('subtracts what was bought', () => {
    assert.equal(stockAfterPurchase(12, 3), 9)
    assert.equal(stockAfterPurchase(3, 3), 0)
  })

  it('never goes negative, whatever raced or was corrupted', () => {
    assert.equal(stockAfterPurchase(2, 5), 0)
    assert.equal(stockAfterPurchase(null, 5), 0)
    assert.equal(stockAfterPurchase(-4, 1), 0)
  })

  it('ignores a missing or nonsensical quantity rather than inventing one', () => {
    assert.equal(stockAfterPurchase(12, 0), 12)
    assert.equal(stockAfterPurchase(12, -3), 12)
    assert.equal(stockAfterPurchase(12, NaN), 12)
  })
})
