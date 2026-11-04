import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { createStub } from './testStub'
import { submitRegistration, RATE_LIMITED_REGISTRATION_MESSAGE } from './service'
import { memoryDuplicateTracker } from './duplicates'
import { PUBLIC_LIMITS, PUBLIC_WINDOW_SECONDS, readRules, registrationRules } from './abuse'
import { checkRegistrationShape } from './formShape'
import {
  dbBatchRateLimitStore,
  keyedRateKey,
  memoryBatchRateLimitStore,
  withinBudget,
  type BatchRateLimitStore,
} from '@/lib/security/dbRateLimit'

const NOW = new Date('2026-11-04T09:00:00Z')
const CODE_A = 'abcdefghjk'
const CODE_B = 'mnpqrstuvw'
const L = PUBLIC_LIMITS.registration

async function setup() {
  return createStub({
    'environmental-organizations': [
      { id: 1, name: 'Hitra kommune', publicCode: CODE_A, status: 'active', allowedCategories: ['aa', 'aaa', 'other'], otherCategoryDescription: 'Knappceller', pinHash: null },
      { id: 2, name: 'Frøya skole', publicCode: CODE_B, status: 'active', allowedCategories: ['aa'], pinHash: null },
    ],
  })
}

const reg = (code: string, ip: string, quantities: Record<string, unknown> = { aa: '2' }, extra: Record<string, unknown> = {}) => ({
  code,
  quantities,
  confirmed: false,
  confirmDuplicate: false,
  submissionKey: randomUUID(),
  clientKey: ip,
  ...extra,
})

async function stored(req: Awaited<ReturnType<typeof setup>>['req']): Promise<number> {
  const found = await req.payload.find({ collection: 'battery-registrations', limit: 0, pagination: false, overrideAccess: true })
  return found.docs.length
}

/** Quantities that never repeat, so the in-memory near-duplicate prompt stays out of the way. */
const qty = (i: number) => ({ aa: String((i % 40) + 1), aaa: String(Math.floor(i / 40) + 1) })

describe('registration request shape', () => {
  const form = (entries: [string, string | Blob][]) => {
    const f = new FormData()
    for (const [k, v] of entries) f.append(k, v)
    return f
  }
  const browser: [string, string][] = [
    ['code', CODE_A],
    ['referansekode', ''],
    ['antall_aa', '3'],
    ['antall_aaa', ''],
    ['antall_other', '1'],
    ['bekreftAntall', '1'],
    ['submissionKey', randomUUID()],
    ['cf-turnstile-response', 'XXXX.DUMMY.TOKEN.XXXX'],
  ]

  it('accepts exactly what the page sends', () => {
    assert.deepEqual(checkRegistrationShape(form(browser)), { ok: true })
    assert.deepEqual(checkRegistrationShape(form([...browser, ['bekreftDuplikat', '1']])), { ok: true })
  })

  it('refuses unexpected, repeated, file and oversized fields and malformed flags', () => {
    assert.deepEqual(checkRegistrationShape(form([...browser, ['organization', '2']])), { ok: false, problem: 'unexpected-field' })
    assert.deepEqual(checkRegistrationShape(form([...browser, ['antall_9v', '1']])), { ok: false, problem: 'unexpected-field' })
    assert.deepEqual(checkRegistrationShape(form([...browser, ['antall_aa', '400']])), { ok: false, problem: 'repeated-field' })
    assert.deepEqual(checkRegistrationShape(form([...browser.slice(0, 2), ['antall_aa', new Blob(['1'])]])), { ok: false, problem: 'file-field' })
    assert.deepEqual(checkRegistrationShape(form([['antall_aa', '1'.repeat(17)]])), { ok: false, problem: 'oversized-field' })
    assert.deepEqual(checkRegistrationShape(form([['cf-turnstile-response', 'x'.repeat(2049)]])), { ok: false, problem: 'oversized-field' })
    assert.deepEqual(checkRegistrationShape(form([['bekreftAntall', 'true']])), { ok: false, problem: 'oversized-field' })
    assert.deepEqual(checkRegistrationShape(form([['bekreftAntall', '0']])), { ok: false, problem: 'malformed-flag' })
  })
})

