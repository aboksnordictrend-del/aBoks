import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PUBLIC_CODE_ALPHABET, PUBLIC_CODE_LENGTH, generatePublicCode, isValidPublicCode } from './code'
import { generatePin, hashPin, validatePinFormat, verifyPin } from './pin'
import { attemptAllowed, pinLockedUntil } from './pinAttempts'
import { allowedCategoriesFor, policyFor } from './policy'
import {
  cleanText,
  parseDeliveryQuantity,
  validateCorrectedLines,
  validateDelivery,
  validateReason,
  validateRegistration,
} from './validation'
import { periodBuckets, resolveMiljoPeriod, PeriodError } from './period'
import {
  countable,
  deliveryTrend,
  perOrganization,
  publicDeliveryRows,
  registrationTrend,
  summarizeDeliveries,
  summarizeRegistrations,
  visibleCategories,
  type DeliveryRecord,
  type RegistrationRecord,
} from './stats'
import { deliveriesCsv, registrationsCsv, summaryCsv, fileSlug } from './csv'
import { memoryDuplicateTracker, registrationFingerprint } from './duplicates'
import { detectDocumentKind, precheckDocument } from './documents'
import { PIN_POLICY } from './constants'

const NOW = new Date('2026-10-31T12:00:00Z')

describe('public organisation codes', () => {
  it('generates valid, distinct codes from the unambiguous alphabet', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generatePublicCode()))
    assert.equal(codes.size, 500)
    for (const c of codes) {
      assert.equal(c.length, PUBLIC_CODE_LENGTH)
      assert.ok(isValidPublicCode(c), c)
      assert.doesNotMatch(c, /[01ilo]/)
    }
  })

  it('discards biased bytes (rejection sampling) and is deterministic for a given source', () => {
    let calls = 0
    const source = (n: number) => {
      calls++
      // First batch is all ≥ 248 (rejected for a 31-letter alphabet), then zeros.
      return new Uint8Array(n).fill(calls === 1 ? 250 : 0)
    }
    assert.equal(generatePublicCode(source), PUBLIC_CODE_ALPHABET[0]!.repeat(PUBLIC_CODE_LENGTH))
    assert.equal(calls, 2)
  })

  it('rejects anything that is not a code', () => {
    for (const bad of ['', 'ABCDEFGHJK', 'abcdefghj', 'abcdefghjkm', 'abcdefghj0', '../../etc', null, 42]) {
      assert.equal(isValidPublicCode(bad), false, String(bad))
    }
  })
})

describe('PIN hashing and policy', () => {
  it('hashes with a salt and verifies only the right PIN', async () => {
    const a = await hashPin('482915')
    const b = await hashPin('482915')
    assert.notEqual(a, b, 'salted')
    assert.match(a, /^scrypt\$16384\$8\$1\$/)
    assert.doesNotMatch(a, /482915/)
    assert.equal(await verifyPin('482915', a), true)
    assert.equal(await verifyPin('482916', a), false)
    assert.equal(await verifyPin('', a), false)
  })

  it('never throws on malformed stored values', async () => {
    for (const enc of [null, undefined, '', 'plain', 'scrypt$x$8$1$aa$bb', 'scrypt$99999999$8$1$aaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbb']) {
      assert.equal(await verifyPin('123456', enc), false)
    }
  })

  it('validates PIN format', () => {
    assert.equal(validatePinFormat('482915'), null)
    assert.ok(validatePinFormat('12345'))
    assert.ok(validatePinFormat('12345678901'))
    assert.ok(validatePinFormat('12a456'))
    assert.ok(validatePinFormat('111111'))
    assert.ok(validatePinFormat('123456'))
    assert.ok(validatePinFormat('654321'))
    assert.ok(validatePinFormat(482915))
  })

  it('generates PINs that pass the policy', () => {
    for (let i = 0; i < 200; i++) {
      const pin = generatePin()
      assert.equal(pin.length, PIN_POLICY.generatedLength)
      assert.equal(validatePinFormat(pin), null)
    }
  })

  it('allows a fixed number of attempts per window and reports the lock', () => {
    assert.equal(attemptAllowed(1), true)
    assert.equal(attemptAllowed(PIN_POLICY.maxAttempts), true)
    assert.equal(attemptAllowed(PIN_POLICY.maxAttempts + 1), false)
    assert.equal(attemptAllowed(Number.NaN), false)
    const start = '2026-10-31T11:55:00.000Z'
    assert.equal(pinLockedUntil(2, start, NOW), null)
    assert.equal(pinLockedUntil(PIN_POLICY.maxAttempts, start, NOW)?.toISOString(), '2026-10-31T12:10:00.000Z')
    assert.equal(pinLockedUntil(PIN_POLICY.maxAttempts, '2026-10-31T11:00:00.000Z', NOW), null, 'window expired')
  })
})

