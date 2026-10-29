import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  GOOGLE_CATEGORY,
  merchantClassification,
  productBrand,
  productKind,
  productSeoTitle,
} from './productIdentity'

// The catalogue as it is published today (titles, slugs and sections as written in Payload).
const CATALOGUE = [
  { title: 'aBoks', slug: 'aboks', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Mini', slug: 'aboks-mini', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Nano', slug: 'aboks-nano', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Vegg', slug: 'aboks-vegg', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Office', slug: 'aboks-office', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks XL', slug: 'aboks-xl', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Spesial', slug: 'aboks-spesial', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'AA-Modul', slug: 'aa-modul', section: 'accessories', brand: 'aBoks', kind: 'accessory' },
  { title: 'AAA-Modul', slug: 'aaa-modul', section: 'accessories', brand: 'aBoks', kind: 'accessory' },
  { title: 'BB-Modul', slug: 'bb-modul', section: 'accessories', brand: 'aBoks', kind: 'accessory' },
  { title: 'GP Ultra AA 10 stk.', slug: 'gp-ultra-plus-aa-10-pakk', section: 'accessories', brand: 'GP', kind: 'battery' },
  { title: 'GP Ultra AAA 10 stk.', slug: 'gp-ultra-plus-aaa-10-pakk', section: 'accessories', brand: 'GP', kind: 'battery' },
] as const

// An accessory from a maker the code does not know.
const UNKNOWN = { title: 'Varta Longlife AA 4 stk.', slug: 'varta-longlife-aa-4', section: 'accessories' }

/** <title> after the root layout's `%s | aBoks` template. */
const rendered = (document: string | { absolute: string }) =>
  typeof document === 'string' ? `${document} | aBoks` : document.absolute

describe('productBrand', () => {
  for (const p of CATALOGUE) {
    it(`${p.title} → ${p.brand}`, () => assert.equal(productBrand(p), p.brand))
  }

  it('never guesses aBoks for an accessory of unknown make', () => {
    assert.equal(productBrand(UNKNOWN), null)
    assert.equal(productKind(UNKNOWN), 'unknown')
  })

  it('does not mistake a word starting with GP for the brand', () => {
    assert.equal(productBrand({ title: 'GPS-holder', slug: 'gps-holder', section: 'accessories' }), null)
  })

  it('recognises an aBoks accessory by its name when it is not in the slug list', () => {
    assert.equal(productBrand({ title: 'aBoks Veggfeste', slug: 'veggfeste', section: 'accessories' }), 'aBoks')
  })

  it('treats a missing section as the main catalogue', () => {
    assert.equal(productKind({ title: 'aBoks', section: null }), 'organizer')
  })
})

describe('productKind', () => {
  for (const p of CATALOGUE) {
    it(`${p.title} is ${p.kind}`, () => assert.equal(productKind(p), p.kind))
  }
})

describe('merchantClassification', () => {
  it('files GP batteries under General Purpose Batteries (Google taxonomy 4928)', () => {
    assert.deepEqual(merchantClassification(CATALOGUE[10]), {
      googleProductCategory: 'Electronics > Electronics Accessories > Power > Batteries > General Purpose Batteries',
      productType: 'Batteries / AA batteries',
    })
    assert.equal(merchantClassification(CATALOGUE[11]).productType, 'Batteries / AAA batteries')
  })

  it('keeps the existing organiser classification for every aBoks product', () => {
    for (const p of CATALOGUE.filter((c) => c.brand === 'aBoks')) {
      assert.deepEqual(merchantClassification(p), {
        googleProductCategory: GOOGLE_CATEGORY.householdSupplies,
        productType: 'Battery organizer / Home organization',
      })
    }
  })

  it('uses the two category paths exactly as Google\'s taxonomy spells them', () => {
    assert.equal(GOOGLE_CATEGORY.householdSupplies, 'Home & Garden > Household Supplies')
    assert.equal(
      GOOGLE_CATEGORY.generalPurposeBatteries,
      'Electronics > Electronics Accessories > Power > Batteries > General Purpose Batteries',
    )
  })
})

describe('productSeoTitle', () => {
  it('keeps the organiser wording for aBoks organisers', () => {
    assert.equal(rendered(productSeoTitle({ title: 'aBoks Vegg', section: 'products' }).document), 'aBoks Vegg – Smart batteriorganisator | aBoks')
  })

  it('calls GP batteries batteries, with the size taken from the name', () => {
    assert.equal(rendered(productSeoTitle(CATALOGUE[10]).document), 'GP Ultra AA 10 stk. – AA-batterier | aBoks')
    assert.equal(rendered(productSeoTitle(CATALOGUE[11]).document), 'GP Ultra AAA 10 stk. – AAA-batterier | aBoks')
    assert.equal(productSeoTitle({ title: 'GP Ultra 9V', section: 'accessories' }).social, 'GP Ultra 9V – batterier')
  })

  it('calls aBoks accessories accessories, without repeating the brand', () => {
    assert.equal(rendered(productSeoTitle(CATALOGUE[7]).document), 'AA-Modul – tilbehør til aBoks')
  })

  it('claims nothing about a product of unknown make', () => {
    assert.equal(rendered(productSeoTitle(UNKNOWN).document), 'Varta Longlife AA 4 stk. | aBoks')
  })

  for (const p of CATALOGUE) {
    it(`${p.title}: never «organiser» unless it is one, brand suffix at most once`, () => {
      const { document, social } = productSeoTitle(p)
      const title = rendered(document)
      assert.ok(title.startsWith(p.title), 'product name preserved')
      assert.equal(title.includes('batteriorganisator'), p.kind === 'organizer')
      assert.ok(title.split('| aBoks').length - 1 <= 1)
      assert.ok(!social.includes('| aBoks'))
    })
  }
})
