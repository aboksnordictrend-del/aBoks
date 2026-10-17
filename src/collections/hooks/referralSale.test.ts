import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { APIError, ValidationError } from 'payload'
import {
  CUSTOMER_NOT_APPROVED_MESSAGE,
  LOCKED_FIELDS,
  REFERRAL_PAYOUT_CONTEXT,
  SALE_DELETE_MESSAGE,
  comparable,
  enforceReferralSaleRules,
  guardReferralSaleDelete,
  saleTitle,
} from './referralSale'

/* ------------------------------ harness ------------------------------ */

type Doc = Record<string, unknown>
type FindArgs = { collection: string; where: Doc }

interface Stub {
  customers?: Record<string, Doc>
  sales?: Record<string, Doc>
  /** Orders whose `orderNumber` exists. */
  orderNumbers?: string[]
  /** promo-code-usages per order id. */
  usages?: Record<string, Doc[]>
  /** Answer for a referral-sales find, by the first condition's field. */
  salesFind?: (where: Doc) => Doc[]
}

const CUSTOMERS: Record<string, Doc> = {
  1: { id: 1, name: 'Sport 1 Lillestrøm', partner: 7, category: 'retailStore', status: 'approved' },
  2: { id: 2, name: 'Bedrift AS', partner: 7, category: 'businessSale', status: 'approved' },
  3: { id: 3, name: 'Venter Butikk', partner: 7, category: 'retailStore', status: 'pending' },
  4: { id: 4, name: 'Inaktiv Butikk', partner: 7, category: 'retailStore', status: 'inactive' },
}

function stubReq(stub: Stub = {}) {
  const calls = { find: [] as FindArgs[], findByID: [] as Doc[] }
  const customers = { ...CUSTOMERS, ...stub.customers }
  const req = {
    user: { id: 42 },
    payload: {
      findByID: async (args: { collection: string; id: unknown }) => {
        calls.findByID.push(args as unknown as Doc)
        const table = args.collection === 'referred-customers' ? customers : stub.sales ?? {}
        return table[String(args.id)] ?? null
      },
      find: async (args: FindArgs) => {
        calls.find.push(args)
        if (args.collection === 'orders') {
          const number = (args.where as { orderNumber: { equals: string } }).orderNumber.equals
          return { docs: (stub.orderNumbers ?? []).includes(number) ? [{ id: 99 }] : [] }
        }
        if (args.collection === 'promo-code-usages') {
          const orderId = (args.where as { order: { equals: unknown } }).order.equals
          return { docs: stub.usages?.[String(orderId)] ?? [] }
        }
        return { docs: stub.salesFind?.(args.where) ?? [] }
      },
    },
    t: (key: string) => key,
  }
  return { req, calls }
}

type ChangeArgs = Parameters<typeof enforceReferralSaleRules>[0]

const sale = (overrides: Doc = {}): Doc => ({
  referredCustomer: 1,
  saleDate: '2026-10-17T10:00:00.000Z',
  invoicedTotal: 12_500,
  shippingAmount: 250,
  otherExcludedAmount: 50,
  vatTreatment: 'noVat',
  paymentStatus: 'pending',
  ...overrides,
})

async function run(operation: 'create' | 'update', data: Doc, originalDoc?: Doc, stub: Stub = {}, context: Doc = {}) {
  const { req, calls } = stubReq(stub)
  await enforceReferralSaleRules({ operation, data, originalDoc, req, context } as unknown as ChangeArgs)
  return { data, calls }
}

/** A sale as stored after a successful create. */
async function created(overrides: Doc = {}, stub: Stub = {}): Promise<Doc> {
  const { data } = await run('create', sale(overrides), undefined, stub)
  return { id: 50, ...data }
}

async function refused(promise: Promise<unknown>, path: string, message?: string | RegExp) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof ValidationError, `expected ValidationError, got ${String(err)}`)
    const errors = (err as ValidationError).data.errors
    assert.equal(errors[0].path, path)
    if (typeof message === 'string') assert.equal(errors[0].message, message)
    else if (message) assert.match(errors[0].message, message)
    return true
  })
}

