import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import QuantityStepper, {
  SOLUTION_QTY_MAX,
  SOLUTION_QTY_MIN,
  normalizeQuantity,
} from './QuantityStepper'

/**
 * The quantity control on a solution page. The interesting part is `normalizeQuantity`:
 * it is the single rule for what a typed value means, applied both while typing and on
 * commit, so the configurator's state can only ever hold a whole number in range.
 */

const noop = () => {}

const markup = (value: number) =>
  renderToStaticMarkup(
    <QuantityStepper value={value} onChange={noop} label="Antall aBoks Office" />,
  )

describe('normalizeQuantity', () => {
  it('reads a plain number', () => {
    assert.equal(normalizeQuantity('0'), 0)
    assert.equal(normalizeQuantity('5'), 5)
    assert.equal(normalizeQuantity('50'), 50)
    assert.equal(normalizeQuantity('300'), 300)
    assert.equal(normalizeQuantity('9999'), 9999)
  })

  it('treats an empty field as the minimum rather than as an error', () => {
    assert.equal(normalizeQuantity(''), SOLUTION_QTY_MIN)
    assert.equal(normalizeQuantity('   '), SOLUTION_QTY_MIN)
  })

  it('cannot produce a negative quantity', () => {
    // The minus is not clamped away after parsing — it never survives to be parsed.
    assert.equal(normalizeQuantity('-1'), 1)
    assert.equal(normalizeQuantity('-300'), 300)
    assert.equal(normalizeQuantity('-'), SOLUTION_QTY_MIN)
  })

  it('caps at the maximum', () => {
    assert.equal(normalizeQuantity('10000'), SOLUTION_QTY_MAX)
    assert.equal(normalizeQuantity('999999999'), SOLUTION_QTY_MAX)
    assert.equal(normalizeQuantity('9'.repeat(400)), SOLUTION_QTY_MAX)
  })

  it('ignores everything that is not a digit', () => {
    assert.equal(normalizeQuantity('abc'), SOLUTION_QTY_MIN)
    assert.equal(normalizeQuantity('3e2'), 32)
    assert.equal(normalizeQuantity('1.5'), 15)
    assert.equal(normalizeQuantity(' 300 stk '), 300)
  })

  it('drops leading zeros instead of keeping them', () => {
    assert.equal(normalizeQuantity('0300'), 300)
    assert.equal(normalizeQuantity('000'), 0)
  })

  it("honours a caller's own range", () => {
    assert.equal(normalizeQuantity('0', 1, 10), 1)
    assert.equal(normalizeQuantity('99', 1, 10), 10)
  })
})

describe('quantity stepper', () => {
  it('shows the quantity in an editable numeric field', () => {
    const html = markup(300)
    assert.ok(html.includes('value="300"'), 'the field carries the current value')
    assert.ok(html.includes('inputMode="numeric"') || html.includes('inputmode="numeric"'))
    // A text field with a numeric mode: no native spinner arrows to fight the pill.
    assert.ok(!html.includes('type="number"'))
  })

  it('labels the field and both buttons for a screen reader', () => {
    const html = markup(1)
    assert.ok(html.includes('aria-label="Antall aBoks Office"'))
    assert.ok(html.includes('aria-label="Færre – Antall aBoks Office"'))
    assert.ok(html.includes('aria-label="Flere – Antall aBoks Office"'))
  })

  it('disables minus at the minimum and plus at the maximum', () => {
    const atMin = markup(SOLUTION_QTY_MIN)
    const atMax = markup(SOLUTION_QTY_MAX)
    const minusDisabled = /<button[^>]*disabled[^>]*aria-label="Færre/
    const plusDisabled = /<button[^>]*disabled[^>]*aria-label="Flere/

    // Exactly one disabled button in each state, and it is the right one.
    assert.equal((atMin.match(/disabled/g) ?? []).length, 1)
    assert.match(atMin, minusDisabled)
    assert.equal((atMax.match(/disabled/g) ?? []).length, 1)
    assert.match(atMax, plusDisabled)
  })

  it('leaves both buttons live in between', () => {
    assert.equal((markup(300).match(/disabled/g) ?? []).length, 0)
  })
})
