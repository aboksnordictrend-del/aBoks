import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import {
  buildExternalKey,
  parseSyncMode,
  runMetaSync,
  validateSyncDates,
  SyncValidationError,
  type MetaSpendQuery,
  type MetaSyncDeps,
} from './sync'
import type { MetaConfig } from './config'
import type { MetaDailySpend } from './types'

const TOKEN = 'SECRET-TOKEN-should-never-leak'
const ACCOUNT = 'act_999'
const NOW = new Date('2026-07-22T09:00:00.000Z')

const config: MetaConfig = {
  appId: '123',
  accessToken: TOKEN,
  adAccountId: ACCOUNT,
  graphApiVersion: 'v24.0',
  baseUrl: 'https://graph.facebook.com/v24.0',
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

/** In-memory Payload double that understands the three queries sync issues. */
function mockPayload(initial: Doc[] = [], vatRate = 25): Mock {
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

      const and = (where as { and?: Array<Record<string, { equals?: string }>> }).and
      // findLastExternalDate: and[] contains { source: { equals: 'meta-api' } }
      if (and?.some((c) => c?.source?.equals === 'meta-api')) {
        const rows = [...store.values()]
          .filter((d) => d.source === 'meta-api' && typeof d.externalDate === 'string')
          .sort((a, b) => String(b.externalDate).localeCompare(String(a.externalDate)))
        return { docs: rows.slice(0, 1) }
      }

      // Otherwise: the manual-conflict query.
      conflictWheres.push(where)
      return { docs: [...store.values()].filter((d) => d.channel === 'meta' && d.source !== 'meta-api') }
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
    findGlobal: async () => ({ metaAdsVatRate: vatRate }),
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

function days(...rows: Array<[string, number]>): MetaDailySpend[] {
  return rows.map(([date, spend]) => ({ date, spend, currency: 'NOK' }))
}

/** Capture the query the Meta client was asked for, so we can assert the window. */
function capturingDeps(rows: MetaDailySpend[], over: Partial<MetaSyncDeps> = {}) {
  const seen: MetaSpendQuery[] = []
  const deps: MetaSyncDeps = {
    config,
    metaVatRate: 0, // amount == amountExVat keeps assertions simple
    now: () => NOW,
    fetchDailySpend: async (q) => {
      seen.push(q)
      return rows
    },
    ...over,
  }
  return { deps, seen }
}

function metaDoc(id: number, date: string, amount: number): Doc {
  return {
    id,
    channel: 'meta',
    source: 'meta-api',
    amount,
    vatRate: 0,
    externalKey: buildExternalKey(ACCOUNT, date),
    externalAccountId: ACCOUNT,
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
    assert.throws(() => parseSyncMode('partial'), SyncValidationError)
    assert.throws(() => parseSyncMode(3), SyncValidationError)
  })
})

describe('validateSyncDates (still used by the Meta page display filter)', () => {
  it('accepts both dates empty', () => {
    assert.deepEqual(validateSyncDates({}), {})
  })
  it('rejects only one date', () => {
    assert.throws(() => validateSyncDates({ since: '2026-07-11' }), SyncValidationError)
  })
  it('rejects since > until', () => {
    assert.throws(() => validateSyncDates({ since: '2026-07-12', until: '2026-07-11' }), SyncValidationError)
  })
})

describe('runMetaSync — initial sync (#1, #2)', () => {
  it('escalates an incremental request to a full import when the DB is empty', async () => {
    const m = mockPayload()
    const { deps, seen } = capturingDeps(days(['2026-04-09', 100], ['2026-07-22', 200]))
    const res = await runMetaSync(m.payload, { mode: 'incremental' }, deps)

    assert.deepEqual(seen[0], {}, 'no time_range ⇒ full available history')
    assert.equal(res.initialSync, true)
    assert.equal(res.mode, 'full')
    assert.equal(res.created, 2)
    // The reported period is the span of what Meta actually returned.
    assert.deepEqual(res.period, { since: '2026-04-09', until: '2026-07-22' })
  })
})

