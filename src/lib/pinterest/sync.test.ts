import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { computeMarketingExVat } from '@/collections/MarketingExpenses'
import {
  PINTEREST_ADS_CHANNEL,
  PINTEREST_ADS_SOURCE,
  PINTEREST_ADS_VAT_RATE,
  PinterestSyncValidationError,
  buildExternalKey,
  parseSyncMode,
  runPinterestAdsSync,
  validateSyncDates,
  type PinterestSyncDeps,
} from './sync'
import type { PinterestAdsConfig } from './config'
import type { PinterestSpendRange } from './ads'
import type { PinterestAdAccountInfo, PinterestDailySpend } from './types'

const SECRETS = {
  appSecret: 'APP-SECRET-should-never-leak',
  accessToken: 'ACCESS-TOKEN-should-never-leak',
}
const AD_ACCOUNT = '549755885175'
const OTHER_AD_ACCOUNT = '111111111111'
const NOW = new Date('2026-07-22T09:00:00.000Z')

const config: PinterestAdsConfig = {
  appId: 'app-id',
  appSecret: SECRETS.appSecret,
  accessToken: SECRETS.accessToken,
  adAccountId: AD_ACCOUNT,
  apiVersion: 'v5',
  baseUrl: 'https://api.pinterest.com/v5',
  historyStart: '2019-01-01',
}

const account: PinterestAdAccountInfo = {
  id: AD_ACCOUNT,
  name: 'aBoks',
  currency: 'NOK',
  country: 'NO',
  createdDate: '2026-04-01',
}

interface Doc {
  id: number
  channel: string
  source?: string
  amount?: number
  vatRate?: number
  externalKey?: string
  externalAccountId?: string
  externalDate?: string
  date?: string
  periodFrom?: string
  periodTo?: string
  description?: string
  [k: string]: unknown
}

interface Mock {
  payload: Payload
  store: Map<number, Doc>
  readonly creates: number
  readonly updates: number
}

type Clause = Record<string, { equals?: string; not_equals?: string; exists?: boolean }>

/** In-memory Payload double that understands the three queries the sync issues. */
function mockPayload(initial: Doc[] = []): Mock {
  const store = new Map<number, Doc>()
  let seq = 0
  for (const d of initial) {
    store.set(d.id, d)
    seq = Math.max(seq, d.id)
  }
  const state = { creates: 0, updates: 0 }

  const payload = {
    find: async ({ where }: { where: Record<string, unknown> }) => {
      const byKey = (where as { externalKey?: { equals?: string } }).externalKey?.equals
      if (byKey) return { docs: [...store.values()].filter((d) => d.externalKey === byKey) }

      const and = (where as { and?: Clause[] }).and
      // findLastExternalDate: and[] carries a source AND an externalAccountId equality.
      const sourceEq = and?.find((c) => c?.source?.equals)?.source?.equals
      const accountEq = and?.find((c) => c?.externalAccountId?.equals)?.externalAccountId?.equals
      if (sourceEq && accountEq) {
        const rows = [...store.values()]
          .filter(
            (d) =>
              d.source === sourceEq &&
              d.externalAccountId === accountEq &&
              typeof d.externalDate === 'string',
          )
          .sort((a, b) => String(b.externalDate).localeCompare(String(a.externalDate)))
        return { docs: rows.slice(0, 1) }
      }

      // Otherwise: the manual-conflict query (channel pinterest, source != pinterest-ads).
      return {
        docs: [...store.values()].filter(
          (d) => d.channel === PINTEREST_ADS_CHANNEL && d.source !== PINTEREST_ADS_SOURCE,
        ),
      }
    },
    create: async ({ data }: { data: Doc }) => {
      state.creates += 1
      seq += 1
      const doc: Doc = { ...data, id: seq }
      store.set(seq, doc)
      return doc
    },
    update: async ({ id, data }: { id: number; data: Partial<Doc> }) => {
      state.updates += 1
      const doc = { ...(store.get(id) as Doc), ...data }
      store.set(id, doc)
      return doc
    },
    findGlobal: async () => ({}),
    logger: { error() {}, warn() {}, info() {} },
  } as unknown as Payload

  return {
    payload,
    store,
    get creates() {
      return state.creates
    },
    get updates() {
      return state.updates
    },
  }
}

