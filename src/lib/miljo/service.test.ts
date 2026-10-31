import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createStub } from './testStub'
import { buildPublicStatistics, loadRecords, PIN_REJECTED_MESSAGE, resolveOrganization, submitDelivery, submitRegistration, toPublicOrganization } from './service'
import { correctDelivery, correctRegistration, invalidateDelivery, invalidateRegistration, restoreRegistration, reviewRegistration } from './admin'
import { memoryDuplicateTracker } from './duplicates'
import { hashPin } from './pin'
import { resolveMiljoPeriod } from './period'
import type { PinAttemptStore } from './pinAttempts'
import { PIN_POLICY } from './constants'

const NOW = new Date('2026-10-31T12:00:00Z')
const why = (r: { ok: boolean }): string | undefined => (r as { reason?: string }).reason
const CODE_A = 'abcdefghjk'
const CODE_B = 'mnpqrstuvw'

async function setup(extra: Record<string, unknown> = {}) {
  const pinHash = await hashPin('482915')
  return createStub(
    {
      'environmental-organizations': [
        { id: 1, name: 'Hitra kommune', publicCode: CODE_A, status: 'active', allowedCategories: ['aa', 'aaa'], pinHash, internalNotes: 'HEMMELIG NOTAT', contactEmail: 'kontakt@hitra.invalid', ...extra },
        { id: 2, name: 'Frøya skole', publicCode: CODE_B, status: 'active', allowedCategories: ['aa'], pinHash: null },
        { id: 3, name: 'Stengt AS', publicCode: 'xyzxyzxyzx', status: 'inactive', allowedCategories: ['aa'] },
      ],
    },
    { id: 7, email: 'admin@aboks.invalid', role: 'admin' },
  )
}

/** In-memory equivalent of the atomic SQL store (single-threaded tests). */
function memoryPinStore(): PinAttemptStore & { counts: Map<number, number> } {
  const counts = new Map<number, number>()
  return {
    counts,
    async reserve(id) {
      const n = (counts.get(id) ?? 0) + 1
      counts.set(id, n)
      return { allowed: n <= PIN_POLICY.maxAttempts }
    },
    async reset(id) {
      counts.set(id, 0)
    },
  }
}

const reg = (code: string, quantities: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  code,
  quantities,
  confirmed: false,
  confirmDuplicate: false,
  submissionKey: randomUUID(),
  clientKey: '10.0.0.1',
  ...extra,
})

const delivery = (pin: string, extra: Record<string, unknown> = {}) => ({
  code: CODE_A,
  pin,
  submissionKey: randomUUID(),
  fields: { deliveryDate: '2026-10-30', quantity: '12,5', unit: 'kg', operator: 'Retura Trøndelag', reference: 'K-991' },
  ...extra,
})

describe('organisation resolution', () => {
  it('treats inactive, unknown and malformed codes the same', async () => {
    const { req } = await setup()
    assert.equal((await resolveOrganization(req, CODE_A)).kind, 'active')
    for (const c of ['xyzxyzxyzx', 'aaaaaaaaaa', '../etc', '']) assert.equal((await resolveOrganization(req, c)).kind, 'unavailable', c)
  })

  it('sends only public fields to the page', async () => {
    const { req } = await setup()
    const r = await resolveOrganization(req, CODE_A)
    assert.equal(r.kind, 'active')
    const pub = toPublicOrganization(r.kind === 'active' ? r.org : (null as never))
    assert.deepEqual(Object.keys(pub).sort(), ['categories', 'code', 'confirmAbove', 'deliveryEnabled', 'maxPerCategory', 'maxPerSubmission', 'name'])
    const json = JSON.stringify(pub)
    assert.ok(!json.includes('HEMMELIG') && !json.includes('kontakt@') && !json.includes('scrypt'))
    assert.equal(pub.deliveryEnabled, true)
  })
})

