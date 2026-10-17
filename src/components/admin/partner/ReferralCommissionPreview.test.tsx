import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { ValidationError } from 'payload'
import ReferralCommissionPreviewView, { PREVIEW_FOOTNOTE, buildCommissionPreview, type PreviewInput } from './ReferralCommissionPreviewView'
import { enforceReferralSaleRules } from '@/collections/hooks/referralSale'
import { computeSaleCommission } from '@/lib/partner/referral'

/**
 * The live commission preview: what it shows, and — the point of it — that it computes exactly
 * what the server stores.
 */

const text = (input: PreviewInput) =>
  renderToStaticMarkup(<ReferralCommissionPreviewView preview={buildCommissionPreview(input)} />)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\s  ]+/g, ' ')
    .trim()

/** formatNOK uses non-breaking spaces; compare on plain spaces. */
const norm = (value: string) => value.replace(/[  ]/g, ' ')

const retail = (overrides: Partial<PreviewInput> = {}): PreviewInput => ({
  category: 'retailStore',
  invoicedTotal: 12_500,
  shippingAmount: 250,
  otherExcludedAmount: 50,
  vatTreatment: 'noVat',
  paymentStatus: 'pending',
  ...overrides,
})

/* ------------------------------ what it shows ------------------------------ */

describe('commission preview — calculation shown line by line', () => {
  it('Forhandlersalg: base, standard 15 % and the commission', () => {
    const preview = buildCommissionPreview(retail())
    assert.equal(preview.tone, 'ok')
    const t = text(retail())
    for (const expected of [
      'Provisjon: 1 830,00 kr',
      'Fakturert beløp 12 500,00 kr',
      '− Frakt 250,00 kr',
      '− Andre tillegg 50,00 kr',
      '= Provisjonsgrunnlag 12 200,00 kr',
      '15 % (standard Forhandlersalg)',
      'Opptjenes først når salget settes til «Betalt».',
      'ABOKS AS er ikke MVA-registrert',
      PREVIEW_FOOTNOTE,
    ]) {
      assert.ok(t.includes(expected), `missing «${expected}» in: ${t}`)
    }
  })

  it('updates with every changed input', () => {
    assert.equal(norm(buildCommissionPreview(retail({ invoicedTotal: 10_000, shippingAmount: null, otherExcludedAmount: null })).title), 'Provisjon: 1 500,00 kr')
    const vat = text(retail({ invoicedTotal: 13_000, shippingAmount: 500, otherExcludedAmount: null, vatTreatment: 'vatDeducted', vatAmount: 2_500 }))
    assert.ok(vat.includes('− MVA 2 500,00 kr'))
    assert.ok(vat.includes('Provisjon: 1 500,00 kr'))
    const override = text(retail({ commissionRate: 20, rateOverrideReason: 'Avtalt' }))
    assert.ok(override.includes('20 % (avviker fra standard 15 %)'))
    assert.ok(override.includes('Provisjon: 2 440,00 kr'))
  })

  it('makes it obvious when a Bedriftssalg sale does not qualify', () => {
    const input = retail({ category: 'businessSale' })
    const preview = buildCommissionPreview(input)
    assert.equal(preview.tone, 'warning')
    assert.equal(preview.title, 'Gir ikke provisjon')
    const t = text(input)
    assert.ok(t.includes('Bedriftssalg gir provisjon bare for avtalte salg. Velg «Gir provisjon»'))
    assert.ok(t.includes('Provisjon 0,00 kr'))
    assert.ok(t.includes('25 % (standard Bedriftssalg)'))
  })

  it('shows 25 % once «Gir provisjon» is chosen for a Bedriftssalg sale', () => {
    assert.equal(norm(buildCommissionPreview(retail({ category: 'businessSale', commissionEligibility: 'eligible' })).title), 'Provisjon: 3 050,00 kr')
  })

  it('says so when «Gir ikke provisjon» is chosen explicitly', () => {
    const preview = buildCommissionPreview(retail({ commissionEligibility: 'notEligible' }))
    assert.equal(preview.title, 'Gir ikke provisjon')
    assert.deepEqual(preview.notes.slice(0, 1), ['«Gir ikke provisjon» er valgt for dette salget.'])
  })

  it('shows the server message for invalid input', () => {
    const decimals = buildCommissionPreview(retail({ invoicedTotal: 100.555 }))
    assert.equal(decimals.tone, 'error')
    assert.match(decimals.notes[0], /høyst to desimaler/)
    assert.match(buildCommissionPreview(retail({ shippingAmount: 20_000 })).notes[0], /ikke være høyere enn fakturert beløp/)
    assert.match(buildCommissionPreview(retail({ vatTreatment: 'vatDeducted' })).notes[0], /MVA-beløpet/)
    assert.match(buildCommissionPreview(retail({ commissionRate: 20 })).notes[0], /begrunnelse/)
  })

  it('asks for what is missing before calculating', () => {
    assert.equal(buildCommissionPreview({ category: undefined }).title, 'Velg henvist kunde for å se provisjonen.')
    assert.equal(buildCommissionPreview({ category: undefined, loadingCustomer: true }).title, 'Henter kunde …')
    const missing = buildCommissionPreview({ category: 'retailStore', invoicedTotal: null })
    assert.equal(missing.title, 'Fyll inn fakturert beløp og velg MVA-behandling.')
    assert.deepEqual(missing.notes, ['Forhandlersalg: standardsats 15 %.'])
  })

  it('a cancelled or refunded sale shows no commission', () => {
    assert.equal(buildCommissionPreview(retail({ paymentStatus: 'refunded' })).title, 'Ingen provisjon – salget er kansellert eller refundert')
  })

  it('a paid or closed saved sale shows the stored, locked figures — never a recalculation', () => {
    const preview = buildCommissionPreview(
      retail({ invoicedTotal: 99_999, savedPaymentStatus: 'paid', savedCommissionBase: 12_200, savedCommissionAmount: 1_830 }),
    )
    assert.equal(preview.tone, 'locked')
    assert.equal(preview.title, 'Låst – lagret provisjon')
    assert.deepEqual(preview.lines.map((l) => l.value.replace(/[  ]/g, ' ')), ['12 200,00 kr', '1 830,00 kr'])
  })

  it('notes that double commission with a promo code is checked on save', () => {
    assert.ok(buildCommissionPreview(retail({ hasOrder: true })).notes.some((n) => n.includes('dobbel provisjon')))
  })
})

