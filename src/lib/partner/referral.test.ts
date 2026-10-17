import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  RETAILER_COMMISSION_PERCENT,
} from '@/lib/partnerProgram/methodCalculator'
import {
  DEFAULT_REFERRAL_RATE,
  REFERRAL_CATEGORY_OPTIONS,
  REFERRED_CUSTOMER_STATUS_OPTIONS,
  REFERRAL_COMMISSION_STATUS_OPTIONS,
  SALE_PAYMENT_STATUS_OPTIONS,
  VAT_TREATMENTS,
  VAT_TREATMENT_OPTIONS,
  calculateReferralCommission,
  clawbackFor,
  computeReferralTotals,
  defaultQualifies,
  defaultRateFor,
  deriveCommissionStatus,
  formatOrganizationNumber,
  isOpenReferredCustomerStatus,
  isRateOverride,
  normalizeCustomerName,
  normalizeOrganizationNumber,
  registrationKey,
  validateCountryCode,
  validateRegistrationNumber,
  parseKroner,
  defaultEligibility,
  isCommissionEligibility,
  planReferralPayout,
  adjustmentReasonFor,
  ADJUSTMENT_REASON_OPTIONS,
  type PayoutCandidateSale,
  toReferralSnapshotKr,
  validateOrganizationNumber,
  validatePaymentTransition,
  validatePromoOverlap,
  validateRate,
  validateSaleAmounts,
} from './referral'
import { numericToOere } from './referralLocks'
import { COUNTRY_CODES, COUNTRY_NAMES_NB, COUNTRY_OPTIONS, isCountryCode } from './countries'

/* ------------------------------ categories and rates ------------------------------ */

describe('referral categories and default rates', () => {
  it('uses the /bli-partner programme rates: 25 % Bedriftssalg, 15 % Forhandlersalg', () => {
    assert.equal(DEFAULT_REFERRAL_RATE.businessSale, 25)
    assert.equal(DEFAULT_REFERRAL_RATE.retailStore, 15)
    // Re-used, never restated.
    assert.equal(DEFAULT_REFERRAL_RATE.businessSale, BUSINESS_SALE_COMMISSION_PERCENT)
    assert.equal(DEFAULT_REFERRAL_RATE.retailStore, RETAILER_COMMISSION_PERCENT)
  })

  it('returns null — never a guessed rate — for an unknown category', () => {
    assert.equal(defaultRateFor('online'), null)
    assert.equal(defaultRateFor(undefined), null)
  })

  it('qualifies Forhandlersalg by default, never Bedriftssalg', () => {
    assert.equal(defaultQualifies('retailStore'), true)
    assert.equal(defaultQualifies('businessSale'), false)
    assert.equal(defaultQualifies(null), false)
  })

  it('labels every option in Norwegian and says Forhandlersalg is physical stores only', () => {
    const labels = REFERRAL_CATEGORY_OPTIONS.map((o) => o.label)
    assert.deepEqual(labels, ['Bedriftssalg', 'Forhandlersalg – fysisk butikk'])
    assert.deepEqual(
      REFERRED_CUSTOMER_STATUS_OPTIONS.map((o) => o.label),
      ['Venter', 'Godkjent', 'Avvist', 'Inaktiv'],
    )
    assert.deepEqual(
      SALE_PAYMENT_STATUS_OPTIONS.map((o) => o.label),
      ['Venter på betaling', 'Betalt', 'Kansellert', 'Refundert'],
    )
    assert.deepEqual(
      REFERRAL_COMMISSION_STATUS_OPTIONS.map((o) => o.label),
      ['Venter', 'Opptjent', 'Utbetalt', 'Tilbakeført'],
    )
  })

  it('treats only pending and approved referrals as open (blocking a duplicate)', () => {
    assert.equal(isOpenReferredCustomerStatus('pending'), true)
    assert.equal(isOpenReferredCustomerStatus('approved'), true)
    assert.equal(isOpenReferredCustomerStatus('rejected'), false)
    assert.equal(isOpenReferredCustomerStatus('inactive'), false)
    assert.equal(isOpenReferredCustomerStatus(null), false)
  })
})

