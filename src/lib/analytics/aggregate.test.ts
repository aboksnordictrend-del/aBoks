import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildWarnings, isMissingVariantLink } from './aggregate'
import { computeProducts } from './calc'
import type { AnalyticsLine, AnalyticsOrder } from './types'

/**
 * The shop's real shape: `aBoks` (id 1) is sold in colours, `GP Ultra AA` (id 5) is a battery
 * multipack with no variants at all. Both live in the catalogue; only the first has rows in
 * `product-variants`.
 */
const VARIANT_BASED = new Set(['1'])

function line(over: Partial<AnalyticsLine> = {}): AnalyticsLine {
  return {
    productId: '1',
    productName: 'aBoks',
    quantity: 1,
    unitPrice: 449,
    unitCost: 100,
    costEstimated: false,
    vatRate: 0,
    vatEstimated: false,
    ...over,
  }
}

function order(lines: AnalyticsLine[], id = 'o1'): AnalyticsOrder {
  return {
    id,
    orderNumber: `AB-0000${id}`,
    status: 'shipped',
    date: '2026-08-22T10:00:00.000Z',
    shippingCharged: 0,
    discountAmount: 0,
    actualShippingCost: 0,
    paymentFee: 0,
    extraCosts: 0,
    lines,
  }
}

const noVariantWarning = (orders: AnalyticsOrder[], ids: ReadonlySet<string> | null) =>
  buildWarnings(orders, {
    paidAtMissing: 0,
    paidOnly: true,
    settings: null,
    expenses: [],
    cacUnkeyed: 0,
    variantBasedProductIds: ids,
  }).find((w) => w.code === 'no-variant')

/** A plain accessory line, exactly as order AB-037596 stores its two battery packs. */
const accessoryLine = line({ productId: '5', productName: 'GP Ultra AA', variantName: '' })

describe('isMissingVariantLink', () => {
  it('does not flag a variant-less product sold without a variant', () => {
    assert.equal(isMissingVariantLink(accessoryLine, VARIANT_BASED), false)
  })

  it('does not flag a variant-based product that has its variant link', () => {
    assert.equal(
      isMissingVariantLink(line({ variantId: '3', variantName: 'Olivengrønn' }), VARIANT_BASED),
      false,
    )
  })

  it('flags a variant-based product whose variant link is gone', () => {
    assert.equal(isMissingVariantLink(line({ variantName: 'Olivengrønn' }), VARIANT_BASED), true)
  })

  it('flags a variant-based product even with no colour snapshot left', () => {
    assert.equal(isMissingVariantLink(line(), VARIANT_BASED), true)
  })

  it('falls back to the colour snapshot when the product link is gone', () => {
    const legacy = { productName: 'aBoks', quantity: 1 } as AnalyticsLine
    assert.equal(isMissingVariantLink({ ...legacy, variantName: 'Sort' }, VARIANT_BASED), true)
    assert.equal(isMissingVariantLink({ ...legacy, colorName: 'Sort' }, VARIANT_BASED), true)
    assert.equal(isMissingVariantLink(legacy, VARIANT_BASED), false)
  })

  it('falls back to the colour snapshot when the catalogue lookup failed', () => {
    assert.equal(isMissingVariantLink(accessoryLine, null), false)
    assert.equal(isMissingVariantLink(line({ variantName: 'Sort' }), null), true)
  })
})

describe('buildWarnings — no-variant', () => {
  it('stays silent for an order of variant-less accessories', () => {
    const accessories = order([
      accessoryLine,
      line({ productId: '6', productName: 'GP Ultra AAA', variantName: '' }),
    ])
    assert.equal(noVariantWarning([accessories], VARIANT_BASED), undefined)
  })

  it('stays silent when every variant-based line is linked', () => {
    const linked = order([line({ variantId: '3', variantName: 'Olivengrønn' })])
    assert.equal(noVariantWarning([linked], VARIANT_BASED), undefined)
  })

  it('counts only the variant-based line in a mixed order', () => {
    const mixed = order([
      line({ variantId: '1', variantName: 'Sort' }),
      accessoryLine,
      line({ variantName: 'Olivengrønn' }),
    ])
    const warning = noVariantWarning([mixed], VARIANT_BASED)
    assert.equal(warning?.count, 1)
    assert.match(warning?.message ?? '', /^1 ordrelinjer mangler variantkobling/)
  })
})

describe('sales figures are unaffected by the warning rule', () => {
  it('aggregates a mixed order into one row per product and per variant', () => {
    const mixed = order([
      line({ variantId: '1', variantName: 'Sort' }),
      { ...accessoryLine, unitPrice: 99, unitCost: 40 },
    ])
    const products = computeProducts([mixed])

    const aboks = products.find((p) => p.productId === '1')
    assert.equal(aboks?.unitsSold, 1)
    assert.equal(aboks?.variants.length, 1)
    assert.equal(aboks?.variants[0]?.variantId, '1')

    const gp = products.find((p) => p.productId === '5')
    assert.equal(gp?.unitsSold, 1)
    assert.equal(gp?.revenueGross, 99)
    // A variant-less product still gets exactly one row, keyed on the product itself.
    assert.equal(gp?.variants.length, 1)
    assert.equal(gp?.variants[0]?.variantId, undefined)
  })
})
