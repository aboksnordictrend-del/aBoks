import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FULL_SYNC_CHUNK_DAYS,
  INCREMENTAL_OVERLAP_DAYS,
  computeIncrementalWindow,
  fullSyncChunks,
  todayForAccount,
} from './syncWindow'

describe('todayForAccount', () => {
  it('uses the UTC day (Pinterest exposes no ad-account time zone)', () => {
    assert.equal(todayForAccount(new Date('2026-07-22T09:00:00.000Z')), '2026-07-22')
    assert.equal(todayForAccount(new Date('2026-07-22T23:59:59.000Z')), '2026-07-22')
    assert.equal(todayForAccount(new Date('2026-07-23T00:00:01.000Z')), '2026-07-23')
  })
})

describe('computeIncrementalWindow', () => {
  it('spans lastExternalDate − 13 … today (14 days when up to date)', () => {
    assert.equal(INCREMENTAL_OVERLAP_DAYS, 13)
    assert.deepEqual(computeIncrementalWindow('2026-07-22', '2026-07-22'), {
      since: '2026-07-09',
      until: '2026-07-22',
    })
  })

  it('anchors on the last imported day, not on today', () => {
    assert.deepEqual(computeIncrementalWindow('2026-01-15', '2026-07-22'), {
      since: '2026-01-02',
      until: '2026-07-22',
    })
  })

  it('handles a month / year rollover', () => {
    assert.deepEqual(computeIncrementalWindow('2026-01-05', '2026-01-05'), {
      since: '2025-12-23',
      until: '2026-01-05',
    })
  })

  it('clamps a future lastExternalDate so since never exceeds until', () => {
    const w = computeIncrementalWindow('2027-01-01', '2026-07-22')
    assert.equal(w.until, '2026-07-22')
    assert.ok(w.since <= w.until)
    assert.equal(w.since, '2026-07-09')
  })
})

describe('fullSyncChunks', () => {
  it('returns one chunk when the range already fits', () => {
    assert.deepEqual(fullSyncChunks('2026-07-01', '2026-07-22'), [
      { since: '2026-07-01', until: '2026-07-22' },
    ])
  })

  it('never exceeds the API limit of 90 days per request', () => {
    assert.equal(FULL_SYNC_CHUNK_DAYS, 90)
    const chunks = fullSyncChunks('2025-01-01', '2026-07-22')
    assert.ok(chunks.length > 1)
    for (const c of chunks) {
      const spanDays =
        (Date.parse(`${c.until}T00:00:00Z`) - Date.parse(`${c.since}T00:00:00Z`)) / 86_400_000 + 1
      assert.ok(spanDays <= 90, `chunk ${c.since}…${c.until} is ${spanDays} days`)
    }
  })

  it('is contiguous, chronological and non-overlapping', () => {
    const chunks = fullSyncChunks('2025-01-01', '2026-07-22')
    assert.equal(chunks[0].since, '2025-01-01')
    assert.equal(chunks[chunks.length - 1].until, '2026-07-22')
    for (let i = 1; i < chunks.length; i += 1) {
      assert.ok(chunks[i - 1].until < chunks[i].since)
    }
  })

  it('returns nothing for an inverted range', () => {
    assert.deepEqual(fullSyncChunks('2026-07-22', '2026-07-01'), [])
  })
})