describe('registration submission', () => {
  it('stores a registration with original and current lines', async () => {
    const { req, db } = await setup()
    const r = await submitRegistration(req, reg(CODE_A, { aa: '3', aaa: '1' }), { duplicates: memoryDuplicateTracker(), now: NOW })
    assert.deepEqual(r, { ok: true, total: 4, lines: [{ category: 'aa', quantity: 3 }, { category: 'aaa', quantity: 1 }] })
    const stored = db['battery-registrations']![0]!
    assert.deepEqual(stored.submittedLines, stored.lines)
    assert.equal(stored.organization, 1)
    assert.equal(stored.reviewState, 'none')
    assert.equal('clientKey' in stored, false, 'no client identifier stored')
  })

  it('is idempotent per submission key', async () => {
    const { req, db } = await setup()
    const input = reg(CODE_A, { aa: 2 })
    const deps = { duplicates: memoryDuplicateTracker(), now: NOW }
    assert.ok((await submitRegistration(req, input, deps)).ok)
    assert.ok((await submitRegistration(req, input, deps)).ok)
    assert.equal(db['battery-registrations']!.length, 1)
  })

  it('refuses a key that belongs to another organisation', async () => {
    const { req } = await setup()
    const input = reg(CODE_A, { aa: 2 })
    await submitRegistration(req, input, { duplicates: memoryDuplicateTracker(), now: NOW })
    const r = await submitRegistration(req, { ...input, code: CODE_B }, { duplicates: memoryDuplicateTracker(), now: NOW })
    assert.equal(r.ok, false)
  })

  it('refuses disabled categories, malformed keys and inactive organisations', async () => {
    const { req } = await setup()
    const deps = { duplicates: memoryDuplicateTracker(), now: NOW }
    assert.equal((await submitRegistration(req, reg(CODE_B, { aaa: 1 }), deps)).ok, false, 'AAA not enabled for org 2')
    assert.equal((await submitRegistration(req, reg(CODE_A, { other: 1 }), deps)).ok, false, '«Andre» not configured')
    assert.equal(why(await submitRegistration(req, reg(CODE_A, { aa: 1 }, { submissionKey: 'not-a-uuid' }), deps)), 'invalid')
    assert.equal(why(await submitRegistration(req, reg('xyzxyzxyzx', { aa: 1 }), deps)), 'closed')
  })

  it('asks before storing a near-duplicate, then flags it', async () => {
    const { req, db } = await setup()
    const deps = { duplicates: memoryDuplicateTracker(), now: NOW }
    await submitRegistration(req, reg(CODE_A, { aa: 5 }), deps)
    assert.equal(why(await submitRegistration(req, reg(CODE_A, { aa: 5 }), deps)), 'possible-duplicate')
    assert.equal((await submitRegistration(req, reg(CODE_A, { aa: 5 }, { clientKey: '10.0.0.2' }), deps)).ok, true, 'other network')
    assert.ok((await submitRegistration(req, reg(CODE_A, { aa: 5 }, { confirmDuplicate: true }), deps)).ok)
    const last = db['battery-registrations']!.at(-1)!
    assert.deepEqual(last.flags, ['possible-duplicate'])
    assert.equal(last.reviewState, 'pending')
  })

  it('flags large registrations and busy days for review', async () => {
    const { req, db } = await setup({ dailyFlagThreshold: 100 })
    const deps = { duplicates: memoryDuplicateTracker(), now: NOW }
    assert.equal(why(await submitRegistration(req, reg(CODE_A, { aa: 60 }), deps)), 'needs-confirmation')
    assert.ok((await submitRegistration(req, reg(CODE_A, { aa: 60 }, { confirmed: true }), deps)).ok)
    assert.ok((await submitRegistration(req, reg(CODE_A, { aa: 45 }, { clientKey: 'x' }), deps)).ok)
    const [a, b] = db['battery-registrations']!
    assert.deepEqual(a!.flags, ['high-quantity'])
    assert.deepEqual(b!.flags, ['burst'], '60 + 45 > 100 today')
  })
})

