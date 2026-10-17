import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Payload } from 'payload'
import { CategorySection, OverviewCards } from './ReferredCustomersOverview'
import { SALES_SHOWN_PER_CATEGORY, buildReferralOverview, loadReferralOverview } from '@/lib/partner/referralOverview'
import { Partners } from '@/collections/Partners'

/**
 * The «Henviste kunder – oversikt» on a partner: companies and physical stores separately, with
 * their sales and commission totals.
 */

const text = (node: React.ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\s  ]+/g, ' ')
    .trim()

const CUSTOMERS = [
  { id: 1, name: 'Sport 1 Lillestrøm', category: 'retailStore', status: 'approved' },
  { id: 2, name: 'Bedrift AS', category: 'businessSale', status: 'approved' },
  { id: 3, name: 'Annen Butikk', category: 'retailStore', status: 'inactive' },
]

/** Newest first, as the loader sorts them. */
const SALES = [
  { id: 15, referredCustomer: 1, category: 'retailStore', saleDate: '2026-10-15T10:00:00.000Z', invoicedTotal: 1_000, commissionAmount: 150, paymentStatus: 'pending', commissionStatus: 'pending' },
  { id: 14, referredCustomer: 1, category: 'retailStore', saleDate: '2026-10-10T10:00:00.000Z', invoicedTotal: 2_000, commissionAmount: 300, paymentStatus: 'refunded', commissionStatus: 'reversed' },
  { id: 13, referredCustomer: 1, category: 'retailStore', saleDate: '2026-10-05T10:00:00.000Z', invoicedTotal: 12_200, commissionAmount: 1_830, paymentStatus: 'paid', commissionStatus: 'paid' },
  { id: 12, referredCustomer: 1, category: 'retailStore', saleDate: '2026-10-01T10:00:00.000Z', invoicedTotal: 5_000, commissionAmount: 750, paymentStatus: 'paid', commissionStatus: 'earned' },
  { id: 11, referredCustomer: 2, category: 'businessSale', saleDate: '2026-09-20T10:00:00.000Z', invoicedTotal: 40_000, commissionAmount: 10_000, paymentStatus: 'paid', commissionStatus: 'earned' },
  { id: 10, referredCustomer: 2, category: 'businessSale', saleDate: '2026-09-10T10:00:00.000Z', invoicedTotal: 8_000, commissionAmount: 0, paymentStatus: 'paid', commissionStatus: 'earned' },
]

describe('buildReferralOverview', () => {
  const overview = buildReferralOverview(CUSTOMERS, SALES)

  it('separates companies and physical stores', () => {
    assert.deepEqual(overview.businessSale.customers.map((c) => c.name), ['Bedrift AS'])
    assert.deepEqual(overview.retailStore.customers.map((c) => c.name), ['Annen Butikk', 'Sport 1 Lillestrøm'])
    assert.equal(overview.businessSale.saleCount, 2)
    assert.equal(overview.retailStore.saleCount, 4)
  })

  it('totals each customer: earned (incl. paid out), pending, paid out, reversed, paid revenue', () => {
    const store = overview.retailStore.customers.find((c) => c.id === '1')!
    assert.deepEqual(
      { sales: store.saleCount, revenue: store.paidRevenue, earned: store.earned, pending: store.pending, paidOut: store.paidOut, reversed: store.reversed },
      { sales: 4, revenue: 17_200, earned: 2_580, pending: 150, paidOut: 1_830, reversed: 300 },
    )
    const empty = overview.retailStore.customers.find((c) => c.id === '3')!
    assert.equal(empty.saleCount, 0)
    assert.equal(empty.earned, 0)
  })

  it('totals each category with the same rules as the payout panel', () => {
    assert.equal(overview.retailStore.totals.earnedTotalOere.retailStore, 258_000)
    assert.equal(overview.retailStore.totals.earnedUnpaidOere.retailStore, 75_000)
    assert.equal(overview.businessSale.totals.earnedTotalOere.businessSale, 1_000_000)
    assert.equal(overview.businessSale.totals.earnedTotalOere.retailStore, 0)
  })

  it('lists the newest sales first, capped per category', () => {
    assert.deepEqual(overview.retailStore.sales.map((s) => s.id), ['15', '14', '13', '12'])
    assert.equal(overview.retailStore.sales[0].customerName, 'Sport 1 Lillestrøm')
    const many = Array.from({ length: 30 }, (_, i) => ({ ...SALES[0], id: 100 + i }))
    const capped = buildReferralOverview(CUSTOMERS, many).retailStore
    assert.equal(capped.sales.length, SALES_SHOWN_PER_CATEGORY)
    assert.equal(capped.saleCount, 30)
  })
})

