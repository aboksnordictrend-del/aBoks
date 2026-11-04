import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { CollectionConfig } from 'payload'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { MILJO_LOGIN, OrdersStandIn, OrganizationsStandIn } from '@/lib/testing/miljoStandIns'
import { MILJO_TRUSTED_ACCOUNT_CREATE } from '@/lib/miljo/business'
import { resolveMiljoPeriod } from '@/lib/miljo/period'
import { buildPublicStatistics, loadRecords, resolveOrganization } from '@/lib/miljo/service'
import {
  accountDeliveries,
  accountExport,
  accountOrganization,
  accountOverview,
  accountStatistics,
  allTimePeriod,
} from '@/lib/miljo/account/organization'
import { currentSession, type MiljoSession } from '@/lib/miljo/account/session'
import { BusinessCustomers } from './BusinessCustomers'
import { MiljoAccounts } from './MiljoAccounts'
import { Users } from './Users'

/**
 * Stage 2.3 — Min side's battery data (@/lib/miljo/account/organization): overview, statistics,
 * deliveries and exports, through Payload's real auth pipeline with an in-memory database.
 *
 * Two organisations with overlapping data. Every function takes ONLY the session — the
 * organisation is derived server-side — so these tests prove that account A never sees B's
 * records, and that the figures equal the public page's for the same organisation.
 *
 * Battery records are inserted straight into the store: their own collections' hooks (limits,
 * duplicate checks, PIN verification) are tested elsewhere and never run here.
 */

const PASSWORD = 'Stage23-test-only-1'
const NOW = new Date('2026-11-04T12:00:00Z')

const RegistrationsStandIn: CollectionConfig = {
  slug: 'battery-registrations',
  fields: [
    { name: 'organization', type: 'relationship', relationTo: 'environmental-organizations' },
    { name: 'organizationName', type: 'text' },
    { name: 'registeredAt', type: 'date' },
    { name: 'status', type: 'text' },
    { name: 'lines', type: 'json' },
    { name: 'submittedTotal', type: 'number' },
    { name: 'flags', type: 'json' },
    { name: 'reviewState', type: 'text' },
  ],
}

const DeliveriesStandIn: CollectionConfig = {
  slug: 'battery-deliveries',
  fields: [
    { name: 'organization', type: 'relationship', relationTo: 'environmental-organizations' },
    { name: 'organizationName', type: 'text' },
    { name: 'deliveryDate', type: 'text' },
    { name: 'quantity', type: 'number' },
    { name: 'unit', type: 'text' },
    { name: 'operator', type: 'text' },
    { name: 'reference', type: 'text' },
    { name: 'documentationStatus', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'registeredAt', type: 'date' },
  ],
}

let h: RestHarness
const rows = (slug: string): Row[] => (h.store[slug] ??= [])
const org = { a: 1, b: 2, closed: 3 }
let sessionA: MiljoSession
let sessionB: MiljoSession
let sessionNoOrg: MiljoSession

async function signedIn(email: string): Promise<MiljoSession> {
  const token = await h.login('miljo-accounts', email, PASSWORD, MILJO_LOGIN)
  const s = await currentSession(h.payload, token)
  assert.ok(s, `session for ${email}`)
  return s
}

