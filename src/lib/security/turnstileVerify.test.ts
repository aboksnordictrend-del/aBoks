import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { TURNSTILE_MESSAGES, turnstilePolicy, verifyTurnstileToken, type TurnstileEnv } from './turnstileVerify'

// Siteverify is never called for real: every test injects `fetchImpl`. The keys below are
// Cloudflare's published test keys or obvious placeholders — never a real secret.

const SECRET = 'live-secret-placeholder-0000000000'
const SITE = 'live-site-key-placeholder'
const PROD: TurnstileEnv = { TURNSTILE_SECRET_KEY: SECRET, NEXT_PUBLIC_TURNSTILE_SITE_KEY: SITE, VERCEL_ENV: 'production' }
const LOCAL_TEST: TurnstileEnv = { TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }
const ACTION = 'miljo-registrering'
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

type Call = { url: string; body: URLSearchParams }

function fakeFetch(responses: Array<Record<string, unknown> | Error | { status: number }>) {
  const calls: Call[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: new URLSearchParams(init?.body as URLSearchParams) })
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!
    if (next instanceof Error) throw next
    if ('status' in next && typeof next.status === 'number') return new Response('oops', { status: next.status })
    return Response.json(next)
  }) as typeof fetch
  return { impl, calls }
}

const ok = (extra: Record<string, unknown> = {}) => ({ success: true, hostname: 'aboks.no', action: ACTION, 'error-codes': [], ...extra })
const fail = (...codes: string[]) => ({ success: false, 'error-codes': codes })

let logged: string[] = []
const original = { log: console.log, warn: console.warn, error: console.error }
beforeEach(() => {
  logged = []
  console.warn = (...a: unknown[]) => void logged.push(a.join(' '))
  console.error = (...a: unknown[]) => void logged.push(a.join(' '))
})
afterEach(() => {
  console.warn = original.warn
  console.error = original.error
})

const verify = (token: unknown, env: TurnstileEnv, responses: Parameters<typeof fakeFetch>[0], extra: Record<string, unknown> = {}) => {
  const f = fakeFetch(responses)
  return verifyTurnstileToken(token, { action: ACTION, remoteIp: '203.0.113.7', env, fetchImpl: f.impl, retryDelayMs: 0, ...extra }).then((r) => ({ r, calls: f.calls }))
}

describe('turnstilePolicy', () => {
  it('enforces with strict claims in Production', () => assert.deepEqual(turnstilePolicy(PROD), { mode: 'enforce', strictClaims: true }))

  it('fails closed on a deployment with a missing key', () => {
    assert.equal(turnstilePolicy({ ...PROD, TURNSTILE_SECRET_KEY: '' }).mode, 'misconfigured')
    assert.equal(turnstilePolicy({ ...PROD, NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined }).mode, 'misconfigured')
    assert.equal(turnstilePolicy({ VERCEL_ENV: 'preview' }).mode, 'misconfigured')
  })

  it('refuses Cloudflare test secrets in Production', () => {
    assert.equal(turnstilePolicy({ ...PROD, TURNSTILE_SECRET_KEY: LOCAL_TEST.TURNSTILE_SECRET_KEY }).mode, 'misconfigured')
  })

  it('locally: skips without keys, enforces (without host/action claims) with test keys', () => {
    assert.equal(turnstilePolicy({}).mode, 'skip')
    assert.deepEqual(turnstilePolicy(LOCAL_TEST), { mode: 'enforce', strictClaims: false })
    assert.equal(turnstilePolicy({ TURNSTILE_SECRET_KEY: 'x' }).mode, 'misconfigured')
  })
})

