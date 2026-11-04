import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimitSubject, trustedClientIp } from './clientIp'

const h = (init: Record<string, string>) => new Headers(init)
const VERCEL = { VERCEL: '1' }

describe('trustedClientIp', () => {
  it('on Vercel prefers the platform header over a client-supplied x-forwarded-for', () => {
    assert.equal(trustedClientIp(h({ 'x-vercel-forwarded-for': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' }), VERCEL), '203.0.113.7')
    assert.equal(trustedClientIp(h({ 'x-real-ip': '203.0.113.8', 'x-forwarded-for': '1.1.1.1' }), VERCEL), '203.0.113.8')
  })

  it('takes the first address of a list', () => {
    assert.equal(trustedClientIp(h({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }), {}), '198.51.100.1')
  })

  it('never lets arbitrary header text into a key', () => {
    for (const bad of ['', 'not-an-ip', '1.2.3.4:80', '<script>', '999.1.1.1', 'a'.repeat(5000)]) {
      assert.equal(trustedClientIp(h({ 'x-vercel-forwarded-for': bad, 'x-forwarded-for': bad }), VERCEL), 'unknown', bad)
    }
    assert.equal(trustedClientIp(h({}), {}), 'unknown')
  })

  it('accepts IPv6', () => {
    assert.equal(trustedClientIp(h({ 'x-vercel-forwarded-for': '2001:db8::1' }), VERCEL), '2001:db8::1')
  })
})

describe('rateLimitSubject', () => {
  it('keeps IPv4 as is', () => assert.equal(rateLimitSubject('203.0.113.7'), '203.0.113.7'))

  it('groups IPv6 by /64, so rotating inside one prefix does not help', () => {
    const a = rateLimitSubject('2001:db8:1:2:aaaa::1')
    assert.equal(a, '2001:0db8:0001:0002::/64')
    assert.equal(rateLimitSubject('2001:db8:1:2:ffff:ffff:ffff:ffff'), a)
    assert.notEqual(rateLimitSubject('2001:db8:1:3::1'), a)
    assert.equal(rateLimitSubject('::1'), '0000:0000:0000:0000::/64')
  })

  it('treats IPv4-mapped IPv6 as the IPv4 address', () => {
    assert.equal(rateLimitSubject('::ffff:203.0.113.7'), '203.0.113.7')
    assert.equal(rateLimitSubject('::ffff:cb00:7107'), '203.0.113.7')
  })

  it('maps anything else to unknown', () => {
    assert.equal(rateLimitSubject('unknown'), 'unknown')
    assert.equal(rateLimitSubject('x'), 'unknown')
  })
})
