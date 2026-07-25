import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateRawToken,
  hashToken,
  hashesEqual,
  isWellFormedToken,
  reviewInvitationUrl,
  invitationExpiry,
  INVITATION_TTL_DAYS,
} from './reviewToken'

describe('reviewToken', () => {
  it('generates high-entropy, well-formed, unique tokens', () => {
    const a = generateRawToken()
    const b = generateRawToken()
    assert.notEqual(a, b)
    assert.ok(isWellFormedToken(a))
    assert.ok(a.length >= 40)
    // base64url alphabet only
    assert.match(a, /^[A-Za-z0-9_-]+$/)
  })

  it('hashes deterministically to a 64-char hex sha-256', () => {
    const raw = generateRawToken()
    const h1 = hashToken(raw)
    const h2 = hashToken(raw)
    assert.equal(h1, h2)
    assert.match(h1, /^[0-9a-f]{64}$/)
    assert.notEqual(h1, hashToken(generateRawToken()))
  })

  it('never stores the raw token in its hash', () => {
    const raw = generateRawToken()
    assert.ok(!hashToken(raw).includes(raw))
  })

  it('rejects malformed tokens before any lookup', () => {
    assert.equal(isWellFormedToken(''), false)
    assert.equal(isWellFormedToken('short'), false)
    assert.equal(isWellFormedToken('has spaces and !!!'), false)
    assert.equal(isWellFormedToken(null), false)
    assert.equal(isWellFormedToken(123), false)
  })

  it('compares hashes in constant time correctly', () => {
    const raw = generateRawToken()
    assert.ok(hashesEqual(hashToken(raw), hashToken(raw)))
    assert.ok(!hashesEqual(hashToken(raw), hashToken(generateRawToken())))
  })

  it('builds an absolute review URL from the configured base', () => {
    const raw = generateRawToken()
    assert.equal(reviewInvitationUrl(raw, 'https://aboks.no'), `https://aboks.no/anmeldelse/${raw}`)
    // trailing slash tolerated
    assert.equal(reviewInvitationUrl(raw, 'https://aboks.no/'), `https://aboks.no/anmeldelse/${raw}`)
  })

  it('computes a 30-day expiry by default', () => {
    const from = new Date('2026-07-01T00:00:00.000Z')
    const exp = new Date(invitationExpiry(INVITATION_TTL_DAYS, from))
    const days = (exp.getTime() - from.getTime()) / (24 * 3600 * 1000)
    assert.equal(days, 30)
  })
})
