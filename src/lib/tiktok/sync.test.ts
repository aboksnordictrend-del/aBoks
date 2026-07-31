import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { computeMarketingExVat } from '@/collections/MarketingExpenses'
import {
  computeAdSpend,
  computeCac,
  computeChannels,
  computeCostPerOrder,
  computeRoas,
} from '@/lib/analytics/marketing'
import { channelLabel } from '@/lib/marketingChannels'
import {
  TIKTOK_ADS_CHANNEL,
  TIKTOK_ADS_SOURCE,
  TIKTOK_ADS_VAT_RATE,
  TikTokAdvertiserNotSelectedError,
  TikTokCurrencyUnknownError,
  TikTokSyncValidationError,
  buildExternalKey,
  parseSyncMode,
  runTikTokAdsSync,
  validateSyncDates,
  type TikTokSyncDeps,
} from './sync'
import { getTikTokAdsConfig, type TikTokAdsConfig } from './config'
import type { TikTokSpendRange } from './reports'
import type { TikTokAdvertiserInfo, TikTokDailySpend } from './types'

const SECRETS = {
  appSecret: 'APP-SECRET-should-never-leak',
  accessToken: 'ACCESS-TOKEN-should-never-leak',
}
const ADVERTISER = '7012345678901234567'
const OTHER_ADVERTISER = '7099999999999999999'
const NOW = new Date('2026-07-22T09:00:00.000Z')

const config: TikTokAdsConfig = getTikTokAdsConfig({
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: SECRETS.appSecret,
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
  TIKTOK_ADVERTISER_ID: ADVERTISER,
})

const account: TikTokAdvertiserInfo = {
  id: ADVERTISER,
  name: 'aBoks',
  currency: 'NOK',
  timezone: 'Europe/Oslo',
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

      // Otherwise: the manual-conflict query (channel tiktok, source != tiktok-ads).
      return {
        docs: [...store.values()].filter(
          (d) => d.channel === TIKTOK_ADS_CHANNEL && d.source !== TIKTOK_ADS_SOURCE,
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
    updateGlobal: async () => ({}),
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

/** Build daily-spend rows from [date, kroner] pairs. */
function days(...rows: Array<[string, number]>): TikTokDailySpend[] {
  return rows.map(([date, spend]) => ({ date, spend, currency: 'NOK' }))
}

/**
 * Deps that capture every range the client was asked for, so the resolved window and the
 * chunking are both assertable. `rows` are returned filtered to the requested range, which is
 * how the real API behaves. Credentials are injected so no token store is consulted.
 */
function capturingDeps(rows: TikTokDailySpend[], over: Partial<TikTokSyncDeps> = {}) {
  const seen: TikTokSpendRange[] = []
  const deps: TikTokSyncDeps = {
    config,
    accessToken: SECRETS.accessToken,
    advertiserId: ADVERTISER,
    now: () => NOW,
    fetchAdvertiserInfo: async () => account,
    storedConnection: null,
    fetchDailySpend: async (range) => {
      seen.push(range)
      return rows.filter((r) => r.date >= range.since && r.date <= range.until)
    },
    ...over,
  }
  return { deps, seen }
}

function tiktokDoc(id: number, date: string, amount: number, advertiserId = ADVERTISER): Doc {
  return {
    id,
    channel: TIKTOK_ADS_CHANNEL,
    source: TIKTOK_ADS_SOURCE,
    amount,
    vatRate: 0,
    externalKey: buildExternalKey(advertiserId, date),
    externalAccountId: advertiserId,
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
    assert.throws(() => parseSyncMode('partial'), TikTokSyncValidationError)
    assert.throws(() => parseSyncMode(3), TikTokSyncValidationError)
  })
})

describe('validateSyncDates (TikTok page display filter)', () => {
  it('accepts both dates empty', () => {
    assert.deepEqual(validateSyncDates({}), {})
  })
  it('rejects only one date', () => {
    assert.throws(() => validateSyncDates({ since: '2026-07-11' }), TikTokSyncValidationError)
  })
  it('rejects since > until', () => {
    assert.throws(
      () => validateSyncDates({ since: '2026-07-12', until: '2026-07-11' }),
      TikTokSyncValidationError,
    )
  })
})

describe('buildExternalKey', () => {
  it('is deterministic per advertiser + day', () => {
    assert.equal(
      buildExternalKey(ADVERTISER, '2026-07-22'),
      'tiktok:7012345678901234567:2026-07-22',
    )
  })

  it('separates advertisers, and never collides with a Meta/Google/Pinterest key', () => {
    assert.notEqual(
      buildExternalKey(ADVERTISER, '2026-07-22'),
      buildExternalKey(OTHER_ADVERTISER, '2026-07-22'),
    )
    assert.ok(buildExternalKey(ADVERTISER, '2026-07-22').startsWith('tiktok:'))
  })
})

describe('runTikTokAdsSync — initial sync', () => {
  it('escalates an incremental request to a full import when the DB is empty', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps(days(['2026-04-09', 100], ['2026-07-22', 200]))
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.initialSync, true)
    assert.equal(res.mode, 'full')
    assert.equal(res.requestedMode, 'incremental')
    assert.equal(res.created, 2)
    // The full window starts at the advertiser's creation day, not at the configured floor.
    assert.deepEqual(res.period, { since: '2026-04-01', until: '2026-07-22' })
    assert.equal(seen[0].since, '2026-04-01')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
  })

  it('falls back to the configured floor when TikTok reports no creation date', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 200]), {
      fetchAdvertiserInfo: async () => ({ ...account, createdDate: null }),
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'full' }, deps)
    assert.equal(res.period.since, '2020-01-01')
  })

  it('never starts before the configured floor, even for an older account', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 200]), {
      fetchAdvertiserInfo: async () => ({ ...account, createdDate: '2015-06-01' }),
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'full' }, deps)
    assert.equal(res.period.since, '2020-01-01')
  })

  it('reports an empty account cleanly instead of failing', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps([])
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.initialSync, true)
    assert.equal(res.fetchedDays, 0)
    assert.equal(res.created, 0)
    assert.equal(res.totalSpend, 0)
  })

  it('splits a long full import into sequential ≤30-day chunks', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps(days(['2025-01-05', 10], ['2026-07-22', 20]), {
      fetchAdvertiserInfo: async () => ({ ...account, createdDate: '2025-01-01' }),
    })
    await runTikTokAdsSync(m.payload, { mode: 'full' }, deps)

    assert.ok(seen.length > 1, 'more than one request for a >30-day history')
    assert.equal(seen[0].since, '2025-01-01')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
    for (const chunk of seen) {
      const span = (Date.parse(chunk.until) - Date.parse(chunk.since)) / 86_400_000 + 1
      assert.ok(span <= 30, `${chunk.since}..${chunk.until} exceeds TikTok's 30-day limit`)
    }
    for (let i = 1; i < seen.length; i += 1) {
      assert.ok(seen[i - 1].until < seen[i].since, 'chunks never overlap')
    }
  })
})

