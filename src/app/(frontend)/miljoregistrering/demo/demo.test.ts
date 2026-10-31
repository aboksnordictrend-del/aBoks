import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import {
  DEMO_LABEL,
  DEMO_PIN,
  checkDemoDelivery,
  checkDemoRegistration,
  demoReducer,
  demoStatistics,
  seedState,
  type DemoDeliveryInput,
  type DemoState,
} from './demoModel'
import { demoCsv, demoPdf } from './demoExports'

const NOW = new Date('2026-10-31T12:00:00Z')

const delivery = (over: Partial<DemoDeliveryInput> = {}): DemoDeliveryInput => ({
  deliveryDate: '2026-10-30',
  quantity: '2,5',
  unit: 'kg',
  operator: 'Demo Miljømottak',
  reference: '',
  pin: DEMO_PIN,
  hasAttachment: false,
  ...over,
})

function deliver(state: DemoState, input: DemoDeliveryInput): DemoState {
  const r = checkDemoDelivery(input, NOW)
  assert.ok(r.ok, 'expected a valid delivery')
  return demoReducer(state, { type: 'deliver', delivery: r.delivery })
}

describe('miljoregistrering demo — sample data', () => {
  it('starts with the fictional figures: AA 86, AAA 54, 140 registered, 3 deliveries', () => {
    const s = demoStatistics(seedState(NOW), NOW)
    assert.deepEqual(s.registrations.byCategory, { aa: 86, aaa: 54, other: 0 })
    assert.equal(s.registrations.total, 140)
    assert.equal(s.deliveries.deliveries, 3)
    assert.deepEqual(s.deliveries.byUnit, { kg: { deliveries: 2, quantity: 3.2 }, stk: { deliveries: 1, quantity: 45 } })
    assert.equal(s.trend.length, 12, 'twelve monthly buckets')
    assert.equal(s.trend.reduce((n, p) => n + p.total, 0), 140, 'every sample registration falls inside the period')
  })
})

describe('miljoregistrering demo — registration', () => {
  it('validates with the production rules', () => {
    const empty = checkDemoRegistration({}, false)
    assert.equal(empty.ok, false)
    const perCategory = checkDemoRegistration({ aa: '201' }, false)
    assert.ok(!perCategory.ok && perCategory.errors.aa)
    const needsConfirm = checkDemoRegistration({ aa: '40', aaa: '20' }, false)
    assert.ok(!needsConfirm.ok && /Bekreft/.test(needsConfirm.message))
    assert.equal(checkDemoRegistration({ aa: '40', aaa: '20' }, true).ok, true)
    const notOffered = checkDemoRegistration({ other: '3' }, false)
    assert.ok(!notOffered.ok && notOffered.errors.other, '«Andre» is not offered in the demo')
  })

  it('updates registrations only — deliveries are untouched', () => {
    const before = seedState(NOW)
    const r = checkDemoRegistration({ aa: '3', aaa: '2' }, false)
    assert.ok(r.ok)
    const after = demoReducer(before, { type: 'register', lines: r.lines, at: NOW.toISOString() })
    const s = demoStatistics(after, NOW)
    assert.equal(s.registrations.total, 145)
    assert.deepEqual(s.registrations.byCategory, { aa: 89, aaa: 56, other: 0 })
    assert.equal(s.registrations.registrations, 15)
    assert.deepEqual(after.deliveries, before.deliveries)
  })
})