/* ------------------------------ organisation number ------------------------------ */

describe('organisation number', () => {
  it('normalises the ways people write it', () => {
    assert.equal(normalizeOrganizationNumber('834 012 952'), '834012952')
    assert.equal(normalizeOrganizationNumber('NO 834 012 952 MVA'), '834012952')
    assert.equal(normalizeOrganizationNumber('no834.012.952mva'), '834012952')
    assert.equal(normalizeOrganizationNumber('834-012-952'), '834012952')
    assert.equal(normalizeOrganizationNumber('  '), null)
    assert.equal(normalizeOrganizationNumber(null), null)
  })

  it('accepts real organisation numbers (modulus 11)', () => {
    assert.equal(validateOrganizationNumber('834 012 952'), true) // ABOKS AS
    assert.equal(validateOrganizationNumber('937172877'), true)
    assert.equal(validateOrganizationNumber(''), true) // optional
    assert.equal(validateOrganizationNumber(undefined), true)
  })

  it('rejects wrong length and a wrong check digit', () => {
    assert.match(String(validateOrganizationNumber('12345678')), /9 sifre/)
    assert.match(String(validateOrganizationNumber('83401295A')), /9 sifre/)
    assert.match(String(validateOrganizationNumber('834012953')), /kontrollsifferet/)
  })

  it('formats as three groups', () => {
    assert.equal(formatOrganizationNumber('834012952'), '834 012 952')
    assert.equal(formatOrganizationNumber(''), null)
  })
})

describe('registration number — Norwegian and foreign (ISO country codes)', () => {
  it('applies strict Norwegian validation for NO and for a missing country', () => {
    for (const country of ['NO', '', null, undefined]) {
      assert.equal(validateRegistrationNumber('834 012 952', country), true, String(country))
      assert.match(String(validateRegistrationNumber('834012953', country)), /kontrollsifferet/)
      assert.match(String(validateRegistrationNumber('SE556677', country)), /9 sifre/)
    }
  })

  it('accepts a foreign number as written, with no Norwegian check digit', () => {
    assert.equal(validateRegistrationNumber('556677-8899', 'SE'), true)
    assert.equal(validateRegistrationNumber('DK 12345678', 'DK'), true)
    assert.equal(validateRegistrationNumber('HRB 12345 B', 'DE'), true)
    // Nine digits that fail the Norwegian check digit are fine abroad.
    assert.equal(validateRegistrationNumber('834012953', 'SE'), true)
  })

  it('refuses a country that is not an ISO code', () => {
    assert.match(String(validateRegistrationNumber('556677-8899', 'Sverige')), /Velg land/)
    assert.match(String(validateRegistrationNumber('556677-8899', 'se')), /Velg land/)
    assert.equal(validateCountryCode('SE'), true)
    assert.equal(validateCountryCode('NO'), true)
    assert.match(String(validateCountryCode('Sweden')), /Velg land/)
  })

  it('limits a foreign number to plain characters and 40 characters', () => {
    assert.match(String(validateRegistrationNumber('12345; DROP', 'SE')), /bokstaver, tall/)
    assert.match(String(validateRegistrationNumber('A'.repeat(41), 'SE')), /40 tegn/)
  })

  it('treats an empty number as absent for every country', () => {
    assert.equal(validateRegistrationNumber('  ', 'SE'), true)
    assert.equal(validateRegistrationNumber(null, 'NO'), true)
  })

  it('builds one key per registration: ISO code + number', () => {
    assert.equal(registrationKey('NO 834 012 952 MVA', 'NO'), 'NO:834012952')
    assert.equal(registrationKey('834012952', null), 'NO:834012952')
    assert.equal(registrationKey('556677-8899', 'SE'), 'SE:5566778899')
    assert.equal(registrationKey('556677 8899', 'SE'), 'SE:5566778899')
    assert.notEqual(registrationKey('123456789', 'SE'), registrationKey('123456789', 'DK'))
    assert.equal(registrationKey('556677-8899', 'Sverige'), null)
    assert.equal(registrationKey('', 'SE'), null)
  })
})

