import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  catalogueUnitPrice,
  computeOrderTotals,
  lineTotalKr,
  samePrice,
  sumOrderTotals,
  validateQuantity,
  validateUnitPrice,
} from './manualOrderPricing'
import { NO_CATALOGUE_PRICE_MESSAGE, decideLinePrice, isStandardPrice, type LineState } from './manualOrderForm'
import {
  customerInfoFromBusinessCustomer,
  customerInfoFromCustomer,
  mergeProposal,
  planAutofill,
} from './customerInfoAutofill'

// `aboks` has quantity bands in @/lib/quantityPricing: 10+ → 399 kr, 20+ → 349 kr.
const ABOKS = { slug: 'aboks', price: 449 }
const ACCESSORY = { slug: 'tilbehor-x', price: 99 }

describe('catalogue price — the same engine checkout charges with', () => {
  it('ordinary price, then the quantity bands', () => {
    assert.equal(catalogueUnitPrice(ABOKS, 1), 449)
    assert.equal(catalogueUnitPrice(ABOKS, 9), 449)
    assert.equal(catalogueUnitPrice(ABOKS, 10), 399)
    assert.equal(catalogueUnitPrice(ABOKS, 20), 349)
    assert.equal(catalogueUnitPrice(ACCESSORY, 50), 99, 'unconfigured product keeps its price')
  })

  it('an active sale price applies, an expired one does not', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString()
    assert.equal(catalogueUnitPrice({ ...ACCESSORY, salePrice: 79 }, 1), 79)
    assert.equal(catalogueUnitPrice({ ...ACCESSORY, salePrice: 79, saleEndDate: past }, 1), 99)
  })

  it('no price → null, never an invented value', () => {
    for (const p of [null, undefined, {}, { price: null }, { price: -1 }, { price: Number.NaN }]) {
      assert.equal(catalogueUnitPrice(p as never, 1), null)
    }
  })
})

describe('validation', () => {
  it('unit price: ≥ 0, finite, at most two decimals', () => {
    for (const ok of [0, 1, 349, 349.5, 349.99]) assert.equal(validateUnitPrice(ok), null, String(ok))
    for (const bad of [-1, -0.01, 1.005, Number.NaN, Infinity, '349', null, undefined]) assert.notEqual(validateUnitPrice(bad), null, String(bad))
  })

  it('quantity: whole number 1–9999', () => {
    for (const ok of [1, 10, 9999]) assert.equal(validateQuantity(ok), null)
    for (const bad of [0, -1, 1.5, 10000, '2', null]) assert.notEqual(validateQuantity(bad), null, String(bad))
  })
})

describe('totals — in øre, MVA included, discount only on goods', () => {
  it('line total is unit price × quantity without floating-point drift', () => {
    assert.equal(lineTotalKr(349, 12), 4188)
    assert.equal(lineTotalKr(0.1, 3), 0.3)
    assert.equal(lineTotalKr(33.33, 3), 99.99)
  })

  it('several lines, shipping and a frozen promo discount', () => {
    const t = computeOrderTotals({
      lines: [
        { unitPrice: 449, quantity: 2 },
        { unitPrice: 99.5, quantity: 3 },
      ],
      shipping: 69,
      discountAmount: 50,
    })
    assert.deepEqual(t, { lineTotals: [898, 298.5], subtotal: 1196.5, shipping: 69, discount: 50, total: 1215.5 })
  })

  it('no lines, no shipping, no discount → zeros; MVA is never added on top', () => {
    assert.deepEqual(computeOrderTotals({ lines: [], shipping: null, discountAmount: null }), {
      lineTotals: [],
      subtotal: 0,
      shipping: 0,
      discount: 0,
      total: 0,
    })
    assert.equal(computeOrderTotals({ lines: [{ unitPrice: 100, quantity: 1 }], shipping: 0, discountAmount: 0 }).total, 100)
  })

  it('stored line totals can be summed as they are (historical lines)', () => {
    assert.equal(sumOrderTotals([100.1, 200.2], 0, 0).subtotal, 300.3)
  })

  it('samePrice compares in øre', () => {
    assert.equal(samePrice(349, 349.0), true)
    assert.equal(samePrice(349, 349.01), false)
    assert.equal(samePrice(null, 349), false)
  })
})

