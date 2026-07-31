import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSupportedCurrency,
  getAdvertiserInfo,
  getAdvertiserInfoIfPermitted,
  listAuthorizedAdvertisers,
  parseCreatedDate,
  resolveCurrency,
  selectAdvertiser,
} from './accounts'
import type { FetchImpl } from './client'
import { getTikTokAdsConfig, type TikTokAdsConfig } from './config'
import { TikTokAdsError } from './errors'

const APP_SECRET = 'APP-SECRET-should-never-leak'
const ACCESS_TOKEN = 'ACCESS-TOKEN-should-never-leak'
const ADVERTISER = '7012345678901234567'
const OTHER_ADVERTISER = '7099999999999999999'

const config: TikTokAdsConfig = getTikTokAdsConfig({
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: APP_SECRET,
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
})

const ok = (data: unknown) => ({ code: 0, message: 'OK', request_id: 'req-1', data })

function stubFetch(bodies: unknown[]) {
  const calls: Array<{ url: string; init?: Parameters<FetchImpl>[1] }> = []
  let i = 0
  const fetchImpl: FetchImpl = async (url, init) => {
    calls.push({ url, init })
    const body = bodies[Math.min(i, bodies.length - 1)]
    i += 1
    // The client reads the body as text and parses it, so `text` is the meaningful stub.
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }
  return { fetchImpl, calls }
}

describe('assertSupportedCurrency', () => {
  it('accepts NOK', () => {
    assert.doesNotThrow(() => assertSupportedCurrency('NOK'))
  })

  it('accepts an empty currency (nothing to contradict)', () => {
    assert.doesNotThrow(() => assertSupportedCurrency(''))
  })

  it('stops on any other currency and names it', () => {
    assert.throws(() => assertSupportedCurrency('USD'), /USD/)
    assert.throws(() => assertSupportedCurrency('EUR'), TikTokAdsError)
  })
})

describe('parseCreatedDate', () => {
  it('reads Unix seconds', () => {
    assert.equal(parseCreatedDate(1_609_459_200), '2021-01-01')
  })

  it('reads Unix milliseconds', () => {
    assert.equal(parseCreatedDate(1_609_459_200_000), '2021-01-01')
  })

  it('reads a numeric string', () => {
    assert.equal(parseCreatedDate('1609459200'), '2021-01-01')
  })

  it('reads an ISO-ish string', () => {
    assert.equal(parseCreatedDate('2021-01-01 08:00:00'), '2021-01-01')
  })

  it('returns null for anything unusable', () => {
    for (const bad of [undefined, 0, -5, 'not a date', '']) {
      assert.equal(parseCreatedDate(bad as never), null, String(bad))
    }
  })
})

describe('listAuthorizedAdvertisers', () => {
  it('calls the v1.3 oauth2/advertiser/get endpoint with app credentials and the token header', async () => {
    const { fetchImpl, calls } = stubFetch([
      ok({ list: [{ advertiser_id: ADVERTISER, advertiser_name: 'aBoks' }] }),
    ])
    const advertisers = await listAuthorizedAdvertisers(config, ACCESS_TOKEN, { fetchImpl })

    const url = new URL(calls[0].url)
    assert.equal(
      url.origin + url.pathname,
      'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/',
    )
    assert.equal(url.searchParams.get('app_id'), '7668564716072534017')
    assert.equal(url.searchParams.get('secret'), APP_SECRET)
    assert.equal(calls[0].init?.headers?.['Access-Token'], ACCESS_TOKEN)
    assert.deepEqual(advertisers, [{ id: ADVERTISER, name: 'aBoks' }])
  })

  it('accepts the legacy `name` spelling and numeric ids', async () => {
    const { fetchImpl } = stubFetch([ok({ list: [{ advertiser_id: 7012, name: 'Legacy' }] })])
    assert.deepEqual(await listAuthorizedAdvertisers(config, ACCESS_TOKEN, { fetchImpl }), [
      { id: '7012', name: 'Legacy' },
    ])
  })

  it('drops entries without a usable id instead of inventing one', async () => {
    const { fetchImpl } = stubFetch([
      ok({ list: [{ advertiser_name: 'No id' }, { advertiser_id: ADVERTISER }] }),
    ])
    const advertisers = await listAuthorizedAdvertisers(config, ACCESS_TOKEN, { fetchImpl })
    assert.deepEqual(advertisers, [{ id: ADVERTISER, name: null }])
  })

  it('returns an empty list when `list` is missing entirely', async () => {
    const { fetchImpl } = stubFetch([ok({})])
    assert.deepEqual(await listAuthorizedAdvertisers(config, ACCESS_TOKEN, { fetchImpl }), [])
  })

  it('surfaces an application error even though HTTP was 200', async () => {
    const { fetchImpl } = stubFetch([
      { code: 40100, message: 'access token invalid', request_id: 'req-x' },
    ])
    await assert.rejects(
      () => listAuthorizedAdvertisers(config, ACCESS_TOKEN, { fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof TikTokAdsError)
        assert.equal(err.needsReconnect, true)
        assert.equal(err.detail.requestId, 'req-x')
        return true
      },
    )
  })
})

