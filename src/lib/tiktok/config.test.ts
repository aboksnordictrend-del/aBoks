import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  TIKTOK_ADS_REQUIRED_ENV,
  TikTokAdsConfigError,
  getTikTokAdsConfig,
  maskAdvertiserId,
  normalizeAdvertiserId,
} from './config'

const VALID = {
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: 'APP-SECRET-should-never-leak',
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
  TIKTOK_ADVERTISER_ID: '7012345678901234567',
}

describe('normalizeAdvertiserId', () => {
  it('strips everything that is not a digit', () => {
    assert.equal(normalizeAdvertiserId('7012345678901234567'), '7012345678901234567')
    assert.equal(normalizeAdvertiserId(' 7012-3456-7890 '), '701234567890')
  })

  it('yields an empty string when there is no digit at all', () => {
    assert.equal(normalizeAdvertiserId('abc'), '')
  })
})

describe('maskAdvertiserId', () => {
  it('keeps only the last four digits', () => {
    assert.equal(maskAdvertiserId('7012345678901234567'), '•••4567')
  })

  it('never returns the full id', () => {
    assert.ok(!maskAdvertiserId('7012345678901234567').includes('70123456789'))
  })

  it('degrades safely for empty / very short input', () => {
    assert.equal(maskAdvertiserId(''), '—')
    assert.equal(maskAdvertiserId('12'), '•••12')
  })
})

