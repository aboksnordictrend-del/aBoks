import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCostPriceFromItems } from './productCost'

describe('computeCostPriceFromItems', () => {
  it('empty / missing array → 0', () => {
    assert.equal(computeCostPriceFromItems([]), 0)
    assert.equal(computeCostPriceFromItems(undefined), 0)
    assert.equal(computeCostPriceFromItems(null), 0)
  })

  it('sums several items', () => {
    const items = [
      { name: 'PLA Matte', amount: 48 },
      { name: 'Elektrisitet', amount: 4 },
      { name: 'Eske', amount: 22 },
      { name: 'Brosjyre', amount: 3 },
      { name: 'Etikett', amount: 2 },
    ]
    assert.equal(computeCostPriceFromItems(items), 79)
  })

  it('sums decimals without float drift', () => {
    assert.equal(computeCostPriceFromItems([{ amount: 48.5 }, { amount: 0.1 }, { amount: 0.2 }]), 48.8)
  })

  it('removing an item reduces the total', () => {
    const full = [{ amount: 48 }, { amount: 22 }, { amount: 4 }]
    const removed = [{ amount: 48 }, { amount: 4 }]
    assert.equal(computeCostPriceFromItems(full), 74)
    assert.equal(computeCostPriceFromItems(removed), 52)
  })

  it('ignores NaN, Infinity, negatives and non-numeric', () => {
    const items = [
      { amount: 50 },
      { amount: Number.NaN },
      { amount: Number.POSITIVE_INFINITY },
      { amount: -20 },
      { amount: 'oops' },
      { amount: null },
    ]
    assert.equal(computeCostPriceFromItems(items), 50)
  })

  it('coerces numeric strings from form input', () => {
    assert.equal(computeCostPriceFromItems([{ amount: '48.50' }, { amount: '4' }]), 52.5)
  })
})
