import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { allocateDiscount, type AllocatableLine } from './allocate'

const lines = (...amounts: number[]): AllocatableLine[] =>
  amounts.map((amountOere, i) => ({ key: `v${i + 1}`, amountOere }))

const shares = (result: ReturnType<typeof allocateDiscount>) =>
  result.entries.map((e) => e.discountOere)

describe('allocateDiscount', () => {
  it('splits an evenly divisible discount evenly', () => {
    const result = allocateDiscount(lines(10_000, 10_000), 2_000)
    assert.deepEqual(shares(result), [1_000, 1_000])
    assert.equal(result.totalAllocatedOere, 2_000)
  })

  it('allocates proportionally to line size, not per line', () => {
    // 30 000 + 10 000 øre sharing 4 000 → 3 000 / 1 000.
    const result = allocateDiscount(lines(30_000, 10_000), 4_000)
    assert.deepEqual(shares(result), [3_000, 1_000])
  })

  it('sums exactly to the discount when the split does not divide (the 1/3 case)', () => {
    // Three equal lines sharing 100 øre: 33.33 each. Independent rounding would give 99.
    const result = allocateDiscount(lines(10_000, 10_000, 10_000), 100)
    assert.equal(result.totalAllocatedOere, 100)
    assert.deepEqual(shares(result), [34, 33, 33])
  })

  it('is deterministic — identical input gives an identical split every time', () => {
    const input = lines(4_499, 12_900, 799, 30_000)
    const first = shares(allocateDiscount(input, 1_234))
    for (let i = 0; i < 25; i++) {
      assert.deepEqual(shares(allocateDiscount(input, 1_234)), first)
    }
  })

  it('never lets a line receive more than its own total', () => {
    // A discount equal to the whole eligible subtotal: every line goes to exactly zero.
    const amounts = [4_499, 899, 12_050]
    const total = amounts.reduce((a, b) => a + b, 0)
    const result = allocateDiscount(lines(...amounts), total)
    assert.deepEqual(shares(result), amounts)
    assert.equal(result.totalAllocatedOere, total)
  })

  it('caps a discount larger than the lines can absorb (100 kr off an 80 kr cart)', () => {
    const result = allocateDiscount(lines(8_000), 10_000)
    assert.deepEqual(shares(result), [8_000])
    assert.equal(result.totalAllocatedOere, 8_000)
  })

  it('gives a zero-amount line nothing, even when leftovers are handed out', () => {
    const result = allocateDiscount(lines(10_000, 0, 10_000), 101)
    const [a, zero, b] = shares(result)
    assert.equal(zero, 0)
    assert.equal(a + b, 101)
  })

  it('returns all zeros for a non-positive discount or an empty cart', () => {
    assert.equal(allocateDiscount(lines(10_000), 0).totalAllocatedOere, 0)
    assert.equal(allocateDiscount(lines(10_000), -500).totalAllocatedOere, 0)
    assert.equal(allocateDiscount([], 500).totalAllocatedOere, 0)
    assert.equal(allocateDiscount(lines(0, 0), 500).totalAllocatedOere, 0)
  })

  it('ignores corrupt line amounts instead of trusting them', () => {
    const result = allocateDiscount(
      [
        { key: 'a', amountOere: -1_000 },
        { key: 'b', amountOere: 10_000 },
      ],
      1_000,
    )
    assert.deepEqual(shares(result), [0, 1_000])
  })

  it('holds both invariants across many awkward carts and discounts', () => {
    // Deterministic pseudo-random sweep — every combination must satisfy
    // Σ allocations === min(discount, eligible)  and  allocation_i ≤ amount_i.
    let seed = 20260727
    const next = (max: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return (seed >>> 0) % max
    }

    for (let round = 0; round < 400; round++) {
      const lineCount = 1 + next(6)
      const amounts = Array.from({ length: lineCount }, () => next(50_000))
      const eligible = amounts.reduce((a, b) => a + b, 0)
      const discount = next(60_000)

      const result = allocateDiscount(lines(...amounts), discount)
      const expected = Math.min(discount, eligible)

      assert.equal(
        result.totalAllocatedOere,
        expected,
        `round ${round}: amounts=${amounts} discount=${discount}`,
      )
      result.entries.forEach((entry, i) => {
        assert.ok(
          entry.discountOere <= amounts[i],
          `round ${round}: line ${i} over-discounted (${entry.discountOere} > ${amounts[i]})`,
        )
        assert.ok(Number.isInteger(entry.discountOere), 'allocations must stay integer øre')
      })
    }
  })

  it('handles a fractional percentage on a multi-line cart without drift', () => {
    // 12.5 % of (449 + 899 + 1299) kr = 330.875 kr → the caller rounds once to 33 088 øre.
    const amounts = [44_900, 89_900, 129_900]
    const eligible = amounts.reduce((a, b) => a + b, 0)
    const discount = Math.round((eligible * 12.5) / 100)
    const result = allocateDiscount(lines(...amounts), discount)

    assert.equal(discount, 33_088)
    assert.equal(result.totalAllocatedOere, 33_088)
    assert.equal(
      shares(result).reduce((a, b) => a + b, 0),
      33_088,
    )
  })
})