/** Build daily-spend rows from [date, kroner] pairs (micros derived, never rounded early). */
function days(...rows: Array<[string, number]>): PinterestDailySpend[] {
  return rows.map(([date, spend]) => ({
    date,
    spendMicros: Math.round(spend * 1_000_000),
    spend,
    currency: 'NOK',
  }))
}

/**
 * Deps that capture every range the client was asked for, so the resolved window and the
 * chunking are both assertable. `rows` are returned filtered to the requested range, which
 * is how the real API behaves.
 */
function capturingDeps(rows: PinterestDailySpend[], over: Partial<PinterestSyncDeps> = {}) {
  const seen: PinterestSpendRange[] = []
  const deps: PinterestSyncDeps = {
    config,
    now: () => NOW,
    fetchAccountInfo: async () => account,
    fetchDailySpend: async (range) => {
      seen.push(range)
      return rows.filter((r) => r.date >= range.since && r.date <= range.until)
    },
    ...over,
  }
  return { deps, seen }
}

function pinterestDoc(id: number, date: string, amount: number, adAccountId = AD_ACCOUNT): Doc {
  return {
    id,
    channel: PINTEREST_ADS_CHANNEL,
    source: PINTEREST_ADS_SOURCE,
    amount,
    vatRate: 0,
    externalKey: buildExternalKey(adAccountId, date),
    externalAccountId: adAccountId,
    externalDate: date,
    date: `${date}T00:00:00.000Z`,
  }
}

describe('parseSyncMode', () => {
  it('defaults to incremental', () => {
    assert.equal(parseSyncMode(undefined), 'incremental')
    assert.equal(parseSyncMode(null), 'incremental')
    assert.equal(parseSyncMode(''), 'incremental')
  })
  it('accepts the two valid modes', () => {
    assert.equal(parseSyncMode('incremental'), 'incremental')
    assert.equal(parseSyncMode('full'), 'full')
  })
  it('rejects anything else', () => {
    assert.throws(() => parseSyncMode('partial'), PinterestSyncValidationError)
    assert.throws(() => parseSyncMode(3), PinterestSyncValidationError)
  })
})

describe('validateSyncDates (Pinterest page display filter)', () => {
  it('accepts both dates empty', () => {
    assert.deepEqual(validateSyncDates({}), {})
  })
  it('rejects only one date', () => {
    assert.throws(() => validateSyncDates({ since: '2026-07-11' }), PinterestSyncValidationError)
  })
  it('rejects since > until', () => {
    assert.throws(
      () => validateSyncDates({ since: '2026-07-12', until: '2026-07-11' }),
      PinterestSyncValidationError,
    )
  })
})

describe('buildExternalKey', () => {
  it('is deterministic per account + day, and distinct from a Meta/Google key', () => {
    assert.equal(buildExternalKey(AD_ACCOUNT, '2026-07-22'), 'pinterest:549755885175:2026-07-22')
    assert.notEqual(
      buildExternalKey(AD_ACCOUNT, '2026-07-22'),
      buildExternalKey(OTHER_AD_ACCOUNT, '2026-07-22'),
    )
  })
})

describe('runPinterestAdsSync — initial sync', () => {
  it('escalates an incremental request to a full import when the DB is empty', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps(days(['2026-04-09', 100], ['2026-07-22', 200]))
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.initialSync, true)
    assert.equal(res.mode, 'full')
    assert.equal(res.created, 2)
    // The full window starts at the ad account's creation day, not at the configured floor.
    assert.deepEqual(res.period, { since: '2026-04-01', until: '2026-07-22' })
    assert.equal(seen[0].since, '2026-04-01')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
  })

  it('falls back to the configured floor when Pinterest reports no creation date', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 200]), {
      fetchAccountInfo: async () => ({ ...account, createdDate: null }),
      chunkDays: 90,
    })
    const res = await runPinterestAdsSync(m.payload, { mode: 'full' }, deps)
    assert.equal(res.period.since, '2019-01-01')
  })

  it('never starts before the configured floor, even for an older account', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 200]), {
      fetchAccountInfo: async () => ({ ...account, createdDate: '2015-06-01' }),
      chunkDays: 90,
    })
    const res = await runPinterestAdsSync(m.payload, { mode: 'full' }, deps)
    assert.equal(res.period.since, '2019-01-01')
  })

  it('reports an empty account cleanly instead of failing', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps([])
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.initialSync, true)
    assert.equal(res.fetchedDays, 0)
    assert.equal(res.created, 0)
    assert.equal(res.totalSpend, 0)
  })

  it('splits a long full import into sequential ≤90-day chunks', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps(days(['2025-01-05', 10], ['2026-07-22', 20]), {
      fetchAccountInfo: async () => ({ ...account, createdDate: '2025-01-01' }),
      chunkDays: 90,
    })
    await runPinterestAdsSync(m.payload, { mode: 'full' }, deps)

    assert.ok(seen.length > 1, 'more than one request for a >90-day history')
    assert.equal(seen[0].since, '2025-01-01')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
    for (let i = 1; i < seen.length; i += 1) {
      assert.ok(seen[i - 1].until < seen[i].since, 'chunks never overlap')
    }
  })
})