describe('registration policy', () => {
  it('defaults to AA and AAA; «Andre» needs selection AND a description', () => {
    assert.deepEqual(allowedCategoriesFor({ allowedCategories: ['aa', 'aaa'] }).map((c) => c.value), ['aa', 'aaa'])
    assert.deepEqual(allowedCategoriesFor({ allowedCategories: ['aa', 'other'] }).map((c) => c.value), ['aa'])
    assert.deepEqual(
      allowedCategoriesFor({ allowedCategories: ['other', 'aa'], otherCategoryDescription: 'Knappceller (ikke litium)', otherCategoryLabel: 'Knappceller' }),
      [
        { value: 'aa', label: 'AA' },
        { value: 'other', label: 'Knappceller', description: 'Knappceller (ikke litium)' },
      ],
    )
  })

  it('never offers 9V, lithium or unknown values', () => {
    assert.deepEqual(allowedCategoriesFor({ allowedCategories: ['9v', 'lithium', 'aa', 'AA'] }).map((c) => c.value), ['aa'])
  })

  it('caps organisation limits at the hard ceilings', () => {
    const p = policyFor({ allowedCategories: ['aa'], maxPerCategory: 5000, maxPerSubmission: 9999, confirmAbove: 9999 })
    assert.equal(p.maxPerCategory, 200)
    assert.equal(p.maxPerSubmission, 500)
    assert.equal(p.confirmAbove, 500)
    const q = policyFor({ allowedCategories: ['aa'], maxPerCategory: 20, maxPerSubmission: 30, confirmAbove: 10 })
    assert.deepEqual([q.maxPerCategory, q.maxPerSubmission, q.confirmAbove], [20, 30, 10])
    const d = policyFor({})
    assert.deepEqual([d.maxPerCategory, d.maxPerSubmission, d.confirmAbove, d.dailyFlagThreshold], [200, 500, 50, 1000])
  })
})

