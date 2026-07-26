import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { colorNameFromLineName, orderLineDisplayName, splitLineName } from './orderLineName'

describe('orderLineDisplayName', () => {
  it('prints the snapshotted name verbatim for every product', () => {
    const lines = [
      { displayName: 'aBoks – Mørk blå', variantName: 'Mørk blå' },
      { displayName: 'aBoks Vegg – Mørk blå', variantName: 'Mørk blå' },
      { displayName: 'aBoks Mini – Sort', variantName: 'Sort' },
      { displayName: 'aBoks Nano – Creme', variantName: 'Creme' },
    ]
    assert.deepEqual(lines.map(orderLineDisplayName), [
      'aBoks – Mørk blå',
      'aBoks Vegg – Mørk blå',
      'aBoks Mini – Sort',
      'aBoks Nano – Creme',
    ])
  })

  it('never prefixes a product name onto the stored value', () => {
    // The old bug: a Vegg line rendered as "aBoks – Mørk blå".
    assert.equal(orderLineDisplayName({ displayName: 'aBoks Vegg – Mørk blå' }), 'aBoks Vegg – Mørk blå')
    // A legacy line with only a colour prints the colour — not "aBoks – Mørk blå".
    assert.equal(orderLineDisplayName({ variantName: 'Mørk blå' }), 'Mørk blå')
  })

  it('ignores a blank snapshot and falls through', () => {
    assert.equal(orderLineDisplayName({ displayName: '   ', variantName: 'Sort' }), 'Sort')
    assert.equal(orderLineDisplayName({ displayName: null, variantName: null }), 'Produkt')
    assert.equal(orderLineDisplayName({}), 'Produkt')
  })

  it('trims stored whitespace', () => {
    assert.equal(orderLineDisplayName({ displayName: '  aBoks Vegg – Sort ' }), 'aBoks Vegg – Sort')
  })
})

describe('splitLineName', () => {
  it('splits the current display-name format into product and colour', () => {
    assert.deepEqual(splitLineName('aBoks Vegg – Mørk blå'), {
      productName: 'aBoks Vegg',
      colorName: 'Mørk blå',
    })
    assert.deepEqual(splitLineName('aBoks – Mørk blå'), {
      productName: 'aBoks',
      colorName: 'Mørk blå',
    })
    assert.deepEqual(splitLineName('aBoks Nano – Creme'), {
      productName: 'aBoks Nano',
      colorName: 'Creme',
    })
  })

  it('still splits the legacy "aBoks · Farge" format', () => {
    assert.deepEqual(splitLineName('aBoks · Olivengrønn'), {
      productName: 'aBoks',
      colorName: 'Olivengrønn',
    })
  })

  it('keeps a separator that is part of the product name', () => {
    assert.deepEqual(splitLineName('aBoks Vegg – Pro – Sort'), {
      productName: 'aBoks Vegg – Pro',
      colorName: 'Sort',
    })
  })

  it('never guesses a product when there is no separator', () => {
    assert.deepEqual(splitLineName('Sort'), { productName: 'Sort', colorName: '' })
  })
})

describe('colorNameFromLineName', () => {
  it('reads the colour off both formats', () => {
    assert.equal(colorNameFromLineName('aBoks Vegg – Mørk blå'), 'Mørk blå')
    assert.equal(colorNameFromLineName('aBoks · Olivengrønn'), 'Olivengrønn')
  })

  it('returns the whole name when there is no separator', () => {
    assert.equal(colorNameFromLineName('Sort'), 'Sort')
  })
})
