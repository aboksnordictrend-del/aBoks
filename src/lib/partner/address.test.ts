import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADDRESS_LINE_MAX,
  DEFAULT_PARTNER_COUNTRY,
  isNorwegianCountry,
  trimText,
  validateOptionalText,
  validatePostalCode,
} from './address'

/** Partner postal address: optional, light validation, Norwegian messages. */

describe('address — country', () => {
  it('defaults new partners to Norge', () => {
    assert.equal(DEFAULT_PARTNER_COUNTRY, 'Norge')
  })

  it('treats Norge in its usual spellings, and an empty country, as Norwegian', () => {
    for (const c of ['Norge', 'norge', ' NORWAY ', 'NO', 'nor', '', null, undefined]) {
      assert.equal(isNorwegianCountry(c), true, String(c))
    }
    for (const c of ['Sverige', 'Danmark', 'Storbritannia', 42]) assert.equal(isNorwegianCountry(c), false, String(c))
  })
})

describe('address — postal code', () => {
  it('is optional', () => {
    for (const v of [undefined, null, '', '   ']) assert.equal(validatePostalCode(v, 'Norge'), true, JSON.stringify(v))
  })

  it('requires exactly four digits for a Norwegian address', () => {
    for (const ok of ['0150', '9990', ' 5003 ']) assert.equal(validatePostalCode(ok, 'Norge'), true, ok)
    for (const bad of ['150', '01500', '0l50', 'AB12']) {
      assert.match(String(validatePostalCode(bad, 'Norge')), /fire siffer/, bad)
    }
    assert.match(String(validatePostalCode('150', null)), /fire siffer/, 'empty country counts as Norway')
  })

  it('accepts common foreign formats and refuses junk', () => {
    for (const ok of ['SW1A 1AA', '10115', '113 51', 'K1A-0B1']) assert.equal(validatePostalCode(ok, 'Utland'), true, ok)
    for (const bad of ['-123', 'ABCDEFGHIJKLM', 'A#1']) {
      assert.match(String(validatePostalCode(bad, 'Utland')), /bokstaver, tall/, bad)
    }
  })

  it('refuses a non-string value', () => {
    assert.match(String(validatePostalCode(150, 'Norge')), /må være tekst/)
  })
})

describe('address — free text', () => {
  it('is optional and capped, with the field named in the message', () => {
    assert.equal(validateOptionalText(undefined, 'Adresse', ADDRESS_LINE_MAX), true)
    assert.equal(validateOptionalText('Storgata 1', 'Adresse', ADDRESS_LINE_MAX), true)
    assert.equal(validateOptionalText(` ${'x'.repeat(ADDRESS_LINE_MAX)} `, 'Adresse', ADDRESS_LINE_MAX), true, 'measured after trimming')
    assert.match(String(validateOptionalText('x'.repeat(ADDRESS_LINE_MAX + 1), 'Adresse', ADDRESS_LINE_MAX)), /^Adresse kan ikke være lengre enn 200 tegn/)
  })

  it('trims strings and leaves other values alone', () => {
    assert.equal(trimText('  Oslo  '), 'Oslo')
    assert.equal(trimText(null), null)
    assert.equal(trimText(5), 5)
  })
})
