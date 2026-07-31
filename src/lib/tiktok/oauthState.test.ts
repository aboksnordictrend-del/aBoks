import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { STATE_TTL_MS, createOAuthState, verifyOAuthState } from './oauthState'

const SECRET = 'payload-secret-used-only-in-this-test-0123456789'
const OTHER_SECRET = 'a-completely-different-server-secret-9876543210'
const NOW = Date.UTC(2026, 6, 31, 10, 0, 0)

describe('createOAuthState', () => {
  it('produces a body.signature pair', () => {
    const state = createOAuthState('42', SECRET, NOW)
    assert.equal(state.split('.').length, 2)
  })

  it('never embeds the signing secret', () => {
    assert.ok(!createOAuthState('42', SECRET, NOW).includes(SECRET))
  })

  it('is URL-safe, so it survives a redirect through TikTok unchanged', () => {
    const state = createOAuthState('42', SECRET, NOW)
    assert.equal(encodeURIComponent(state), state)
  })

  it('differs between two calls in the same millisecond (per-flow nonce)', () => {
    assert.notEqual(createOAuthState('42', SECRET, NOW), createOAuthState('42', SECRET, NOW))
  })
})

describe('verifyOAuthState', () => {
  it('accepts a freshly minted state and returns the admin it was minted for', () => {
    const result = verifyOAuthState(createOAuthState('42', SECRET, NOW), SECRET, NOW + 1000)
    assert.equal(result.ok, true)
    assert.equal(result.ok && result.payload.userId, '42')
  })

  it('rejects a missing or non-string state', () => {
    for (const bad of [undefined, null, '', 42, {}]) {
      const result = verifyOAuthState(bad, SECRET, NOW)
      assert.equal(result.ok, false)
      assert.equal(!result.ok && result.reason, 'malformed')
    }
  })

  it('rejects a state with no signature at all', () => {
    const result = verifyOAuthState('just-a-body', SECRET, NOW)
    assert.equal(result.ok, false)
  })

  it('rejects a tampered payload — the signature no longer matches', () => {
    const state = createOAuthState('42', SECRET, NOW)
    const [body, signature] = state.split('.')
    const forgedBody = Buffer.from(
      JSON.stringify({ userId: '999', issuedAtMs: NOW, nonce: 'x' }),
      'utf8',
    ).toString('base64url')
    const result = verifyOAuthState(`${forgedBody}.${signature}`, SECRET, NOW)
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.reason, 'signature')
    assert.notEqual(forgedBody, body)
  })

  it('rejects a state signed with a different secret', () => {
    const result = verifyOAuthState(createOAuthState('42', OTHER_SECRET, NOW), SECRET, NOW)
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.reason, 'signature')
  })

  it('rejects a state past its TTL', () => {
    const state = createOAuthState('42', SECRET, NOW)
    assert.equal(verifyOAuthState(state, SECRET, NOW + STATE_TTL_MS - 1).ok, true)
    const expired = verifyOAuthState(state, SECRET, NOW + STATE_TTL_MS + 1)
    assert.equal(expired.ok, false)
    assert.equal(!expired.ok && expired.reason, 'expired')
  })

  it('rejects a state issued in the future beyond the clock-skew allowance', () => {
    const state = createOAuthState('42', SECRET, NOW + 10 * 60_000)
    const result = verifyOAuthState(state, SECRET, NOW)
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.reason, 'expired')
  })

  it('rejects a correctly signed body that is not the expected payload shape', () => {
    // Signed with the real secret, so the signature check passes — the shape check must not.
    const body = Buffer.from(JSON.stringify({ hello: 'world' }), 'utf8').toString('base64url')
    const signature = createHmac('sha256', `tiktok-oauth-state:${SECRET}`)
      .update(body)
      .digest('base64url')
    const result = verifyOAuthState(`${body}.${signature}`, SECRET, NOW)
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.reason, 'malformed')
  })
})