describe('verifyTurnstileToken', () => {
  it('accepts a valid token and sends secret, token, remote IP and an idempotency key', async () => {
    const { r, calls } = await verify(TOKEN, PROD, [ok()])
    assert.deepEqual(r, { ok: true })
    assert.equal(calls.length, 1)
    assert.equal(calls[0]!.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
    assert.equal(calls[0]!.body.get('secret'), SECRET)
    assert.equal(calls[0]!.body.get('response'), TOKEN)
    assert.equal(calls[0]!.body.get('remoteip'), '203.0.113.7')
    assert.match(calls[0]!.body.get('idempotency_key')!, /^[0-9a-f-]{36}$/)
  })

  it('accepts www.aboks.no as well', async () => {
    assert.deepEqual((await verify(TOKEN, PROD, [ok({ hostname: 'www.aboks.no' })])).r, { ok: true })
  })

  it('refuses a missing or empty token without calling Cloudflare', async () => {
    for (const t of [undefined, null, '', '   ', 42, new File([], 'x')]) {
      const { r, calls } = await verify(t, PROD, [ok()])
      assert.deepEqual(r, { ok: false, reason: 'missing-token' })
      assert.equal(calls.length, 0)
    }
  })

  it('refuses an oversized token without calling Cloudflare', async () => {
    const { r, calls } = await verify('x'.repeat(2049), PROD, [ok()])
    assert.deepEqual(r, { ok: false, reason: 'malformed-token' })
    assert.equal(calls.length, 0)
  })

  it('refuses invalid tokens', async () => {
    assert.deepEqual((await verify(TOKEN, PROD, [fail('invalid-input-response')])).r, { ok: false, reason: 'invalid-token' })
    assert.deepEqual((await verify(TOKEN, PROD, [fail('bad-request')])).r, { ok: false, reason: 'invalid-token' })
    assert.deepEqual((await verify(TOKEN, PROD, [{ success: 'true' }])).r, { ok: false, reason: 'invalid-token' })
  })

  it('refuses expired and replayed tokens (timeout-or-duplicate), without retrying', async () => {
    const { r, calls } = await verify(TOKEN, PROD, [fail('timeout-or-duplicate')])
    assert.deepEqual(r, { ok: false, reason: 'expired-or-duplicate' })
    assert.equal(calls.length, 1)
  })

  it('replay: the same token is accepted once and refused the second time', async () => {
    const seen = new Set<string>()
    const impl = (async (_u: unknown, init?: RequestInit) => {
      const token = new URLSearchParams(init?.body as URLSearchParams).get('response')!
      if (seen.has(token)) return Response.json(fail('timeout-or-duplicate'))
      seen.add(token)
      return Response.json(ok())
    }) as typeof fetch
    const opts = { action: ACTION, env: PROD, fetchImpl: impl }
    assert.deepEqual(await verifyTurnstileToken(TOKEN, opts), { ok: true })
    assert.deepEqual(await verifyTurnstileToken(TOKEN, opts), { ok: false, reason: 'expired-or-duplicate' })
  })

  it('checks hostname and action in Production', async () => {
    assert.deepEqual((await verify(TOKEN, PROD, [ok({ hostname: 'evil.example' })])).r, { ok: false, reason: 'hostname-mismatch' })
    assert.deepEqual((await verify(TOKEN, PROD, [ok({ hostname: undefined })])).r, { ok: false, reason: 'hostname-mismatch' })
    assert.deepEqual((await verify(TOKEN, PROD, [ok({ action: 'review' })])).r, { ok: false, reason: 'action-mismatch' })
    assert.deepEqual((await verify(TOKEN, PROD, [ok({ action: '' })])).r, { ok: false, reason: 'action-mismatch' })
  })

  it('does not check hostname and action with local test keys (Cloudflare answers with test values)', async () => {
    assert.deepEqual((await verify(TOKEN, LOCAL_TEST, [ok({ hostname: 'localhost', action: 'test' })])).r, { ok: true })
  })

  it('fails closed when the secret is rejected', async () => {
    assert.deepEqual((await verify(TOKEN, PROD, [fail('invalid-input-secret')])).r, { ok: false, reason: 'misconfigured' })
  })

  it('fails closed when Turnstile is not configured on a deployment', async () => {
    const { r, calls } = await verify(TOKEN, { VERCEL_ENV: 'production' }, [ok()])
    assert.deepEqual(r, { ok: false, reason: 'misconfigured' })
    assert.equal(calls.length, 0)
  })

  it('skips only on a local run without keys', async () => {
    const { r, calls } = await verify(undefined, {}, [ok()])
    assert.deepEqual(r, { ok: true, skipped: true })
    assert.equal(calls.length, 0)
  })

  it('retries a network failure or internal-error once with the same idempotency key', async () => {
    const a = await verify(TOKEN, PROD, [new Error('ECONNRESET'), ok()])
    assert.deepEqual(a.r, { ok: true })
    assert.equal(a.calls.length, 2)
    assert.equal(a.calls[0]!.body.get('idempotency_key'), a.calls[1]!.body.get('idempotency_key'))

    const b = await verify(TOKEN, PROD, [fail('internal-error'), ok()])
    assert.deepEqual(b.r, { ok: true })
    assert.equal(b.calls.length, 2)
  })

  it('fails closed when Siteverify stays unavailable (errors, 5xx, timeouts)', async () => {
    assert.deepEqual((await verify(TOKEN, PROD, [new Error('ETIMEDOUT')])).r, { ok: false, reason: 'unavailable' })
    assert.deepEqual((await verify(TOKEN, PROD, [{ status: 503 }])).r, { ok: false, reason: 'unavailable' })
    assert.deepEqual((await verify(TOKEN, PROD, [fail('internal-error')])).r, { ok: false, reason: 'unavailable' })

    // A Siteverify that never answers is aborted by the per-attempt timeout.
    const hanging = (async (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch
    const started = Date.now()
    const r = await verifyTurnstileToken(TOKEN, { action: ACTION, env: PROD, fetchImpl: hanging, timeoutMs: 50, retryDelayMs: 0 })
    assert.deepEqual(r, { ok: false, reason: 'unavailable' })
    assert.ok(Date.now() - started < 2000)
  })

  it('never logs the secret or the token', async () => {
    await verify(TOKEN, PROD, [fail('invalid-input-secret')])
    await verify(TOKEN, PROD, [new Error('down')])
    await verify(TOKEN, PROD, [ok({ hostname: 'evil.example' })])
    await verify(TOKEN, { VERCEL_ENV: 'production' }, [ok()])
    assert.ok(logged.length > 0)
    for (const line of logged) {
      assert.ok(!line.includes(SECRET), line)
      assert.ok(!line.includes(TOKEN), line)
    }
  })

  it('has a Norwegian message for every failure, none of which reveals the reason', () => {
    for (const m of Object.values(TURNSTILE_MESSAGES)) assert.ok(m.length > 10 && !/hostname|action|secret/i.test(m))
    assert.equal(TURNSTILE_MESSAGES['hostname-mismatch'], TURNSTILE_MESSAGES['invalid-token'])
  })
})