describe('runTikTokAdsSync — incremental window', () => {
  it('requests lastExternalDate − 13 days … today', async () => {
    const m = mockPayload([tiktokDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
    assert.equal(res.initialSync, false)
    assert.equal(res.mode, 'incremental')
    assert.deepEqual(res.period, { since: '2026-07-09', until: '2026-07-22' })
  })

  it('anchors on a stale last date rather than only the last 14 days', async () => {
    const m = mockPayload([tiktokDoc(1, '2026-01-15', 100)])
    const { deps, seen } = capturingDeps(days(['2026-01-15', 100]))
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(seen[0].since, '2026-01-02')
    assert.notEqual(seen[0].since, '2026-07-09', 'not the trailing 14 days from today')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
    assert.equal(res.mode, 'incremental', 'still incremental — not escalated to full')
  })

  it('defaults to incremental when no mode is given', async () => {
    const m = mockPayload([tiktokDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    await runTikTokAdsSync(m.payload, {}, deps)
    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
  })

  it('ignores rows from another source and another advertiser when anchoring', async () => {
    const m = mockPayload([
      // A Pinterest row with a newer date must not become the TikTok anchor…
      {
        id: 1,
        channel: 'pinterest',
        source: 'pinterest-ads',
        externalAccountId: '549755885175',
        externalDate: '2026-07-22',
        amount: 500,
      },
      // …nor may a different TikTok advertiser.
      tiktokDoc(2, '2026-07-21', 50, OTHER_ADVERTISER),
      // The real anchor for this advertiser:
      tiktokDoc(3, '2026-07-10', 100),
    ])
    const { deps, seen } = capturingDeps(days(['2026-07-10', 100]))
    await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.deepEqual(seen[0], { since: '2026-06-27', until: '2026-07-22' })
  })

  it('uses the advertiser time zone for "today", not the server zone', async () => {
    const m = mockPayload([tiktokDoc(1, '2026-07-21', 100)])
    // 22:30 UTC is already the 22nd in Oslo.
    const { deps, seen } = capturingDeps(days(['2026-07-21', 100]), {
      now: () => new Date('2026-07-21T22:30:00.000Z'),
    })
    await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
  })
})

describe('runTikTokAdsSync — idempotent upsert', () => {
  it('creates one record per day with vatRate 0 and the deterministic key', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-21', 120.5], ['2026-07-22', 80.25]), {
      lastExternalDate: '2026-07-21',
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.created, 2)
    const rows = [...m.store.values()]
    assert.deepEqual(rows.map((r) => r.externalKey).sort(), [
      'tiktok:7012345678901234567:2026-07-21',
      'tiktok:7012345678901234567:2026-07-22',
    ])
    for (const r of rows) {
      assert.equal(r.channel, TIKTOK_ADS_CHANNEL)
      assert.equal(r.source, TIKTOK_ADS_SOURCE)
      assert.equal(r.vatRate, TIKTOK_ADS_VAT_RATE)
      assert.equal(r.externalAccountId, ADVERTISER)
    }
  })

  it('stores the day exactly as TikTok labelled it, with no timezone shift', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 80]), { lastExternalDate: '2026-07-22' })
    await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    const row = [...m.store.values()][0]
    assert.equal(row.externalDate, '2026-07-22')
    assert.equal(row.date, '2026-07-22T00:00:00.000Z')
    assert.equal(row.periodFrom, '2026-07-22T00:00:00.000Z')
    assert.equal(row.periodTo, '2026-07-22T00:00:00.000Z')
  })

  it('is idempotent: a second run creates nothing and updates nothing', async () => {
    const m = mockPayload()
    const rows = days(['2026-07-21', 120.5], ['2026-07-22', 80.25])
    const first = capturingDeps(rows, { lastExternalDate: '2026-07-21' })
    await runTikTokAdsSync(m.payload, { mode: 'incremental' }, first.deps)

    const second = capturingDeps(rows, { lastExternalDate: '2026-07-21' })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, second.deps)

    assert.equal(res.created, 0)
    assert.equal(res.updated, 0)
    assert.equal(res.unchanged, 2)
    assert.equal(m.store.size, 2, 'no duplicate rows')
  })

  it('creates no duplicate when a full re-import covers already-imported days', async () => {
    const m = mockPayload()
    const rows = days(['2026-07-21', 120.5], ['2026-07-22', 80.25])
    await runTikTokAdsSync(m.payload, { mode: 'full' }, capturingDeps(rows).deps)
    const res = await runTikTokAdsSync(m.payload, { mode: 'full' }, capturingDeps(rows).deps)

    assert.equal(m.store.size, 2)
    assert.equal(res.created, 0)
    assert.equal(res.unchanged, 2)
  })

  it('updates a restated amount and leaves an unchanged one alone', async () => {
    const m = mockPayload([tiktokDoc(1, '2026-07-21', 100), tiktokDoc(2, '2026-07-22', 200)])
    const { deps } = capturingDeps(days(['2026-07-21', 100], ['2026-07-22', 250]), {
      lastExternalDate: '2026-07-22',
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.updated, 1)
    assert.equal(res.unchanged, 1)
    assert.equal(m.store.get(2)?.amount, 250)
  })

  it('never overwrites a manual row that happens to carry the same key', async () => {
    const m = mockPayload([
      { ...tiktokDoc(1, '2026-07-22', 999), channel: 'annet', source: 'manual' },
    ])
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.conflicts.length, 0, 'the gate does not see it — channel is not tiktok')
    assert.equal(res.skipped, 1)
    assert.equal(res.created, 0)
    assert.equal(res.updated, 0)
    assert.equal(m.store.get(1)?.amount, 999, 'the manual amount is untouched')
    assert.match(res.warnings.join(' '), /Hoppet over 2026-07-22/)
  })
})

