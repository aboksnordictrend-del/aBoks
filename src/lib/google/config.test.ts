import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getGoogleAdsConfig,
  GoogleAdsConfigError,
  maskCustomerId,
  normalizeCustomerId,
} from './config'

// getGoogleAdsConfig takes the env map as an argument, so no process.env mutation is needed.
const SECRET_CLIENT = 'CLIENT-SECRET-should-never-leak'
const SECRET_REFRESH = 'REFRESH-TOKEN-should-never-leak'
const SECRET_DEV = 'DEV-TOKEN-should-never-leak'

function env(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    GOOGLE_ADS_CLIENT_ID: 'client-id.apps.googleusercontent.com',
    GOOGLE_ADS_CLIENT_SECRET: SECRET_CLIENT,
    GOOGLE_ADS_DEVELOPER_TOKEN: SECRET_DEV,
    GOOGLE_ADS_REFRESH_TOKEN: SECRET_REFRESH,
    GOOGLE_ADS_CUSTOMER_ID: '123-456-7890',
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: '987-654-3210',
    ...over,
  }
}

describe('normalizeCustomerId (#1)', () => {
  it('strips dashes', () => {
    assert.equal(normalizeCustomerId('123-456-7890'), '1234567890')
  })
  it('keeps an already-plain id', () => {
    assert.equal(normalizeCustomerId('1234567890'), '1234567890')
  })
  it('tolerates spaces and stray separators', () => {
    assert.equal(normalizeCustomerId(' 123 456 7890 '), '1234567890')
    assert.equal(normalizeCustomerId('123.456.7890'), '1234567890')
  })
  it('returns an empty string when there are no digits', () => {
    assert.equal(normalizeCustomerId('abc'), '')
  })
})

describe('maskCustomerId', () => {
  it('reveals only the last four digits', () => {
    assert.equal(maskCustomerId('1234567890'), '•••-•••-7890')
    assert.equal(maskCustomerId('123-456-7890'), '•••-•••-7890')
  })
  it('handles short and empty ids without throwing', () => {
    assert.equal(maskCustomerId('12'), '•••12')
    assert.equal(maskCustomerId(''), '—')
  })
})

describe('getGoogleAdsConfig — normalization (#1)', () => {
  it('normalizes both ids to digits only', () => {
    const cfg = getGoogleAdsConfig(env())
    assert.equal(cfg.customerId, '1234567890')
    assert.equal(cfg.loginCustomerId, '9876543210')
  })

  it('accepts a missing manager account (standalone setup)', () => {
    const cfg = getGoogleAdsConfig(env({ GOOGLE_ADS_LOGIN_CUSTOMER_ID: undefined }))
    assert.equal(cfg.loginCustomerId, '')
  })

  it('derives the versioned base URL', () => {
    const cfg = getGoogleAdsConfig(env())
    assert.equal(cfg.apiVersion, 'v24')
    assert.equal(cfg.baseUrl, 'https://googleads.googleapis.com/v24')
  })

  it('reads an overridden API version', () => {
    const cfg = getGoogleAdsConfig(env({ GOOGLE_ADS_API_VERSION: 'v22' }))
    assert.equal(cfg.baseUrl, 'https://googleads.googleapis.com/v22')
  })

  it('defaults the history probe floor and accepts an override', () => {
    assert.equal(getGoogleAdsConfig(env()).historyStart, '2015-01-01')
    assert.equal(
      getGoogleAdsConfig(env({ GOOGLE_ADS_HISTORY_START: '2023-06-01' })).historyStart,
      '2023-06-01',
    )
  })
})

describe('getGoogleAdsConfig — missing/invalid configuration (#10)', () => {
  for (const key of [
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
  ]) {
    it(`throws a controlled error when ${key} is missing`, () => {
      assert.throws(
        () => getGoogleAdsConfig(env({ [key]: undefined })),
        (err: unknown) => {
          assert.ok(err instanceof GoogleAdsConfigError)
          assert.match(err.message, /Google Ads-konfigurasjonen mangler eller er ugyldig/)
          assert.match(err.message, new RegExp(key))
          return true
        },
      )
    })
  }

  it('treats a blank value as missing', () => {
    assert.throws(() => getGoogleAdsConfig(env({ GOOGLE_ADS_REFRESH_TOKEN: '   ' })), GoogleAdsConfigError)
  })

  it('rejects a customer id with no digits', () => {
    assert.throws(() => getGoogleAdsConfig(env({ GOOGLE_ADS_CUSTOMER_ID: 'abc-def' })), GoogleAdsConfigError)
  })

  it('rejects a malformed manager id', () => {
    assert.throws(
      () => getGoogleAdsConfig(env({ GOOGLE_ADS_LOGIN_CUSTOMER_ID: 'mcc' })),
      GoogleAdsConfigError,
    )
  })

  it('rejects a malformed history start and API version', () => {
    assert.throws(() => getGoogleAdsConfig(env({ GOOGLE_ADS_HISTORY_START: '01.01.2020' })), GoogleAdsConfigError)
    assert.throws(() => getGoogleAdsConfig(env({ GOOGLE_ADS_API_VERSION: '21' })), GoogleAdsConfigError)
  })

  it('never puts a secret into a configuration error message (#11)', () => {
    try {
      getGoogleAdsConfig(env({ GOOGLE_ADS_CUSTOMER_ID: 'abc' }))
      assert.fail('expected a throw')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      assert.ok(!message.includes(SECRET_CLIENT))
      assert.ok(!message.includes(SECRET_REFRESH))
      assert.ok(!message.includes(SECRET_DEV))
    }
  })
})