describe('countries', () => {
  it('has all 249 ISO 3166-1 alpha-2 codes with Norwegian names', () => {
    assert.equal(COUNTRY_CODES.length, 249)
    assert.ok(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code)))
    assert.equal(COUNTRY_NAMES_NB.NO, 'Norge')
    assert.equal(COUNTRY_NAMES_NB.SE, 'Sverige')
    assert.equal(COUNTRY_NAMES_NB.DE, 'Tyskland')
  })

  it('excludes reserved and deprecated codes', () => {
    for (const code of ['UK', 'EU', 'XK', 'YU', 'ZZ']) assert.equal(isCountryCode(code), false, code)
  })

  it('puts Norway and the Nordics first, then sorts by Norwegian name', () => {
    assert.deepEqual(COUNTRY_OPTIONS.slice(0, 5).map((o) => o.value), ['NO', 'SE', 'DK', 'FI', 'IS'])
    const rest = COUNTRY_OPTIONS.slice(5).map((o) => COUNTRY_NAMES_NB[o.value])
    assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b, 'nb')))
    assert.equal(new Set(COUNTRY_OPTIONS.map((o) => o.value)).size, 249)
  })
})

describe('normalizeCustomerName', () => {
  it('ignores case, punctuation, spacing and a trailing legal form', () => {
    assert.equal(normalizeCustomerName('Elkjøp Lørenskog AS'), 'elkjøp lørenskog')
    assert.equal(normalizeCustomerName('  elkjøp   lørenskog '), 'elkjøp lørenskog')
    assert.equal(normalizeCustomerName('Elkjøp Lørenskog, AS.'), 'elkjøp lørenskog')
    assert.equal(normalizeCustomerName('Butikk-Huset ASA'), 'butikk huset')
  })

  it('keeps Æ, Ø and Å distinct from their look-alikes', () => {
    assert.notEqual(normalizeCustomerName('Bø Handel'), normalizeCustomerName('Bo Handel'))
  })

  it('does not strip a legal-form word that is the whole name or mid-name', () => {
    assert.equal(normalizeCustomerName('AS'), 'as')
    assert.equal(normalizeCustomerName('Sa Sport'), 'sa sport')
  })

  it('returns null for nothing usable', () => {
    assert.equal(normalizeCustomerName('  ...  '), null)
    assert.equal(normalizeCustomerName(42), null)
  })
})

/* ------------------------------ amounts and base ------------------------------ */