describe('runTikTokAdsSync — zero-spend days', () => {
  it('skips a zero-spend day instead of storing an empty row', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-21', 0], ['2026-07-22', 80]), {
      lastExternalDate: '2026-07-21',
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.fetchedDays, 2)
    assert.equal(res.created, 1)
    assert.equal(res.skipped, 1)
    assert.equal(m.store.size, 1)
    assert.equal([...m.store.values()][0].externalDate, '2026-07-22')
  })

  it('still corrects an already-imported day down to 0, so no stale cost survives', async () => {
    const m = mockPayload([tiktokDoc(1, '2026-07-22', 200)])
    const { deps } = capturingDeps(days(['2026-07-22', 0]), { lastExternalDate: '2026-07-22' })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.updated, 1)
    assert.equal(res.skipped, 0)
    assert.equal(m.store.get(1)?.amount, 0)
  })
})

describe('runTikTokAdsSync — manual overlap gate', () => {
  it('writes nothing and returns the conflicts', async () => {
    const m = mockPayload([
      {
        id: 1,
        channel: TIKTOK_ADS_CHANNEL,
        source: 'manual',
        amount: 5000,
        description: 'TikTok juli (faktura)',
        date: '2026-07-15T00:00:00.000Z',
      },
    ])
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.conflicts.length, 1)
    assert.equal(res.conflicts[0].description, 'TikTok juli (faktura)')
    assert.equal(res.created, 0)
    assert.equal(m.creates, 0)
    assert.match(res.warnings.join(' '), /dobbelttelling/)
  })
})

