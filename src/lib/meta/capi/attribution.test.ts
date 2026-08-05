import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { clientIpFromHeaders, fbcFromFbclid, isUsableIp, resolveMetaAttribution } from './attribution'

const lookup = (values: Record<string, string>) => (name: string) => values[name] ?? null

describe('clientIpFromHeaders', () => {
  it('prefers Vercel’s own header over the spoofable x-forwarded-for', () => {
    const ip = clientIpFromHeaders(
      lookup({
        'x-vercel-forwarded-for': '84.208.10.5',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      }),
    )
    assert.equal(ip, '84.208.10.5')
  })

  it('keeps only the first address of a proxy chain, never the whole list', () => {
    const ip = clientIpFromHeaders(lookup({ 'x-forwarded-for': '84.208.10.5, 10.0.0.1, 172.16.3.9' }))
    assert.equal(ip, '84.208.10.5')
    assert.ok(!ip!.includes(','))
  })

  it('falls back through the header order', () => {
    assert.equal(clientIpFromHeaders(lookup({ 'x-real-ip': '84.208.10.5' })), '84.208.10.5')
  })

  it('strips an IPv4 port and IPv6 brackets', () => {
    assert.equal(clientIpFromHeaders(lookup({ 'x-real-ip': '84.208.10.5:51234' })), '84.208.10.5')
    assert.equal(clientIpFromHeaders(lookup({ 'x-real-ip': '[2001:db8::1]' })), '2001:db8::1')
  })

  it('skips loopback and private addresses instead of storing a fake customer IP', () => {
    assert.equal(clientIpFromHeaders(lookup({ 'x-real-ip': '127.0.0.1' })), null)
    assert.equal(clientIpFromHeaders(lookup({ 'x-real-ip': '::1' })), null)
    assert.equal(clientIpFromHeaders(lookup({ 'x-forwarded-for': '10.0.0.4, 84.208.10.5' })), '84.208.10.5')
  })

  it('returns null when no header carries anything usable', () => {
    assert.equal(clientIpFromHeaders(lookup({})), null)
    assert.equal(clientIpFromHeaders(lookup({ 'x-forwarded-for': 'unknown' })), null)
    assert.equal(clientIpFromHeaders(lookup({ 'x-real-ip': '999.1.1.1' })), null)
  })
})

describe('isUsableIp', () => {
  it('accepts public IPv4 and IPv6', () => {
    assert.ok(isUsableIp('84.208.10.5'))
    assert.ok(isUsableIp('2001:db8::1'))
  })

  it('rejects malformed values', () => {
    assert.ok(!isUsableIp(''))
    assert.ok(!isUsableIp('1.2.3'))
    assert.ok(!isUsableIp('256.1.1.1'))
    assert.ok(!isUsableIp('hello'))
  })
})

describe('fbcFromFbclid', () => {
  it('builds Meta’s fb.1.<ts>.<fbclid> format', () => {
    assert.equal(fbcFromFbclid('AbCd_123-xyz', 1_700_000_000_000), 'fb.1.1700000000000.AbCd_123-xyz')
  })

  it('rejects empty, absent and implausible values', () => {
    assert.equal(fbcFromFbclid('', 1), null)
    assert.equal(fbcFromFbclid(null, 1), null)
    assert.equal(fbcFromFbclid(undefined, 1), null)
    assert.equal(fbcFromFbclid('a b', 1), null)
    assert.equal(fbcFromFbclid('x'.repeat(501), 1), null)
  })
})

describe('resolveMetaAttribution', () => {
  const headers = lookup({
    'x-vercel-forwarded-for': '84.208.10.5',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
  })

  it('collects both cookies, the IP and the user agent', () => {
    const attribution = resolveMetaAttribution({
      getCookie: lookup({ _fbp: 'fb.1.1700000000000.1234567890', _fbc: 'fb.1.1700000000000.AbCd' }),
      getHeader: headers,
    })

    assert.deepEqual(attribution, {
      fbp: 'fb.1.1700000000000.1234567890',
      fbc: 'fb.1.1700000000000.AbCd',
      clientIpAddress: '84.208.10.5',
      clientUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
    })
  })

  it('rebuilds fbc from fbclid when the cookie is missing', () => {
    const attribution = resolveMetaAttribution({
      getCookie: lookup({}),
      getHeader: headers,
      fbclid: 'AbCd_123',
      nowMs: 1_700_000_000_000,
    })
    assert.equal(attribution.fbc, 'fb.1.1700000000000.AbCd_123')
  })

  it('prefers the real cookie over a reconstructed one', () => {
    const attribution = resolveMetaAttribution({
      getCookie: lookup({ _fbc: 'fb.1.1600000000000.FromCookie' }),
      getHeader: headers,
      fbclid: 'FromUrl',
      nowMs: 1_700_000_000_000,
    })
    assert.equal(attribution.fbc, 'fb.1.1600000000000.FromCookie')
  })

  it('omits keys entirely when the browser offered nothing', () => {
    const attribution = resolveMetaAttribution({ getCookie: lookup({}), getHeader: lookup({}) })
    assert.deepEqual(attribution, {})
  })

  it('drops a cookie that is not a plain token', () => {
    const attribution = resolveMetaAttribution({
      getCookie: lookup({ _fbp: 'fb.1.1;drop table', _fbc: 'x'.repeat(300) }),
      getHeader: lookup({}),
    })
    assert.deepEqual(attribution, {})
  })
})