describe('budget rules', () => {
  it('network rules first, then organisation, battery budget and overall', () => {
    const [own, shared] = registrationRules('203.0.113.7', 1, 37)
    assert.deepEqual(own!.map((r) => r.key), ['miljo:reg:net-org:203.0.113.7:1', 'miljo:reg:net:203.0.113.7'])
    assert.deepEqual(shared!.map((r) => r.key), ['miljo:reg:org:1', 'miljo:reg:org-batteries:1', 'miljo:reg:all'])
    assert.deepEqual(shared!.filter((r) => r.cost !== undefined).map((r) => r.cost), [37])
    assert.ok([...own!, ...shared!].every((r) => r.key.startsWith('miljo:')))
    assert.notDeepEqual(readRules('pdf', 'x').flat().map((r) => r.key), readRules('csv', 'x').flat().map((r) => r.key))
  })

  it('withinBudget: within, over, and a failing store is never «ok»', async () => {
    const s = memoryBatchRateLimitStore()
    const k = [[{ key: 'k', limit: 2 }]]
    assert.equal(await withinBudget(s, 60, k), 'ok')
    assert.equal(await withinBudget(s, 60, k), 'ok')
    assert.equal(await withinBudget(s, 60, k), 'limited')
    const broken: BatchRateLimitStore = { hitMany: async () => Promise.reject(new Error('db down')) }
    assert.equal(await withinBudget(broken, 60, k), 'unavailable')
  })

  it('a client over its own limit does not push the shared counters (no lockout of others)', async () => {
    const s = memoryBatchRateLimitStore()
    const tiers = (ip: string) => readRules('statistics', ip)
    for (let i = 0; i < 5_000; i++) await withinBudget(s, 3600, tiers('198.51.100.1'))
    assert.equal(s.count('miljo:statistics:all'), PUBLIC_LIMITS.statistics.perNetwork)
    assert.equal(await withinBudget(s, 3600, tiers('198.51.100.2')), 'ok')
  })

  it('windows restart after the window', async () => {
    let t = 0
    const s = memoryBatchRateLimitStore(() => t)
    const k = [[{ key: 'k', limit: 2 }]]
    for (let i = 0; i < 3; i++) await withinBudget(s, 60, k)
    assert.equal(await withinBudget(s, 60, k), 'limited')
    t = 61_000
    assert.equal(await withinBudget(s, 60, k), 'ok')
  })
})

describe('database batch store (statement shape, fake executor)', () => {
  function fakePayload(rows: (keys: string[]) => Record<string, unknown>[], secret: string | null = 'server-secret') {
    const statements: { sql: string; params: unknown[] }[] = []
    const payload = {
      secret: secret ?? undefined,
      db: {
        drizzle: {
          async execute(query: { queryChunks?: unknown[] }) {
            const { PgDialect } = await import('drizzle-orm/pg-core')
            const built = new PgDialect().sqlToQuery(query as never)
            statements.push({ sql: built.sql, params: built.params })
            const keys = built.params.filter((p): p is string => typeof p === 'string' && /^[0-9a-f]{64}$/.test(p))
            return { rows: rows(keys) }
          },
        },
      },
    } as unknown as Payload
    return { payload, statements }
  }

  it('counts all rules in ONE statement, keyed by HMAC (no address in clear), in hash order', async () => {
    const { payload, statements } = fakePayload((keys) => keys.map((k, i) => ({ key: k, count: i + 1 })))
    const store = dbBatchRateLimitStore(payload, () => 1)
    const rules = registrationRules('203.0.113.7', 1, 5).flat()
    const counts = await store.hitMany(rules.map((r) => ({ key: r.key, cost: r.cost ?? 1 })), PUBLIC_WINDOW_SECONDS)
    assert.equal(statements.length, 1)
    assert.match(statements[0]!.sql, /INSERT INTO "miljo_rate_limits"/)
    assert.match(statements[0]!.sql, /ON CONFLICT \("key"\) DO UPDATE/)
    const params = JSON.stringify(statements[0]!.params)
    assert.ok(!params.includes('203.0.113.7'))
    const keys = statements[0]!.params.filter((p): p is string => typeof p === 'string' && /^[0-9a-f]{64}$/.test(p))
    assert.deepEqual(keys, [...keys].sort())
    assert.equal(keys[0], [...rules.map((r) => keyedRateKey('server-secret', r.key))].sort()[0])
    assert.equal(counts.length, rules.length)
  })

  it('throws (→ refused by the caller) when the database answers without counts or no secret exists', async () => {
    const empty = fakePayload(() => [])
    await assert.rejects(dbBatchRateLimitStore(empty.payload, () => 1).hitMany([{ key: 'a', cost: 1 }], 60))
    const noSecret = fakePayload((keys) => keys.map((k) => ({ key: k, count: 1 })), null)
    await assert.rejects(dbBatchRateLimitStore(noSecret.payload, () => 1).hitMany([{ key: 'a', cost: 1 }], 60))
  })

  it('prunes expired windows occasionally, and a failing prune is harmless', async () => {
    const { payload, statements } = fakePayload((keys) => keys.map((k) => ({ key: k, count: 1 })))
    await dbBatchRateLimitStore(payload, () => 0).hitMany([{ key: 'a', cost: 1 }], 60)
    assert.equal(statements.length, 2)
    assert.match(statements[1]!.sql, /DELETE FROM "miljo_rate_limits" WHERE "window_start" </)
  })
})