describe('miljoregistrering demo — delivery', () => {
  it('checks the fields before the PIN, then rejects a wrong PIN', () => {
    const bad = checkDemoDelivery(delivery({ quantity: 'mye', pin: '000000' }), NOW)
    assert.ok(!bad.ok && bad.reason === 'invalid' && bad.errors.quantity)
    const wrongPin = checkDemoDelivery(delivery({ pin: '654321' }), NOW)
    assert.ok(!wrongPin.ok && wrongPin.reason === 'pin')
    const future = checkDemoDelivery(delivery({ deliveryDate: '2026-11-02' }), NOW)
    assert.ok(!future.ok && future.errors.deliveryDate)
    const kgAsPieces = checkDemoDelivery(delivery({ unit: 'stk', quantity: '2,5' }), NOW)
    assert.ok(!kgAsPieces.ok && kgAsPieces.errors.quantity, 'stk. must be a whole number')
  })

  it('keeps kg and stk. apart and never touches registrations', () => {
    const before = seedState(NOW)
    let state = deliver(before, delivery({ quantity: '2,5', unit: 'kg' }))
    state = deliver(state, delivery({ quantity: '30', unit: 'stk', hasAttachment: true }))
    const s = demoStatistics(state, NOW)
    assert.deepEqual(s.deliveries.byUnit, { kg: { deliveries: 3, quantity: 5.7 }, stk: { deliveries: 2, quantity: 75 } })
    assert.equal(s.deliveries.deliveries, 5)
    assert.equal(s.deliveries.documented, 3)
    assert.equal(s.registrations.total, 140, 'registered batteries are a separate figure')
    assert.deepEqual(state.registrations, before.registrations)
  })

  it('marks a delivery with an attachment as documented, without one as reported', () => {
    const withFile = checkDemoDelivery(delivery({ hasAttachment: true }), NOW)
    const without = checkDemoDelivery(delivery(), NOW)
    assert.ok(withFile.ok && withFile.delivery.documentationStatus === 'documented')
    assert.ok(without.ok && without.delivery.documentationStatus === 'reported')
  })
})

describe('miljoregistrering demo — reset', () => {
  it('restores the sample values', () => {
    let state = seedState(NOW)
    const r = checkDemoRegistration({ aa: '9' }, false)
    assert.ok(r.ok)
    state = demoReducer(state, { type: 'register', lines: r.lines, at: NOW.toISOString() })
    state = deliver(state, delivery())
    state = demoReducer(state, { type: 'reset', now: NOW })
    assert.deepEqual(state, seedState(NOW))
  })
})

describe('miljoregistrering demo — exports', () => {
  it('CSV: BOM, then a DEMO banner line before the real content', () => {
    for (const type of ['sammendrag', 'registreringer', 'leveranser'] as const) {
      const { body, filename } = demoCsv(seedState(NOW), type, NOW)
      assert.equal(body.charCodeAt(0), 0xfeff)
      assert.ok(body.slice(1).startsWith(`"${DEMO_LABEL}"`), type)
      assert.ok(body.includes('Demo Bedrift AS (DEMO – EKSEMPELDATA)'), type)
      assert.equal(body.indexOf(String.fromCharCode(0xfeff), 1), -1, 'only one BOM')
      assert.ok(filename.startsWith('DEMO-'), type)
    }
    const deliveries = demoCsv(seedState(NOW), 'leveranser', NOW).body
    assert.ok(/;1,8;"kg";/.test(deliveries) && /;45;"stk\.";/.test(deliveries), 'units stay as registered')
  })

  it('PDF: a valid document titled and named as a demo', async () => {
    const { body, filename } = await demoPdf(seedState(NOW), null, NOW)
    const doc = await PDFDocument.load(body)
    assert.ok(doc.getTitle()?.startsWith(DEMO_LABEL))
    assert.ok(doc.getPageCount() >= 1)
    assert.ok(filename.startsWith('DEMO-'))
  })
})

describe('miljoregistrering demo — isolation', () => {
  // Static guard: nothing in the demo may reach the real system. The only fetch is the
  // site's static logo for the PDF header.
  const dir = fileURLToPath(new URL('.', import.meta.url))
  const sources = readdirSync(dir)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'))
    .map((f) => ({ f, src: readFileSync(join(dir, f), 'utf8') }))

  it('imports no server action, server module or Payload', () => {
    for (const { f, src } of sources) {
      assert.doesNotMatch(src, /from '[^']*\/actions'/, f)
      assert.doesNotMatch(src, /@\/lib\/miljo\/(service|server|records|tx|pin|pinAttempts|pinVault|exports)'/, f)
      assert.doesNotMatch(src, /from '(payload|@payloadcms\/[^']+)'/, f)
      assert.doesNotMatch(src, /'use server'/, f)
    }
  })

  it('calls no API route and stores nothing in the browser', () => {
    for (const { f, src } of sources) {
      assert.doesNotMatch(src, /\/api\//, f)
      assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|dataLayer/, f)
      for (const m of src.matchAll(/fetch\(([^)]*)\)/g)) assert.equal(m[1], "'/logo.png'", `${f}: ${m[0]}`)
    }
  })
})