describe('validateSaleAmounts — commission base', () => {
  it('ABOKS AS today (no VAT): base = total − shipping − other charges', () => {
    const result = validateSaleAmounts({
      invoicedTotalOere: 1_250_000,
      shippingOere: 25_000,
      otherExcludedOere: 5_000,
      vatTreatment: 'noVat',
    })
    assert.deepEqual(result, { ok: true, baseOere: 1_220_000 })
  })

  it('optional exclusions default to 0', () => {
    assert.deepEqual(validateSaleAmounts({ invoicedTotalOere: 10_000, vatTreatment: 'noVat' }), {
      ok: true,
      baseOere: 10_000,
    })
  })

  it('future VAT invoice: the explicitly entered VAT is always deducted', () => {
    // 10 000 goods + 2 500 VAT + 500 shipping invoiced = 13 000.
    const result = validateSaleAmounts({
      invoicedTotalOere: 1_300_000,
      shippingOere: 50_000,
      vatTreatment: 'vatDeducted',
      vatAmountOere: 250_000,
    })
    assert.deepEqual(result, { ok: true, baseOere: 1_000_000 })
  })

  it('offers no VAT-inclusive option that skips the deduction', () => {
    assert.deepEqual([...VAT_TREATMENTS], ['noVat', 'vatDeducted'])
    assert.equal(VAT_TREATMENT_OPTIONS.length, 2)
  })

  it('requires a VAT treatment — there is no silent default', () => {
    const result = validateSaleAmounts({ invoicedTotalOere: 10_000, vatTreatment: undefined })
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.field, 'vatTreatment')
  })

  it('requires a VAT amount on a VAT invoice', () => {
    for (const vatAmountOere of [undefined, null, 0]) {
      const result = validateSaleAmounts({ invoicedTotalOere: 10_000, vatTreatment: 'vatDeducted', vatAmountOere })
      assert.equal(!result.ok && result.field, 'vatAmount')
    }
  })

  it('refuses a VAT amount on a sale without VAT', () => {
    const result = validateSaleAmounts({ invoicedTotalOere: 10_000, vatTreatment: 'noVat', vatAmountOere: 2_000 })
    assert.equal(!result.ok && result.field, 'vatAmount')
  })

  it('refuses exclusions larger than the invoice instead of flooring at 0', () => {
    const result = validateSaleAmounts({
      invoicedTotalOere: 10_000,
      shippingOere: 6_000,
      otherExcludedOere: 5_000,
      vatTreatment: 'noVat',
    })
    assert.equal(!result.ok && result.field, 'invoicedTotal')
  })

  it('refuses missing, negative and fractional-øre amounts', () => {
    assert.equal(validateSaleAmounts({ invoicedTotalOere: null, vatTreatment: 'noVat' }).ok, false)
    assert.equal(validateSaleAmounts({ invoicedTotalOere: -1, vatTreatment: 'noVat' }).ok, false)
    assert.equal(validateSaleAmounts({ invoicedTotalOere: 10.5, vatTreatment: 'noVat' }).ok, false)
    const shipping = validateSaleAmounts({ invoicedTotalOere: 100, shippingOere: -1, vatTreatment: 'noVat' })
    assert.equal(!shipping.ok && shipping.field, 'shippingAmount')
  })
})

/* ------------------------------ rate ------------------------------ */

describe('validateRate / isRateOverride', () => {
  it('accepts the standard rate without a reason', () => {
    assert.equal(validateRate({ rate: 25, category: 'businessSale' }), true)
    assert.equal(validateRate({ rate: 15, category: 'retailStore' }), true)
  })

  it('requires an explanation for an override', () => {
    assert.match(String(validateRate({ rate: 20, category: 'businessSale' })), /begrunnelse/)
    assert.match(String(validateRate({ rate: 20, category: 'businessSale', overrideReason: '   ' })), /begrunnelse/)
    assert.equal(validateRate({ rate: 20, category: 'businessSale', overrideReason: 'Avtalt 20 % for rammeavtale' }), true)
  })

  it('compares in basis points, so float noise is not an override', () => {
    assert.equal(isRateOverride(15.000000001, 'retailStore'), false)
    assert.equal(isRateOverride(15.01, 'retailStore'), true)
  })

  it('treats any rate on an unknown category as an override', () => {
    assert.equal(isRateOverride(25, 'online'), true)
  })

  it('refuses missing, negative and above-100 rates', () => {
    assert.match(String(validateRate({ rate: null, category: 'retailStore' })), /fylles ut/)
    assert.match(String(validateRate({ rate: Number.NaN, category: 'retailStore' })), /fylles ut/)
    assert.match(String(validateRate({ rate: -1, category: 'retailStore', overrideReason: 'x' })), /negativ/)
    assert.match(String(validateRate({ rate: 101, category: 'retailStore', overrideReason: 'x' })), /100/)
  })
})

/* ------------------------------ commission ------------------------------ */

