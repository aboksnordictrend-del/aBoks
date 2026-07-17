import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deriveLine } from './orderSnapshot'

describe('deriveLine', () => {
  it('returns nulls when unitCost is missing (old order line)', () => {
    assert.deepEqual(deriveLine({ quantity: 2, lineTotal: 250, vatRate: 25 }), {
      lineCost: null,
      lineProfit: null,
    })
  })

  it('computes lineCost and VAT-adjusted lineProfit', () => {
    // 250 incl 25% VAT → net 200 ; cost 40*2 = 80 ; profit 120
    assert.deepEqual(deriveLine({ unitCost: 40, quantity: 2, lineTotal: 250, vatRate: 25 }), {
      lineCost: 80,
      lineProfit: 120,
    })
  })

  it('treats 0% VAT as no adjustment', () => {
    assert.deepEqual(deriveLine({ unitCost: 40, quantity: 1, lineTotal: 100, vatRate: 0 }), {
      lineCost: 40,
      lineProfit: 60,
    })
  })

  it('defaults a missing vatRate to 0', () => {
    assert.deepEqual(deriveLine({ unitCost: 10, quantity: 3, lineTotal: 90 }), {
      lineCost: 30,
      lineProfit: 60,
    })
  })
})
