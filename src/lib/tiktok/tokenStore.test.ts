import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload } from 'payload'
import {
  decryptToken,
  encryptToken,
  getStoredConnection,
  hasStoredToken,
  resolveAccessToken,
  resolveAdvertiserId,
  saveConnection,
  TIKTOK_CONNECTION_VERSION,
} from './tokenStore'

const SECRET = 'payload-secret-used-only-in-this-test-0123456789'
const TOKEN = 'ACCESS-TOKEN-should-never-leak'
const ADVERTISER = '7012345678901234567'
const ENV = { PAYLOAD_SECRET: SECRET }

/** A stored connection written by the *current* flow. */
function current(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { connectionVersion: TIKTOK_CONNECTION_VERSION, ...over }
}

/** In-memory Payload double for the one global this module touches. */
function mockPayload(initial: Record<string, unknown> = {}) {
  let doc: Record<string, unknown> = { ...initial }
  const payload = {
    findGlobal: async () => doc,
    updateGlobal: async ({ data }: { data: Record<string, unknown> }) => {
      doc = { ...doc, ...data }
      return doc
    },
    logger: { error() {}, warn() {}, info() {} },
  } as unknown as Payload
  return {
    payload,
    get doc() {
      return doc
    },
  }
}

describe('encryptToken / decryptToken', () => {
  it('round-trips a token', () => {
    assert.equal(decryptToken(encryptToken(TOKEN, SECRET), SECRET), TOKEN)
  })

  it('never stores the plaintext', () => {
    assert.ok(!encryptToken(TOKEN, SECRET).includes(TOKEN))
  })

  it('produces a different ciphertext each time (random IV)', () => {
    assert.notEqual(encryptToken(TOKEN, SECRET), encryptToken(TOKEN, SECRET))
  })

  it('returns null for the wrong key rather than throwing', () => {
    assert.equal(decryptToken(encryptToken(TOKEN, SECRET), 'a-different-secret-value'), null)
  })

  it('returns null for a tampered ciphertext (GCM authentication)', () => {
    const parts = encryptToken(TOKEN, SECRET).split(':')
    // Flip a character in the ciphertext segment.
    parts[3] = parts[3].startsWith('A') ? `B${parts[3].slice(1)}` : `A${parts[3].slice(1)}`
    assert.equal(decryptToken(parts.join(':'), SECRET), null)
  })

  it('returns null for a plaintext or otherwise unrecognised value', () => {
    assert.equal(decryptToken(TOKEN, SECRET), null)
    assert.equal(decryptToken('v9:a:b:c', SECRET), null)
    assert.equal(decryptToken('', SECRET), null)
  })
})

describe('saveConnection', () => {
  it('writes the token encrypted, never in plaintext', async () => {
    const m = mockPayload()
    await saveConnection(
      m.payload,
      {
        accessToken: TOKEN,
        advertiserId: ADVERTISER,
        advertiserName: 'aBoks',
        currency: 'NOK',
        timezone: 'Europe/Oslo',
        connectedAt: '2026-07-31T10:00:00.000Z',
        metadataAvailable: true,
        reportingOk: true,
      },
      ENV,
    )

    const serialized = JSON.stringify(m.doc)
    assert.ok(!serialized.includes(TOKEN), 'plaintext token must never reach the database')
    assert.equal(decryptToken(String(m.doc.accessTokenEncrypted), SECRET), TOKEN)
    assert.equal(m.doc.advertiserId, ADVERTISER)
    assert.equal(m.doc.currency, 'NOK')
    assert.equal(m.doc.timezone, 'Europe/Oslo')
  })

  it('accepts a token with no advertiser (authorization done, selection pending)', async () => {
    const m = mockPayload()
    await saveConnection(
      m.payload,
      {
        accessToken: TOKEN,
        advertiserId: null,
        advertiserName: null,
        currency: null,
        timezone: null,
        connectedAt: '2026-07-31T10:00:00.000Z',
        metadataAvailable: true,
        reportingOk: true,
      },
      ENV,
    )
    assert.equal(m.doc.advertiserId, null)
    assert.ok(m.doc.accessTokenEncrypted)
  })

  it('refuses to store anything when PAYLOAD_SECRET is missing', async () => {
    const m = mockPayload()
    await assert.rejects(
      () =>
        saveConnection(
          m.payload,
          {
            accessToken: TOKEN,
            advertiserId: ADVERTISER,
            advertiserName: null,
            currency: 'NOK',
            timezone: null,
            connectedAt: '2026-07-31T10:00:00.000Z',
            metadataAvailable: false,
            reportingOk: true,
          },
          {},
        ),
      /PAYLOAD_SECRET/,
    )
    assert.equal(m.doc.accessTokenEncrypted, undefined)
  })

  it('stamps the current connection version, so the flow it was minted under is recorded', async () => {
    const m = mockPayload()
    await saveConnection(
      m.payload,
      {
        accessToken: TOKEN,
        advertiserId: ADVERTISER,
        advertiserName: 'aBoks',
        currency: 'NOK',
        timezone: null,
        connectedAt: '2026-07-31T10:00:00.000Z',
        metadataAvailable: false,
        reportingOk: true,
      },
      ENV,
    )
    assert.equal(m.doc.connectionVersion, TIKTOK_CONNECTION_VERSION)
    assert.equal(m.doc.metadataAvailable, false)
    assert.equal(m.doc.reportingOk, true)
  })
})