describe('registration validation', () => {
  const policy = policyFor({ allowedCategories: ['aa', 'aaa'] })

  it('accepts valid counts and computes the total', () => {
    const r = validateRegistration({ aa: '3', aaa: 2 }, false, policy)
    assert.deepEqual(r, { ok: true, lines: [{ category: 'aa', quantity: 3 }, { category: 'aaa', quantity: 2 }], total: 5, flags: [] })
  })

  it('refuses zero, non-integers and negative numbers', () => {
    assert.equal(validateRegistration({}, false, policy).ok, false)
    for (const bad of ['1.5', '-2', 'abc', '1e3', ' 2 3']) {
      const r = validateRegistration({ aa: bad }, false, policy)
      assert.equal(r.ok, false, bad)
    }
  })

  it('refuses a disabled category instead of dropping it', () => {
    const r = validateRegistration({ aa: 1, other: 2 }, false, policy)
    assert.equal(r.ok, false)
    assert.ok(!r.ok && r.errors.other)
  })

  it('enforces 200 per category and 500 per submission', () => {
    assert.equal(validateRegistration({ aa: 201 }, true, policy).ok, false)
    assert.equal(validateRegistration({ aa: 200 }, true, policy).ok, true)
    const all = policyFor({ allowedCategories: ['aa', 'aaa', 'other'], otherCategoryDescription: 'x' })
    const over = validateRegistration({ aa: 200, aaa: 200, other: 101 }, true, all)
    assert.equal(over.ok, false)
    assert.equal(validateRegistration({ aa: 200, aaa: 200, other: 100 }, true, all).ok, true)
  })

  it('asks for confirmation above 50 and flags the stored registration', () => {
    const r = validateRegistration({ aa: 51 }, false, policy)
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.reason, 'needs-confirmation')
    const c = validateRegistration({ aa: 51 }, true, policy)
    assert.equal(c.ok && c.flags[0], 'high-quantity')
    const fifty = validateRegistration({ aa: 50 }, false, policy)
    assert.equal(fifty.ok && fifty.flags.length, 0)
  })

  it('validates admin corrections', () => {
    assert.deepEqual(validateCorrectedLines({ aaa: 2, aa: '1' }, 200), {
      ok: true,
      lines: [{ category: 'aa', quantity: 1 }, { category: 'aaa', quantity: 2 }],
      total: 3,
    })
    assert.equal(validateCorrectedLines({ aa: 0 }, 200).ok, false, 'invalidate instead of zero')
    assert.equal(validateCorrectedLines({ '9v': 1 }, 200).ok, false)
    assert.equal(validateCorrectedLines({ aa: 201 }, 200).ok, false)
    assert.equal(validateCorrectedLines(null, 200).ok, false)
  })

  it('requires a reason', () => {
    assert.equal(validateReason('').ok, false)
    assert.equal(validateReason('  ab ').ok, false)
    assert.equal(validateReason('x'.repeat(501)).ok, false)
    assert.deepEqual(validateReason('  Feil   antall\n'), { ok: true, reason: 'Feil antall' })
  })
})

describe('delivery validation — weight versus count', () => {
  const today = '2026-10-31'
  const base = { deliveryDate: '2026-10-30', unit: 'kg', operator: '  Retura  Trøndelag ', reference: 'K-123' }

  it('keeps kg as a decimal and pieces as an integer, never converting', () => {
    const kg = validateDelivery({ ...base, quantity: '12,5' }, today)
    assert.ok(kg.ok)
    assert.deepEqual(kg.ok && kg.value, { deliveryDate: '2026-10-30', quantity: 12.5, unit: 'kg', operator: 'Retura Trøndelag', reference: 'K-123' })
    const stk = validateDelivery({ ...base, unit: 'stk', quantity: '340' }, today)
    assert.ok(stk.ok && stk.value.quantity === 340 && stk.value.unit === 'stk')
    assert.equal(validateDelivery({ ...base, unit: 'stk', quantity: '12,5' }, today).ok, false)
    assert.equal(parseDeliveryQuantity('1 250,75', 'kg'), 1250.75)
    assert.ok(Number.isNaN(parseDeliveryQuantity('12,555', 'kg')))
  })

  it('refuses missing unit, zero, future and very old dates, empty operator', () => {
    assert.equal(validateDelivery({ ...base, unit: 'liter', quantity: '1' }, today).ok, false)
    assert.equal(validateDelivery({ ...base, quantity: '0' }, today).ok, false)
    assert.equal(validateDelivery({ ...base, quantity: '1', deliveryDate: '2026-11-01' }, today).ok, false)
    assert.equal(validateDelivery({ ...base, quantity: '1', deliveryDate: '2020-01-01' }, today).ok, false)
    assert.equal(validateDelivery({ ...base, quantity: '1', deliveryDate: '2026-02-30' }, today).ok, false)
    assert.equal(validateDelivery({ ...base, quantity: '1', operator: ' ' }, today).ok, false)
    assert.equal(validateDelivery({ ...base, quantity: '1', deliveryDate: today }, today).ok, true)
  })

  it('strips control and bidi characters from free text', () => {
    const rlo = String.fromCharCode(0x202e)
    assert.equal(cleanText(`Ret${rlo}ura\u0000\n AS`, 100), 'Ret ura AS')
  })
})