describe('getTikTokAdsConfig', () => {
  it('reads every value from env and derives the API + authorize URLs', () => {
    const config = getTikTokAdsConfig(VALID)
    assert.equal(config.appId, VALID.TIKTOK_APP_ID)
    assert.equal(config.appSecret, VALID.TIKTOK_APP_SECRET)
    assert.equal(config.redirectUri, VALID.TIKTOK_REDIRECT_URI)
    assert.equal(config.advertiserId, VALID.TIKTOK_ADVERTISER_ID)
    assert.equal(config.apiVersion, 'v1.3')
    assert.equal(config.baseUrl, 'https://business-api.tiktok.com/open_api/v1.3')
    assert.equal(config.authorizeUrl, 'https://business-api.tiktok.com/portal/auth')
    assert.equal(config.historyStart, '2020-01-01')
  })

  it('requires only the app credentials and the redirect URI', () => {
    assert.deepEqual(
      [...TIKTOK_ADS_REQUIRED_ENV],
      ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET', 'TIKTOK_REDIRECT_URI'],
    )
    // The advertiser is discovered by OAuth, and the token is obtained by "Koble til" — a
    // setup without either is still valid configuration.
    const config = getTikTokAdsConfig({
      TIKTOK_APP_ID: VALID.TIKTOK_APP_ID,
      TIKTOK_APP_SECRET: 'secret',
      TIKTOK_REDIRECT_URI: VALID.TIKTOK_REDIRECT_URI,
    })
    assert.equal(config.advertiserId, '')
    assert.equal(config.accessToken, '')
  })

  it('names the missing variables without leaking any value', () => {
    try {
      getTikTokAdsConfig({})
      assert.fail('expected a config error')
    } catch (err) {
      assert.ok(err instanceof TikTokAdsConfigError)
      assert.match(err.message, /TIKTOK_APP_ID/)
      assert.match(err.message, /TIKTOK_APP_SECRET/)
      assert.match(err.message, /TIKTOK_REDIRECT_URI/)
    }
  })

  it('never puts a secret value in the error message', () => {
    try {
      getTikTokAdsConfig({ ...VALID, TIKTOK_APP_ID: '' })
      assert.fail('expected a config error')
    } catch (err) {
      assert.ok(err instanceof TikTokAdsConfigError)
      assert.ok(!err.message.includes(VALID.TIKTOK_APP_SECRET))
    }
  })

  it('treats a blank value as missing', () => {
    assert.throws(
      () => getTikTokAdsConfig({ ...VALID, TIKTOK_APP_SECRET: '   ' }),
      TikTokAdsConfigError,
    )
  })

  it('rejects a non-numeric app id', () => {
    assert.throws(
      () => getTikTokAdsConfig({ ...VALID, TIKTOK_APP_ID: 'my-app' }),
      TikTokAdsConfigError,
    )
  })

  it('rejects an advertiser id that contains no digit (a typo, not "let OAuth decide")', () => {
    assert.throws(
      () => getTikTokAdsConfig({ ...VALID, TIKTOK_ADVERTISER_ID: 'my-account' }),
      TikTokAdsConfigError,
    )
  })

  describe('redirect URI', () => {
    it('rejects a relative or malformed URL', () => {
      for (const bad of ['/api/callback', 'not a url', '']) {
        assert.throws(
          () => getTikTokAdsConfig({ ...VALID, TIKTOK_REDIRECT_URI: bad }),
          TikTokAdsConfigError,
          bad,
        )
      }
    })

    it('rejects plain http on a public host', () => {
      assert.throws(
        () => getTikTokAdsConfig({ ...VALID, TIKTOK_REDIRECT_URI: 'http://aboks.no/cb' }),
        TikTokAdsConfigError,
      )
    })

    it('allows http on localhost, for development', () => {
      const config = getTikTokAdsConfig({
        ...VALID,
        TIKTOK_REDIRECT_URI: 'http://localhost:3000/api/admin/integrations/tiktok/callback',
      })
      assert.equal(
        config.redirectUri,
        'http://localhost:3000/api/admin/integrations/tiktok/callback',
      )
    })

    it('preserves the URI byte for byte — TikTok compares it to the registered value', () => {
      const withTrailing = 'https://aboks.no/api/admin/integrations/tiktok/callback/'
      assert.equal(
        getTikTokAdsConfig({ ...VALID, TIKTOK_REDIRECT_URI: withTrailing }).redirectUri,
        withTrailing,
      )
    })
  })

  describe('TIKTOK_ADVERTISER_CURRENCY', () => {
    it('is empty when unset — the sync then refuses rather than assuming NOK', () => {
      assert.equal(getTikTokAdsConfig(VALID).advertiserCurrency, '')
    })

    it('normalizes case and whitespace to an ISO 4217 code', () => {
      assert.equal(
        getTikTokAdsConfig({ ...VALID, TIKTOK_ADVERTISER_CURRENCY: ' nok ' }).advertiserCurrency,
        'NOK',
      )
    })

    it('rejects a malformed code rather than silently comparing it against NOK', () => {
      for (const bad of ['kroner', 'NO', 'NOKK', 'N0K']) {
        assert.throws(
          () => getTikTokAdsConfig({ ...VALID, TIKTOK_ADVERTISER_CURRENCY: bad }),
          TikTokAdsConfigError,
          bad,
        )
      }
    })

    it('accepts a non-NOK code — the import guard, not the parser, is what stops it', () => {
      assert.equal(
        getTikTokAdsConfig({ ...VALID, TIKTOK_ADVERTISER_CURRENCY: 'USD' }).advertiserCurrency,
        'USD',
      )
    })
  })

  it('accepts optional overrides and rejects malformed ones', () => {
    const config = getTikTokAdsConfig({
      ...VALID,
      TIKTOK_API_VERSION: 'v2',
      TIKTOK_HISTORY_START: '2021-03-01',
      TIKTOK_ACCESS_TOKEN: 'ENV-TOKEN',
    })
    assert.equal(config.apiVersion, 'v2')
    assert.equal(config.baseUrl, 'https://business-api.tiktok.com/open_api/v2')
    assert.equal(config.historyStart, '2021-03-01')
    assert.equal(config.accessToken, 'ENV-TOKEN')

    assert.throws(
      () => getTikTokAdsConfig({ ...VALID, TIKTOK_API_VERSION: '1.3' }),
      TikTokAdsConfigError,
    )
    assert.throws(
      () => getTikTokAdsConfig({ ...VALID, TIKTOK_HISTORY_START: '01.03.2021' }),
      TikTokAdsConfigError,
    )
  })
})