describe('resolveAccessToken', () => {
  it('prefers the env token, without touching the database value', async () => {
    const m = mockPayload(current({ accessTokenEncrypted: encryptToken('STORED', SECRET) }))
    assert.equal(await resolveAccessToken(m.payload, '  ENV-TOKEN  ', ENV), 'ENV-TOKEN')
  })

  it('falls back to the stored, decrypted token', async () => {
    const m = mockPayload(current({ accessTokenEncrypted: encryptToken(TOKEN, SECRET) }))
    assert.equal(await resolveAccessToken(m.payload, '', ENV), TOKEN)
  })

  it('returns null when nothing is stored', async () => {
    assert.equal(await resolveAccessToken(mockPayload().payload, '', ENV), null)
  })

  it('returns null when the stored value cannot be decrypted (rotated secret)', async () => {
    const m = mockPayload(
      current({ accessTokenEncrypted: encryptToken(TOKEN, 'the-old-secret-value') }),
    )
    assert.equal(await resolveAccessToken(m.payload, '', ENV), null)
  })
})

describe('connection version — an old authorization is never reused', () => {
  /**
   * A token minted under a previous flow was granted against a different authorization
   * contract, so it must not be carried over: the admin has to authorize again. Everything
   * that reads the stored connection enforces this, not just one entry point.
   */
  const legacy = {
    connectionVersion: TIKTOK_CONNECTION_VERSION - 1,
    accessTokenEncrypted: encryptToken(TOKEN, SECRET),
    advertiserId: ADVERTISER,
    advertiserName: 'aBoks',
    currency: 'NOK',
  }

  it('does not decrypt or return an old token', async () => {
    assert.equal(await resolveAccessToken(mockPayload(legacy).payload, '', ENV), null)
  })

  it('reports no stored token, so the card falls back to "Ikke tilkoblet"', async () => {
    assert.equal(await hasStoredToken(mockPayload(legacy).payload), false)
  })

  it('reports no stored connection metadata', async () => {
    assert.equal(await getStoredConnection(mockPayload(legacy).payload), null)
  })

  it('does not reuse the old advertiser selection', async () => {
    assert.equal(await resolveAdvertiserId(mockPayload(legacy).payload, ''), '')
  })

  it('treats a connection with no version at all as legacy', async () => {
    const unversioned = mockPayload({ accessTokenEncrypted: encryptToken(TOKEN, SECRET) })
    assert.equal(await resolveAccessToken(unversioned.payload, '', ENV), null)
    assert.equal(await hasStoredToken(unversioned.payload), false)
  })

  it('still honours an env token, which is independent of the stored connection', async () => {
    assert.equal(await resolveAccessToken(mockPayload(legacy).payload, 'ENV-TOKEN', ENV), 'ENV-TOKEN')
  })
})

describe('resolveAdvertiserId', () => {
  it('prefers the env value over the stored selection', async () => {
    const m = mockPayload(current({ advertiserId: 'stored-id' }))
    assert.equal(await resolveAdvertiserId(m.payload, ADVERTISER), ADVERTISER)
  })

  it('falls back to the stored selection', async () => {
    const m = mockPayload(current({ advertiserId: ADVERTISER }))
    assert.equal(await resolveAdvertiserId(m.payload, ''), ADVERTISER)
  })

  it('is empty when neither is set', async () => {
    assert.equal(await resolveAdvertiserId(mockPayload().payload, ''), '')
  })
})

describe('getStoredConnection / hasStoredToken', () => {
  it('returns null when nothing has been connected', async () => {
    assert.equal(await getStoredConnection(mockPayload().payload), null)
    assert.equal(await hasStoredToken(mockPayload().payload), false)
  })

  it('reports a token with no advertiser as a real (half-finished) connection', async () => {
    const m = mockPayload(current({ accessTokenEncrypted: encryptToken(TOKEN, SECRET) }))
    const info = await getStoredConnection(m.payload)
    assert.ok(info)
    assert.equal(info.advertiserId, null)
    assert.equal(await hasStoredToken(m.payload), true)
  })

  it('never includes the token in the returned metadata', async () => {
    const m = mockPayload(
      current({
        accessTokenEncrypted: encryptToken(TOKEN, SECRET),
        advertiserId: ADVERTISER,
        advertiserName: 'aBoks',
        currency: 'NOK',
        timezone: 'Europe/Oslo',
        connectedAt: '2026-07-31T10:00:00.000Z',
      }),
    )
    const info = await getStoredConnection(m.payload)
    const serialized = JSON.stringify(info)
    assert.ok(!serialized.includes(TOKEN))
    assert.ok(!serialized.includes('accessToken'))
    assert.equal(info?.advertiserName, 'aBoks')
  })

  it('surfaces the optional-metadata and reporting flags', async () => {
    const m = mockPayload(
      current({
        accessTokenEncrypted: encryptToken(TOKEN, SECRET),
        advertiserId: ADVERTISER,
        metadataAvailable: false,
        reportingOk: true,
      }),
    )
    const info = await getStoredConnection(m.payload)
    assert.equal(info?.metadataAvailable, false)
    assert.equal(info?.reportingOk, true)
  })

  it('reports reportingOk as null when no probe has run', async () => {
    const m = mockPayload(current({ advertiserId: ADVERTISER }))
    assert.equal((await getStoredConnection(m.payload))?.reportingOk, null)
  })

  it('treats a blank stored value as absent', async () => {
    const m = mockPayload(current({ accessTokenEncrypted: '   ', advertiserId: '  ' }))
    assert.equal(await getStoredConnection(m.payload), null)
    assert.equal(await hasStoredToken(m.payload), false)
  })
})