describe('calculateReferralCommission', () => {
  it('Forhandlersalg: 15 % of the base', () => {
    assert.deepEqual(calculateReferralCommission({ baseOere: 1_220_000, rate: 15, qualifies: true }), {
      appliedRate: 15,
      commissionAmountOere: 183_000,
    })
  })

  it('Bedriftssalg: 25 % of the base', () => {
    assert.equal(calculateReferralCommission({ baseOere: 1_000_000, rate: 25, qualifies: true }).commissionAmountOere, 250_000)
  })

  it('rounds once, to the nearest øre', () => {
    // 333 øre × 15 % = 49.95 → 50.
    assert.equal(calculateReferralCommission({ baseOere: 333, rate: 15, qualifies: true }).commissionAmountOere, 50)
    // 12,3 % × 10 000 øre = 1 230, despite 12.3 × 100 being 1229.999… in floating point.
    assert.equal(calculateReferralCommission({ baseOere: 10_000, rate: 12.3, qualifies: true }).commissionAmountOere, 1_230)
  })

  it('earns nothing when the administrator has not marked the sale as qualifying', () => {
    assert.deepEqual(calculateReferralCommission({ baseOere: 1_000_000, rate: 25, qualifies: false }), {
      appliedRate: 0,
      commissionAmountOere: 0,
    })
  })

  it('fails closed on an unusable rate or base', () => {
    for (const rate of [null, Number.NaN, -5, 150, '25']) {
      assert.equal(calculateReferralCommission({ baseOere: 10_000, rate, qualifies: true }).commissionAmountOere, 0)
    }
    assert.equal(calculateReferralCommission({ baseOere: -100, rate: 15, qualifies: true }).commissionAmountOere, 0)
    assert.equal(calculateReferralCommission({ baseOere: 10.5, rate: 15, qualifies: true }).commissionAmountOere, 0)
  })

  it('converts to kroner at the storage boundary and keeps the typed rate out of it', () => {
    const commission = calculateReferralCommission({ baseOere: 1_220_000, rate: 15, qualifies: true })
    assert.deepEqual(toReferralSnapshotKr({ baseOere: 1_220_000, commission }), {
      commissionBase: 12_200,
      commissionAmount: 1_830,
    })
  })
})

/* ------------------------------ status ------------------------------ */

describe('deriveCommissionStatus', () => {
  it('is earned only after payment', () => {
    assert.equal(deriveCommissionStatus({ paymentStatus: 'pending', paidOut: false }), 'pending')
    assert.equal(deriveCommissionStatus({ paymentStatus: 'paid', paidOut: false }), 'earned')
    assert.equal(deriveCommissionStatus({ paymentStatus: 'paid', paidOut: true }), 'paid')
  })

  it('reverses on cancellation or refund, paid out or not', () => {
    for (const paidOut of [false, true]) {
      assert.equal(deriveCommissionStatus({ paymentStatus: 'cancelled', paidOut }), 'reversed')
      assert.equal(deriveCommissionStatus({ paymentStatus: 'refunded', paidOut }), 'reversed')
    }
  })

  it('stays pending for anything unknown', () => {
    assert.equal(deriveCommissionStatus({ paymentStatus: undefined, paidOut: false }), 'pending')
    assert.equal(deriveCommissionStatus({ paymentStatus: 'betalt', paidOut: true }), 'pending')
  })
})

describe('validatePaymentTransition', () => {
  const ok = (from: unknown, to: unknown, paidOut = false) =>
    validatePaymentTransition(from, to, { paidOut }) === true

  it('allows any valid status on a new sale', () => {
    assert.equal(ok(undefined, 'paid'), true)
    assert.equal(ok(null, 'pending'), true)
  })

  it('pending → paid or cancelled', () => {
    assert.equal(ok('pending', 'paid'), true)
    assert.equal(ok('pending', 'cancelled'), true)
    assert.equal(ok('pending', 'refunded'), false)
  })

  it('paid → refunded; never cancelled', () => {
    assert.equal(ok('paid', 'refunded'), true)
    assert.equal(ok('paid', 'cancelled'), false)
  })

  it('paid → pending only to undo a mistake before any payout', () => {
    assert.equal(ok('paid', 'pending', false), true)
    assert.equal(ok('paid', 'pending', true), false)
  })

  it('cancelled and refunded are final', () => {
    for (const from of ['cancelled', 'refunded']) {
      for (const to of ['pending', 'paid', 'cancelled', 'refunded'].filter((s) => s !== from)) {
        assert.equal(ok(from, to), false, `${from} → ${to}`)
      }
    }
  })

  it('an unchanged status is always allowed (editing a note)', () => {
    assert.equal(ok('refunded', 'refunded'), true)
  })

  it('refuses an unknown target status', () => {
    assert.equal(ok('pending', 'betalt'), false)
  })
})