describe('OverviewCards and CategorySection', () => {
  const overview = buildReferralOverview(CUSTOMERS, SALES)

  it('shows counts and every commission total, in Norwegian', () => {
    const t = text(<OverviewCards overview={overview} />)
    for (const expected of [
      'Bedrifter 1 2 salg',
      'Fysiske butikker 2 4 salg',
      'Opptjent – Bedriftssalg 10 000,00 kr',
      'Opptjent – Forhandlersalg 2 580,00 kr',
      'Venter på betaling 150,00 kr',
      'Ikke utbetalt 10 750,00 kr',
      'Utbetalt 1 830,00 kr',
      'Tilbakeført 300,00 kr',
    ]) {
      assert.ok(t.includes(expected), `missing «${expected}» in: ${t}`)
    }
  })

  it('lists customers and their sales with links and Norwegian statuses', () => {
    const node = <CategorySection title="Fysiske butikker – Forhandlersalg" empty="Ingen." category={overview.retailStore} />
    const html = renderToStaticMarkup(node)
    assert.match(html, /href="\/admin\/collections\/referred-customers\/1"/)
    assert.match(html, /href="\/admin\/collections\/referral-sales\/15"/)
    const t = text(node)
    for (const expected of ['Godkjent', 'Inaktiv', 'Venter på betaling', 'Refundert', 'Tilbakeført', 'Utbetalt', 'Opptjent', '15.10.2026']) {
      assert.ok(t.includes(expected), `missing «${expected}»`)
    }
  })

  it('says so when there are no customers in a category', () => {
    const none = buildReferralOverview([], []).businessSale
    assert.equal(text(<CategorySection title="Bedrifter – Bedriftssalg" empty="Ingen henviste bedrifter." category={none} />), 'Bedrifter – Bedriftssalg Ingen henviste bedrifter.')
  })

  it('notes when only the newest sales are shown', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...SALES[0], id: 100 + i }))
    const t = text(<CategorySection title="x" empty="x" category={buildReferralOverview(CUSTOMERS, many).retailStore} />)
    assert.ok(t.includes('Viser de 25 siste av 30 salg'))
  })
})

describe('loadReferralOverview', () => {
  it('uses two queries, filtered by partner, sales newest first', async () => {
    const queries: Record<string, unknown>[] = []
    const payload = {
      find: async (args: Record<string, unknown>) => {
        queries.push(args)
        return { docs: args.collection === 'referred-customers' ? CUSTOMERS : SALES }
      },
    } as unknown as Payload
    const overview = await loadReferralOverview(payload, 7)
    assert.deepEqual(queries.map((q) => [q.collection, JSON.stringify(q.where), q.sort ?? null]), [
      ['referred-customers', '{"partner":{"equals":7}}', null],
      ['referral-sales', '{"partner":{"equals":7}}', '-saleDate'],
    ])
    assert.equal(overview.retailStore.customers.length, 2)
  })
})

describe('Partners — overview placement', () => {
  const ui = (name: string) => (Partners.fields as { name?: string; admin?: { condition?: (d: unknown) => boolean } }[]).find((f) => f.name === name)

  it('shows the overview and the payout panel on regular partners only', () => {
    for (const name of ['referredCustomersOverview', 'referralCommission']) {
      const field = ui(name)
      assert.ok(field, name)
      assert.equal(field.admin!.condition!({ partnerType: 'regular' }), true)
      assert.equal(field.admin!.condition!({ partnerType: 'retailer' }), false)
    }
  })

  it('keeps the overview above the list where customers are added', () => {
    const names = (Partners.fields as { name?: string }[]).map((f) => f.name)
    assert.ok(names.indexOf('referredCustomersOverview') < names.indexOf('referredCustomers'))
    assert.ok(names.indexOf('promoCodes') >= 0, 'the promo-code list is still there')
  })
})
