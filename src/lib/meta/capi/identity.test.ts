import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'crypto'
import { hashedEmail, hashedPhone, normalizeEmail, normalizePhone, sha256Hex } from './identity'

const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    assert.equal(normalizeEmail('  Ola.Nordmann@Example.NO  '), 'ola.nordmann@example.no')
  })

  it('leaves an already-normalized address alone', () => {
    assert.equal(normalizeEmail('post@aboks.no'), 'post@aboks.no')
  })

  it('rejects empty, missing and whitespace-only values', () => {
    assert.equal(normalizeEmail(''), null)
    assert.equal(normalizeEmail('   '), null)
    assert.equal(normalizeEmail(null), null)
    assert.equal(normalizeEmail(undefined), null)
  })

  it('rejects values that are not addresses, rather than hashing junk', () => {
    assert.equal(normalizeEmail('ola'), null)
    assert.equal(normalizeEmail('@example.no'), null)
    assert.equal(normalizeEmail('ola@'), null)
    assert.equal(normalizeEmail('ola@example'), null)
    assert.equal(normalizeEmail('ola@@example.no'), null)
    assert.equal(normalizeEmail('ola nordmann@example.no'), null)
  })
})

describe('normalizePhone — Norwegian numbers', () => {
  it('accepts the four shapes Kustom returns and produces one value', () => {
    for (const input of ['+47 123 45 678', '(+47) 123-45-678', '0047 12345678', '12345678']) {
      assert.equal(normalizePhone(input), '4712345678', `failed for ${input}`)
    }
  })

  it('adds the country code only to a bare 8-digit number', () => {
    assert.equal(normalizePhone('12345678'), '4712345678')
    // Already carries a country code — must not become 4747…
    assert.equal(normalizePhone('4712345678'), '4712345678')
    assert.ok(!normalizePhone('4712345678')!.startsWith('4747'))
  })

  it('leaves a foreign number alone instead of labelling it Norwegian', () => {
    assert.equal(normalizePhone('+46 70 123 45 67'), '46701234567')
  })

  it('strips every separator, leaving digits only', () => {
    assert.match(normalizePhone('+47 12 34 56 78')!, /^\d+$/)
  })

  it('rejects empty and unusable values', () => {
    assert.equal(normalizePhone(''), null)
    assert.equal(normalizePhone('   '), null)
    assert.equal(normalizePhone('abc'), null)
    assert.equal(normalizePhone('123'), null)
    assert.equal(normalizePhone(null), null)
    assert.equal(normalizePhone(undefined), null)
  })
})

describe('sha256Hex', () => {
  it('is lowercase hex of the UTF-8 bytes', () => {
    const digest = sha256Hex('ola.nordmann@example.no')
    assert.equal(digest, sha('ola.nordmann@example.no'))
    assert.match(digest, /^[0-9a-f]{64}$/)
  })

  it('hashes the NORMALIZED value, so casing cannot split one customer in two', () => {
    assert.equal(hashedEmail('  Ola@Example.NO '), sha('ola@example.no'))
    assert.equal(hashedPhone('+47 123 45 678'), sha('4712345678'))
  })

  it('returns null instead of hashing an unusable value', () => {
    assert.equal(hashedEmail(''), null)
    assert.equal(hashedEmail('not-an-email'), null)
    assert.equal(hashedPhone(''), null)
    assert.equal(hashedPhone('abc'), null)
  })
})