describe('clawbackFor', () => {
  it('owes back a commission that was already paid out', () => {
    assert.equal(
      clawbackFor({ previousCommissionStatus: 'paid', nextCommissionStatus: 'reversed', commissionAmountOere: 183_000 }),
      -183_000,
    )
  })

  it('owes nothing for a commission that was only earned or pending', () => {
    for (const previousCommissionStatus of ['earned', 'pending', undefined]) {
      assert.equal(
        clawbackFor({ previousCommissionStatus, nextCommissionStatus: 'reversed', commissionAmountOere: 183_000 }),
        null,
      )
    }
  })

  it('never fires twice: a sale already reversed is not reversed again', () => {
    assert.equal(
      clawbackFor({ previousCommissionStatus: 'reversed', nextCommissionStatus: 'reversed', commissionAmountOere: 183_000 }),
      null,
    )
  })

  it('owes nothing for a zero commission', () => {
    assert.equal(clawbackFor({ previousCommissionStatus: 'paid', nextCommissionStatus: 'reversed', commissionAmountOere: 0 }), null)
  })
})

/* ------------------------------ double commission ------------------------------ */

describe('validatePromoOverlap', () => {
  it('passes when the order earned no promo commission', () => {
    assert.equal(validatePromoOverlap({ promoCommissionOere: 0, referralCommissionOere: 10_000, allowDouble: false, reason: '' }), true)
  })

  it('passes when the referral sale itself earns nothing', () => {
    assert.equal(validatePromoOverlap({ promoCommissionOere: 5_000, referralCommissionOere: 0, allowDouble: false, reason: '' }), true)
  })

  it('requires an explicit decision and a reason for double commission', () => {
    assert.match(
      String(validatePromoOverlap({ promoCommissionOere: 5_000, referralCommissionOere: 10_000, allowDouble: false, reason: 'x' })),
      /Tillat provisjon/,
    )
    assert.match(
      String(validatePromoOverlap({ promoCommissionOere: 5_000, referralCommissionOere: 10_000, allowDouble: true, reason: ' ' })),
      /begrunnelse/,
    )
    assert.equal(
      validatePromoOverlap({ promoCommissionOere: 5_000, referralCommissionOere: 10_000, allowDouble: true, reason: 'Avtalt med partner' }),
      true,
    )
  })
})

/* ------------------------------ totals ------------------------------ */