describe('periods (Oslo)', () => {
  it('resolves presets to Oslo-day boundaries', () => {
    const y = resolveMiljoPeriod({ preset: 'thisYear' }, NOW)
    assert.equal(y.fromKey, '2026-01-01')
    assert.equal(y.toKey, '2026-10-31')
    assert.equal(y.from, '2025-12-31T23:00:00.000Z')
    assert.equal(y.to, '2026-10-31T23:00:00.000Z', 'CET after the October DST change')
    assert.equal(y.grouping, 'month')

    const ly = resolveMiljoPeriod({ preset: 'lastYear' }, NOW)
    assert.deepEqual([ly.fromKey, ly.toKey], ['2025-01-01', '2025-12-31'])
    const m = resolveMiljoPeriod({ preset: 'thisMonth' }, NOW)
    assert.deepEqual([m.fromKey, m.toKey, m.grouping], ['2026-10-01', '2026-10-31', 'day'])
    const lm = resolveMiljoPeriod({ preset: 'lastMonth' }, new Date('2026-03-15T12:00:00Z'))
    assert.deepEqual([lm.fromKey, lm.toKey], ['2026-02-01', '2026-02-28'])
  })

  it('handles a summer-time custom range and the Oslo midnight edge', () => {
    const p = resolveMiljoPeriod({ preset: 'custom', from: '2026-07-01', to: '2026-07-01' }, NOW)
    assert.equal(p.from, '2026-06-30T22:00:00.000Z')
    assert.equal(p.to, '2026-07-01T22:00:00.000Z')
  })

  it('validates custom input and the span limit', () => {
    assert.throws(() => resolveMiljoPeriod({ preset: 'custom', from: '2026-02-30', to: '2026-03-01' }, NOW), PeriodError)
    assert.throws(() => resolveMiljoPeriod({ preset: 'custom', from: '2026-05-01', to: '2026-04-01' }, NOW), PeriodError)
    assert.throws(() => resolveMiljoPeriod({ preset: 'custom', from: '2010-01-01', to: '2026-01-01' }, NOW), PeriodError)
    assert.equal(resolveMiljoPeriod({ preset: 'nonsense' }, NOW).preset, 'thisYear')
  })

  it('builds gap-filled day, month and year buckets', () => {
    const p = resolveMiljoPeriod({ preset: 'custom', from: '2024-11-15', to: '2026-02-03', grouping: 'year' }, NOW)
    assert.deepEqual(periodBuckets(p).map((b) => b.key), ['2024', '2025', '2026'])
    const m = resolveMiljoPeriod({ preset: 'custom', from: '2026-01-20', to: '2026-03-02', grouping: 'month' }, NOW)
    assert.deepEqual(periodBuckets(m).map((b) => b.key), ['2026-01', '2026-02', '2026-03'])
    const longDays = resolveMiljoPeriod({ preset: 'custom', from: '2024-01-01', to: '2026-01-01', grouping: 'day' }, NOW)
    assert.equal(longDays.grouping, 'month', 'day buckets are capped')
  })
})

const reg = (id: number, at: string, lines: RegistrationRecord['lines'], extra: Partial<RegistrationRecord> = {}): RegistrationRecord => ({
  id,
  organizationId: 1,
  organizationName: 'Hitra kommune',
  registeredAt: at,
  status: 'registered',
  lines,
  submittedTotal: lines.reduce((s, l) => s + l.quantity, 0),
  flags: [],
  reviewState: 'none',
  ...extra,
})

const del = (id: number, date: string, quantity: number, unit: 'kg' | 'stk', extra: Partial<DeliveryRecord> = {}): DeliveryRecord => ({
  id,
  organizationId: 1,
  organizationName: 'Hitra kommune',
  deliveryDate: date,
  quantity,
  unit,
  operator: 'Retura',
  documentationStatus: 'reported',
  status: 'registered',
  registeredAt: `${date}T10:00:00.000Z`,
  ...extra,
})