before(async () => {
  h = await createRestHarness('miljo-konto-data-test', [
    Users,
    OrdersStandIn,
    OrganizationsStandIn,
    BusinessCustomers,
    MiljoAccounts,
    RegistrationsStandIn,
    DeliveriesStandIn,
  ])
  rows('environmental-organizations').push(
    { id: org.a, name: 'Fjordvik AS', publicCode: 'fjrdvkabcd', status: 'active', allowedCategories: ['aa', 'aaa'], createdAt: '2026-10-01T08:00:00.000Z', pinHash: 'scrypt$secret' },
    { id: org.b, name: 'Kystbygg AS', publicCode: 'kystbygabc', status: 'active', allowedCategories: ['aa', 'aaa'], createdAt: '2026-09-15T08:00:00.000Z' },
  )

  const reg = (id: number, organization: number, registeredAt: string, lines: { category: string; quantity: number }[], status = 'registered') =>
    rows('battery-registrations').push({ id, organization, organizationName: '', registeredAt, status, lines, submittedTotal: 0, flags: [], reviewState: 'none' })
  reg(101, org.a, '2026-10-05T10:00:00.000Z', [{ category: 'aa', quantity: 10 }, { category: 'aaa', quantity: 4 }])
  reg(102, org.a, '2026-11-02T10:00:00.000Z', [{ category: 'aa', quantity: 6 }], 'corrected')
  reg(103, org.a, '2026-11-03T10:00:00.000Z', [{ category: 'aa', quantity: 500 }], 'invalidated')
  reg(104, org.a, '2026-11-03T11:00:00.000Z', [{ category: 'other', quantity: 2 }])
  reg(201, org.b, '2026-10-06T10:00:00.000Z', [{ category: 'aa', quantity: 999 }])

  const del = (id: number, organization: number, deliveryDate: string, quantity: number, unit: string, extra: Record<string, unknown> = {}) =>
    rows('battery-deliveries').push({
      id,
      organization,
      organizationName: '',
      deliveryDate,
      quantity,
      unit,
      operator: 'Norsk Gjenvinning',
      reference: null,
      documentationStatus: 'reported',
      status: 'registered',
      registeredAt: `${deliveryDate}T12:00:00.000Z`,
      ...extra,
    })
  del(301, org.a, '2026-10-20', 1.25, 'kg', { reference: 'KV-1001', documentationStatus: 'documented' })
  del(302, org.a, '2026-11-01', 2.1, 'kg', { status: 'corrected' })
  del(303, org.a, '2026-11-02', 40, 'stk', { operator: 'Batteriretur', reference: '  ' })
  del(304, org.a, '2026-11-03', 99, 'kg', { status: 'invalidated', reference: 'SKAL-IKKE-VISES' })
  del(401, org.b, '2026-10-21', 7, 'kg', { operator: 'Kystbygg mottak', reference: 'B-HEMMELIG' })

  const p = h.payload
  const bc = async (name: string, organizationNumber: string, environmentalOrganization?: number) =>
    (await p.create({ collection: 'business-customers', data: { name, organizationNumber, contactEmail: `${organizationNumber}@aboks.invalid`, status: 'active', ...(environmentalOrganization ? { environmentalOrganization } : {}) } as never })).id as number
  const bcA = await bc('Fjordvik AS', '834012952', org.a)
  const bcB = await bc('Kystbygg AS', '923609016', org.b)
  const bcNone = await bc('Uten org AS', '974760673')
  rows('orders').push(
    { id: 51, orderNumber: 'AB-000051', status: 'confirmed', businessCustomer: bcA },
    { id: 52, orderNumber: 'AB-000052', status: 'delivered', businessCustomer: bcB },
    { id: 53, orderNumber: 'AB-000053', status: 'shipped', businessCustomer: bcNone },
  )
  const verified = new Date().toISOString()
  const acc = (email: string, businessCustomer: number) =>
    p.create({ collection: 'miljo-accounts', data: { email, password: PASSWORD, businessCustomer, status: 'active', emailVerifiedAt: verified } as never, context: { [MILJO_TRUSTED_ACCOUNT_CREATE]: true } })
  await acc('a@fjordvik.invalid', bcA)
  await acc('b@kystbygg.invalid', bcB)
  await acc('x@utenorg.invalid', bcNone)
  sessionA = await signedIn('a@fjordvik.invalid')
  sessionB = await signedIn('b@kystbygg.invalid')
  sessionNoOrg = await signedIn('x@utenorg.invalid')
})

after(async () => {
  await h?.payload.destroy?.()
})

/* ------------------------------ organisation ------------------------------ */

describe('the organisation comes from the session only', () => {
  it('account A → organisation A, account B → organisation B', async () => {
    assert.equal((await accountOrganization(sessionA))?.org.id, org.a)
    assert.equal((await accountOrganization(sessionB))?.org.id, org.b)
  })

  it('a company without an environmental organisation gets none — never someone else’s', async () => {
    assert.equal(await accountOrganization(sessionNoOrg), null)
  })

  it('«all time» starts on the organisation’s first day', async () => {
    const a = (await accountOrganization(sessionA))!
    assert.equal(a.sinceKey, '2026-10-01')
    const period = allTimePeriod(a.sinceKey, NOW)
    assert.equal(period.fromKey, '2026-10-01')
    assert.equal(period.toKey, '2026-11-04')
  })

  it('an organisation an administrator closed is still readable by its own account', async () => {
    const orgRow = rows('environmental-organizations').find((o) => o.id === org.a)!
    orgRow.status = 'inactive'
    try {
      const a = await accountOrganization(sessionA)
      assert.equal(a?.org.id, org.a)
      assert.equal(a?.active, false)
    } finally {
      orgRow.status = 'active'
    }
  })
})

/* ------------------------------ overview ------------------------------ */

describe('overview (all time)', () => {
  it('counts only A’s records: invalidated left out, corrected with current values', async () => {
    const o = await accountOverview(sessionA, (await accountOrganization(sessionA))!, NOW)
    assert.deepEqual(o.registrations.byCategory, { aa: 16, aaa: 4, other: 2 })
    assert.equal(o.registrations.registrations, 3)
    assert.equal(o.registrations.total, 22)
  })

  it('kilograms and pieces stay apart — never converted or added together', async () => {
    const o = await accountOverview(sessionA, (await accountOrganization(sessionA))!, NOW)
    assert.deepEqual(o.deliveries.byUnit.kg, { deliveries: 2, quantity: 3.35 })
    assert.deepEqual(o.deliveries.byUnit.stk, { deliveries: 1, quantity: 40 })
    assert.equal(o.deliveries.deliveries, 3)
    assert.equal(o.deliveries.withReceipt, 1)
  })

  it('B sees only B', async () => {
    const o = await accountOverview(sessionB, (await accountOrganization(sessionB))!, NOW)
    assert.equal(o.registrations.total, 999)
    assert.deepEqual(o.deliveries.byUnit.kg, { deliveries: 1, quantity: 7 })
    assert.equal(o.deliveries.byUnit.stk.deliveries, 0)
  })
})

