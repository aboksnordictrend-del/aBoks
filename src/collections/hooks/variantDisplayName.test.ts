import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatVariantDisplayName } from './variantDisplayName'

describe('formatVariantDisplayName', () => {
  it('joins product title and colour with an en dash', () => {
    assert.equal(formatVariantDisplayName('aBoks', 'Sort'), 'aBoks – Sort')
    assert.equal(formatVariantDisplayName('aBoks Mini', 'Creme'), 'aBoks Mini – Creme')
    assert.equal(formatVariantDisplayName('aBoks Nano', 'Olivengrønn'), 'aBoks Nano – Olivengrønn')
  })

  it('trims surrounding whitespace on both parts', () => {
    assert.equal(formatVariantDisplayName('  aBoks  ', '  Mørk blå  '), 'aBoks – Mørk blå')
  })
})
