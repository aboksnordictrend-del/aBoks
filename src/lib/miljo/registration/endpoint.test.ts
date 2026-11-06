import { afterEach, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { REGISTRATION_TURNSTILE_ACTIONS } from './constants'
import { parseRequest } from './endpoint'
import { POST as purchaseRoute } from '../../../app/api/miljo/registrering/kjop/route'
import { POST as lookupRoute } from '../../../app/api/miljo/registrering/organisasjon/route'
import { POST as submitRoute } from '../../../app/api/miljo/registrering/route'
import { SITE_URL } from '@/lib/site'

/**
 * The HTTP edge of self-registration. No database and no network: every refusal below happens
 * before the Payload client is even loaded, and Cloudflare's Siteverify is a stub.
 */

const SECRET = '0x4AAAAAAArealLookingSecretValue'
const SITE_KEY = '0x4AAAAAAArealLookingSiteKey'
const ENV_KEYS = ['VERCEL_ENV', 'TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY'] as const

const saved: Record<string, string | undefined> = {}
const realFetch = globalThis.fetch
let siteverifyCalls = 0

function setEnv(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
}

function siteverify(answer: Record<string, unknown>) {
  globalThis.fetch = (async () => {
    siteverifyCalls += 1
    return new Response(JSON.stringify(answer), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://aboks.no/api/miljo/registrering/kjop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: new URL(SITE_URL).origin, ...headers },
    body: JSON.stringify(body),
  })

const production = { VERCEL_ENV: 'production', TURNSTILE_SECRET_KEY: SECRET, NEXT_PUBLIC_TURNSTILE_SITE_KEY: SITE_KEY }
const action = REGISTRATION_TURNSTILE_ACTIONS.purchase

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key]
  siteverifyCalls = 0
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  globalThis.fetch = realFetch
})

describe('origin', () => {
  it('a missing or foreign Origin is refused', async () => {
    setEnv({})
    const noOrigin = new Request('https://aboks.no/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(((await parseRequest(noOrigin)) as Response).status, 403)
    assert.equal(((await parseRequest(post({}, { Origin: 'https://evil.example' }))) as Response).status, 403)
  })
})

describe('Turnstile on the public steps', () => {
  it('fails CLOSED in production when the secret or the site key is missing', async () => {
    for (const env of [{ VERCEL_ENV: 'production' }, { VERCEL_ENV: 'production', TURNSTILE_SECRET_KEY: SECRET }, { VERCEL_ENV: 'production', NEXT_PUBLIC_TURNSTILE_SITE_KEY: SITE_KEY }]) {
      setEnv(env)
      const res = (await parseRequest(post({ turnstileToken: 'token' }), { botAction: action })) as Response
      assert.equal(res.status, 503, JSON.stringify(env))
      assert.equal(((await res.json()) as { code: string }).code, 'turnstile')
    }
    assert.equal(siteverifyCalls, 0)
  })

  it('a missing token is refused without calling Cloudflare', async () => {
    setEnv(production)
    siteverify({ success: true, hostname: 'aboks.no', action })
    assert.equal(((await parseRequest(post({}), { botAction: action })) as Response).status, 400)
    assert.equal(siteverifyCalls, 0)
  })

  it('in production the hostname and the action must match', async () => {
    setEnv(production)
    siteverify({ success: true, hostname: 'evil.example', action })
    assert.equal(((await parseRequest(post({ turnstileToken: 't' }), { botAction: action })) as Response).status, 400, 'hostname')
    siteverify({ success: true, hostname: 'aboks.no', action: 'miljo-levering' })
    assert.equal(((await parseRequest(post({ turnstileToken: 't' }), { botAction: action })) as Response).status, 400, 'action')
    siteverify({ success: false, 'error-codes': ['invalid-input-response'] })
    assert.equal(((await parseRequest(post({ turnstileToken: 't' }), { botAction: action })) as Response).status, 400, 'invalid token')
  })

  it('a valid token passes and the body comes through', async () => {
    setEnv(production)
    siteverify({ success: true, hostname: 'aboks.no', action })
    const parsed = await parseRequest(post({ turnstileToken: 't', orderNumber: 'AB-000001' }), { botAction: action })
    assert.ok(!(parsed instanceof Response))
    assert.equal(parsed.body.orderNumber, 'AB-000001')
    assert.equal(siteverifyCalls, 1)
  })

  it('confirmation and «send again» need no token: they carry a secret', async () => {
    setEnv(production)
    assert.ok(!((await parseRequest(post({ token: 'x' }))) instanceof Response))
    assert.equal(siteverifyCalls, 0)
  })

  it('all three public routes refuse a request without a token before reaching any data', async () => {
    setEnv(production)
    for (const route of [purchaseRoute, lookupRoute, submitRoute]) {
      const res = await route(post({ orderNumber: 'AB-000001', email: 'x@y.no', organizationNumber: '923609016' }))
      assert.equal(res.status, 400)
      assert.equal(((await res.json()) as { code: string }).code, 'turnstile')
    }
    assert.equal(siteverifyCalls, 0)
  })

  it('each route asks for its own action', async () => {
    setEnv(production)
    siteverify({ success: true, hostname: 'aboks.no', action: 'noe-annet' })
    for (const route of [purchaseRoute, lookupRoute, submitRoute]) {
      const res = await route(post({ turnstileToken: 't' }))
      assert.equal(((await res.json()) as { code: string }).code, 'turnstile')
    }
    assert.equal(siteverifyCalls, 3)
  })
})

describe('the client address', () => {
  it('becomes a rate-limit subject: never raw header text, and IPv6 per /64', async () => {
    setEnv({})
    const garbage = await parseRequest(post({}, { 'x-forwarded-for': 'hei; DROP TABLE' }))
    assert.equal((garbage as { ip: string }).ip, 'unknown')
    const v6 = await parseRequest(post({}, { 'x-forwarded-for': '2001:db8:1:2:3:4:5:6' }))
    assert.equal((v6 as { ip: string }).ip, '2001:0db8:0001:0002::/64')
  })
})