describe('delivery submission and PIN', () => {
  it('stores a delivery only with the right PIN, keeping kg as kg', async () => {
    const { req, db } = await setup()
    const store = memoryPinStore()
    const r = await submitDelivery(req, delivery('482915'), { pinAttempts: store, now: NOW })
    assert.ok(r.ok)
    const d = db['battery-deliveries']![0]!
    assert.deepEqual([d.quantity, d.unit, d.documentationStatus, d.status], [12.5, 'kg', 'reported', 'registered'])
    assert.deepEqual(d.submittedValues, { deliveryDate: '2026-10-30', quantity: 12.5, unit: 'kg', operator: 'Retura Trøndelag', reference: 'K-991', documentationStatus: 'reported', document: false })
    const audit = db['battery-delivery-audit']![0]!
    assert.deepEqual([audit.action, audit.performedByLabel, audit.delivery], ['create', 'Ansvarlig (PIN)', d.id])
    assert.equal(store.counts.get(1), 0, 'reset after success')
  })

  it('stores pieces as pieces', async () => {
    const { req, db } = await setup()
    const r = await submitDelivery(req, delivery('482915', { fields: { deliveryDate: '2026-10-01', quantity: '340', unit: 'stk', operator: 'Batteriretur' } }), { pinAttempts: memoryPinStore(), now: NOW })
    assert.ok(r.ok)
    assert.deepEqual([db['battery-deliveries']![0]!.quantity, db['battery-deliveries']![0]!.unit], [340, 'stk'])
  })

  it('refuses unauthorised attempts with one generic message and stores nothing', async () => {
    const { req, db } = await setup()
    const store = memoryPinStore()
    for (const pin of ['', '000000', '4829150', '48291']) {
      const r = await submitDelivery(req, delivery(pin), { pinAttempts: store, now: NOW })
      assert.deepEqual([r.ok, !r.ok && r.reason, !r.ok && r.message], [false, 'unauthorized', PIN_REJECTED_MESSAGE])
    }
    // An organisation without a PIN can never accept a delivery — the QR code alone is no authorisation.
    const noPin = await submitDelivery(req, { ...delivery('482915'), code: CODE_B }, { pinAttempts: store, now: NOW })
    assert.equal(!noPin.ok && noPin.reason, 'unauthorized')
    assert.equal(db['battery-deliveries']?.length ?? 0, 0)
  })

  it('stops verifying after the attempt budget, even for the right PIN', async () => {
    const { req } = await setup()
    const store = memoryPinStore()
    for (let i = 0; i < PIN_POLICY.maxAttempts; i++) await submitDelivery(req, delivery('111112'), { pinAttempts: store, now: NOW })
    const locked = await submitDelivery(req, delivery('482915'), { pinAttempts: store, now: NOW })
    assert.equal(!locked.ok && locked.reason, 'unauthorized')
    await store.reset(1)
    assert.ok((await submitDelivery(req, delivery('482915'), { pinAttempts: store, now: NOW })).ok)
  })

  it('reports field errors before spending a PIN attempt', async () => {
    const { req } = await setup()
    const store = memoryPinStore()
    const r = await submitDelivery(req, delivery('000000', { fields: { deliveryDate: '2026-11-05', quantity: '1', unit: 'kg', operator: 'X AS' } }), { pinAttempts: store, now: NOW })
    assert.equal(!r.ok && r.reason, 'invalid')
    assert.equal(store.counts.get(1) ?? 0, 0)
  })

  it('refuses non-document attachments before the PIN check', async () => {
    const { req } = await setup()
    const store = memoryPinStore()
    const r = await submitDelivery(req, delivery('482915', { document: new TextEncoder().encode('<svg onload="x"/>') }), { pinAttempts: store, now: NOW })
    assert.equal(!r.ok && r.reason, 'invalid')
    assert.equal(store.counts.get(1) ?? 0, 0)
  })
})