describe('runPinterestAdsSync — incremental window', () => {
  it('requests lastExternalDate − 13 days … today', async () => {
    const m = mockPayload([pinterestDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
    assert.equal(res.initialSync, false)
    assert.equal(res.mode, 'incremental')
    assert.deepEqual(res.period, { since: '2026-07-09', until: '2026-07-22' })
  })

  it('anchors on a stale last date rather than only the last 14 days', async () => {
    const m = mockPayload([pinterestDoc(1, '2026-01-15', 100)])
    const { deps, seen } = capturingDeps(days(['2026-01-15', 100]))
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(seen[0].since, '2026-01-02')
    assert.notEqual(seen[0].since, '2026-07-09', 'not the trailing 14 days from today')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
    assert.equal(res.mode, 'incremental', 'still incremental — not escalated to full')
  })

  it('defaults to incremental when no mode is given', async () => {
    const m = mockPayload([pinterestDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    await runPinterestAdsSync(m.payload, {}, deps)
    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
  })

  it('ignores rows from another source and another ad account when anchoring', async () => {
    const m = mockPayload([
      // A Google row with a much newer date must not become the Pinterest anchor…
      {
        id: 1,
        channel: 'google',
        source: 'google-ads',
        externalAccountId: '1234567890',
        externalDate: '2026-07-22',
        amount: 500,
      },
      // …nor may a different Pinterest ad account.
      pinterestDoc(2, '2026-07-21', 50, OTHER_AD_ACCOUNT),
      // The real anchor for this account:
      pinterestDoc(3, '2026-07-10', 100),
    ])
    const { deps, seen } = capturingDeps(days(['2026-07-10', 100]))
    await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.deepEqual(seen[0], { since: '2026-06-27', until: '2026-07-22' })
  })
})

describe('runPinterestAdsSync — idempotent upsert', () => {
  it('creates one record per day with vatRate 0 and the deterministic key', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-21', 120.5], ['2026-07-22', 80.25]), {
      lastExternalDate: '2026-07-21',
    })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.created, 2)
    const rows = [...m.store.values()]
    assert.deepEqual(
      rows.map((r) => r.externalKey).sort(),
      ['pinterest:549755885175:2026-07-21', 'pinterest:549755885175:2026-07-22'],
    )
    for (const r of rows) {
      assert.equal(r.channel, PINTEREST_ADS_CHANNEL)
      assert.equal(r.source, PINTEREST_ADS_SOURCE)
      assert.equal(r.vatRate, PINTEREST_ADS_VAT_RATE)
      assert.equal(r.externalAccountId, AD_ACCOUNT)
    }
  })

  it('is idempotent: a second run creates nothing and updates nothing', async () => {
    const m = mockPayload()
    const rows = days(['2026-07-21', 120.5], ['2026-07-22', 80.25])
    const first = capturingDeps(rows, { lastExternalDate: '2026-07-21' })
    await runPinterestAdsSync(m.payload, { mode: 'incremental' }, first.deps)

    const second = capturingDeps(rows, { lastExternalDate: '2026-07-21' })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, second.deps)

    assert.equal(res.created, 0)
    assert.equal(res.updated, 0)
    assert.equal(res.unchanged, 2)
    assert.equal(m.store.size, 2, 'no duplicate rows')
  })

  it('updates a restated amount and leaves an unchanged one alone', async () => {
    const m = mockPayload([pinterestDoc(1, '2026-07-21', 100), pinterestDoc(2, '2026-07-22', 200)])
    const { deps } = capturingDeps(days(['2026-07-21', 100], ['2026-07-22', 250]), {
      lastExternalDate: '2026-07-22',
    })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.updated, 1)
    assert.equal(res.unchanged, 1)
    assert.equal(m.store.get(2)?.amount, 250)
  })

  it('never overwrites a manual row that happens to carry the same key', async () => {
    // A hand-edited row on another channel can carry a Pinterest external key and so slip
    // past the channel-scoped conflict gate. The per-row source guard is the backstop.
    const m = mockPayload([
      { ...pinterestDoc(1, '2026-07-22', 999), channel: 'annet', source: 'manual' },
    ])
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.conflicts.length, 0, 'the gate does not see it — channel is not pinterest')
    assert.equal(res.skipped, 1)
    assert.equal(res.created, 0)
    assert.equal(res.updated, 0)
    assert.equal(m.store.get(1)?.amount, 999, 'the manual amount is untouched')
    assert.match(res.warnings.join(' '), /Hoppet over 2026-07-22/)
  })
})

