import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { metaSyncEndpoint } from './metaSync'

// Build a minimal PayloadRequest double. `user` drives the auth gate; `json` returns the
// request body. `payload.logger` is needed because error branches log server-side.
function makeReq(user: unknown, body: unknown = {}): PayloadRequest {
  return {
    user,
    json: async () => body,
    payload: { logger: { error() {}, warn() {}, info() {} } },
    headers: new Headers(),
  } as unknown as PayloadRequest
}

async function call(user: unknown, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await metaSyncEndpoint.handler!(makeReq(user, body))
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

describe('metaSync endpoint — authorization', () => {
  beforeEach(() => {
    // Force getMetaConfig() to throw MetaConfigError so the admin path never hits the
    // network: it proves the request passed the auth gate and stopped at config.
    delete process.env.META_ACCESS_TOKEN
    delete process.env.META_AD_ACCOUNT_ID
  })

  it('rejects an unauthenticated request with 401', async () => {
    const { status, json } = await call(null)
    assert.equal(status, 401)
    assert.equal(json.success, false)
  })

  it('rejects an authenticated non-admin (editor) with 403', async () => {
    const { status, json } = await call({ role: 'editor', email: 'e@x.no' })
    assert.equal(status, 403)
    assert.equal(json.success, false)
    // The role is checked server-side on req.user — never trusted from the client.
    assert.match(String(json.error), /administrator/i)
  })

  it('lets an admin through the auth gate (fails later at config, not on auth)', async () => {
    const { status } = await call({ role: 'admin', email: 'a@x.no' })
    // Not 401/403 → auth passed. 500 because META_* env is unset (MetaConfigError).
    assert.notEqual(status, 401)
    assert.notEqual(status, 403)
    assert.equal(status, 500)
  })

  it('does not trust a client-supplied role field over req.user', async () => {
    // A non-admin user object that also carries a spoofed admin-ish payload must still 403.
    const { status } = await call({ role: 'editor', isAdmin: true })
    assert.equal(status, 403)
  })

  it('rejects an invalid sync mode with 400', async () => {
    const { status } = await call({ role: 'admin' }, { mode: 'partial' })
    assert.equal(status, 400)
  })

  it('accepts the two valid modes (passes validation, stops at config)', async () => {
    for (const mode of ['incremental', 'full']) {
      const { status } = await call({ role: 'admin' }, { mode })
      assert.equal(status, 500, `${mode} reached config, not a validation error`)
    }
  })

  it('ignores client-supplied dates — the window is server-resolved', async () => {
    // since/until in the body must not cause a 400 nor influence anything.
    const { status } = await call({ role: 'admin' }, { since: '2026-01-01', until: '2026-01-02' })
    assert.equal(status, 500) // config error, i.e. it got past body parsing
  })

  it('never leaks a token or user object in the response body', async () => {
    const { json } = await call({ role: 'editor', email: 'secret@x.no' })
    assert.ok(!JSON.stringify(json).includes('secret@x.no'))
  })
})