describe('admin corrections and audit', () => {
  async function withRegistration() {
    const stub = await setup()
    await submitRegistration(stub.req, reg(CODE_A, { aa: 4, aaa: 2 }), { duplicates: memoryDuplicateTracker(), now: NOW })
    return { ...stub, id: stub.db['battery-registrations']![0]!.id }
  }

  it('corrects current lines, keeps the original and writes an audit row', async () => {
    const { req, db, id } = await withRegistration()
    assert.equal((await correctRegistration(req, id, { lines: { aa: 5, aaa: 2 }, reason: '' })).ok, false, 'reason required')
    assert.deepEqual(await correctRegistration(req, id, { lines: { aa: 5, aaa: 2 }, reason: 'Telt feil' }), { ok: true })
    const r = db['battery-registrations']![0]!
    assert.equal(r.status, 'corrected')
    assert.equal(r.totalQuantity, 7)
    assert.equal(r.submittedTotal, 6)
    const a = db['battery-registration-audit']![0]!
    assert.deepEqual([a.action, a.reason, a.performedBy, a.performedByLabel], ['correct', 'Telt feil', 7, 'admin@aboks.invalid'])
    assert.deepEqual((a.before as { total: number }).total, 6)
    assert.deepEqual((a.after as { total: number }).total, 7)
    assert.equal((await correctRegistration(req, id, { lines: { aa: 5, aaa: 2 }, reason: 'Igjen' })).ok, false, 'unchanged')
  })

  it('invalidates and restores; invalidated records leave the aggregates', async () => {
    const { req, db, id } = await withRegistration()
    assert.ok((await invalidateRegistration(req, id, { reason: 'Test-registrering' })).ok)
    assert.equal((await invalidateRegistration(req, id, { reason: 'Igjen' })).ok, false)
    assert.equal((await correctRegistration(req, id, { lines: { aa: 1 }, reason: 'Etter ugyldig' })).ok, false)
    const period = resolveMiljoPeriod({ preset: 'thisYear' }, NOW)
    assert.equal((await loadRecords(req, { organizationId: 1, period })).registrations.length, 0)
    assert.equal((await loadRecords(req, { organizationId: 1, period, includeInvalidated: true })).registrations.length, 1)
    assert.ok((await restoreRegistration(req, id, { reason: 'Var riktig likevel' })).ok)
    assert.equal(db['battery-registrations']![0]!.status, 'registered')
    assert.deepEqual(db['battery-registration-audit']!.map((a) => a.action), ['invalidate', 'restore'])
  })

  it('marks flagged registrations as reviewed', async () => {
    const { req, db } = await setup()
    await submitRegistration(req, reg(CODE_A, { aa: 60 }, { confirmed: true }), { duplicates: memoryDuplicateTracker(), now: NOW })
    const id = db['battery-registrations']![0]!.id
    assert.ok((await reviewRegistration(req, id, {})).ok)
    assert.equal(db['battery-registrations']![0]!.reviewState, 'reviewed')
    assert.equal(db['battery-registration-audit']![0]!.reason, 'Gjennomgått uten endring.')
    assert.equal((await reviewRegistration(req, id, {})).ok, false)
  })

  it('corrects deliveries without touching the submitted values', async () => {
    const { req, db } = await setup()
    await submitDelivery(req, delivery('482915'), { pinAttempts: memoryPinStore(), now: NOW })
    const id = db['battery-deliveries']![0]!.id
    db['battery-deliveries']![0]!.document = 5 // a receipt is attached, so «documented» is allowed
    const r = await correctDelivery(req, id, { deliveryDate: '2026-10-29', quantity: '13', unit: 'kg', operator: 'Retura Trøndelag', reference: 'K-991', documentationStatus: 'documented', reason: 'Kvittering mottatt' }, NOW)
    assert.deepEqual(r, { ok: true })
    const d = db['battery-deliveries']![0]!
    assert.deepEqual([d.quantity, d.documentationStatus, d.status], [13, 'documented', 'corrected'])
    assert.equal((d.submittedValues as { quantity: number }).quantity, 12.5)
    assert.equal((await correctDelivery(req, id, { deliveryDate: '2027-01-01', quantity: '1', unit: 'kg', operator: 'X', reason: 'Fremtid' }, NOW)).ok, false)
    assert.ok((await invalidateDelivery(req, id, { reason: 'Dobbeltregistrert' })).ok)
    assert.deepEqual(db['battery-delivery-audit']!.map((a) => a.action), ['create', 'correct', 'invalidate'])
  })
})