describe('runMetaSync — incremental window (#3, #8)', () => {
  it('requests lastExternalDate − 13 days … today', async () => {
    const m = mockPayload([metaDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    const res = await runMetaSync(m.payload, { mode: 'incremental' }, deps)

    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
    assert.equal(res.initialSync, false)
    assert.equal(res.mode, 'incremental')
    assert.deepEqual(res.period, { since: '2026-07-09', until: '2026-07-22' })
  })

  it('anchors on a stale last date rather than only the last 14 days', async () => {
    const m = mockPayload([metaDoc(1, '2026-07-10', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-10', 100]))
    await runMetaSync(m.payload, { mode: 'incremental' }, deps)
    assert.deepEqual(seen[0], { since: '2026-06-27', until: '2026-07-22' })
  })

  it('defaults to incremental when no mode is given', async () => {
    const m = mockPayload([metaDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-07-22', 100]))
    await runMetaSync(m.payload, {}, deps)
    assert.deepEqual(seen[0], { since: '2026-07-09', until: '2026-07-22' })
  })
})

describe('runMetaSync — full mode (#7)', () => {
  it('always asks for the whole history, even when data exists', async () => {
    const m = mockPayload([metaDoc(1, '2026-07-22', 100)])
    const { deps, seen } = capturingDeps(days(['2026-04-09', 50], ['2026-07-22', 100]))
    const res = await runMetaSync(m.payload, { mode: 'full' }, deps)

    assert.deepEqual(seen[0], {}, 'no time_range ⇒ full history')
    assert.equal(res.mode, 'full')
    assert.equal(res.initialSync, false, 'not an initial sync — data already existed')
  })
})

describe('runMetaSync — idempotency and corrections (#9, #10)', () => {
  it('a repeated incremental sync creates no duplicates', async () => {
    const m = mockPayload()
    const rows = days(['2026-07-21', 100], ['2026-07-22', 200])
    await runMetaSync(m.payload, { mode: 'incremental' }, capturingDeps(rows).deps)
    const second = await runMetaSync(m.payload, { mode: 'incremental' }, capturingDeps(rows).deps)

    assert.equal(second.created, 0)
    assert.equal(second.unchanged, 2)
    assert.equal(m.store.size, 2)
  })

  it('updates a record when Meta restates spend 5 days back', async () => {
    // 2026-07-17 is inside the 09.07–22.07 window.
    const m = mockPayload([metaDoc(1, '2026-07-17', 100)])
    const { deps } = capturingDeps(days(['2026-07-17', 175]))
    const res = await runMetaSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.updated, 1)
    assert.equal(res.created, 0)
    assert.equal(m.store.get(1)?.amount, 175)
  })

  it('never leaks the token into stored records or the result', async () => {
    const m = mockPayload()
    const res = await runMetaSync(m.payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)
    assert.ok(!JSON.stringify(res).includes(TOKEN))
    assert.ok(!JSON.stringify([...m.store.values()]).includes(TOKEN))
  })
})

describe('runMetaSync — manual conflicts (#19, #20)', () => {
  const manual: Doc = {
    id: 42,
    channel: 'meta',
    source: 'manual',
    amount: 500,
    description: 'Meta juli (manuell)',
    periodFrom: '2026-07-01T00:00:00.000Z',
    periodTo: '2026-07-31T00:00:00.000Z',
  }

  it('blocks an incremental sync and checks only its 14-day window (#19)', async () => {
    const m = mockPayload([manual, metaDoc(1, '2026-07-22', 100)])
    const { deps } = capturingDeps(days(['2026-07-22', 100]))
    const res = await runMetaSync(m.payload, { mode: 'incremental' }, deps)

    assert.equal(res.created, 0)
    assert.equal(res.conflicts.length, 1)
    assert.equal(res.conflicts[0].id, '42')
    // The conflict query covered exactly the incremental window, not all history.
    const bounds = conflictBounds(m.conflictWheres[0])
    assert.equal(bounds.start, '2026-07-09T00:00:00.000Z')
    assert.equal(bounds.end, '2026-07-22T23:59:59.999Z')
  })

  it('blocks a full sync across the whole fetched period (#20)', async () => {
    const m = mockPayload([manual])
    const { deps } = capturingDeps(days(['2026-04-09', 10], ['2026-07-22', 20]))
    const res = await runMetaSync(m.payload, { mode: 'full' }, deps)

    assert.equal(res.created, 0)
    assert.equal(m.store.size, 1, 'nothing written')
    assert.equal(res.conflicts.length, 1)
    const bounds = conflictBounds(m.conflictWheres[0])
    assert.equal(bounds.start, '2026-04-09T00:00:00.000Z')
    assert.equal(bounds.end, '2026-07-22T23:59:59.999Z')
  })

  it('skips (never overwrites) a manual row that shares the external key', async () => {
    const collidingManual: Doc = {
      id: 7,
      channel: 'google', // not caught by the meta conflict query, but shares the key
      source: 'manual',
      amount: 999,
      externalKey: buildExternalKey(ACCOUNT, '2026-07-22'),
    }
    const m = mockPayload([collidingManual])
    const res = await runMetaSync(m.payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)

    assert.equal(res.skipped, 1)
    assert.equal(res.created, 0)
    assert.equal(m.store.get(7)?.amount, 999) // untouched
  })
})

describe('runMetaSync — unique-key race', () => {
  it('reconciles instead of failing when create hits a duplicate key', async () => {
    let keyFinds = 0
    const raced = metaDoc(5, '2026-07-22', 100)
    const payload = {
      find: async ({ where }: { where: Record<string, unknown> }) => {
        const byKey = (where as { externalKey?: { equals?: string } }).externalKey?.equals
        if (byKey) {
          keyFinds += 1
          return { docs: keyFinds === 1 ? [] : [raced] }
        }
        const and = (where as { and?: Array<Record<string, { equals?: string }>> }).and
        if (and?.some((c) => c?.source?.equals === 'meta-api')) return { docs: [] } // no prior data
        return { docs: [] } // no manual conflicts
      },
      create: async () => {
        throw new Error('duplicate key value violates unique constraint')
      },
      update: async () => raced,
      findGlobal: async () => ({ metaAdsVatRate: 0 }),
      logger: { error() {}, warn() {}, info() {} },
    } as unknown as Payload

    const res = await runMetaSync(payload, {}, capturingDeps(days(['2026-07-22', 100])).deps)
    assert.equal(res.created, 0)
    assert.equal(res.unchanged, 1)
  })
})
