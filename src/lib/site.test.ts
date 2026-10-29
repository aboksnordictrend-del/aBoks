import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PRODUCTION_SITE_URL, normalizeSiteOrigin, resolveSiteUrl } from './site'

describe('resolveSiteUrl', () => {
  it('always answers https://aboks.no on the live site, whatever the variable says', () => {
    for (const NEXT_PUBLIC_SERVER_URL of [
      undefined,
      '',
      'http://localhost:3000',
      'https://www.aboks.no',
      'https://aboks.no/',
      'not a url',
    ]) {
      assert.equal(resolveSiteUrl({ VERCEL_ENV: 'production', NEXT_PUBLIC_SERVER_URL }), PRODUCTION_SITE_URL)
      assert.equal(
        resolveSiteUrl({ NEXT_PUBLIC_VERCEL_ENV: 'production', NEXT_PUBLIC_SERVER_URL }),
        PRODUCTION_SITE_URL,
      )
    }
  })

  it('keeps the configured origin in local development', () => {
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' }), 'http://localhost:3000')
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SERVER_URL: 'http://localhost:3001/' }), 'http://localhost:3001')
  })

  it('uses the configured origin on Preview', () => {
    assert.equal(
      resolveSiteUrl({ VERCEL_ENV: 'preview', NEXT_PUBLIC_SERVER_URL: 'https://aboks.no' }),
      'https://aboks.no',
    )
  })

  it('falls back to production when nothing usable is configured', () => {
    assert.equal(resolveSiteUrl({}), PRODUCTION_SITE_URL)
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SERVER_URL: '   ' }), PRODUCTION_SITE_URL)
    assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SERVER_URL: 'aboks.no' }), PRODUCTION_SITE_URL)
  })
})

describe('normalizeSiteOrigin', () => {
  it('strips trailing slashes and paths so joined URLs never get a double slash', () => {
    assert.equal(normalizeSiteOrigin('https://aboks.no/'), 'https://aboks.no')
    assert.equal(normalizeSiteOrigin('https://aboks.no//'), 'https://aboks.no')
    assert.equal(normalizeSiteOrigin(' https://aboks.no/some/path '), 'https://aboks.no')
  })

  it('rejects anything that is not an absolute http(s) URL', () => {
    assert.equal(normalizeSiteOrigin(undefined), null)
    assert.equal(normalizeSiteOrigin('ftp://aboks.no'), null)
    assert.equal(normalizeSiteOrigin('//aboks.no'), null)
  })
})
