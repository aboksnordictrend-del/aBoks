import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { openPin, PIN_KEY_ENV, pinVaultKey, pinVaultStatus, sealPin } from './pinVault'
import { hashPin, verifyPin } from './pin'
import { createStub } from './testStub'
import { toPublicOrganization, resolveOrganization } from './service'
import { handleOrganizationStatus, handleRevealPin, handleSetPin } from '../../collections/endpoints/miljo'

const KEY_B64 = randomBytes(32).toString('base64')
const env = { [PIN_KEY_ENV]: KEY_B64 }

describe('PIN vault — encryption', () => {
  it('round-trips a PIN and never contains it in clear text', () => {
    const key = pinVaultKey(env)!
    const sealed = sealPin('482915', 7, key)
    assert.match(sealed, /^v1:/)
    assert.ok(!sealed.includes('482915'))
    assert.equal(openPin(sealed, 7, key), '482915')
    assert.notEqual(sealPin('482915', 7, key), sealed, 'random IV per seal')
  })

  it('rejects another organisation, a wrong key, tampering and garbage', () => {
    const key = pinVaultKey(env)!
    const sealed = sealPin('482915', 7, key)
    assert.equal(openPin(sealed, 8, key), null, 'copied to another organisation')
    assert.equal(openPin(sealed, 7, pinVaultKey({ [PIN_KEY_ENV]: randomBytes(32).toString('hex') })!), null, 'wrong key')
    const parts = sealed.split(':')
    const flipped = Buffer.from(parts[3]!, 'base64url')
    flipped[0] = flipped[0]! ^ 1
    assert.equal(openPin([parts[0], parts[1], parts[2], flipped.toString('base64url')].join(':'), 7, key), null, 'tampered')
    for (const bad of [null, '', 'plain482915', 'v1:a:b:c']) assert.equal(openPin(bad as string | null, 7, key), null)
  })

  it('requires a dedicated 32-byte key — no PAYLOAD_SECRET fallback', () => {
    assert.equal(pinVaultStatus({}).configured, false)
    assert.equal(pinVaultKey({ PAYLOAD_SECRET: 'x'.repeat(40) }), null)
    assert.equal(pinVaultStatus({ [PIN_KEY_ENV]: 'too-short' }).configured, false)
    assert.equal(pinVaultKey({ [PIN_KEY_ENV]: 'too-short' }), null)
    assert.ok(!String(pinVaultStatus({ [PIN_KEY_ENV]: 'too-short' }).problem).includes('too-short'), 'never echoes the key')
    assert.equal(pinVaultStatus(env).configured, true)
  })
})

