import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { productBrand, productKind, productSeoTitle } from './productIdentity'

// The catalogue as it is published today (titles and sections as written in Payload).
const CATALOGUE = [
  { title: 'aBoks', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Mini', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Nano', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Vegg', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Office', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks XL', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'aBoks Spesial', section: 'products', brand: 'aBoks', kind: 'organizer' },
  { title: 'AA-Modul', section: 'accessories', brand: 'aBoks', kind: 'accessory' },
  { title: 'AAA-Modul', section: 'accessories', brand: 'aBoks', kind: 'accessory' },
  { title: 'BB-Modul', section: 'accessories', brand: 'aBoks', kind: 'accessory' },
  { title: 'GP Ultra AA 10 stk.', section: 'accessories', brand: 'GP', kind: 'battery' },
  { title: 'GP Ultra AAA 10 stk.', section: 'accessories', brand: 'GP', kind: 'battery' },
] as const

/** <title> after the root layout's `%s | aBoks` template. */
const rendered = (document: string | { absolute: string }) =>
  typeof document === 'string' ? `${document} | aBoks` : document.absolute

describe('productBrand', () => {
  for (const p of CATALOGUE) {
    it(`${p.title} → ${p.brand}`, () => assert.equal(productBrand(p), p.brand))
  }

  it('does not mistake a word starting with GP for the brand', () => {
    assert.equal(productBrand({ title: 'GPS-holder', section: 'accessories' }), 'aBoks')
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

describe('productSeoTitle', () => {
  it('keeps the organiser wording for aBoks organisers', () => {
    assert.equal(rendered(productSeoTitle({ title: 'aBoks Vegg', section: 'products' }).document), 'aBoks Vegg – Smart batteriorganisator | aBoks')
  })

  it('calls GP batteries batteries, with the size taken from the name', () => {
    assert.equal(rendered(productSeoTitle({ title: 'GP Ultra AA 10 stk.', section: 'accessories' }).document), 'GP Ultra AA 10 stk. – AA-batterier | aBoks')
    assert.equal(rendered(productSeoTitle({ title: 'GP Ultra AAA 10 stk.', section: 'accessories' }).document), 'GP Ultra AAA 10 stk. – AAA-batterier | aBoks')
    assert.equal(productSeoTitle({ title: 'GP Ultra 9V', section: 'accessories' }).social, 'GP Ultra 9V – batterier')
  })

  it('calls aBoks accessories accessories, without repeating the brand', () => {
    assert.equal(rendered(productSeoTitle({ title: 'AA-Modul', section: 'accessories' }).document), 'AA-Modul – tilbehør til aBoks')
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