/* ------------------------------ manual amounts → commission ------------------------------ */

describe('referral sale — manual amounts and automatic commission', () => {
  it('Forhandlersalg: 15 % of total − shipping − other charges, earned only when paid', async () => {
    const { data } = await run('create', sale())
    assert.equal(data.commissionBase, 12_200)
    assert.equal(data.commissionRate, 15)
    assert.equal(data.commissionEligibility, 'eligible')
    assert.equal(data.commissionAmount, 1_830)
    assert.equal(data.commissionStatus, 'pending')
    assert.equal(data.currency, 'NOK')
  })

  it('Bedriftssalg: earns nothing by default — the administrator must choose «Gir provisjon»', async () => {
    const byDefault = (await run('create', sale({ referredCustomer: 2 }))).data
    assert.equal(byDefault.commissionEligibility, 'notEligible')
    assert.equal(byDefault.commissionRate, 25)
    assert.equal(byDefault.commissionAmount, 0)

    const chosen = (await run('create', sale({ referredCustomer: 2, commissionEligibility: 'eligible' }))).data
    assert.equal(chosen.commissionAmount, 3_050)
  })

  it('a Forhandlersalg purchase can be explicitly excluded', async () => {
    const { data } = await run('create', sale({ commissionEligibility: 'notEligible' }))
    assert.equal(data.commissionAmount, 0)
  })

  it('future VAT invoice: the entered VAT is deducted from the base', async () => {
    const { data } = await run(
      'create',
      sale({ invoicedTotal: 13_000, shippingAmount: 500, otherExcludedAmount: null, vatTreatment: 'vatDeducted', vatAmount: 2_500 }),
    )
    assert.equal(data.commissionBase, 10_000)
    assert.equal(data.commissionAmount, 1_500)
  })

  it('requires a VAT treatment and a VAT amount on a VAT invoice', async () => {
    await refused(run('create', sale({ vatTreatment: undefined })), 'vatTreatment')
    await refused(run('create', sale({ vatTreatment: 'vatDeducted' })), 'vatAmount')
  })

  it('refuses an amount with more than two decimals instead of rounding it', async () => {
    await refused(run('create', sale({ invoicedTotal: 100.555 })), 'invoicedTotal', /to desimaler/)
  })

  it('refuses exclusions larger than the invoice', async () => {
    await refused(run('create', sale({ invoicedTotal: 100, shippingAmount: 200 })), 'invoicedTotal')
  })

  it('overwrites every derived value a client sends', async () => {
    const { data } = await run(
      'create',
      sale({ commissionAmount: 999_999, commissionBase: 999_999, commissionStatus: 'paid', partner: 3, category: 'businessSale', payout: 5, createdBy: 1, currency: 'EUR' }),
    )
    assert.equal(data.commissionAmount, 1_830)
    assert.equal(data.commissionBase, 12_200)
    assert.equal(data.commissionStatus, 'pending')
    assert.equal(data.partner, 7)
    assert.equal(data.category, 'retailStore')
    assert.equal(data.payout, null)
    assert.equal(data.createdBy, 42)
    assert.equal(data.currency, 'NOK')
  })

  it('titles the sale with customer and date', async () => {
    const { data } = await run('create', sale())
    assert.equal(data.title, 'Sport 1 Lillestrøm – 17.10.2026')
    assert.equal(saleTitle('  ', null), 'Ukjent kunde')
  })
})

/* ------------------------------ customer ------------------------------ */