describe('statistics', () => {
  const regs = [
    reg(1, '2026-10-01T08:00:00Z', [{ category: 'aa', quantity: 10 }, { category: 'aaa', quantity: 4 }]),
    reg(2, '2026-10-02T08:00:00Z', [{ category: 'aa', quantity: 6 }], { status: 'corrected', submittedTotal: 60 }),
    reg(3, '2026-10-02T09:00:00Z', [{ category: 'aaa', quantity: 99 }], { status: 'invalidated' }),
    // 23:30 UTC on 31 Oct = 00:30 on 1 Nov in Oslo → outside October's day bucket.
    reg(4, '2026-09-30T22:30:00Z', [{ category: 'aa', quantity: 1 }]),
  ]

  it('excludes invalidated records and uses corrected values', () => {
    const s = summarizeRegistrations(countable(regs))
    assert.equal(s.registrations, 3)
    assert.equal(s.total, 21)
    assert.deepEqual(s.byCategory, { aa: 17, aaa: 4, other: 0 })
    assert.equal(summarizeRegistrations(countable(regs, true)).total, 120)
  })

  it('buckets by Oslo day', () => {
    const p = resolveMiljoPeriod({ preset: 'thisMonth' }, NOW)
    const t = registrationTrend(countable(regs), p)
    assert.equal(t.length, 31)
    assert.deepEqual([t[0]!.key, t[0]!.total, t[0]!.registrations], ['2026-10-01', 15, 2], '22:30Z on 30 Sep is 1 Oct in Oslo')
    assert.equal(t[1]!.total, 6)
  })

  it('sums deliveries per unit, never across units', () => {
    const d = [del(1, '2026-10-05', 12.1, 'kg'), del(2, '2026-10-06', 0.2, 'kg', { documentationStatus: 'documented' }), del(3, '2026-10-07', 300, 'stk'), del(4, '2026-10-08', 999, 'kg', { status: 'invalidated' })]
    const s = summarizeDeliveries(countable(d))
    assert.deepEqual(s.byUnit, { kg: { deliveries: 2, quantity: 12.3 }, stk: { deliveries: 1, quantity: 300 } })
    assert.deepEqual([s.documented, s.reported, s.deliveries], [1, 2, 3])
    assert.deepEqual(s.operators, [{ name: 'Retura', deliveries: 3, kg: 12.3, stk: 300 }])
    const p = resolveMiljoPeriod({ preset: 'thisYear' }, NOW)
    const trend = deliveryTrend(countable(d), p)
    assert.deepEqual(trend.find((x) => x.key === '2026-10'), { key: '2026-10', label: 'okt 2026', kg: 12.3, stk: 300, deliveries: 3 })
  })

  it('exposes only public delivery fields', () => {
    const rows = publicDeliveryRows([del(1, '2026-10-05', 5, 'kg', { documentationStatus: 'documented' })])
    assert.deepEqual(Object.keys(rows[0]!).sort(), ['deliveryDate', 'documentation', 'documentationStatus', 'operator', 'quantity', 'unit'])
    assert.equal(rows[0]!.documentation, 'Dokumentert med kvittering')
  })

  it('shows offered categories plus any with historic data', () => {
    assert.deepEqual(visibleCategories(['aa', 'aaa'], { aa: 0, aaa: 0, other: 3 }), ['aa', 'aaa', 'other'])
    assert.deepEqual(visibleCategories(['aa'], { aa: 0, aaa: 0, other: 0 }), ['aa'])
  })

  it('aggregates per organisation', () => {
    const rows = perOrganization(
      [{ id: 1, name: 'Hitra kommune', status: 'active' }, { id: 2, name: 'Frøya', status: 'inactive' }],
      countable(regs),
      [del(1, '2026-10-05', 2.5, 'kg'), del(2, '2026-10-06', 5, 'stk', { organizationId: 2 })],
    )
    assert.equal(rows[0]!.name, 'Hitra kommune')
    assert.equal(rows[0]!.total, 21)
    assert.equal(rows[0]!.kg, 2.5)
    assert.equal(rows[1]!.stk, 5)
    assert.equal(rows[1]!.total, 0)
  })
})