describe('public registration under abuse (service + persistent limits)', () => {
  const deps = (limits: BatchRateLimitStore) => ({ duplicates: memoryDuplicateTracker(), limits, now: NOW })

  it('one network: stops after the per-network-and-organisation budget and stores nothing more', async () => {
    const { req } = await setup()
    const d = deps(memoryBatchRateLimitStore())
    for (let i = 0; i < L.perNetworkPerOrg; i++) {
      const r = await submitRegistration(req, reg(CODE_A, '198.51.100.9', qty(i)), d)
      assert.ok(r.ok, `#${i}`)
    }
    const over = await submitRegistration(req, reg(CODE_A, '198.51.100.9', { aa: '1', aaa: '45' }), d)
    assert.deepEqual(over, { ok: false, reason: 'rate-limited', message: RATE_LIMITED_REGISTRATION_MESSAGE })
    assert.equal(await stored(req), L.perNetworkPerOrg)
    // Another organisation from the same network still works (until the per-network budget).
    assert.ok((await submitRegistration(req, reg(CODE_B, '198.51.100.9', { aa: '1' }), d)).ok)
  })

  it('a shared corporate address: 100 employees in one hour all get through', async () => {
    const { req } = await setup()
    const d = deps(memoryBatchRateLimitStore())
    let accepted = 0
    for (let i = 0; i < 100; i++) if ((await submitRegistration(req, reg(CODE_A, '192.0.2.50', qty(i)), d)).ok) accepted++
    assert.equal(accepted, 100)
  })

  it('many addresses: the per-organisation budget caps a distributed flood', async () => {
    const { req } = await setup()
    const d = deps(memoryBatchRateLimitStore())
    let accepted = 0
    for (let i = 0; i < L.perOrg + 50; i++) {
      const ip = `10.${(i >> 8) & 255}.${i & 255}.1`
      if ((await submitRegistration(req, reg(CODE_A, ip, { aa: '1' }), d)).ok) accepted++
    }
    assert.equal(accepted, L.perOrg)
    assert.ok((await submitRegistration(req, reg(CODE_B, '10.200.0.1', { aa: '1' }), d)).ok, 'other organisations are unaffected')
  })

  it('the battery budget caps large quantities per organisation', async () => {
    const { req } = await setup()
    const d = deps(memoryBatchRateLimitStore())
    let batteries = 0
    for (let i = 0; i < 20; i++) {
      const ip = `172.16.0.${i + 1}`
      const r = await submitRegistration(req, reg(CODE_A, ip, { aa: '200', aaa: '200', other: '100' }, { confirmed: true }), d)
      if (r.ok) batteries += r.total
    }
    assert.equal(batteries, L.batteriesPerOrg)
  })

  it('the overall ceiling holds across organisations', async () => {
    const { req } = await setup()
    const limits = memoryBatchRateLimitStore()
    // Pre-fill the shared counter up to one below the ceiling (as many networks would).
    await limits.hitMany([{ key: 'miljo:reg:all', cost: L.overall - 1 }], PUBLIC_WINDOW_SECONDS)
    const d = deps(limits)
    assert.ok((await submitRegistration(req, reg(CODE_A, '10.0.0.1'), d)).ok)
    assert.equal(why(await submitRegistration(req, reg(CODE_B, '10.0.0.2'), d)), 'rate-limited')
  })

  it('a limiter that cannot count refuses and stores nothing', async () => {
    const { req } = await setup()
    const broken: BatchRateLimitStore = { hitMany: async () => Promise.reject(new Error('db down')) }
    const r = await submitRegistration(req, reg(CODE_A, '10.0.0.1'), deps(broken))
    assert.equal(why(r), 'error')
    assert.equal(await stored(req), 0)
  })

  it('retries of a stored submission key are answered from the record and not counted again', async () => {
    const { req } = await setup()
    const limits = memoryBatchRateLimitStore()
    const d = deps(limits)
    const input = reg(CODE_A, '10.0.0.1')
    for (let i = 0; i < 5; i++) assert.ok((await submitRegistration(req, input, d)).ok)
    assert.equal(limits.count('miljo:reg:org:1'), 1)
    assert.equal(await stored(req), 1)
  })

  it('invalid submissions are not counted and not stored', async () => {
    const { req } = await setup()
    const limits = memoryBatchRateLimitStore()
    const d = deps(limits)
    for (const q of [{ aa: '-1' }, { aa: '1.5' }, { aa: '201' }, { aa: '0' }, { '9v': '1' }, { aa: 'abc' }]) {
      const r = await submitRegistration(req, reg(CODE_B, '10.0.0.1', q), d)
      assert.ok(!r.ok, JSON.stringify(q))
    }
    // «Andre» is not offered by Frøya skole.
    assert.equal(why(await submitRegistration(req, reg(CODE_B, '10.0.0.1', { other: '1' }), d)), 'invalid')
    assert.equal(limits.count('miljo:reg:org:2'), 0)
    assert.equal(await stored(req), 0)
  })

  it('organisation isolation: the code decides the organisation; a key from another organisation is refused', async () => {
    const { req } = await setup()
    const d = deps(memoryBatchRateLimitStore())
    const input = reg(CODE_A, '10.0.0.1')
    assert.ok((await submitRegistration(req, input, d)).ok)
    assert.equal(why(await submitRegistration(req, { ...input, code: CODE_B }, d)), 'invalid')
    const docs = (await req.payload.find({ collection: 'battery-registrations', limit: 0, pagination: false, overrideAccess: true })).docs as unknown as { organization: number }[]
    assert.deepEqual(docs.map((x) => x.organization), [1])
  })
})

function why(r: { ok: boolean }): string | undefined {
  return (r as { reason?: string }).reason
}