describe('referral sale — customer', () => {
  it('derives partner and category from the customer', async () => {
    const { data } = await run('create', sale({ referredCustomer: 2 }))
    assert.equal(data.partner, 7)
    assert.equal(data.category, 'businessSale')
  })

  it('requires an approved customer for a new sale', async () => {
    await refused(run('create', sale({ referredCustomer: 3 })), 'referredCustomer', CUSTOMER_NOT_APPROVED_MESSAGE)
    await refused(run('create', sale({ referredCustomer: 4 })), 'referredCustomer', CUSTOMER_NOT_APPROVED_MESSAGE)
    await refused(run('create', sale({ referredCustomer: 404 })), 'referredCustomer', /Fant ikke/)
  })

  it('lets an existing pending sale be marked paid after the store became inactive', async () => {
    const stored = await created()
    const { data } = await run('update', { ...stored, paymentStatus: 'paid' }, stored, {
      customers: { 1: { ...CUSTOMERS[1], status: 'inactive' } },
    })
    assert.equal(data.commissionStatus, 'earned')
  })
})

/* ------------------------------ rate ------------------------------ */

describe('referral sale — rate override', () => {
  it('requires an explanation for a non-standard rate', async () => {
    await refused(run('create', sale({ commissionRate: 20 })), 'rateOverrideReason', /begrunnelse/)
  })

  it('applies an explained override', async () => {
    const { data } = await run('create', sale({ commissionRate: 20, rateOverrideReason: 'Avtalt i rammeavtale' }))
    assert.equal(data.commissionAmount, 2_440)
  })

  it('refuses a rate above 100', async () => {
    await refused(run('create', sale({ commissionRate: 120, rateOverrideReason: 'x' })), 'commissionRate')
  })

  it('cannot change the rate once the sale is paid', async () => {
    const stored = { ...(await created()), paymentStatus: 'paid', commissionStatus: 'earned' }
    await refused(
      run('update', { ...stored, commissionRate: 20, rateOverrideReason: 'For sent' }, stored),
      'commissionRate',
      /låst/,
    )
  })
})

/* ------------------------------ payment and commission status ------------------------------ */

describe('referral sale — payment confirmation', () => {
  it('earns the commission when marked paid, and fills the paid date', async () => {
    const stored = await created()
    const { data } = await run('update', { ...stored, paymentStatus: 'paid' }, stored)
    assert.equal(data.commissionStatus, 'earned')
    assert.ok(typeof data.paidAt === 'string')
  })

  it('keeps a paid date the administrator entered', async () => {
    const stored = await created()
    const { data } = await run('update', { ...stored, paymentStatus: 'paid', paidAt: '2026-10-10T00:00:00.000Z' }, stored)
    assert.equal(data.paidAt, '2026-10-10T00:00:00.000Z')
  })

  it('can register an already-paid sale directly', async () => {
    const { data } = await run('create', sale({ paymentStatus: 'paid' }))
    assert.equal(data.commissionStatus, 'earned')
  })

  it('reverses on cancellation and refund, recording when', async () => {
    const stored = await created()
    const cancelled = (await run('update', { ...stored, paymentStatus: 'cancelled' }, stored)).data
    assert.equal(cancelled.commissionStatus, 'reversed')
    assert.ok(typeof cancelled.closedAt === 'string')

    const paid: Doc = { ...stored, paymentStatus: 'paid', paidAt: '2026-10-10T00:00:00.000Z', commissionStatus: 'earned' }
    const refunded = (await run('update', { ...paid, paymentStatus: 'refunded' }, paid)).data
    assert.equal(refunded.commissionStatus, 'reversed')
    assert.equal(refunded.commissionAmount, paid.commissionAmount, 'the original commission stays on record')
  })

  it('refuses paid → cancelled (must be refunded)', async () => {
    const paid: Doc = { ...(await created()), paymentStatus: 'paid', commissionStatus: 'earned' }
    await refused(run('update', { ...paid, paymentStatus: 'cancelled' }, paid), 'paymentStatus', /Refundert/)
  })

  it('treats refunded and cancelled as final', async () => {
    const refunded: Doc = { ...(await created()), paymentStatus: 'refunded', commissionStatus: 'reversed' }
    await refused(run('update', { ...refunded, paymentStatus: 'paid' }, refunded), 'paymentStatus', /avsluttet/)
  })

  it('undoes a mistaken «Betalt» before any payout, clearing the paid date', async () => {
    const paid: Doc = { ...(await created()), paymentStatus: 'paid', paidAt: '2026-10-10T00:00:00.000Z', commissionStatus: 'earned' }
    const { data } = await run('update', { ...paid, paymentStatus: 'pending' }, paid)
    assert.equal(data.commissionStatus, 'pending')
    assert.equal(data.paidAt, null)
  })

  it('refuses undoing «Betalt» once a payout covers the sale', async () => {
    const paidOut: Doc = { ...(await created()), paymentStatus: 'paid', commissionStatus: 'paid', payout: 77 }
    await refused(run('update', { ...paidOut, paymentStatus: 'pending' }, paidOut), 'paymentStatus', /utbetalt/)
  })

  it('a paid-out sale shows «Utbetalt»; a refund after payout reverses it', async () => {
    const paidOut: Doc = { ...(await created()), paymentStatus: 'paid', commissionStatus: 'paid', payout: 77 }
    const note = (await run('update', { ...paidOut, internalNote: 'x' }, paidOut)).data
    assert.equal(note.commissionStatus, 'paid')
    assert.equal(note.payout, 77)
    const refunded = (await run('update', { ...paidOut, paymentStatus: 'refunded' }, paidOut)).data
    assert.equal(refunded.commissionStatus, 'reversed')
    assert.equal(refunded.payout, 77, 'the payout link is history and stays')
  })
})