describe('runPinterestAdsSync — zero-spend days', () => {
  it('skips a zero-spend day instead of storing an empty row', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-21', 0], ['2026-07-22', 80]), {
      lastExternalDate: '2026-07-21',
    })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.fetchedDays, 2)
    assert.equal(res.created, 1)
    assert.equal(res.skipped, 1)
    assert.equal(m.store.size, 1)
    assert.equal([...m.store.values()][0].externalDate, '2026-07-22')
  })

  it('still corrects an already-imported day down to 0, so no stale cost survives', async () => {
    const m = mockPayload([pinterestDoc(1, '2026-07-22', 200)])
    const { deps } = capturingDeps(days(['2026-07-22', 0]), { lastExternalDate: '2026-07-22' })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.updated, 1)
    assert.equal(res.skipped, 0)
    assert.equal(m.store.get(1)?.amount, 0)
  })
})

describe('runPinterestAdsSync — manual overlap gate', () => {
  it('writes nothing and returns the conflicts', async () => {
    const m = mockPayload([
      {
        id: 1,
        channel: PINTEREST_ADS_CHANNEL,
        source: 'manual',
        amount: 5000,
        description: 'Pinterest juli (faktura)',
        date: '2026-07-15T00:00:00.000Z',
      },
    ])
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.conflicts.length, 1)
    assert.equal(res.conflicts[0].description, 'Pinterest juli (faktura)')
    assert.equal(res.created, 0)
    assert.equal(m.creates, 0)
    assert.match(res.warnings.join(' '), /dobbelttelling/)
  })
})

describe('runPinterestAdsSync — safety', () => {
  it('stops on a non-NOK ad account rather than converting silently', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      fetchAccountInfo: async () => ({ ...account, currency: 'USD' }),
    })
    await assert.rejects(() => runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps), /USD/)
    assert.equal(m.creates, 0)
  })

  it('returns a masked ad account id and no secret anywhere in the result', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    const res = await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.accountId, '•••5175')
    const serialized = JSON.stringify(res)
    assert.ok(!serialized.includes(SECRETS.accessToken))
    assert.ok(!serialized.includes(SECRETS.appSecret))
    assert.ok(!serialized.includes(AD_ACCOUNT))
  })

  it('stores no secret in syncMetadata', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    await runPinterestAdsSync(m.payload, { mode: 'incremental' }, deps)

    const meta = JSON.stringify([...m.store.values()][0].syncMetadata)
    assert.ok(!meta.includes(SECRETS.accessToken))
    assert.ok(!meta.includes(SECRETS.appSecret))
    assert.match(meta, /"currency":"NOK"/)
    assert.match(meta, /"apiVersion":"v5"/)
  })
})

describe('imported Pinterest rows in the analytics VAT hook', () => {
  it('counts the full amount, because vatRate is 0 (reverse charge)', () => {
    const data = computeMarketingExVat({
      data: { amount: 1234.56, vatRate: PINTEREST_ADS_VAT_RATE },
    } as never) as { amountExVat: number }
    assert.equal(data.amountExVat, 1234.56)
  })
})