describe('runTikTokAdsSync — partial retrieval', () => {
  it('propagates a failed chunk instead of reporting a partial import as success', async () => {
    const m = mockPayload()
    let call = 0
    const { deps } = capturingDeps([], {
      fetchAdvertiserInfo: async () => ({ ...account, createdDate: '2026-01-01' }),
      fetchDailySpend: async (range) => {
        call += 1
        if (call === 2) throw new Error('TikTok chunk failed')
        return [{ date: range.since, spend: 10, currency: 'NOK' }]
      },
    })

    await assert.rejects(
      () => runTikTokAdsSync(m.payload, { mode: 'full' }, deps),
      /TikTok chunk failed/,
    )
    // The first chunk's rows are discarded with the run — never written and never counted.
    assert.equal(m.creates, 0)
  })

  it('releases the per-advertiser lock after a failure, so a retry is possible', async () => {
    const m = mockPayload()
    const failing = capturingDeps([], {
      fetchAdvertiserInfo: async () => {
        throw new Error('temporary outage')
      },
    })
    await assert.rejects(() => runTikTokAdsSync(m.payload, { mode: 'full' }, failing.deps))

    const res = await runTikTokAdsSync(
      m.payload,
      { mode: 'full' },
      capturingDeps(days(['2026-07-22', 10])).deps,
    )
    assert.equal(res.created, 1)
  })
})

describe('runTikTokAdsSync — Reporting-only app (advertiser/info forbidden)', () => {
  /**
   * `GET /advertiser/info/` needs the Ad Account Management scope. With Reporting alone it is
   * refused, so the fetcher resolves null. Nothing in the spend path depends on it — these
   * tests pin down that the import still runs, and that every value it would have supplied
   * has a safe, non-guessed fallback.
   */
  const configWithCurrency: TikTokAdsConfig = getTikTokAdsConfig({
    TIKTOK_APP_ID: '7668564716072534017',
    TIKTOK_APP_SECRET: SECRETS.appSecret,
    TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
    TIKTOK_ADVERTISER_ID: ADVERTISER,
    TIKTOK_ADVERTISER_CURRENCY: 'NOK',
  })

  it('imports spend normally when metadata is unavailable but the currency is declared', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      config: configWithCurrency,
      fetchAdvertiserInfo: async () => null,
      lastExternalDate: '2026-07-22',
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.created, 1)
    assert.equal(res.currency, 'NOK')
    assert.equal(res.currencySource, 'config')
    assert.equal(res.metadataAvailable, false)
    assert.match(res.warnings.join(' '), /Ad Account Management/)
  })

  it('falls back to UTC for "today" when the time zone is unknown', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps(days(['2026-07-21', 10]), {
      config: configWithCurrency,
      fetchAdvertiserInfo: async () => null,
      lastExternalDate: '2026-07-21',
      // 22:30 UTC — Oslo would already be the 22nd, UTC is still the 21st.
      now: () => new Date('2026-07-21T22:30:00.000Z'),
    })
    await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.equal(seen[seen.length - 1].until, '2026-07-21')
  })

  it('falls back to the configured history floor when the creation date is unknown', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 10]), {
      config: configWithCurrency,
      fetchAdvertiserInfo: async () => null,
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'full' }, deps)
    assert.equal(res.period.since, '2020-01-01')
  })

  it('uses the account name captured on the stored connection', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 10]), {
      config: configWithCurrency,
      fetchAdvertiserInfo: async () => null,
      lastExternalDate: '2026-07-22',
      storedConnection: {
        advertiserId: ADVERTISER,
        advertiserName: 'aBoks (lagret)',
        currency: 'NOK',
        timezone: null,
        connectedAt: null,
        metadataAvailable: false,
        reportingOk: true,
      },
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.equal(res.accountName, 'aBoks (lagret)')
  })

  it('records the unknown time zone as null in syncMetadata, never a guess', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 10]), {
      config: configWithCurrency,
      fetchAdvertiserInfo: async () => null,
      lastExternalDate: '2026-07-22',
    })
    await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)
    const meta = JSON.stringify([...m.store.values()][0].syncMetadata)
    assert.match(meta, /"timezone":null/)
  })
})