/* ------------------------------ payout link ------------------------------ */

describe('referral sale — payout link is system-written', () => {
  it('ignores a payout sent by a client', async () => {
    const paid: Doc = { ...(await created()), paymentStatus: 'paid', commissionStatus: 'earned' }
    const { data } = await run('update', { ...paid, payout: 77 }, paid)
    assert.equal(data.payout, null)
    assert.equal(data.commissionStatus, 'earned')
  })

  it('accepts the payout from the payout endpoint context', async () => {
    const paid: Doc = { ...(await created()), paymentStatus: 'paid', commissionStatus: 'earned' }
    const { data } = await run('update', { payout: 77 }, paid, {}, { [REFERRAL_PAYOUT_CONTEXT]: true })
    assert.equal(data.payout, 77)
    assert.equal(data.commissionStatus, 'paid')
  })
})

/* ------------------------------ locked history ------------------------------ */

describe('referral sale — immutable financial history', () => {
  it('locks every financial field once paid', async () => {
    const paid: Doc = { ...(await created()), paymentStatus: 'paid', paidAt: '2026-10-10T00:00:00.000Z', commissionStatus: 'earned' }
    for (const [field, value] of [
      ['invoicedTotal', 99_999],
      ['shippingAmount', 0],
      ['vatTreatment', 'vatDeducted'],
      ['saleDate', '2026-01-01T00:00:00.000Z'],
      ['commissionEligibility', 'notEligible'],
      ['referredCustomer', 2],
      ['externalReference', 'F-1'],
      ['paidAt', '2026-10-11T00:00:00.000Z'],
    ] as const) {
      await refused(run('update', { ...paid, [field]: value }, paid), field, /låst/)
    }
  })

  it('also locks a cancelled sale', async () => {
    const cancelled: Doc = { ...(await created()), paymentStatus: 'cancelled', commissionStatus: 'reversed' }
    await refused(run('update', { ...cancelled, invoicedTotal: 1 }, cancelled), 'invoicedTotal', /avsluttet/)
  })

  it('accepts a resubmitted unchanged form and a changed internal note', async () => {
    const paid: Doc = { ...(await created()), paymentStatus: 'paid', paidAt: '2026-10-10T00:00:00.000Z', commissionStatus: 'earned' }
    // The admin form resends populated relationships and kroner as given.
    const { data } = await run(
      'update',
      { ...paid, referredCustomer: { id: 1, name: 'Sport 1' }, invoicedTotal: 12_500.0, internalNote: 'Ny merknad' },
      paid,
    )
    assert.equal(data.commissionAmount, 1_830)
  })

  it('keeps the frozen snapshot even if the customer data changed since', async () => {
    const paid: Doc = { ...(await created()), paymentStatus: 'paid', commissionStatus: 'earned' }
    const { data, calls } = await run('update', { ...paid, internalNote: 'x' }, paid)
    assert.equal(data.partner, 7)
    assert.equal(data.commissionAmount, 1_830)
    assert.equal(calls.findByID.length, 0, 'a locked sale is not recalculated')
  })

  it('names the locked fields in Norwegian', () => {
    assert.equal(LOCKED_FIELDS.invoicedTotal, 'Fakturert beløp')
    assert.equal(LOCKED_FIELDS.commissionRate, 'Provisjonssats')
  })

  it('compares money in øre, relations by id and dates by instant', () => {
    assert.equal(comparable('invoicedTotal', 12_500), comparable('invoicedTotal', 12_500.0))
    assert.equal(comparable('referredCustomer', { id: 1 }), comparable('referredCustomer', '1'))
    assert.equal(comparable('saleDate', '2026-10-17T10:00:00.000Z'), comparable('saleDate', new Date('2026-10-17T10:00:00Z')))
    assert.equal(comparable('externalReference', '  '), comparable('externalReference', null))
    assert.equal(comparable('allowPromoOverlap', null), comparable('allowPromoOverlap', false))
  })
})

