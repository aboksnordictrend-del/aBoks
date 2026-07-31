import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FULL_SYNC_CHUNK_DAYS,
  INCREMENTAL_OVERLAP_DAYS,
  computeIncrementalWindow,
  fullSyncChunks,
  todayForAdvertiser,
} from './syncWindow'

describe('constants', () => {
  it('keeps the same 14-day incremental overlap as Meta, Google and Pinterest', () => {
    assert.equal(INCREMENTAL_OVERLAP_DAYS, 13)
  })

  it('chunks at 30 days — TikTok\'s hard limit for a stat_time_day report', () => {
    assert.equal(FULL_SYNC_CHUNK_DAYS, 30)
  })
})

describe('todayForAdvertiser', () => {
  it('resolves "today" in the advertiser\'s reporting zone, not in UTC', () => {
    // 22:30 UTC on 21 July is already 00:30 on 22 July in Oslo (UTC+2 in summer).
    const now = new Date('2026-07-21T22:30:00.000Z')
    assert.equal(todayForAdvertiser(now, 'Europe/Oslo'), '2026-07-22')
    assert.equal(todayForAdvertiser(now, 'UTC'), '2026-07-21')
  })

  it('never shifts a day backwards for a zone west of UTC', () => {
    const now = new Date('2026-07-22T03:00:00.000Z')
    assert.equal(todayForAdvertiser(now, 'America/New_York'), '2026-07-21')
  })

  it('falls back to the UTC day when TikTok reports no zone', () => {
    const now = new Date('2026-07-21T22:30:00.000Z')
    assert.equal(todayForAdvertiser(now, null), '2026-07-21')
    assert.equal(todayForAdvertiser(now, undefined), '2026-07-21')
  })

  it('falls back to the UTC day for an unrecognised zone rather than failing', () => {
    const now = new Date('2026-07-21T22:30:00.000Z')
    assert.equal(todayForAdvertiser(now, 'Mars/Olympus_Mons'), '2026-07-21')
  })
})

describe('computeIncrementalWindow', () => {
  it('is lastExternalDate − 13 … today (a 14-day window when up to date)', () => {
    assert.deepEqual(computeIncrementalWindow('2026-07-22', '2026-07-22'), {
      since: '2026-07-09',
      until: '2026-07-22',
    })
  })

  it('anchors on a stale last date rather than only the trailing two weeks', () => {
    assert.deepEqual(computeIncrementalWindow('2026-01-15', '2026-07-22'), {
      since: '2026-01-02',
      until: '2026-07-22',
    })
  })

  it('clamps a last date in the future so `since` never exceeds `until`', () => {
    const window = computeIncrementalWindow('2027-01-01', '2026-07-22')
    assert.ok(window.since <= window.until)
    assert.equal(window.since, '2026-07-09')
  })

  it('crosses a month and a year boundary correctly', () => {
    assert.deepEqual(computeIncrementalWindow('2026-01-05', '2026-01-05'), {
      since: '2025-12-23',
      until: '2026-01-05',
    })
  })
})

describe('fullSyncChunks', () => {
  it('returns one chunk when the range already fits', () => {
    assert.deepEqual(fullSyncChunks('2026-07-01', '2026-07-20'), [
      { since: '2026-07-01', until: '2026-07-20' },
    ])
  })

  it('never emits a chunk wider than 30 days', () => {
    const chunks = fullSyncChunks('2025-01-01', '2026-07-22')
    for (const c of chunks) {
      const days = (Date.parse(c.until) - Date.parse(c.since)) / 86_400_000 + 1
      assert.ok(days <= FULL_SYNC_CHUNK_DAYS, `${c.since}..${c.until} is ${days} days`)
    }
  })

  it('covers the whole range with contiguous, non-overlapping chunks', () => {
    const chunks = fullSyncChunks('2026-01-01', '2026-07-22')
    assert.equal(chunks[0].since, '2026-01-01')
    assert.equal(chunks[chunks.length - 1].until, '2026-07-22')
    for (let i = 1; i < chunks.length; i += 1) {
      assert.ok(chunks[i - 1].until < chunks[i].since, 'chunks never overlap')
      const gap = (Date.parse(chunks[i].since) - Date.parse(chunks[i - 1].until)) / 86_400_000
      assert.equal(gap, 1, 'chunks leave no gap')
    }
  })

  it('returns nothing for an inverted range', () => {
    assert.deepEqual(fullSyncChunks('2026-07-22', '2026-07-01'), [])
  })
})