describe('runTikTokAdsSync — currency is never guessed', () => {
  const noCurrencyConfig = config // no TIKTOK_ADVERTISER_CURRENCY set

  it('refuses to run when no currency can be established', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      config: noCurrencyConfig,
      fetchAdvertiserInfo: async () => null,
      storedConnection: null,
      lastExternalDate: '2026-07-22',
    })
    await assert.rejects(
      () => runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps),
      TikTokCurrencyUnknownError,
    )
    assert.equal(m.creates, 0, 'nothing is written on an unknown currency')
  })

  it('never silently defaults to NOK', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      config: noCurrencyConfig,
      fetchAdvertiserInfo: async () => null,
      storedConnection: null,
    })
    try {
      await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)
      assert.fail('expected a rejection rather than an assumed NOK')
    } catch (err) {
      assert.ok(err instanceof TikTokCurrencyUnknownError)
      assert.match(err.message, /TIKTOK_ADVERTISER_CURRENCY/)
    }
  })

  it('falls back to the stored connection currency when config is silent', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      config: noCurrencyConfig,
      fetchAdvertiserInfo: async () => null,
      lastExternalDate: '2026-07-22',
      storedConnection: {
        advertiserId: ADVERTISER,
        advertiserName: null,
        currency: 'NOK',
        timezone: null,
        connectedAt: null,
        metadataAvailable: false,
        reportingOk: true,
      },
    })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.equal(res.currency, 'NOK')
    assert.equal(res.currencySource, 'stored')
  })

  it('still rejects a declared non-NOK currency', async () => {
    const usdConfig: TikTokAdsConfig = getTikTokAdsConfig({
      TIKTOK_APP_ID: '7668564716072534017',
      TIKTOK_APP_SECRET: SECRETS.appSecret,
      TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
      TIKTOK_ADVERTISER_ID: ADVERTISER,
      TIKTOK_ADVERTISER_CURRENCY: 'USD',
    })
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      config: usdConfig,
      fetchAdvertiserInfo: async () => null,
      lastExternalDate: '2026-07-22',
    })
    await assert.rejects(() => runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps), /USD/)
    assert.equal(m.creates, 0)
  })

  it('prefers TikTok\'s own currency over the declared one', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      // Declares NOK, but TikTok says USD — the authoritative answer must win and stop it.
      config: getTikTokAdsConfig({
        TIKTOK_APP_ID: '7668564716072534017',
        TIKTOK_APP_SECRET: SECRETS.appSecret,
        TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
        TIKTOK_ADVERTISER_ID: ADVERTISER,
        TIKTOK_ADVERTISER_CURRENCY: 'NOK',
      }),
      fetchAdvertiserInfo: async () => ({ ...account, currency: 'USD' }),
      lastExternalDate: '2026-07-22',
    })
    await assert.rejects(() => runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps), /USD/)
    assert.equal(m.creates, 0)
  })
})

