import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCT_NAV_ORDER, buildShopMenu, nextExpandedMenu, toProductNavLinks } from './navigation'

/**
 * The burger menu's HANDLE column. What matters here is that the two submenus are built from
 * whatever Payload returns — no product name is written down in the menu itself — and that
 * only one of them can be open at a time.
 */

const CATALOGUE = [
  { title: 'aBoks Nano', slug: 'aboks-nano' },
  { title: 'aBoks', slug: 'aboks' },
  { title: 'aBoks Vegg', slug: 'aboks-vegg' },
  { title: 'aBoks Mini', slug: 'aboks-mini' },
]

describe('toProductNavLinks', () => {
  it('points every product at its own page', () => {
    assert.deepEqual(toProductNavLinks([{ title: 'AA-Modul', slug: 'aa-modul' }]), [
      { label: 'AA-Modul', href: '/produkter/aa-modul' },
    ])
  })

  it('puts the main catalogue in its running order', () => {
    assert.deepEqual(
      toProductNavLinks(CATALOGUE, PRODUCT_NAV_ORDER).map((l) => l.label),
      ['aBoks', 'aBoks Mini', 'aBoks Nano', 'aBoks Vegg'],
    )
  })

  it('keeps a product the order says nothing about, last and in CMS order', () => {
    const links = toProductNavLinks([...CATALOGUE, { title: 'aBoks Maxi', slug: 'aboks-maxi' }], PRODUCT_NAV_ORDER)
    assert.equal(links.at(-1)?.label, 'aBoks Maxi')
  })

  it('drops a row with nothing to link to', () => {
    assert.deepEqual(toProductNavLinks([{ title: 'Uten slug', slug: '' }, { title: null, slug: 'x' }]), [])
  })
})

describe('buildShopMenu', () => {
  const menu = buildShopMenu(toProductNavLinks(CATALOGUE, PRODUCT_NAV_ORDER), [
    { label: 'AA-Modul', href: '/produkter/aa-modul' },
  ])

  it('is the three rows of the HANDLE column', () => {
    assert.deepEqual(menu.map((e) => e.label), ['Produkter', 'Tilbehør', 'Handlekurv'])
  })

  it('keeps both headings as links to their own listing pages', () => {
    assert.equal(menu[0].href, '/produkter')
    assert.equal(menu[1].href, '/tilbehor')
  })

  it('opens the products submenu with «Alle produkter», then the catalogue', () => {
    assert.deepEqual(menu[0].children?.map((c) => c.label), [
      'Alle produkter', 'aBoks', 'aBoks Mini', 'aBoks Nano', 'aBoks Vegg',
    ])
  })

  it('fills the accessories submenu from the accessories catalogue alone', () => {
    assert.deepEqual(menu[1].children, [{ label: 'AA-Modul', href: '/produkter/aa-modul' }])
  })

  it('leaves Tilbehør without a submenu while nothing is published there', () => {
    assert.deepEqual(buildShopMenu([], [])[1].children, [])
  })

  it('leaves Handlekurv a plain row', () => {
    assert.equal(menu[2].children, undefined)
    assert.equal(menu[2].href, '/handlekurv')
  })
})

describe('nextExpandedMenu', () => {
  it('opens a submenu from closed', () => {
    assert.equal(nextExpandedMenu(null, 'Produkter'), 'Produkter')
  })

  it('closes the other one instead of showing two product lists at once', () => {
    assert.equal(nextExpandedMenu('Produkter', 'Tilbehør'), 'Tilbehør')
  })

  it('closes the open one when it is pressed again', () => {
    assert.equal(nextExpandedMenu('Tilbehør', 'Tilbehør'), null)
  })
})