describe('getAdvertiserInfo', () => {
  it('requests advertiser/info with a JSON id array and no explicit field list', async () => {
    const { fetchImpl, calls } = stubFetch([
      ok({
        list: [
          {
            advertiser_id: ADVERTISER,
            advertiser_name: 'aBoks',
            currency: 'NOK',
            timezone: 'Europe/Oslo',
            create_time: 1_609_459_200,
          },
        ],
      }),
    ])
    const info = await getAdvertiserInfo(config, ACCESS_TOKEN, ADVERTISER, { fetchImpl })

    const url = new URL(calls[0].url)
    assert.equal(
      url.origin + url.pathname,
      'https://business-api.tiktok.com/open_api/v1.3/advertiser/info/',
    )
    assert.equal(url.searchParams.get('advertiser_ids'), JSON.stringify([ADVERTISER]))
    // Omitting `fields` avoids hard-coding names that moved between API generations.
    assert.equal(url.searchParams.get('fields'), null)
    assert.deepEqual(info, {
      id: ADVERTISER,
      name: 'aBoks',
      currency: 'NOK',
      timezone: 'Europe/Oslo',
      createdDate: '2021-01-01',
    })
  })

  it('falls back to display_timezone when `timezone` is absent', async () => {
    const { fetchImpl } = stubFetch([
      ok({ list: [{ advertiser_id: ADVERTISER, display_timezone: 'Europe/Oslo' }] }),
    ])
    const info = await getAdvertiserInfo(config, ACCESS_TOKEN, ADVERTISER, { fetchImpl })
    assert.equal(info.timezone, 'Europe/Oslo')
  })

  it('degrades to nulls rather than failing when optional fields are missing', async () => {
    const { fetchImpl } = stubFetch([ok({ list: [{ advertiser_id: ADVERTISER }] })])
    const info = await getAdvertiserInfo(config, ACCESS_TOKEN, ADVERTISER, { fetchImpl })
    assert.equal(info.name, null)
    assert.equal(info.currency, '')
    assert.equal(info.timezone, null)
    assert.equal(info.createdDate, null)
  })

  it('picks the matching advertiser when TikTok returns several', async () => {
    const { fetchImpl } = stubFetch([
      ok({
        list: [
          { advertiser_id: OTHER_ADVERTISER, currency: 'USD' },
          { advertiser_id: ADVERTISER, currency: 'NOK' },
        ],
      }),
    ])
    const info = await getAdvertiserInfo(config, ACCESS_TOKEN, ADVERTISER, { fetchImpl })
    assert.equal(info.currency, 'NOK')
  })

  it('fails clearly when the advertiser is not in the response', async () => {
    const { fetchImpl } = stubFetch([ok({ list: [] })])
    await assert.rejects(
      () => getAdvertiserInfo(config, ACCESS_TOKEN, ADVERTISER, { fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof TikTokAdsError)
        assert.match(err.message, /Fant ikke TikTok-annonsekontoen/)
        return true
      },
    )
  })
})