describe('computeReferralTotals', () => {
  const sale = (category: string, commissionStatus: string, commissionAmountOere: number | null) => ({
    category,
    commissionStatus,
    commissionAmountOere,
  })

  it('splits earned commission by category and counts each status once', () => {
    const totals = computeReferralTotals(
      [
        sale('businessSale', 'earned', 250_000),
        sale('retailStore', 'earned', 15_000),
        sale('retailStore', 'paid', 30_000),
        sale('retailStore', 'pending', 7_000),
        sale('businessSale', 'reversed', 99_000),
      ],
      [],
    )
    assert.deepEqual(totals.earnedUnpaidOere, { businessSale: 250_000, retailStore: 15_000 })
    assert.deepEqual(totals.earnedTotalOere, { businessSale: 250_000, retailStore: 45_000 })
    assert.equal(totals.pendingOere, 7_000)
    assert.equal(totals.paidOutOere, 30_000)
    assert.equal(totals.reversedOere, 99_000)
    assert.equal(totals.payableOere, 265_000)
    assert.equal(totals.unreadableRows, 0)
  })

  it('deducts open clawbacks from the payable amount, never below 0', () => {
    const sales = [sale('retailStore', 'earned', 20_000)]
    assert.equal(computeReferralTotals(sales, [{ amountOere: -5_000, settled: false }]).payableOere, 15_000)
    const owed = computeReferralTotals(sales, [{ amountOere: -50_000, settled: false }])
    assert.equal(owed.payableOere, 0)
    assert.equal(owed.outstandingClawbackOere, 50_000)
  })

  it('ignores clawbacks already settled by a payout', () => {
    const totals = computeReferralTotals([sale('retailStore', 'earned', 20_000)], [{ amountOere: -5_000, settled: true }])
    assert.equal(totals.outstandingClawbackOere, 0)
    assert.equal(totals.payableOere, 20_000)
  })

  it('excludes unreadable rows — they can only shrink the payable amount', () => {
    const totals = computeReferralTotals(
      [
        sale('retailStore', 'earned', 10_000),
        sale('retailStore', 'earned', null),
        sale('retailStore', 'earned', 10.5),
        sale('online', 'earned', 10_000),
        sale('retailStore', 'opptjent', 10_000),
      ],
      [{ amountOere: 500, settled: false }],
    )
    assert.equal(totals.payableOere, 10_000)
    assert.equal(totals.unreadableRows, 5)
  })
})

/* ------------------------------ eligibility and kroner ------------------------------ */

describe('commission eligibility', () => {
  it('defaults Forhandlersalg to «Gir provisjon» and Bedriftssalg to «Gir ikke provisjon»', () => {
    assert.equal(defaultEligibility('retailStore'), 'eligible')
    assert.equal(defaultEligibility('businessSale'), 'notEligible')
    assert.equal(defaultEligibility(undefined), 'notEligible')
  })

  it('recognises only the two stored values', () => {
    assert.equal(isCommissionEligibility('eligible'), true)
    assert.equal(isCommissionEligibility('notEligible'), true)
    assert.equal(isCommissionEligibility(true), false)
  })
})

describe('parseKroner', () => {
  it('converts kroner with up to two decimals to øre', () => {
    assert.deepEqual(parseKroner(12_500), { ok: true, oere: 1_250_000 })
    assert.deepEqual(parseKroner(1_299.9), { ok: true, oere: 129_990 })
    assert.deepEqual(parseKroner(0.1 + 0.2), { ok: true, oere: 30 })
  })

  it('treats empty as absent', () => {
    assert.deepEqual(parseKroner(null), { ok: true, oere: null })
    assert.deepEqual(parseKroner(undefined), { ok: true, oere: null })
    assert.deepEqual(parseKroner(''), { ok: true, oere: null })
  })

  it('refuses more than two decimals instead of rounding', () => {
    assert.deepEqual(parseKroner(10.555), { ok: false })
    assert.deepEqual(parseKroner(Number.NaN), { ok: false })
    assert.deepEqual(parseKroner('100'), { ok: false })
  })
})

/* ------------------------------ referral payout plan ------------------------------ */

