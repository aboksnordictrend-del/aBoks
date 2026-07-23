import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FULL_SYNC_CHUNK_DAYS,
  INCREMENTAL_OVERLAP_DAYS,
  computeIncrementalWindow,
  fullSyncChunks,
  todayForAccount,
} from './syncWindow'
import { daysBetween } from '@/lib/marketing/dateMath'

describe('todayForAccount (#13)', () => {
  it('uses the ad account time zone, not UTC', () => {
    // 22:30 UTC is already the next day in Oslo (UTC+2 in July).
    const now = new Date('2026-07-22T22:30:00.000Z')
    assert.equal(todayForAccount(now, 'Europe/Oslo'), '2026-07-23')
    assert.equal(todayForAccount(now, 'UTC'), '2026-07-22')
  })

  it('does not roll a day forward for a zone behind UTC', () => {
    // 01:30 UTC is still the previous day in Los Angeles.
    const now = new Date('2026-07-23T01:30:00.000Z')
    assert.equal(todayForAccount(now, 'America/Los_Angeles'), '2026-07-22')
  })

  it('falls back to the UTC day for a missing or invalid zone', () => {
    const now = new Date('2026-07-22T09:00:00.000Z')
    assert.equal(todayForAccount(now, null), '2026-07-22')
    assert.equal(todayForAccount(now, ''), '2026-07-22')
    assert.equal(todayForAccount(now, 'Not/AZone'), '2026-07-22')
  })
})

describe('computeIncrementalWindow (#5)', () => {
  const today = '2026-07-22'

  it('uses lastExternalDate − 13 days … today, a 14-day inclusive window', () => {
    const w = computeIncrementalWindow('2026-07-22', today)
    assert.deepEqual(w, { since: '2026-07-09', until: '2026-07-22' })
    assert.equal(daysBetween(w.since, w.until), 14)
  })

  it('anchors on a stale last date rather than only the last 14 days', () => {
    const w = computeIncrementalWindow('2026-07-10', today)
    assert.equal(w.since, '2026-06-27') // 2026-07-10 − 13
    assert.equal(w.until, today)
  })

  it('starts at lastExternalDate − 13 even when that is far in the past', () => {
    // The window is anchored on the last imported day, never on "today − 13". A database
    // that has not been synced since January must re-check from January, not from July.
    const w = computeIncrementalWindow('2026-01-15', today)
    assert.equal(w.since, '2026-01-02') // 2026-01-15 − 13, across a month boundary
    assert.equal(w.until, today)
    assert.notEqual(w.since, '2026-07-09', 'not the trailing 14 days from today')
    assert.equal(daysBetween(w.since, w.until), 202)
  })

  it('scales the window with the gap, not with a fixed 14 days', () => {
    // Three anchors, three different window lengths — proof the start really tracks
    // lastExternalDate rather than collapsing to a constant.
    const windows = ['2025-08-01', '2026-03-20', '2026-07-22'].map((last) =>
      computeIncrementalWindow(last, today),
    )
    assert.deepEqual(
      windows.map((w) => w.since),
      ['2025-07-19', '2026-03-07', '2026-07-09'],
    )
    const lengths = windows.map((w) => daysBetween(w.since, w.until))
    assert.ok(lengths[0] > lengths[1] && lengths[1] > lengths[2])
    assert.equal(lengths[2], 14, 'only an up-to-date database gets the minimum 14-day window')
  })

  it('never lets since exceed until, even with a future lastExternalDate', () => {
    const w = computeIncrementalWindow('2027-01-01', today)
    assert.equal(w.until, today)
    assert.equal(w.since, '2026-07-09') // anchored to today, not the future date
    assert.ok(w.since <= w.until)
  })

  it('crosses month and year boundaries safely', () => {
    assert.deepEqual(computeIncrementalWindow('2027-01-03', '2027-01-03'), {
      since: '2026-12-21',
      until: '2027-01-03',
    })
  })

  it('keeps the same overlap size as the Meta sync', () => {
    assert.equal(INCREMENTAL_OVERLAP_DAYS, 13)
  })
})

describe('fullSyncChunks', () => {
  it('returns a single chunk when the range already fits', () => {
    assert.deepEqual(fullSyncChunks('2026-07-01', '2026-07-22'), [
      { since: '2026-07-01', until: '2026-07-22' },
    ])
  })

  it('splits a long range into consecutive, non-overlapping chunks', () => {
    const chunks = fullSyncChunks('2026-01-01', '2026-07-22', 90)
    assert.ok(chunks.length > 1)
    assert.equal(chunks[0].since, '2026-01-01')
    assert.equal(chunks[chunks.length - 1].until, '2026-07-22')
    for (let i = 1; i < chunks.length; i += 1) {
      // Each chunk starts exactly one day after the previous one ends — no gap, no overlap.
      assert.ok(chunks[i - 1].until < chunks[i].since)
      assert.equal(daysBetween(chunks[i - 1].until, chunks[i].since), 2)
    }
    for (const c of chunks) assert.ok(daysBetween(c.since, c.until) <= 90)
  })

  it('covers every day of the range exactly once', () => {
    const chunks = fullSyncChunks('2026-01-01', '2026-12-31', 30)
    const total = chunks.reduce((sum, c) => sum + daysBetween(c.since, c.until), 0)
    assert.equal(total, daysBetween('2026-01-01', '2026-12-31'))
  })

  it('returns [] for an inverted range', () => {
    assert.deepEqual(fullSyncChunks('2026-07-22', '2026-07-01'), [])
  })

  it('keeps a documented default chunk size', () => {
    assert.equal(FULL_SYNC_CHUNK_DAYS, 90)
  })
})