/* ------------------------------ statistics ------------------------------ */

describe('statistics', () => {
  it('equal the public page’s statistics for the same organisation and period', async () => {
    const period = resolveMiljoPeriod({ preset: 'custom', from: '2026-10-01', to: '2026-11-04' }, NOW)
    const mine = await accountStatistics(sessionA, (await accountOrganization(sessionA))!, period)
    const resolved = await resolveOrganization(sessionA.req, 'fjrdvkabcd')
    assert.equal(resolved.kind, 'active')
    const records = await loadRecords(sessionA.req, { organizationId: org.a, period })
    const pub = buildPublicStatistics((resolved as { org: Parameters<typeof buildPublicStatistics>[0] }).org, period, records.registrations, records.deliveries)
    assert.deepEqual(mine, pub)
  })

  it('a period filter applies (November only)', async () => {
    const period = resolveMiljoPeriod({ preset: 'custom', from: '2026-11-01', to: '2026-11-30' }, NOW)
    const s = await accountStatistics(sessionA, (await accountOrganization(sessionA))!, period)
    assert.equal(s.registrations.total, 8)
    assert.equal(s.deliveries.deliveries, 2)
  })

  it('the public statistics carry no references and no PIN state', async () => {
    const period = resolveMiljoPeriod({ preset: 'custom', from: '2026-10-01', to: '2026-11-04' }, NOW)
    const text = JSON.stringify(await accountStatistics(sessionA, (await accountOrganization(sessionA))!, period))
    for (const secret of ['KV-1001', 'scrypt', 'pinHash', 'B-HEMMELIG']) assert.ok(!text.includes(secret), secret)
  })
})

/* ------------------------------ deliveries ------------------------------ */

describe('deliveries list', () => {
  it('A’s deliveries only, newest first, with reference and receipt status; invalidated left out', async () => {
    const { rows: list, truncated } = await accountDeliveries(sessionA, (await accountOrganization(sessionA))!)
    assert.equal(truncated, false)
    assert.deepEqual(
      list.map((d) => [d.id, d.deliveryDate, d.quantity, d.unit, d.reference, d.documentationStatus, d.corrected]),
      [
        [303, '2026-11-02', 40, 'stk', null, 'reported', false],
        [302, '2026-11-01', 2.1, 'kg', null, 'reported', true],
        [301, '2026-10-20', 1.25, 'kg', 'KV-1001', 'documented', false],
      ],
    )
    const text = JSON.stringify(list)
    assert.ok(!text.includes('B-HEMMELIG') && !text.includes('Kystbygg mottak'), 'nothing of organisation B')
    assert.ok(!text.includes('SKAL-IKKE-VISES'), 'invalidated delivery not shown')
  })

  it('B’s list holds only B’s delivery', async () => {
    const { rows: list } = await accountDeliveries(sessionB, (await accountOrganization(sessionB))!)
    assert.deepEqual(list.map((d) => d.id), [401])
  })
})

/* ------------------------------ exports ------------------------------ */

describe('exports', () => {
  const period = () => resolveMiljoPeriod({ preset: 'custom', from: '2026-10-01', to: '2026-11-04' }, NOW)

  it('CSV of deliveries: A’s rows only, public columns (no reference)', async () => {
    const file = await accountExport(sessionA, (await accountOrganization(sessionA))!, { format: 'csv', type: 'leveranser', period: period() })
    const csv = String(file.body)
    assert.match(file.filename, /^miljo-leveranser-fjordvik-as-2026-10-01-2026-11-04\.csv$/)
    assert.ok(csv.includes('Batteriretur'))
    assert.ok(!csv.includes('Kystbygg mottak') && !csv.includes('B-HEMMELIG') && !csv.includes('SKAL-IKKE-VISES'))
  })

  it('an unknown CSV type falls back to the summary', async () => {
    const file = await accountExport(sessionA, (await accountOrganization(sessionA))!, { format: 'csv', type: '../../etc', period: period() })
    assert.match(file.filename, /^miljo-sammendrag-/)
  })

  it('PDF: a miljørapport for A', async () => {
    const prev = process.env.RECEIPT_LOGO_URL
    process.env.RECEIPT_LOGO_URL = '' // no network in tests: the report falls back to a text logo
    try {
      const file = await accountExport(sessionA, (await accountOrganization(sessionA))!, { format: 'pdf', type: '', period: period() })
      assert.equal(file.contentType, 'application/pdf')
      assert.match(file.filename, /^miljorapport-fjordvik-as-/)
      assert.equal(Buffer.from(file.body as Uint8Array).subarray(0, 5).toString('latin1'), '%PDF-')
    } finally {
      if (prev === undefined) delete process.env.RECEIPT_LOGO_URL
      else process.env.RECEIPT_LOGO_URL = prev
    }
  })
})