/* ------------------------------ identical to the server ------------------------------ */

describe('commission preview — exactly the server calculation', () => {
  const CUSTOMERS: Record<string, Record<string, unknown>> = {
    1: { id: 1, name: 'Butikk', partner: 7, category: 'retailStore', status: 'approved' },
    2: { id: 2, name: 'Bedrift', partner: 7, category: 'businessSale', status: 'approved' },
  }

  async function serverSave(customerId: 1 | 2, fields: Record<string, unknown>) {
    const data: Record<string, unknown> = { referredCustomer: customerId, saleDate: '2026-10-17T10:00:00.000Z', paymentStatus: 'pending', ...fields }
    const req = {
      user: { id: 1 },
      payload: {
        findByID: async ({ id }: { id: unknown }) => CUSTOMERS[String(id)] ?? null,
        find: async () => ({ docs: [] }),
      },
      t: (k: string) => k,
    }
    try {
      await enforceReferralSaleRules({ operation: 'create', data, req, context: {} } as never)
      return { ok: true as const, base: data.commissionBase, amount: data.commissionAmount, rate: data.commissionRate, eligibility: data.commissionEligibility }
    } catch (err) {
      assert.ok(err instanceof ValidationError)
      return { ok: false as const, message: (err as ValidationError).data.errors[0].message }
    }
  }

  const CASES: [1 | 2, Record<string, unknown>][] = [
    [1, { invoicedTotal: 12_500, shippingAmount: 250, otherExcludedAmount: 50, vatTreatment: 'noVat' }],
    [1, { invoicedTotal: 333.33, vatTreatment: 'noVat' }],
    [1, { invoicedTotal: 0.07, vatTreatment: 'noVat' }],
    [1, { invoicedTotal: 13_000, shippingAmount: 500, vatTreatment: 'vatDeducted', vatAmount: 2_500 }],
    [1, { invoicedTotal: 9_999.99, commissionRate: 12.3, rateOverrideReason: 'Avtalt', vatTreatment: 'noVat' }],
    [1, { invoicedTotal: 5_000, commissionEligibility: 'notEligible', vatTreatment: 'noVat' }],
    [2, { invoicedTotal: 40_000, vatTreatment: 'noVat' }],
    [2, { invoicedTotal: 40_000, commissionEligibility: 'eligible', vatTreatment: 'noVat' }],
    [2, { invoicedTotal: 40_000, commissionEligibility: 'eligible', commissionRate: 20, rateOverrideReason: 'Rammeavtale', vatTreatment: 'noVat' }],
    // Refusals: the preview must show the very message the server returns.
    [1, { invoicedTotal: 100.555, vatTreatment: 'noVat' }],
    [1, { invoicedTotal: 100, shippingAmount: 200, vatTreatment: 'noVat' }],
    [1, { invoicedTotal: 100, vatTreatment: 'vatDeducted' }],
    [1, { invoicedTotal: 100, vatTreatment: 'noVat', vatAmount: 25 }],
    [2, { invoicedTotal: 100, commissionRate: 30, vatTreatment: 'noVat' }],
    [1, { invoicedTotal: 100, commissionRate: 150, rateOverrideReason: 'x', vatTreatment: 'noVat' }],
  ]

  for (const [customerId, fields] of CASES) {
    it(`matches the server for ${JSON.stringify(fields)}`, async () => {
      const server = await serverSave(customerId, fields)
      const preview = computeSaleCommission({ category: CUSTOMERS[customerId].category, ...fields })
      if (server.ok) {
        assert.ok(preview.ok, `preview refused what the server accepted: ${JSON.stringify(preview)}`)
        assert.equal(preview.baseOere / 100, server.base)
        assert.equal(preview.commissionOere / 100, server.amount)
        assert.equal(preview.rate, server.rate)
        assert.equal(preview.eligibility, server.eligibility)
        // And the visible title says the same amount.
        const shown = buildCommissionPreview({ category: CUSTOMERS[customerId].category, paymentStatus: 'pending', ...fields })
        if (preview.eligibility === 'eligible') {
          assert.ok(shown.lines.at(-1)!.value.replace(/[  ]/g, ' ').startsWith(
            (server.amount as number).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, ' '),
          ))
        }
      } else {
        assert.equal(preview.ok, false, 'preview accepted what the server refused')
        assert.equal(!preview.ok && preview.message, server.message)
      }
    })
  }
})
