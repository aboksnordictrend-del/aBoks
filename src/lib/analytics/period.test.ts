import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePeriod, enumerateBuckets } from './period'

// Fixed clock: 15 March 2026, 12:00 UTC. Oslo is CET (+01:00) — DST starts 29 March 2026.
const now = new Date('2026-03-15T12:00:00.000Z')

describe('resolvePeriod presets (Europe/Oslo)', () => {
  it('today spans one Oslo day', () => {
    const p = resolvePeriod('today', { now })
    assert.equal(p.from, '2026-03-14T23:00:00.000Z')
    assert.equal(p.to, '2026-03-15T23:00:00.000Z')
  })

  it('yesterday is the previous Oslo day', () => {
    const p = resolvePeriod('yesterday', { now })
    assert.equal(p.from, '2026-03-13T23:00:00.000Z')
    assert.equal(p.to, '2026-03-14T23:00:00.000Z')
  })

  it('thisMonth starts at the 1st of March Oslo', () => {
    const p = resolvePeriod('thisMonth', { now })
    assert.equal(p.from, '2026-02-28T23:00:00.000Z')
    assert.equal(p.to, '2026-03-15T23:00:00.000Z')
  })

  it('lastMonth is all of February', () => {
    const p = resolvePeriod('lastMonth', { now })
    assert.equal(p.from, '2026-01-31T23:00:00.000Z')
    assert.equal(p.to, '2026-02-28T23:00:00.000Z')
  })

  it('thisYear starts 1 Jan Oslo', () => {
    const p = resolvePeriod('thisYear', { now })
    assert.equal(p.from, '2025-12-31T23:00:00.000Z')
  })

  it('previous window has the same length as the selected one', () => {
    const p = resolvePeriod('last7', { now })
    const span = new Date(p.to).getTime() - new Date(p.from).getTime()
    const prevSpan = new Date(p.previous.to).getTime() - new Date(p.previous.from).getTime()
    assert.equal(prevSpan, span)
    assert.equal(p.previous.to, p.from)
  })
})

describe('resolvePeriod custom + DST', () => {
  it('crosses the spring DST change correctly', () => {
    // 28–30 March 2026 inclusive. DST begins 29 March, so 31 March starts at +02:00.
    const p = resolvePeriod('custom', { customFrom: '2026-03-28', customTo: '2026-03-30', now })
    assert.equal(p.from, '2026-03-27T23:00:00.000Z') // 28 Mar 00:00 +01:00
    assert.equal(p.to, '2026-03-30T22:00:00.000Z') // 31 Mar 00:00 +02:00
    assert.equal(p.suggestedGrouping, 'day')
  })

  it('rejects reversed custom ranges', () => {
    assert.throws(() => resolvePeriod('custom', { customFrom: '2026-03-30', customTo: '2026-03-28', now }))
  })

  it('picks week/month grouping for longer spans', () => {
    assert.equal(resolvePeriod('custom', { customFrom: '2026-01-01', customTo: '2026-02-20', now }).suggestedGrouping, 'week')
    assert.equal(resolvePeriod('custom', { customFrom: '2026-01-01', customTo: '2026-06-30', now }).suggestedGrouping, 'month')
  })
})

describe('enumerateBuckets', () => {
  it('produces contiguous day buckets', () => {
    const buckets = enumerateBuckets({ from: '2026-03-09T23:00:00.000Z', to: '2026-03-12T23:00:00.000Z' }, 'day')
    assert.equal(buckets.length, 3)
  })

  it('collapses a month span into month buckets', () => {
    const buckets = enumerateBuckets({ from: '2025-12-31T23:00:00.000Z', to: '2026-03-31T22:00:00.000Z' }, 'month')
    assert.deepEqual(buckets.map((b) => b.key), ['2026-01', '2026-02', '2026-03'])
  })
})