describe('PIN reveal — endpoints and access control', () => {
  let saved: string | undefined
  beforeEach(() => {
    saved = process.env[PIN_KEY_ENV]
    process.env[PIN_KEY_ENV] = KEY_B64
  })
  afterEach(() => {
    if (saved === undefined) delete process.env[PIN_KEY_ENV]
    else process.env[PIN_KEY_ENV] = saved
  })

  const admin = { id: 1, email: 'admin@aboks.invalid', role: 'admin' }
  const editor = { id: 2, email: 'editor@aboks.invalid', role: 'editor' }

  async function setup(user: unknown, extra: Record<string, unknown> = {}) {
    const stub = createStub({ 'environmental-organizations': [{ id: 5, name: 'Demo', publicCode: 'abcdefghjk', status: 'active', allowedCategories: ['aa'], ...extra }] }, user)
    const call = async (fn: (r: PayloadRequest) => Promise<Response>, body: unknown = {}) => {
      Object.assign(stub.req, { routeParams: { id: '5' }, json: async () => body })
      const res = await fn(stub.req)
      return { status: res.status, body: (await res.json()) as Record<string, unknown>, headers: res.headers }
    }
    return { ...stub, call, org: () => stub.db['environmental-organizations']![0]! }
  }

  it('stores hash + encrypted copy (no plaintext) and reveals the active PIN to an admin', async () => {
    const s = await setup(admin)
    const gen = await s.call(handleSetPin, { mode: 'generate' })
    const pin = String(gen.body.pin)
    assert.equal(gen.body.revealable, true)
    const org = s.org()
    assert.ok(await verifyPin(pin, org.pinHash as string), 'hash still verifies')
    assert.ok(typeof org.pinEncrypted === 'string' && !(org.pinEncrypted as string).includes(pin))
    assert.ok(!JSON.stringify(org).includes(`"${pin}"`), 'no plaintext anywhere in the row')
    const shown = await s.call(handleRevealPin)
    assert.equal(shown.status, 200)
    assert.equal(shown.body.pin, pin)
    assert.match(shown.headers.get('cache-control') ?? '', /no-store/)
    const status = await s.call(handleOrganizationStatus)
    assert.equal(status.body.pinRevealable, true)
    assert.ok(!JSON.stringify(status.body).includes(pin), 'status never carries the PIN')
    assert.ok(!s.logs.some((l) => l.includes(pin)), 'logs never carry the PIN')
  })

  it('custom PINs are revealable too; removal clears both copies', async () => {
    const s = await setup(admin)
    await s.call(handleSetPin, { mode: 'set', pin: '730194' })
    assert.equal((await s.call(handleRevealPin)).body.pin, '730194')
    await s.call(handleSetPin, { mode: 'clear' })
    assert.equal(s.org().pinHash, null)
    assert.equal(s.org().pinEncrypted, null)
    assert.equal((await s.call(handleRevealPin)).status, 404)
  })

  it('refuses anonymous users and editors', async () => {
    for (const [user, code] of [
      [null, 401],
      [editor, 403],
    ] as const) {
      const s = await setup(user, { pinHash: 'x', pinEncrypted: 'y' })
      const res = await s.call(handleRevealPin)
      assert.equal(res.status, code)
      assert.equal(res.body.pin, undefined)
    }
  })

  it('legacy hash-only PINs cannot be shown («opprett ny PIN»)', async () => {
    const s = await setup(admin, { pinHash: await hashPin('482915'), pinEncrypted: null })
    const res = await s.call(handleRevealPin)
    assert.deepEqual([res.status, res.body.code, res.body.error], [409, 'not-recoverable', 'PIN kan ikke vises — opprett ny PIN.'])
    assert.equal((await s.call(handleOrganizationStatus)).body.pinRevealable, false)
  })

  it('a copy that does not match the active hash is never shown', async () => {
    const key = pinVaultKey(env)!
    const s = await setup(admin, { pinHash: await hashPin('482915'), pinEncrypted: sealPin('111222', 5, key) })
    assert.equal((await s.call(handleRevealPin)).body.code, 'not-recoverable')
  })

  it('without a server key PINs still work but are not stored reversibly', async () => {
    delete process.env[PIN_KEY_ENV]
    const s = await setup(admin)
    const gen = await s.call(handleSetPin, { mode: 'generate' })
    assert.equal(gen.body.revealable, false)
    assert.equal(s.org().pinEncrypted, null)
    assert.ok(await verifyPin(String(gen.body.pin), s.org().pinHash as string))
    const res = await s.call(handleRevealPin)
    assert.equal(res.body.code, 'not-configured')
  })

  it('the public organisation DTO never contains PIN data', async () => {
    const key = pinVaultKey(env)!
    const s = await setup(null, { pinHash: await hashPin('482915'), pinEncrypted: sealPin('482915', 5, key) })
    const r = await resolveOrganization(s.req, 'abcdefghjk')
    assert.equal(r.kind, 'active')
    const json = JSON.stringify(toPublicOrganization(r.kind === 'active' ? r.org : (null as never)))
    assert.ok(!/pinEncrypted|pinHash|v1:|scrypt|482915/.test(json), json)
  })
})