describe('CSV', () => {
  const period = resolveMiljoPeriod({ preset: 'thisMonth' }, NOW)
  const ctx = { audience: 'public' as const, title: 'Hitra kommune', period, categories: ['aa', 'aaa'] as ('aa' | 'aaa')[] }

  it('is Excel-friendly: BOM, semicolons, CRLF, decimal comma', () => {
    const csv = deliveriesCsv([del(1, '2026-10-05', 12.5, 'kg')], ctx)
    assert.ok(csv.charCodeAt(0) === 0xfeff)
    assert.ok(csv.includes('\r\n'))
    assert.ok(csv.includes('"2026-10-05";12,5;"kg";"Retura";"Oppgitt av ansvarlig"'))
  })

  it('guards against formula injection in operator names', () => {
    const csv = deliveriesCsv([del(1, '2026-10-05', 1, 'stk', { operator: '=HYPERLINK("http://x")' })], ctx)
    assert.ok(csv.includes(`"'=HYPERLINK(""http://x"")"`))
    assert.ok(!csv.includes(';"=HYPERLINK'))
  })

  it('keeps restricted columns out of the public export', () => {
    const r = [reg(1, '2026-10-01T08:00:00Z', [{ category: 'aa', quantity: 3 }], { flags: ['high-quantity'], status: 'corrected' })]
    const pub = registrationsCsv(r, ctx)
    assert.ok(!pub.includes('Merknader') && !pub.includes('Høyt antall') && !pub.includes('Status'))
    const adm = registrationsCsv(r, { ...ctx, audience: 'admin' })
    assert.ok(adm.includes('Høyt antall') && adm.includes('Korrigert'))
    const pubDel = deliveriesCsv([del(1, '2026-10-05', 1, 'stk')], ctx, new Map([[1, 'SECRET-REF']]))
    assert.ok(!pubDel.includes('SECRET-REF'))
  })

  it('writes per-period summaries with separate unit columns', () => {
    const csv = summaryCsv(
      registrationTrend([reg(1, '2026-10-01T08:00:00Z', [{ category: 'aa', quantity: 3 }])], period),
      deliveryTrend([del(1, '2026-10-01', 2.25, 'kg')], period),
      ctx,
    )
    assert.ok(csv.includes('"Levert (kg)";"Levert (stk.)"'))
    assert.ok(csv.includes('"2026-10-01";1;3;0;3;1;2,25;0'))
  })

  it('makes ASCII file names', () => {
    assert.equal(fileSlug('Bø kommune / Ærlige Å'), 'bo-kommune-aerlige-a')
    assert.equal(fileSlug('***'), 'organisasjon')
  })
})

describe('duplicate detection', () => {
  it('recognises the same counts from the same client within the window', () => {
    const t = memoryDuplicateTracker(1000)
    const fp = registrationFingerprint('abcdefghjk', '10.0.0.1', [{ category: 'aa', quantity: 3 }])
    assert.equal(t.seenRecently(fp, 0), false)
    t.record(fp, 0)
    assert.equal(t.seenRecently(fp, 999), true)
    assert.equal(t.seenRecently(fp, 1000), false)
    assert.notEqual(fp, registrationFingerprint('abcdefghjk', '10.0.0.2', [{ category: 'aa', quantity: 3 }]))
    assert.notEqual(fp, registrationFingerprint('abcdefghjk', '10.0.0.1', [{ category: 'aa', quantity: 4 }]))
    assert.doesNotMatch(fp, /10\.0\.0\.1/)
  })
})

describe('delivery documents', () => {
  it('detects PDFs and images by signature, refusing everything else', () => {
    assert.equal(detectDocumentKind(new TextEncoder().encode('%PDF-1.7\n...')), 'pdf')
    assert.equal(precheckDocument(new TextEncoder().encode('%PDF-1.7\n... truncated')).ok, false)
    assert.equal(precheckDocument(new TextEncoder().encode('%PDF-1.7\n1 0 obj\nstartxref\n9\n%%EOF\n')).ok, true)
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0])
    assert.equal(detectDocumentKind(png), 'image')
    assert.equal(detectDocumentKind(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), null)
    assert.equal(detectDocumentKind(new TextEncoder().encode('<html><script>')), null)
    assert.equal(precheckDocument(new Uint8Array(3_600_000)).ok, false)
  })
})