describe('getAdvertiserInfoIfPermitted', () => {
  /**
   * `GET /advertiser/info/` requires the Ad Account Management scope. A Reporting-only app is
   * refused with code 40001 — expected, and never a reason to fail: nothing in the spend
   * import needs this call.
   */
  const PERMISSION_ERROR = {
    code: 40001,
    message:
      "Permission error: The access token lacks the required scope for endpoint '/advertiser/info/(method=GET)'.",
    request_id: 'req-perm',
  }

  it('returns null on the real permission error instead of throwing', async () => {
    const { fetchImpl } = stubFetch([PERMISSION_ERROR])
    const info = await getAdvertiserInfoIfPermitted(config, ACCESS_TOKEN, ADVERTISER, {
      fetchImpl,
    })
    assert.equal(info, null)
  })

  it('hands the error to onUnavailable, tagged for the log', async () => {
    const { fetchImpl } = stubFetch([PERMISSION_ERROR])
    let seen: TikTokAdsError | null = null
    await getAdvertiserInfoIfPermitted(config, ACCESS_TOKEN, ADVERTISER, {
      fetchImpl,
      onUnavailable: (err) => {
        seen = err
      },
    })
    const err = seen as TikTokAdsError | null
    assert.ok(err)
    assert.equal(err.detail.operation, 'advertiser-info')
    assert.equal(err.detail.requestId, 'req-perm')
    assert.match(err.logLine(), /op=advertiser-info/)
    assert.ok(!err.logLine().includes(ACCESS_TOKEN))
  })

  it('returns null for any provider failure, not only a permission one', async () => {
    // The authoritative test of advertiser access is the report call, which is not swallowed;
    // classifying TikTok's codes here would only add guesswork.
    for (const body of [
      { code: 40105, message: 'token revoked' },
      { code: 50000, message: 'internal error' },
    ]) {
      const { fetchImpl } = stubFetch([body])
      assert.equal(
        await getAdvertiserInfoIfPermitted(config, ACCESS_TOKEN, ADVERTISER, {
          fetchImpl,
          maxRetries: 0,
          sleep: async () => {},
        }),
        null,
      )
    }
  })

  it('returns the metadata unchanged when the call is permitted', async () => {
    const { fetchImpl } = stubFetch([
      ok({ list: [{ advertiser_id: ADVERTISER, advertiser_name: 'aBoks', currency: 'NOK' }] }),
    ])
    const info = await getAdvertiserInfoIfPermitted(config, ACCESS_TOKEN, ADVERTISER, {
      fetchImpl,
    })
    assert.equal(info?.currency, 'NOK')
    assert.equal(info?.name, 'aBoks')
  })
})

describe('resolveCurrency', () => {
  it('prefers TikTok\'s own answer above everything else', () => {
    assert.deepEqual(
      resolveCurrency({ fromAdvertiserInfo: 'USD', fromConfig: 'NOK', fromStored: 'NOK' }),
      { code: 'USD', source: 'advertiser-info' },
    )
  })

  it('falls back to the declared config value', () => {
    assert.deepEqual(resolveCurrency({ fromConfig: 'NOK', fromStored: 'SEK' }), {
      code: 'NOK',
      source: 'config',
    })
  })

  it('falls back to the stored connection last', () => {
    assert.deepEqual(resolveCurrency({ fromStored: 'NOK' }), { code: 'NOK', source: 'stored' })
  })

  it('reports unknown rather than guessing NOK', () => {
    assert.deepEqual(resolveCurrency({}), { code: '', source: 'unknown' })
    assert.deepEqual(
      resolveCurrency({ fromAdvertiserInfo: '', fromConfig: '   ', fromStored: null }),
      { code: '', source: 'unknown' },
    )
  })

  it('normalizes case and whitespace', () => {
    assert.equal(resolveCurrency({ fromConfig: ' nok ' }).code, 'NOK')
  })
})

describe('selectAdvertiser', () => {
  const a = { id: ADVERTISER, name: 'aBoks' }
  const b = { id: OTHER_ADVERTISER, name: 'Annen konto' }

  it('selects the single authorized advertiser when none is configured', () => {
    assert.deepEqual(selectAdvertiser([a], ''), { kind: 'selected', advertiser: a })
  })

  it('selects the configured advertiser when it is authorized', () => {
    assert.deepEqual(selectAdvertiser([a, b], ADVERTISER), { kind: 'selected', advertiser: a })
  })

  it('reports "none" when the authorization covers no advertiser', () => {
    assert.deepEqual(selectAdvertiser([], ''), { kind: 'none' })
  })

  it('reports "ambiguous" — never guesses — when several are available and none is configured', () => {
    const result = selectAdvertiser([a, b], '')
    assert.equal(result.kind, 'ambiguous')
    assert.deepEqual(result.kind === 'ambiguous' && result.advertisers, [a, b])
  })

  it('never falls back to a different account when the configured one is not authorized', () => {
    const result = selectAdvertiser([b], ADVERTISER)
    assert.equal(result.kind, 'not-authorized')
    assert.equal(result.kind === 'not-authorized' && result.configuredId, ADVERTISER)
  })

  it('reports "not-authorized" rather than "none" when nothing is authorized but an id is configured', () => {
    assert.equal(selectAdvertiser([], ADVERTISER).kind, 'not-authorized')
  })
})
