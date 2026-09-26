import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SOLUTION_QTY_MAX, parseQuantityParam } from './quantity'

/**
 * Reading a quantity out of a URL. The calculator writes these links, but anyone can edit
 * one, so the rule is deliberately strict: a plain run of digits or nothing at all. Anything
 * else leaves the solution's own default in place rather than producing a quantity the
 * customer never asked for.
 */

describe('parseQuantityParam', () => {
  it('reads a plain quantity', () => {
    assert.equal(parseQuantityParam('48'), 48)
    assert.equal(parseQuantityParam('1'), 1)
    assert.equal(parseQuantityParam('9999'), 9999)
  })

  it('accepts an explicit zero', () => {
    assert.equal(parseQuantityParam('0'), 0)
  })

  it('tolerates surrounding whitespace', () => {
    assert.equal(parseQuantityParam(' 12 '), 12)
  })

  it('refuses a negative', () => {
    assert.equal(parseQuantityParam('-10'), null)
  })

  it('refuses text', () => {
    assert.equal(parseQuantityParam('hello'), null)
    assert.equal(parseQuantityParam('12stk'), null)
  })

  it('refuses a decimal', () => {
    assert.equal(parseQuantityParam('1.5'), null)
    assert.equal(parseQuantityParam('1,5'), null)
  })

  it('refuses exponent notation', () => {
    assert.equal(parseQuantityParam('1e3'), null)
  })

  it('refuses an empty value', () => {
    assert.equal(parseQuantityParam(''), null)
    assert.equal(parseQuantityParam('   '), null)
  })

  it('caps a quantity above the maximum', () => {
    assert.equal(parseQuantityParam('999999999'), SOLUTION_QTY_MAX)
    assert.equal(parseQuantityParam('9'.repeat(400)), SOLUTION_QTY_MAX)
  })

  it('says nothing about a parameter that is absent', () => {
    assert.equal(parseQuantityParam(undefined), null)
  })

  it('uses the first value when a parameter is repeated', () => {
    assert.equal(parseQuantityParam(['7', '9']), 7)
    assert.equal(parseQuantityParam([]), null)
  })
})