describe('planReferralPayout', () => {
  const sale = (id: number, oere: number | null, overrides: Partial<PayoutCandidateSale> = {}): PayoutCandidateSale => ({
    id,
    partnerId: 3,
    paymentStatus: 'paid',
    commissionStatus: 'earned',
    payoutId: null,
    commissionAmountOere: oere,
    ...overrides,
  })
  const plan = (ids: number[], sales: PayoutCandidateSale[], adjustments: { id: number; amountOere: number | null }[] = []) =>
    planReferralPayout({ partnerId: 3, requestedSaleIds: ids, sales, adjustments })

  it('sums the selected sales and deducts every outstanding adjustment', () => {
    const result = plan([12, 11], [sale(11, 183_000), sale(12, 25_000)], [{ id: 2, amountOere: -3_000 }, { id: 1, amountOere: -30_000 }])
    assert.deepEqual(result, {
      ok: true,
      saleIds: [11, 12],
      adjustmentIds: [1, 2],
      grossOere: 208_000,
      deductedOere: 33_000,
      netOere: 175_000,
    })
  })

  it('refuses a net of zero or below, never producing a negative payout', () => {
    assert.equal(!plan([11], [sale(11, 10_000)], [{ id: 1, amountOere: -10_000 }]).ok && 'refused', 'refused')
    const result = plan([11], [sale(11, 10_000)], [{ id: 1, amountOere: -15_000 }])
    assert.equal(!result.ok && result.code, 'adjustments_exceed_selection')
    assert.match(!result.ok ? result.message : '', /150,00 kr.*100,00 kr/)
  })

  it('refuses one bad sale for the whole payout', () => {
    const cases: [PayoutCandidateSale, string][] = [
      [sale(12, 1_000, { payoutId: 9 }), 'sale_not_payable'],
      [sale(12, 1_000, { commissionStatus: 'paid' }), 'sale_not_payable'],
      [sale(12, 1_000, { paymentStatus: 'pending', commissionStatus: 'pending' }), 'sale_not_payable'],
      [sale(12, 1_000, { paymentStatus: 'refunded', commissionStatus: 'reversed' }), 'sale_not_payable'],
      [sale(12, 1_000, { partnerId: 4 }), 'sale_other_partner'],
      [sale(12, 0), 'unreadable_amount'],
      [sale(12, null), 'unreadable_amount'],
    ]
    for (const [bad, code] of cases) {
      const result = plan([11, 12], [sale(11, 1_000), bad])
      assert.equal(!result.ok && result.code, code, JSON.stringify(bad))
      assert.equal(!result.ok && result.saleId, 12)
    }
  })

  it('refuses missing, duplicate, empty and oversized selections', () => {
    assert.equal(!plan([11, 13], [sale(11, 1_000)]).ok && 'x', 'x')
    assert.equal((plan([11, 13], [sale(11, 1_000)]) as { code?: string }).code, 'sale_not_found')
    assert.equal((plan([11, 11], [sale(11, 1_000)]) as { code?: string }).code, 'duplicate_sales')
    assert.equal((plan([], []) as { code?: string }).code, 'no_sales')
    const many = Array.from({ length: 201 }, (_, i) => i + 1)
    assert.equal((plan(many, many.map((id) => sale(id, 1))) as { code?: string }).code, 'too_many_sales')
  })

  it('refuses an unreadable or positive adjustment instead of skipping it', () => {
    assert.equal((plan([11], [sale(11, 1_000)], [{ id: 1, amountOere: null }]) as { code?: string }).code, 'unreadable_amount')
    assert.equal((plan([11], [sale(11, 1_000)], [{ id: 1, amountOere: 500 }]) as { code?: string }).code, 'unreadable_amount')
  })

  it('labels adjustment reasons in Norwegian', () => {
    assert.deepEqual(ADJUSTMENT_REASON_OPTIONS.map((o) => o.label), ['Refundert etter utbetaling', 'Kansellert etter utbetaling'])
    assert.equal(adjustmentReasonFor('cancelled'), 'cancelledAfterPayout')
    assert.equal(adjustmentReasonFor('refunded'), 'refundedAfterPayout')
  })
})

describe('numericToOere (raw numeric columns)', () => {
  it('reads Postgres numeric strings as øre', () => {
    assert.equal(numericToOere('1830'), 183_000)
    assert.equal(numericToOere('1830.50'), 183_050)
    assert.equal(numericToOere('-300'), -30_000)
    assert.equal(numericToOere(12.5), 1_250)
    assert.equal(numericToOere(null), null)
    assert.equal(numericToOere('abc'), null)
  })
})
