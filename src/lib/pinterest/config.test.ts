import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PINTEREST_ADS_REQUIRED_ENV,
  PinterestAdsConfigError,
  getPinterestAdsConfig,
  maskAdAccountId,
  normalizeAdAccountId,
} from './config'

const VALID = {
  PINTEREST_APP_ID: '1507123',
  PINTEREST_APP_SECRET: 'APP-SECRET-should-never-leak',
  PINTEREST_ACCESS_TOKEN: 'ACCESS-TOKEN-should-never-leak',
  PINTEREST_AD_ACCOUNT_ID: '549755885175',
}

describe('normalizeAdAccountId', () => {
  it('strips everything that is not a digit', () => {
    assert.equal(normalizeAdAccountId('549755885175'), '549755885175')
    assert.equal(normalizeAdAccountId(' 549-755-885-175 '), '549755885175')
    assert.equal(normalizeAdAccountId('act_549755885175'), '549755885175')
  })

  it('yields an empty string when there is no digit at all', () => {
    assert.equal(normalizeAdAccountId('abc'), '')
  })
})

describe('maskAdAccountId', () => {
  it('keeps only the last four digits', () => {
    assert.equal(maskAdAccountId('549755885175'), '•••5175')
  })

  it('never returns the full id', () => {
    assert.ok(!maskAdAccountId('549755885175').includes('549755'))
  })

  it('degrades safely for empty / very short input', () => {
    assert.equal(maskAdAccountId(''), '—')
    assert.equal(maskAdAccountId('12'), '•••12')
  })
})

describe('getPinterestAdsConfig', () => {
  it('reads every credential from env and derives the base URL', () => {
    const config = getPinterestAdsConfig(VALID)
    assert.equal(config.accessToken, VALID.PINTEREST_ACCESS_TOKEN)
    assert.equal(config.appId, VALID.PINTEREST_APP_ID)
    assert.equal(config.appSecret, VALID.PINTEREST_APP_SECRET)
    assert.equal(config.adAccountId, '549755885175')
    assert.equal(config.apiVersion, 'v5')
    assert.equal(config.baseUrl, 'https://api.pinterest.com/v5')
    assert.equal(config.historyStart, '2019-01-01')
  })

  it('requires only the ad account id', () => {
    // PINTEREST_ACCESS_TOKEN is no longer required: the token comes from the stored OAuth
    // grant. Requiring it would keep the manual-token dependency alive forever and would mark
    // a properly connected integration as "Ikke konfigurert".
    assert.deepEqual([...PINTEREST_ADS_REQUIRED_ENV], ['PINTEREST_AD_ACCOUNT_ID'])
    // The app credentials belong to the OAuth config, validated separately, so reading the ads
    // config without them must still succeed.
    const config = getPinterestAdsConfig({ PINTEREST_AD_ACCOUNT_ID: '549755885175' })
    assert.equal(config.appId, '')
    assert.equal(config.appSecret, '')
    assert.equal(config.accessToken, '')
    assert.equal(config.adAccountId, '549755885175')
  })

  it('names the missing variables without leaking any value', () => {
    try {
      getPinterestAdsConfig({})
      assert.fail('expected a config error')
    } catch (err) {
      assert.ok(err instanceof PinterestAdsConfigError)
      assert.match(err.message, /PINTEREST_AD_ACCOUNT_ID/)
    }
  })

  it('treats a blank value as missing', () => {
    assert.throws(
      () => getPinterestAdsConfig({ ...VALID, PINTEREST_AD_ACCOUNT_ID: '   ' }),
      PinterestAdsConfigError,
    )
  })

  it('rejects an ad account id with no digits', () => {
    assert.throws(
      () => getPinterestAdsConfig({ ...VALID, PINTEREST_AD_ACCOUNT_ID: 'my-account' }),
      PinterestAdsConfigError,
    )
  })

  it('accepts optional overrides and rejects malformed ones', () => {
    const config = getPinterestAdsConfig({
      ...VALID,
      PINTEREST_API_VERSION: 'v6',
      PINTEREST_HISTORY_START: '2021-03-01',
    })
    assert.equal(config.apiVersion, 'v6')
    assert.equal(config.baseUrl, 'https://api.pinterest.com/v6')
    assert.equal(config.historyStart, '2021-03-01')

    assert.throws(
      () => getPinterestAdsConfig({ ...VALID, PINTEREST_API_VERSION: '5' }),
      PinterestAdsConfigError,
    )
    assert.throws(
      () => getPinterestAdsConfig({ ...VALID, PINTEREST_HISTORY_START: '01.03.2021' }),
      PinterestAdsConfigError,
    )
  })
})