/* ------------------------------ repeat purchases ------------------------------ */

describe('referral sale — repeat purchases for a physical store', () => {
  it('registers any number of sales on the same store, each earning 15 % once paid', async () => {
    const amounts = [5_000, 7_500, 12_000]
    const commissions: unknown[] = []
    for (const invoicedTotal of amounts) {
      const { data } = await run('create', sale({ invoicedTotal, shippingAmount: null, otherExcludedAmount: null, paymentStatus: 'paid' }))
      commissions.push(data.commissionAmount)
      assert.equal(data.commissionStatus, 'earned')
    }
    assert.deepEqual(commissions, [750, 1_125, 1_800])
  })

  it('refuses the same invoice number twice on one customer', async () => {
    await refused(
      run('create', sale({ externalReference: 'F-1001' }), undefined, {
        salesFind: (where) => (JSON.stringify(where).includes('externalReference') ? [{ id: 5, title: 'Sport 1 – 01.10.2026' }] : []),
      }),
      'externalReference',
      /allerede registrert på denne kunden/,
    )
  })
})

/* ------------------------------ double commission ------------------------------ */

describe('referral sale — no double commission on promo-code orders', () => {
  const partnerUsage = { isPartnerUsage: true, commissionAmount: 40.41 }

  it('refuses a commission-earning sale on an order that already gave promo commission', async () => {
    await refused(run('create', sale({ order: 10 }), undefined, { usages: { 10: [partnerUsage] } }), 'allowPromoOverlap', /promokode-provisjon/)
  })

  it('requires a reason when double commission is allowed', async () => {
    await refused(
      run('create', sale({ order: 10, allowPromoOverlap: true }), undefined, { usages: { 10: [partnerUsage] } }),
      'promoOverlapReason',
    )
  })

  it('allows it with an explicit decision and reason, recording the promo commission', async () => {
    const { data } = await run('create', sale({ order: 10, allowPromoOverlap: true, promoOverlapReason: 'Avtalt' }), undefined, {
      usages: { 10: [partnerUsage] },
    })
    assert.equal(data.promoCommissionOnOrder, 40.41)
    assert.equal(data.commissionAmount, 1_830)
  })

  it('passes when the referral sale itself earns nothing', async () => {
    await run('create', sale({ order: 10, commissionEligibility: 'notEligible' }), undefined, { usages: { 10: [partnerUsage] } })
  })

  it('ignores ordinary promo codes and zero-commission usages', async () => {
    const { data } = await run('create', sale({ order: 10 }), undefined, {
      usages: { 10: [{ isPartnerUsage: false, commissionAmount: 0 }, { isPartnerUsage: true, commissionAmount: null }] },
    })
    assert.equal(data.promoCommissionOnOrder, null)
  })

  it('allows one active referral sale per order', async () => {
    await refused(
      run('create', sale({ order: 10 }), undefined, {
        salesFind: (where) => (JSON.stringify(where).includes('"order"') ? [{ id: 5, title: 'Annet salg' }] : []),
      }),
      'order',
      /Én ordre kan bare gi én henvisningsprovisjon/,
    )
  })

  it('looks for other active sales on the order, excluding itself', async () => {
    const stored = await created({ order: 10 })
    const { calls } = await run('update', { ...stored, invoicedTotal: 13_000 }, stored)
    const salesQuery = calls.find.find((c) => c.collection === 'referral-sales' && JSON.stringify(c.where).includes('"order"'))
    assert.deepEqual(salesQuery?.where, {
      and: [{ order: { equals: 10 } }, { paymentStatus: { in: ['pending', 'paid'] } }, { id: { not_equals: 50 } }],
    })
  })

  it('refuses a webshop order number typed as free text', async () => {
    await refused(
      run('create', sale({ externalReference: 'AB-000123' }), undefined, { orderNumbers: ['AB-000123'] }),
      'externalReference',
      /Velg den i feltet «Ordre»/,
    )
  })

  it('accepts an external invoice number that is not a webshop order', async () => {
    await run('create', sale({ externalReference: 'F-2026-77' }))
  })
})

