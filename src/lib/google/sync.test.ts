import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import { computeMarketingExVat } from '@/collections/MarketingExpenses'
import {
  GOOGLE_ADS_SOURCE,
  GOOGLE_ADS_VAT_RATE,
  GoogleSyncValidationError,
  buildExternalKey,
  parseSyncMode,
  runGoogleAdsSync,
  validateSyncDates,
  type GoogleSyncDeps,
} from './sync'
import type { GoogleAdsConfig } from './config'
import type { GoogleSpendRange } from './ads'
import type { GoogleAdsAccountInfo, GoogleDailySpend } from './types'

const SECRETS = {
  clientSecret: 'CLIENT-SECRET-should-never-leak',
  refreshToken: 'REFRESH-TOKEN-should-never-leak',
  developerToken: 'DEV-TOKEN-should-never-leak',
}
const CUSTOMER = '1234567890'
const OTHER_CUSTOMER = '9999999999'
/** 09:00 UTC on 22 July — the same calendar day in Oslo, so the tests read naturally. */
const NOW = new Date('2026-07-22T09:00:00.000Z')

const config: GoogleAdsConfig = {
  clientId: 'client-id',
  clientSecret: SECRETS.clientSecret,
  developerToken: SECRETS.developerToken,
  refreshToken: SECRETS.refreshToken,
  customerId: CUSTOMER,
  loginCustomerId: '9876543210',
  apiVersion: 'v24',
  baseUrl: 'https://googleads.googleapis.com/v24',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  historyStart: '2015-01-01',
}

const account: GoogleAdsAccountInfo = {
  id: CUSTOMER,
  currencyCode: 'NOK',
  timeZone: 'Europe/Oslo',
  descriptiveName: 'aBoks',
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
  /** `where` clauses seen by the manual-conflict query. */
  conflictWheres: unknown[]
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
  const conflictWheres: unknown[] = []

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

      // Otherwise: the manual-conflict query (channel google, source != google-ads).
      conflictWheres.push(where)
      return {
        docs: [...store.values()].filter((d) => d.channel === 'google' && d.source !== GOOGLE_ADS_SOURCE),
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
    conflictWheres,
    get creates() {
      return state.creates
    },
    get updates() {
      return state.updates
    },
  }
}

/** Build daily-spend rows from [date, kroner] pairs (micros derived, never rounded early). */
function days(...rows: Array<[string, number]>): GoogleDailySpend[] {
  return rows.map(([date, spend]) => ({
    date,
    costMicros: Math.round(spend * 1_000_000),
    spend,
    currency: 'NOK',
  }))
}

/**
 * Deps that capture every range the client was asked for, so the resolved window and the
 * chunking are both assertable. `rows` are returned filtered to the requested range, which
 * is how the real API behaves.
 */
function capturingDeps(rows: GoogleDailySpend[], over: Partial<GoogleSyncDeps> = {}) {
  const seen: GoogleSpendRange[] = []
  const probes: GoogleSpendRange[] = []
  const deps: GoogleSyncDeps = {
    config,
    now: () => NOW,
    fetchAccountInfo: async () => account,
    fetchEarliestDate: async (range) => {
      probes.push(range)
      const inRange = rows.filter((r) => r.date >= range.since && r.date <= range.until)
      return inRange.length > 0 ? inRange.map((r) => r.date).sort()[0] : null
    },
    fetchDailySpend: async (range) => {
      seen.push(range)
      return rows.filter((r) => r.date >= range.since && r.date <= range.until)
    },
    ...over,
  }
  return { deps, seen, probes }
}

function googleDoc(id: number, date: string, amount: number, customerId = CUSTOMER): Doc {
  return {
    id,
    channel: 'google',
    source: GOOGLE_ADS_SOURCE,
    amount,
    vatRate: 0,
    externalKey: buildExternalKey(customerId, date),
    externalAccountId: customerId,
    externalDate: date,
    date: `${date}T00:00:00.000Z`,
  }
}

