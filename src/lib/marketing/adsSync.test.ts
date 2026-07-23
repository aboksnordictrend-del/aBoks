import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { callAdsSync, type AdsSyncResult } from './adsSync'

type FetchLike = typeof globalThis.fetch
const savedFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = savedFetch
})

function stubFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return {
      ok,
      status,
      json: async () => body,
    }
  }) as unknown as FetchLike
  return calls
}

const okResult: AdsSyncResult = {
  success: true,
  mode: 'incremental',
  initialSync: false,
  period: { since: '2026-07-10', until: '2026-07-23' },
  fetchedDays: 14,
  created: 2,
  updated: 12,
  unchanged: 0,
  skipped: 0,
  totalSpend: 1234.56,
  currency: 'NOK',
}

describe('callAdsSync', () => {
  it('POSTs { mode } as JSON with credentials to the given endpoint', async () => {
    const calls = stubFetch(200, okResult)
    await callAdsSync('/api/admin/integrations/google/sync', 'incremental')

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, '/api/admin/integrations/google/sync')
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(calls[0].init?.credentials, 'include')
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { mode: 'incremental' })
  })

  it('classifies a 200 as success and passes the result through', async () => {
    stubFetch(200, okResult)
    const call = await callAdsSync('/x', 'incremental')
    assert.equal(call.kind, 'success')
    if (call.kind === 'success') {
      assert.equal(call.result.created, 2)
      assert.equal(call.result.updated, 12)
    }
  })

  it('classifies a 409 with conflicts as a conflict', async () => {
    stubFetch(409, {
      ...okResult,
      success: false,
      created: 0,
      conflicts: [{ id: '42', description: 'Manuell' }],
    })
    const call = await callAdsSync('/x', 'incremental')
    assert.equal(call.kind, 'conflict')
    if (call.kind === 'conflict') assert.equal(call.result.conflicts?.[0].id, '42')
  })

  it('uses the server error message on a failure response', async () => {
    stubFetch(502, { success: false, error: 'Google Ads svarte med en feil.' })
    const call = await callAdsSync('/x', 'incremental')
    assert.equal(call.kind, 'error')
    if (call.kind === 'error') assert.match(call.message, /Google Ads svarte med en feil/)
  })

  it('treats success:false as an error even on a 200', async () => {
    stubFetch(200, { success: false, error: 'Ugyldig modus.' })
    const call = await callAdsSync('/x', 'incremental')
    assert.equal(call.kind, 'error')
    if (call.kind === 'error') assert.equal(call.message, 'Ugyldig modus.')
  })

  it('falls back to a status-coded message when no error text is given', async () => {
    stubFetch(500, {})
    const call = await callAdsSync('/x', 'incremental')
    assert.equal(call.kind, 'error')
    if (call.kind === 'error') assert.match(call.message, /\(500\)/)
  })

  it('never throws — a network failure becomes an error result', async () => {
    globalThis.fetch = (async () => {
      throw new Error('boom')
    }) as unknown as FetchLike
    const call = await callAdsSync('/x', 'incremental')
    assert.equal(call.kind, 'error')
    if (call.kind === 'error') assert.equal(call.message, 'boom')
  })

  it('a 409 without conflicts is an error, not a conflict', async () => {
    stubFetch(409, { success: false, error: 'En synkronisering pågår allerede.' })
    const call = await callAdsSync('/x', 'incremental')
    assert.equal(call.kind, 'error')
  })
})
