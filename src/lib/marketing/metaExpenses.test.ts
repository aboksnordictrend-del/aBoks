import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  filterMetaApiRows,
  metaExpensesSummary,
  sumInclVat,
  type MetaExpenseRow,
} from './metaExpenses'

function row(over: Partial<MetaExpenseRow> = {}): MetaExpenseRow {
  return {
    id: '1',
    date: '2026-07-20T00:00:00.000Z',
    amount: 100,
    amountExVat: 80,
    source: 'meta-api',
    description: null,
    lastSyncedAt: '2026-07-22T10:00:00.000Z',
    ...over,
  }
}

const mixed: MetaExpenseRow[] = [
  row({ id: '1', date: '2026-07-20T00:00:00.000Z', amount: 100, source: 'meta-api' }),
  row({ id: '2', date: '2026-07-21T00:00:00.000Z', amount: 200, source: 'meta-api' }),
  row({ id: '3', date: '2026-07-01T00:00:00.000Z', amount: 999, source: 'manual', lastSyncedAt: null }),
]

describe('Meta detail — row filtering', () => {
  it('shows only source="meta-api" rows (#5)', () => {
    const meta = filterMetaApiRows(mixed)
    assert.equal(meta.length, 2)
    assert.ok(meta.every((r) => r.source === 'meta-api'))
  })

  it('excludes manual rows from the Meta page (#6)', () => {
    const meta = filterMetaApiRows(mixed)
    assert.ok(!meta.some((r) => r.id === '3'))
    assert.ok(!meta.some((r) => r.source === 'manual'))
  })
})

describe('Meta detail — computed total', () => {
  it('totals only the displayed meta rows (#7)', () => {
    const meta = filterMetaApiRows(mixed)
    assert.equal(sumInclVat(meta), 300) // 100 + 200, manual 999 excluded
  })

  it('summary counts distinct days and the latest sync', () => {
    const meta = filterMetaApiRows(mixed)
    const s = metaExpensesSummary(meta)
    assert.equal(s.totalInclVat, 300)
    assert.equal(s.days, 2)
    assert.equal(s.lastSyncedAt, '2026-07-22T10:00:00.000Z')
  })

  it('is NaN-safe on malformed amounts', () => {
    const s = metaExpensesSummary([row({ amount: Number.NaN, amountExVat: Number.NaN })])
    assert.equal(s.totalInclVat, 0)
    assert.equal(s.totalExVat, 0)
  })
})

describe('analytics independence (#9)', () => {
  it('an analytics-style total over ALL sources includes manual rows', () => {
    // Analytics never filters by source (aggregate.ts reads every marketing-expense), so a
    // full-set total must include the manual row that the Meta view hides.
    const allTotal = sumInclVat(mixed)
    const metaOnly = sumInclVat(filterMetaApiRows(mixed))
    assert.equal(allTotal, 1299) // 100 + 200 + 999
    assert.equal(metaOnly, 300)
    assert.ok(allTotal > metaOnly, 'view-filtering does not shrink the analytics total')
  })
})
