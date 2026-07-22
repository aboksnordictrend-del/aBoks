import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  INCREMENTAL_OVERLAP_DAYS,
  addDaysUtc,
  computeIncrementalWindow,
  minDate,
  todayUtc,
} from './syncWindow'

describe('todayUtc', () => {
  it('formats the UTC calendar day, ignoring local time', () => {
    // 23:30 UTC — a local timezone ahead of UTC must not roll this to the next day.
    assert.equal(todayUtc(new Date('2026-07-22T23:30:00.000Z')), '2026-07-22')
    assert.equal(todayUtc(new Date('2026-07-22T00:00:00.000Z')), '2026-07-22')
  })
})

describe('addDaysUtc', () => {
  it('subtracts within a month', () => {
    assert.equal(addDaysUtc('2026-07-22', -13), '2026-07-09')
  })

  it('crosses a month boundary (#4)', () => {
    assert.equal(addDaysUtc('2026-07-05', -13), '2026-06-22')
    assert.equal(addDaysUtc('2026-03-01', -1), '2026-02-28')
  })

  it('crosses a year boundary (#5)', () => {
    assert.equal(addDaysUtc('2027-01-05', -13), '2026-12-23')
    assert.equal(addDaysUtc('2027-01-01', -1), '2026-12-31')
  })

  it('handles leap years (#6)', () => {
    // 2028 is a leap year: 29 Feb exists.
    assert.equal(addDaysUtc('2028-03-01', -1), '2028-02-29')
    assert.equal(addDaysUtc('2028-03-05', -13), '2028-02-21')
    // 2026 is not a leap year.
    assert.equal(addDaysUtc('2026-03-01', -1), '2026-02-28')
  })

  it('adds days too', () => {
    assert.equal(addDaysUtc('2026-12-31', 1), '2027-01-01')
  })

  it('rejects a malformed date', () => {
    assert.throws(() => addDaysUtc('22-07-2026', -1))
  })
})

describe('minDate', () => {
  it('returns the earlier date', () => {
    assert.equal(minDate('2026-07-01', '2026-07-22'), '2026-07-01')
    assert.equal(minDate('2026-07-22', '2026-07-01'), '2026-07-01')
  })
})

describe('computeIncrementalWindow (#3)', () => {
  const now = new Date('2026-07-22T09:00:00.000Z')

  it('uses lastExternalDate − 13 days … today, a 14-day inclusive window', () => {
    const w = computeIncrementalWindow('2026-07-22', now)
    assert.deepEqual(w, { since: '2026-07-09', until: '2026-07-22' })
  })

  it('starts no later than the last known day − 13 when the data is stale', () => {
    const w = computeIncrementalWindow('2026-07-10', now)
    assert.equal(w.since, '2026-06-27') // 2026-07-10 − 13
    assert.equal(w.until, '2026-07-22')
    assert.ok(w.since <= w.until)
  })

  it('never lets since exceed until, even with a future lastExternalDate', () => {
    const w = computeIncrementalWindow('2027-01-01', now)
    assert.equal(w.until, '2026-07-22')
    assert.ok(w.since <= w.until)
    assert.equal(w.since, '2026-07-09') // anchored to today, not the future date
  })

  it('crosses month and year boundaries safely', () => {
    assert.deepEqual(computeIncrementalWindow('2027-01-03', new Date('2027-01-03T12:00:00.000Z')), {
      since: '2026-12-21',
      until: '2027-01-03',
    })
  })

  it('keeps the documented overlap size', () => {
    assert.equal(INCREMENTAL_OVERLAP_DAYS, 13)
  })
})