describe('runTikTokAdsSync — safety', () => {
  it('stops on a non-NOK advertiser rather than converting silently', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      fetchAdvertiserInfo: async () => ({ ...account, currency: 'USD' }),
    })
    await assert.rejects(() => runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps), /USD/)
    assert.equal(m.creates, 0)
  })

  it('refuses to run without an access token', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { accessToken: undefined })
    await assert.rejects(
      () => runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps),
      /ikke koblet til/,
    )
    assert.equal(m.creates, 0)
  })

  it('refuses to run when no advertiser has been selected', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { advertiserId: '' })
    await assert.rejects(
      () => runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps),
      TikTokAdvertiserNotSelectedError,
    )
    assert.equal(m.creates, 0)
  })

  it('returns a masked advertiser id and no secret anywhere in the result', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.accountId, '•••4567')
    assert.equal(res.accountName, 'aBoks')
    const serialized = JSON.stringify(res)
    assert.ok(!serialized.includes(SECRETS.accessToken))
    assert.ok(!serialized.includes(SECRETS.appSecret))
    assert.ok(!serialized.includes(ADVERTISER))
  })

  it('stores no secret in syncMetadata', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    const meta = JSON.stringify([...m.store.values()][0].syncMetadata)
    assert.ok(!meta.includes(SECRETS.accessToken))
    assert.ok(!meta.includes(SECRETS.appSecret))
    assert.match(meta, /"currency":"NOK"/)
    assert.match(meta, /"apiVersion":"v1\.3"/)
    assert.match(meta, /"timezone":"Europe\/Oslo"/)
  })

  it('exposes the whole shared sync contract', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), { lastExternalDate: '2026-07-22' })
    const res = await runTikTokAdsSync(m.payload, { mode: 'incremental' }, deps)

    for (const key of [
      'provider',
      'mode',
      'requestedMode',
      'initialSync',
      'accountId',
      'accountName',
      'period',
      'fetchedDays',
      'created',
      'updated',
      'unchanged',
      'skipped',
      'totalSpend',
      'currency',
      'syncedAt',
      'conflicts',
      'warnings',
    ]) {
      assert.ok(key in res, `missing ${key}`)
    }
    assert.equal(res.provider, TIKTOK_ADS_SOURCE)
    assert.equal(res.currency, 'NOK')
  })
})

describe('imported TikTok rows in the analytics VAT hook', () => {
  it('counts the full amount, because vatRate is 0 (reverse charge)', () => {
    const data = computeMarketingExVat({
      data: { amount: 1234.56, vatRate: TIKTOK_ADS_VAT_RATE },
    } as never) as { amountExVat: number }
    assert.equal(data.amountExVat, 1234.56)
  })
})

/**
 * The analytics layer is channel-agnostic: it groups by the stored `channel` value and looks
 * the label up in the shared vocabulary. These assertions prove TikTok spend reaches every
 * marketing KPI without a single TikTok-specific line in the dashboard code — which is why
 * nothing under src/lib/analytics was modified for this integration.
 */
describe('TikTok spend flows through the shared analytics calculations', () => {
  const period = { from: '2026-07-01T00:00:00.000Z', to: '2026-08-01T00:00:00.000Z' }
  const expenses = [
    { channel: 'meta', amountExVat: 300, date: '2026-07-10T00:00:00.000Z' },
    { channel: TIKTOK_ADS_CHANNEL, amountExVat: 100, date: '2026-07-11T00:00:00.000Z' },
  ]

  it('is included in total ad spend', () => {
    assert.equal(computeAdSpend(expenses, period), 400)
  })

  it('appears as its own channel row, with the shared "TikTok Ads" label', () => {
    const rows = computeChannels(expenses, period)
    const tiktok = rows.find((r) => r.channel === TIKTOK_ADS_CHANNEL)
    assert.ok(tiktok, 'TikTok has its own channel row')
    assert.equal(tiktok.label, 'TikTok Ads')
    assert.equal(tiktok.amountExVat, 100)
    assert.equal(tiktok.share, 25)
  })

  it('moves CAC, cost-per-order and ROAS, so no KPI silently ignores it', () => {
    const withoutTikTok = expenses.filter((e) => e.channel !== TIKTOK_ADS_CHANNEL)
    const spendWith = computeAdSpend(expenses, period)
    const spendWithout = computeAdSpend(withoutTikTok, period)

    assert.notEqual(computeCac(spendWith, 8), computeCac(spendWithout, 8))
    assert.notEqual(computeCostPerOrder(spendWith, 10), computeCostPerOrder(spendWithout, 10))
    assert.notEqual(computeRoas(5000, spendWith), computeRoas(5000, spendWithout))
  })

  it('is labelled identically wherever the channel value is rendered (CSV, cards, filters)', () => {
    assert.equal(channelLabel(TIKTOK_ADS_CHANNEL), 'TikTok Ads')
  })
})