describe('form — standard vs individual price', () => {
  const state = (over: Partial<LineState>): LineState => ({ productKey: 'p1', variantKey: 'v1', quantity: 1, unitPrice: 449, catalogue: 449, ...over })

  it('a new line gets the standard price when a product is chosen', () => {
    const d = decideLinePrice({ ...state({}), productKey: null, variantKey: null, unitPrice: null }, state({ unitPrice: null }))
    assert.deepEqual(d, { kind: 'set', unitPrice: 449, replacedIndividual: null })
  })

  it('quantity change: a standard price follows the bands', () => {
    const d = decideLinePrice(state({}), state({ quantity: 10, catalogue: 399 }))
    assert.deepEqual(d, { kind: 'set', unitPrice: 399, replacedIndividual: null })
  })

  it('quantity change never resets an individual price', () => {
    const prev = state({ unitPrice: 300 }) // typed by the administrator, catalogue 449
    assert.equal(isStandardPrice(prev), false)
    assert.deepEqual(decideLinePrice(prev, state({ unitPrice: 300, quantity: 25, catalogue: 349 })), { kind: 'keep' })
  })

  it('changing the variant/product restores the new standard price and reports the replaced individual one', () => {
    const d = decideLinePrice(state({ unitPrice: 300 }), state({ variantKey: 'v2', unitPrice: 300, catalogue: 449 }))
    assert.deepEqual(d, { kind: 'set', unitPrice: 449, replacedIndividual: 300 })
    const other = decideLinePrice(state({}), state({ productKey: 'p2', variantKey: null, catalogue: 99 }))
    assert.deepEqual(other, { kind: 'set', unitPrice: 99, replacedIndividual: null })
  })

  it('no catalogue price → a clear error, the price is not touched', () => {
    const d = decideLinePrice({ ...state({}), productKey: null }, state({ unitPrice: null, catalogue: null }))
    assert.deepEqual(d, { kind: 'error', message: NO_CATALOGUE_PRICE_MESSAGE })
  })

  it('a price typed equal to the catalogue price simply is the standard price', () => {
    assert.equal(isStandardPrice(state({ unitPrice: 449 })), true)
    assert.equal(isStandardPrice(state({ unitPrice: null })), true)
  })
})

describe('Kundeinformasjon autofill', () => {
  const customer = {
    email: 'ola@aboks.invalid',
    firstName: 'Ola',
    lastName: 'Nordmann',
    phone: '+47 900 00 000',
    address: { street: 'Storgata 1', postalCode: '0155', city: 'Oslo' },
  }

  it('a private customer maps field by field', () => {
    assert.deepEqual(customerInfoFromCustomer(customer), {
      email: 'ola@aboks.invalid',
      firstName: 'Ola',
      lastName: 'Nordmann',
      address: 'Storgata 1',
      postalCode: '0155',
      city: 'Oslo',
      phone: '+47 900 00 000',
    })
  })

  it('missing fields stay absent — nothing is invented', () => {
    assert.deepEqual(customerInfoFromCustomer({ email: 'a@aboks.invalid', firstName: '  ', address: null }), { email: 'a@aboks.invalid' })
    assert.deepEqual(customerInfoFromCustomer(null), {})
  })

  it('a business customer provides only its contact e-mail; the contact name is never split into person fields', () => {
    assert.deepEqual(
      customerInfoFromBusinessCustomer({ name: 'Fjordvik AS', organizationNumber: '834012952', contactName: 'Kari Fjord', contactEmail: 'post@fjordvik.invalid' }),
      { email: 'post@fjordvik.invalid' },
    )
    assert.deepEqual(customerInfoFromBusinessCustomer({ name: 'X' }), {})
  })

  it('both chosen: the Bedriftskunde wins where it has a value, the Kunde fills the rest', () => {
    const merged = mergeProposal(customerInfoFromCustomer(customer), { email: 'post@fjordvik.invalid' })
    assert.equal(merged.email, 'post@fjordvik.invalid')
    assert.equal(merged.firstName, 'Ola')
  })

  it('empty fields are filled; manual values that differ need confirmation; equal values are no conflict', () => {
    const plan = planAutofill(
      { email: 'manuell@aboks.invalid', firstName: 'Ola', lastName: '', city: null },
      customerInfoFromCustomer(customer),
    )
    assert.deepEqual(plan.conflicts, [{ field: 'email', current: 'manuell@aboks.invalid', proposed: 'ola@aboks.invalid' }])
    assert.equal(plan.fill.firstName, undefined, 'same value — nothing to do')
    assert.equal(plan.fill.lastName, 'Nordmann')
    assert.equal(plan.fill.city, 'Oslo')
  })

  it('changing customer: every field of the old customer is a conflict, not silently replaced', () => {
    const plan = planAutofill(customerInfoFromCustomer(customer), { email: 'kari@aboks.invalid', firstName: 'Kari' })
    assert.deepEqual(plan.conflicts.map((c) => c.field), ['email', 'firstName'])
    assert.deepEqual(plan.fill, {})
  })
})