describe('public statistics isolation', () => {
  it('only contains the requested organisation and no private fields', async () => {
    const { req } = await setup()
    const deps = { duplicates: memoryDuplicateTracker(), now: NOW }
    await submitRegistration(req, reg(CODE_A, { aa: 3 }), deps)
    await submitRegistration(req, reg(CODE_B, { aa: 50 }, { clientKey: 'b' }), deps)
    await submitDelivery(req, delivery('482915'), { pinAttempts: memoryPinStore(), now: NOW })
    const period = resolveMiljoPeriod({ preset: 'thisYear' }, NOW)
    const resolved = await resolveOrganization(req, CODE_A)
    assert.equal(resolved.kind, 'active')
    const org = resolved.kind === 'active' ? resolved.org : (null as never)
    const { registrations, deliveries } = await loadRecords(req, { organizationId: org.id, period })
    const stats = buildPublicStatistics(org, period, registrations, deliveries)
    assert.equal(stats.registrations.total, 3, 'org B excluded')
    assert.equal(stats.deliveries.byUnit.kg.quantity, 12.5)
    const json = JSON.stringify(stats)
    for (const secret of ['K-991', 'HEMMELIG', 'kontakt@', 'scrypt', 'submissionKey', 'Frøya']) assert.ok(!json.includes(secret), secret)
  })
})

describe('documentation status integrity', () => {
  it('a delivery without an attachment is stored as «Oppgitt av ansvarlig»', async () => {
    const { req, db } = await setup()
    await submitDelivery(req, delivery('482915'), { pinAttempts: memoryPinStore(), now: NOW })
    assert.equal(db['battery-deliveries']![0]!.documentationStatus, 'reported')
    assert.equal(db['battery-deliveries']![0]!.document, null)
  })

  it('an admin cannot mark a delivery without an attachment as documented', async () => {
    const { req, db } = await setup()
    await submitDelivery(req, delivery('482915'), { pinAttempts: memoryPinStore(), now: NOW })
    const d = db['battery-deliveries']![0]!
    const r = await correctDelivery(req, d.id, { deliveryDate: '2026-10-30', quantity: '12,5', unit: 'kg', operator: 'Retura Trøndelag', reference: 'K-991', documentationStatus: 'documented', reason: 'Kvittering mottatt på e-post' }, NOW)
    assert.equal(r.ok, false)
    assert.match(!r.ok ? r.message : '', /krever at leveransen har et vedlegg/)
    assert.equal(d.documentationStatus, 'reported')
    assert.equal(db['battery-delivery-audit']!.filter((a) => a.action === 'correct').length, 0, 'nothing written')
  })

  it('with an attachment the documented status is allowed, and can be downgraded', async () => {
    const { req, db } = await setup()
    await submitDelivery(req, delivery('482915'), { pinAttempts: memoryPinStore(), now: NOW })
    const d = db['battery-deliveries']![0]!
    d.document = 99
    const base = { deliveryDate: '2026-10-30', quantity: '12,5', unit: 'kg', operator: 'Retura Trøndelag', reference: 'K-991' }
    assert.deepEqual(await correctDelivery(req, d.id, { ...base, documentationStatus: 'documented', reason: 'Vedlegg kontrollert' }, NOW), { ok: true })
    assert.deepEqual(await correctDelivery(req, d.id, { ...base, documentationStatus: 'reported', reason: 'Vedlegget var feil fil' }, NOW), { ok: true })
  })
})