/** Pull the conflict window bounds out of a captured `where`. */
function conflictBounds(where: unknown): { start: string; end: string } {
  const and = (where as { and: unknown[] }).and
  const dateClause = (and[2] as { or: Array<{ and: Array<Record<string, Record<string, string>>> }> }).or[0]
  return {
    start: dateClause.and[0].date.greater_than_equal,
    end: dateClause.and[1].date.less_than_equal,
  }
}

describe('parseSyncMode (#9)', () => {
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
    assert.throws(() => parseSyncMode('partial'), GoogleSyncValidationError)
    assert.throws(() => parseSyncMode(3), GoogleSyncValidationError)
    assert.throws(() => parseSyncMode({ mode: 'full' }), GoogleSyncValidationError)
  })
})

describe('validateSyncDates (Google page display filter)', () => {
  it('accepts both dates empty', () => {
    assert.deepEqual(validateSyncDates({}), {})
  })
  it('rejects only one date', () => {
    assert.throws(() => validateSyncDates({ since: '2026-07-11' }), GoogleSyncValidationError)
  })
  it('rejects since > until', () => {
    assert.throws(
      () => validateSyncDates({ since: '2026-07-12', until: '2026-07-11' }),
      GoogleSyncValidationError,
    )
  })
})

describe('buildExternalKey', () => {
  it('is deterministic per account + day, and distinct from a Meta key', () => {
    assert.equal(buildExternalKey(CUSTOMER, '2026-07-22'), 'google:1234567890:2026-07-22')
    assert.notEqual(
      buildExternalKey(CUSTOMER, '2026-07-22'),
      buildExternalKey(OTHER_CUSTOMER, '2026-07-22'),
    )
  })
})

describe('runGoogleAdsSync — initial sync (#4)', () => {
  it('escalates an incremental request to a full import when the DB is empty', async () => {
    const m = mockPayload()
    const { deps, seen, probes } = capturingDeps(days(['2026-04-09', 100], ['2026-07-22', 200]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.initialSync, true)
    assert.equal(res.mode, 'full')
    assert.equal(res.created, 2)
    // The full window starts at the account's first day with data, not at the probe floor.
    assert.deepEqual(probes[0], { since: '2015-01-01', until: '2026-07-22' })
    assert.deepEqual(res.period, { since: '2026-04-09', until: '2026-07-22' })
    assert.equal(seen[0].since, '2026-04-09')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
  })

  it('reports an empty account cleanly instead of failing', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps([])
    const res = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.initialSync, true)
    assert.equal(res.fetchedDays, 0)
    assert.equal(res.created, 0)
    assert.deepEqual(res.period, { since: null, until: null })
    assert.equal(seen.length, 0, 'no spend query when there is no history to fetch')
    assert.match(res.warnings.join(' '), /ingen registrerte kostnader/)
  })

  it('splits a long full import into sequential chunks (#5 of the spec)', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps(days(['2025-01-01', 10], ['2026-07-22', 20]), {
      chunkDays: 90,
    })
    await runGoogleAdsSync(m.payload, { mode: 'full' }, deps)

    assert.ok(seen.length > 1, 'more than one request for a >90-day history')
    assert.equal(seen[0].since, '2025-01-01')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
    for (let i = 1; i < seen.length; i += 1) {
      assert.ok(seen[i - 1].until < seen[i].since, 'chunks never overlap')
    }
  })
})

