import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PRODUCT_LINE_REF_PREFIX,
  isProductLineRef,
  lineRefFor,
  parseLineRef,
  productLineRef,
  resolvedLineRef,
} from './lineRef'

/**
 * The property that matters most here is backward compatibility: a variant line's reference
 * has to stay the bare id it has always been, because those strings are already sitting in
 * customers' localStorage, in live Kustom orders and on historical order lines.
 */

describe('variant references are unchanged', () => {
  it('keeps a variant id bare', () => {
    assert.equal(lineRefFor({ variantId: '12' }), '12')
    assert.equal(lineRefFor({ variantId: 12 }), '12')
  })

  it('reads a legacy reference back as a variant', () => {
    assert.deepEqual(parseLineRef('12'), { kind: 'variant', variantId: '12' })
    assert.deepEqual(parseLineRef(12), { kind: 'variant', variantId: '12' })
    assert.equal(isProductLineRef('12'), false)
  })
})

describe('product references', () => {
  it('are prefixed, and round-trip', () => {
    const ref = productLineRef(34)
    assert.equal(ref, `${PRODUCT_LINE_REF_PREFIX}34`)
    assert.deepEqual(parseLineRef(ref), { kind: 'product', productId: '34' })
    assert.equal(isProductLineRef(ref), true)
  })

  it('cannot collide with a variant id, which is always numeric', () => {
    assert.notEqual(productLineRef('34'), '34')
  })
})

describe('lineRefFor — the precedence rule', () => {
  it('lets the variant win whenever there is one', () => {
    // A client that sends both must not be able to buy a variant product against its
    // parent's stock; the variant is what identifies the line.
    assert.equal(lineRefFor({ variantId: '12', productId: '34' }), '12')
  })

  it('falls back to the product when there is no variant', () => {
    assert.equal(lineRefFor({ productId: '34' }), 'product-34')
    assert.equal(lineRefFor({ variantId: null, productId: 34 }), 'product-34')
    assert.equal(lineRefFor({ variantId: '   ', productId: '34' }), 'product-34')
  })

  it('returns null when a line cannot be identified at all', () => {
    assert.equal(lineRefFor({}), null)
    assert.equal(lineRefFor({ variantId: null, productId: null }), null)
    assert.equal(lineRefFor({ variantId: '  ', productId: '' }), null)
    assert.equal(resolvedLineRef({}), '')
  })
})

describe('parseLineRef — unusable input is refused, never guessed', () => {
  it('rejects blanks, bare prefixes and non-strings', () => {
    assert.equal(parseLineRef(''), null)
    assert.equal(parseLineRef('   '), null)
    assert.equal(parseLineRef(PRODUCT_LINE_REF_PREFIX), null)
    assert.equal(parseLineRef(null), null)
    assert.equal(parseLineRef(undefined), null)
    assert.equal(parseLineRef({ id: 3 }), null)
  })
})
