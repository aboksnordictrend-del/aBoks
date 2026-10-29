import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProductJsonLd, type ProductJsonLdInput } from './productJsonLd'
import { getEffectivePrice } from './pricing'
import { absoluteUrl } from './site'

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

function input(overrides: Partial<ProductJsonLdInput> = {}): ProductJsonLdInput {
  return {
    title: 'aBoks',
    description: 'Smart batteriboks',
    slug: 'aboks',
    section: 'products',
    image: 'https://example.public.blob.vercel-storage.com/aboks.webp',
    price: 499,
    sale: { salePrice: null, saleStartDate: null, saleEndDate: null },
    hasVariants: true,
    stock: 10,
    reviewSummary: { count: 0, average: 0 },
    ...overrides,
  }
}

const offer = (jsonLd: Record<string, unknown>) => jsonLd.offers as Record<string, string>

describe('buildProductJsonLd — offer price follows the sale window', () => {
  it('uses the regular price when there is no sale', () => {
    assert.equal(offer(buildProductJsonLd(input())).price, '499')
  })

  it('uses the sale price while the sale is running', () => {
    const sale = { salePrice: 399, saleStartDate: iso(-DAY), saleEndDate: iso(DAY) }
    assert.equal(offer(buildProductJsonLd(input({ sale }))).price, '399')
  })

  it('uses the regular price before an upcoming sale starts', () => {
    const sale = { salePrice: 399, saleStartDate: iso(DAY), saleEndDate: iso(2 * DAY) }
    assert.equal(offer(buildProductJsonLd(input({ sale }))).price, '499')
  })

  it('uses the regular price once the sale has ended', () => {
    const sale = { salePrice: 399, saleStartDate: iso(-2 * DAY), saleEndDate: iso(-DAY) }
    assert.equal(offer(buildProductJsonLd(input({ sale }))).price, '499')
  })

  it('honours an open-ended sale on either side', () => {
    assert.equal(offer(buildProductJsonLd(input({ sale: { salePrice: 399, saleStartDate: iso(-DAY) } }))).price, '399')
    assert.equal(offer(buildProductJsonLd(input({ sale: { salePrice: 399, saleEndDate: iso(-DAY) } }))).price, '499')
  })

  it('ignores a sale price that is not below the regular price', () => {
    assert.equal(offer(buildProductJsonLd(input({ sale: { salePrice: 599 } }))).price, '499')
    assert.equal(offer(buildProductJsonLd(input({ sale: { salePrice: 0 } }))).price, '499')
  })

  it('states the same price the page and the Merchant feed compute', () => {
    for (const sale of [
      { salePrice: 399, saleStartDate: iso(-DAY), saleEndDate: iso(DAY) },
      { salePrice: 399, saleStartDate: iso(DAY), saleEndDate: iso(2 * DAY) },
      { salePrice: 399, saleStartDate: iso(-2 * DAY), saleEndDate: iso(-DAY) },
    ]) {
      assert.equal(offer(buildProductJsonLd(input({ sale }))).price, String(getEffectivePrice(499, sale)))
    }
  })
})

describe('buildProductJsonLd — other fields', () => {
  it('keeps NOK and the canonical product URL', () => {
    const jsonLd = buildProductJsonLd(input())
    assert.equal(offer(jsonLd).priceCurrency, 'NOK')
    assert.equal(jsonLd.url, absoluteUrl('/produkter/aboks'))
    assert.equal(offer(jsonLd).url, absoluteUrl('/produkter/aboks'))
  })

  it('reports availability as before: flat InStock with variants, real stock without', () => {
    assert.equal(offer(buildProductJsonLd(input({ hasVariants: true, stock: 0 }))).availability, 'https://schema.org/InStock')
    assert.equal(offer(buildProductJsonLd(input({ hasVariants: false, stock: 0 }))).availability, 'https://schema.org/OutOfStock')
    assert.equal(offer(buildProductJsonLd(input({ hasVariants: false, stock: 3 }))).availability, 'https://schema.org/InStock')
  })

  it('states the same brand as the Merchant feed: aBoks for its own products, GP for GP', () => {
    assert.deepEqual(buildProductJsonLd(input()).brand, { '@type': 'Brand', name: 'aBoks' })
    assert.deepEqual(
      buildProductJsonLd(input({ title: 'AA-Modul', slug: 'aa-modul', section: 'accessories' })).brand,
      { '@type': 'Brand', name: 'aBoks' },
    )
    assert.deepEqual(
      buildProductJsonLd(input({ title: 'GP Ultra AA 10 stk.', slug: 'gp-ultra-plus-aa-10-pakk', section: 'accessories' })).brand,
      { '@type': 'Brand', name: 'GP' },
    )
  })

  it('states no brand for an accessory of unknown make', () => {
    const jsonLd = buildProductJsonLd(input({ title: 'Varta Longlife AA 4 stk.', slug: 'varta-aa', section: 'accessories' }))
    assert.equal(jsonLd.brand, undefined)
  })

  it('never states a SKU or a rating that does not exist', () => {
    const jsonLd = buildProductJsonLd(input())
    assert.equal(jsonLd.sku, undefined)
    assert.equal(jsonLd.aggregateRating, undefined)
    const rated = buildProductJsonLd(input({ reviewSummary: { count: 3, average: 4.666 } }))
    assert.deepEqual(rated.aggregateRating, {
      '@type': 'AggregateRating',
      ratingValue: '4.7',
      reviewCount: 3,
      bestRating: 5,
      worstRating: 1,
    })
  })

  it('omits the image when there is none', () => {
    assert.equal(buildProductJsonLd(input({ image: undefined })).image, undefined)
  })
})