/* ------------------------------ corrections ------------------------------ */

describe('referral sale — corrections', () => {
  const refundedOriginal = { id: 20, referredCustomer: 1, paymentStatus: 'refunded', title: 'Original' }

  it('accepts a correction of a refunded sale of the same customer', async () => {
    const { data } = await run('create', sale({ correctsSale: 20, invoicedTotal: 10_000 }), undefined, { sales: { 20: refundedOriginal } })
    assert.equal(data.correctsSale, 20)
    assert.equal(data.commissionAmount, 1_455)
  })

  it('requires the original to be refunded or cancelled first', async () => {
    await refused(
      run('create', sale({ correctsSale: 20 }), undefined, { sales: { 20: { ...refundedOriginal, paymentStatus: 'paid' } } }),
      'correctsSale',
      /«Refundert» eller «Kansellert»/,
    )
  })

  it('requires the same customer', async () => {
    await refused(
      run('create', sale({ correctsSale: 20 }), undefined, { sales: { 20: { ...refundedOriginal, referredCustomer: 2 } } }),
      'correctsSale',
      /samme henviste kunde/,
    )
  })

  it('allows only one active correction per original', async () => {
    await refused(
      run('create', sale({ correctsSale: 20 }), undefined, {
        sales: { 20: refundedOriginal },
        salesFind: (where) => (JSON.stringify(where).includes('correctsSale') ? [{ id: 21, title: 'Første korreksjon' }] : []),
      }),
      'correctsSale',
      /allerede korrigert/,
    )
  })

  it('refuses a sale correcting itself', async () => {
    const stored = await created()
    await refused(run('update', { ...stored, correctsSale: 50 }, stored), 'correctsSale', /seg selv/)
  })
})

/* ------------------------------ delete ------------------------------ */

describe('guardReferralSaleDelete', () => {
  type DeleteArgs = Parameters<typeof guardReferralSaleDelete>[0]
  const del = (stored: Doc) => {
    const { req } = stubReq({ sales: { 50: stored } })
    return Promise.resolve(guardReferralSaleDelete({ id: 50, req } as unknown as DeleteArgs))
  }

  it('allows deleting a sale still awaiting payment', async () => {
    await del({ id: 50, paymentStatus: 'pending' })
  })

  for (const paymentStatus of ['paid', 'cancelled', 'refunded']) {
    it(`refuses deleting a ${paymentStatus} sale`, async () => {
      await assert.rejects(del({ id: 50, paymentStatus }), (err: unknown) => {
        assert.ok(err instanceof APIError)
        assert.equal((err as APIError).message, SALE_DELETE_MESSAGE)
        return true
      })
    })
  }

  it('refuses deleting a paid-out sale', async () => {
    await assert.rejects(del({ id: 50, paymentStatus: 'pending', payout: 77 }))
  })
})