describe('runGoogleAdsSync — incremental window (#5)', () => {
  it('requests lastExternalDate − 13 days … today', async () => {
    const m = mockPayload([googleDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
    assert.equal(res.initialSync, false)
    assert.equal(res.mode, 'incremental')
    assert.deepEqual(res.period, { since: '2026-07-09', until: '2026-07-22' })
  })

  it('anchors on a stale last date rather than only the last 14 days', async () => {
    const m = mockPayload([googleDoc(1, '2026-07-10', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-10', 100]))
    await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.deepEqual(seen[0], { since: '2026-06-27', until: '2026-07-22' })
  })

  it('starts at lastExternalDate − 13 even when that is months before today', async () => {
    // Regression guard: the window must be anchored on the last imported day, NOT on
    // "today − 13". A database that has been idle since January must re-check from January.
    const m = mockPayload([googleDoc(1, '2026-01-15', 100)])
    const { deps, seen } = capturingDeps(days(['2026-01-15', 100]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)

    // 2026-01-15 − 13 = 2026-01-02, i.e. 202 days — so it is also chunked (>90 days).
    assert.equal(seen[0].since, '2026-01-02')
    assert.notEqual(seen[0].since, '2026-07-09', 'not the trailing 14 days from today')
    assert.equal(seen[seen.length - 1].until, '2026-07-22')
    assert.deepEqual(res.period, { since: '2026-01-02', until: '2026-07-22' })
    assert.equal(res.mode, 'incremental', 'still incremental — not escalated to full')
    assert.equal(res.initialSync, false)
  })

  it('defaults to incremental when no mode is given', async () => {
    const m = mockPayload([googleDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    await runGoogleAdsSync(m.payload, {}, deps)
    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
  })

  it('ends on today in the ad account time zone, not the UTC day (#13)', async () => {
    // 22:30 UTC on 22 July is already 23 July in Oslo.
    const m = mockPayload([googleDoc(1, '2026-07-23', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-23', 100]), {
      now: () => new Date('2026-07-22T22:30:00.000Z'),
    })
    await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.equal(seen[0].until, '2026-07-23')
  })
})

describe('runGoogleAdsSync — lastExternalDate scoping (#8)', () => {
  it('ignores rows from another source and another account', async () => {
    const m = mockPayload([
      // A Meta row with a much newer date must not become the Google anchor…
      {
        id: 1,
        channel: 'meta',
        source: 'meta-api',
        externalAccountId: 'act_999',
        externalDate: '2026-07-22',
        amount: 500,
      },
      // …nor may a different Google customer id.
      googleDoc(2, '2026-07-21', 50, OTHER_CUSTOMER),
      // The real anchor for this account:
      googleDoc(3, '2026-07-10', 100),
    ])
    const { deps, seen } = capturingDeps(days(['2026-07-10', 100]))
    await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)
    // Anchored on 2026-07-10 (this account), not 2026-07-22 / 2026-07-21.
    assert.deepEqual(seen[0], { since: '2026-06-27', until: '2026-07-22' })
  })

  it('treats a foreign-account-only database as a first sync', async () => {
    const m = mockPayload([googleDoc(1, '2026-07-21', 50, OTHER_CUSTOMER)])
    const { deps } = capturingDeps(days(['2026-07-20', 10], ['2026-07-21', 20]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)
    assert.equal(res.initialSync, true)
    assert.equal(res.mode, 'full')
  })
})

describe('runGoogleAdsSync — full mode', () => {
  it('always asks for the whole history, even when data exists', async () => {
    const m = mockPayload([googleDoc(1, '2026-07-22', 100)])
    const { deps, probes } = capturingDeps(days(['2026-04-09', 50], ['2026-07-22', 100]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'full' }, deps)

    assert.equal(res.mode, 'full')
    assert.equal(res.initialSync, false, 'not an initial sync — data already existed')
    assert.equal(probes.length, 1)
    assert.equal(res.period.since, '2026-04-09')
  })
})

describe('runGoogleAdsSync — idempotency and corrections (#6, #7)', () => {
  it('a repeated incremental sync creates no duplicates (#6)', async () => {
    const m = mockPayload()
    const rows = days(['2026-07-21', 100], ['2026-07-22', 200])
    await runGoogleAdsSync(m.payload, { mode: 'incremental' }, capturingDeps(rows).deps)
    const second = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, capturingDeps(rows).deps)

    assert.equal(second.created, 0)
    assert.equal(second.unchanged, 2)
    assert.equal(m.store.size, 2)
  })

  it('a full re-import after an incremental one still creates no duplicates (#6)', async () => {
    const m = mockPayload()
    const rows = days(['2026-06-01', 10], ['2026-07-21', 100], ['2026-07-22', 200])
    await runGoogleAdsSync(m.payload, { mode: 'full' }, capturingDeps(rows).deps)
    await runGoogleAdsSync(m.payload, { mode: 'incremental' }, capturingDeps(rows).deps)
    const third = await runGoogleAdsSync(m.payload, { mode: 'full' }, capturingDeps(rows).deps)

    assert.equal(m.store.size, 3)
    assert.equal(third.created, 0)
    // One record per (account, day) — the external key is what guarantees it.
    const keys = [...m.store.values()].map((d) => d.externalKey)
    assert.equal(new Set(keys).size, keys.length)
  })

  it('updates a record when Google restates spend 5 days back (#7)', async () => {
    // 2026-07-17 is inside the 09.07–22.07 window.
    const m = mockPayload([googleDoc(1, '2026-07-17', 100)])
    const { deps } = capturingDeps(days(['2026-07-17', 175.5]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.updated, 1)
    assert.equal(res.created, 0)
    assert.equal(m.store.get(1)?.amount, 175.5)
  })

  it('stores the exact converted amount and the raw micros (#2, #12)', async () => {
    const m = mockPayload()
    const rows: GoogleDailySpend[] = [
      { date: '2026-07-22', costMicros: 1_234_560_000, spend: 1234.56, currency: 'NOK' },
    ]
    const res = await runGoogleAdsSync(m.payload, {}, capturingDeps(rows).deps)

    const doc = [...m.store.values()][0]
    assert.equal(doc.amount, 1234.56)
    assert.equal((doc.syncMetadata as { costMicros: number }).costMicros, 1_234_560_000)
    assert.equal(res.totalSpend, 1234.56)
  })

  it('stores the calendar day verbatim, with no timezone shift (#13)', async () => {
    const m = mockPayload()
    await runGoogleAdsSync(m.payload, {}, capturingDeps(days(['2026-01-01', 5])).deps)
    const doc = [...m.store.values()][0]
    assert.equal(doc.externalDate, '2026-01-01')
    assert.equal(doc.date, '2026-01-01T00:00:00.000Z')
  })

  it('never leaks a secret into stored records or the result (#11)', async () => {
    const m = mockPayload()
    const res = await runGoogleAdsSync(m.payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)
    const stored = JSON.stringify([...m.store.values()])
    const returned = JSON.stringify(res)
    for (const secret of Object.values(SECRETS)) {
      assert.ok(!returned.includes(secret))
      assert.ok(!stored.includes(secret))
    }
    // The account id is masked in the response and never returned in full.
    assert.equal(res.accountId, '•••-•••-7890')
    assert.ok(!returned.includes(CUSTOMER))
  })
})

describe('runGoogleAdsSync — manual conflicts', () => {
  const manual: Doc = {
    id: 42,
    channel: 'google',
    source: 'manual',
    amount: 500,
    description: 'Google juli (manuell)',
    periodFrom: '2026-07-01T00:00:00.000Z',
    periodTo: '2026-07-31T00:00:00.000Z',
  }

  it('blocks an incremental sync and checks only its 14-day window', async () => {
    const m = mockPayload([manual, googleDoc(1, '2026-07-22', 100)])
    const { deps } = capturingDeps(days(['2026-07-22', 100]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.created, 0)
    assert.equal(res.conflicts.length, 1)
    assert.equal(res.conflicts[0].id, '42')
    const bounds = conflictBounds(m.conflictWheres[0])
    assert.equal(bounds.start, '2026-07-09T00:00:00.000Z')
    assert.equal(bounds.end, '2026-07-22T23:59:59.999Z')
  })

  it('blocks a full sync across the whole fetched period', async () => {
    const m = mockPayload([manual])
    const { deps } = capturingDeps(days(['2026-04-09', 10], ['2026-07-22', 20]))
    const res = await runGoogleAdsSync(m.payload, { mode: 'full' }, deps)

    assert.equal(res.created, 0)
    assert.equal(m.store.size, 1, 'nothing written')
    assert.equal(res.conflicts.length, 1)
  })

  it('skips (never overwrites) a manual row that shares the external key', async () => {
    const collidingManual: Doc = {
      id: 7,
      channel: 'meta', // not caught by the google conflict query, but shares the key
      source: 'manual',
      amount: 999,
      externalKey: buildExternalKey(CUSTOMER, '2026-07-22'),
    }
    const m = mockPayload([collidingManual])
    const res = await runGoogleAdsSync(m.payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)

    assert.equal(res.skipped, 1)
    assert.equal(res.created, 0)
    assert.equal(m.store.get(7)?.amount, 999) // untouched
  })

  it('leaves Meta records completely alone', async () => {
    const metaRow: Doc = {
      id: 3,
      channel: 'meta',
      source: 'meta-api',
      amount: 777,
      externalKey: 'meta:act_999:2026-07-22',
      externalAccountId: 'act_999',
      externalDate: '2026-07-22',
    }
    const m = mockPayload([metaRow])
    await runGoogleAdsSync(m.payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)
    assert.deepEqual(m.store.get(3), metaRow)
  })
})

describe('runGoogleAdsSync — currency guard', () => {
  it('stops the import for a non-NOK ad account instead of assuming NOK', async () => {
    const m = mockPayload()
    const { deps } = capturingDeps(days(['2026-07-22', 100]), {
      fetchAccountInfo: async () => ({ ...account, currencyCode: 'EUR' }),
    })
    await assert.rejects(
      () => runGoogleAdsSync(m.payload, {}, deps),
      (err: unknown) => err instanceof Error && /EUR/.test(err.message),
    )
    assert.equal(m.store.size, 0, 'nothing written')
  })
})

describe('runGoogleAdsSync — unique-key race', () => {
  it('reconciles instead of failing when create hits a duplicate key', async () => {
    let keyFinds = 0
    const raced = googleDoc(5, '2026-07-22', 100)
    const payload = {
      find: async ({ where }: { where: Record<string, unknown> }) => {
        const byKey = (where as { externalKey?: { equals?: string } }).externalKey?.equals
        if (byKey) {
          keyFinds += 1
          return { docs: keyFinds === 1 ? [] : [raced] }
        }
        return { docs: [] } // no prior data, no manual conflicts
      },
      create: async () => {
        throw new Error('duplicate key value violates unique constraint')
      },
      update: async () => raced,
      findGlobal: async () => ({}),
      logger: { error() {}, warn() {}, info() {} },
    } as unknown as Payload

    const res = await runGoogleAdsSync(payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)
    assert.equal(res.created, 0)
    assert.equal(res.unchanged, 1)
  })
})

describe('runGoogleAdsSync — VAT (reverse charge)', () => {
  it('always writes vatRate 0, so the imported cost is counted in full', async () => {
    const m = mockPayload()
    await runGoogleAdsSync(m.payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)

    const doc = [...m.store.values()][0]
    assert.equal(doc.vatRate, GOOGLE_ADS_VAT_RATE)
    assert.equal(doc.vatRate, 0)
    // computeMarketingExVat derives amount / (1 + vatRate/100); with 0 that is the identity,
    // so analytics spends the full Google Ads figure instead of amount / 1.25.
    assert.equal(computeMarketingExVat({ data: doc } as never)?.amountExVat, 100)
  })

  it('does not consult economy-settings for a rate', async () => {
    let globalReads = 0
    const m = mockPayload()
    const payload = {
      ...m.payload,
      findGlobal: async () => {
        globalReads += 1
        return {}
      },
    } as unknown as Payload
    await runGoogleAdsSync(payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)
    assert.equal(globalReads, 0)
  })

  it('never reduces the stored amount below the reported spend', async () => {
    const m = mockPayload()
    await runGoogleAdsSync(m.payload, {}, capturingDeps(days(['2026-07-22', 1234.56])).deps)
    const doc = [...m.store.values()][0]
    assert.equal(doc.amount, 1234.56)
    assert.equal(computeMarketingExVat({ data: doc } as never)?.amountExVat, 1234.56)
  })
})
