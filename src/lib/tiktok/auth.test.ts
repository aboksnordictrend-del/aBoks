import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildAuthorizationUrl, exchangeAuthCode } from './auth'
import { getTikTokAdsConfig, type TikTokAdsConfig } from './config'
import { TikTokAdsError } from './errors'
import type { FetchImpl } from './client'

const APP_SECRET = 'APP-SECRET-should-never-leak'
const ACCESS_TOKEN = 'ACCESS-TOKEN-should-never-leak'
const AUTH_CODE = 'AUTH-CODE-should-never-leak'

const config: TikTokAdsConfig = getTikTokAdsConfig({
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: APP_SECRET,
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
})

/** A fetch double that records what it was called with and replies with `body`. */
function stubFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: Parameters<FetchImpl>[1] }> = []
  const fetchImpl: FetchImpl = async (url, init) => {
    calls.push({ url, init })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }
  return { fetchImpl, calls }
}

const ok = (data: unknown) => ({ code: 0, message: 'OK', request_id: 'req-1', data })

describe('buildAuthorizationUrl', () => {
  it('targets TikTok\'s portal auth endpoint with app_id, state and redirect_uri', () => {
    const url = new URL(buildAuthorizationUrl(config, 'STATE-VALUE'))
    assert.equal(url.origin + url.pathname, 'https://business-api.tiktok.com/portal/auth')
    assert.equal(url.searchParams.get('app_id'), '7668564716072534017')
    assert.equal(url.searchParams.get('state'), 'STATE-VALUE')
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://aboks.no/api/admin/integrations/tiktok/callback',
    )
  })

  it('URL-encodes the redirect URI rather than pasting it raw', () => {
    assert.match(buildAuthorizationUrl(config, 's'), /redirect_uri=https%3A%2F%2Faboks\.no/)
  })

  it('never places the app secret in the authorization URL', () => {
    assert.ok(!buildAuthorizationUrl(config, 'STATE').includes(APP_SECRET))
  })
})

describe('exchangeAuthCode', () => {
  it('POSTs app_id, secret and auth_code as JSON to the v1.3 token endpoint', async () => {
    const { fetchImpl, calls } = stubFetch(
      ok({ access_token: ACCESS_TOKEN, advertiser_ids: ['7012345678901234567'] }),
    )
    const grant = await exchangeAuthCode(config, AUTH_CODE, { fetchImpl })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/')
    assert.equal(calls[0].init?.method, 'POST')
    assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
      app_id: '7668564716072534017',
      secret: APP_SECRET,
      auth_code: AUTH_CODE,
    })
    assert.equal(grant.accessToken, ACCESS_TOKEN)
    assert.deepEqual(grant.advertiserIds, ['7012345678901234567'])
  })

  it('never puts the secret or the code in the URL (they stay in the body)', async () => {
    const { fetchImpl, calls } = stubFetch(ok({ access_token: ACCESS_TOKEN }))
    await exchangeAuthCode(config, AUTH_CODE, { fetchImpl })
    assert.ok(!calls[0].url.includes(APP_SECRET))
    assert.ok(!calls[0].url.includes(AUTH_CODE))
  })

  it('normalizes numeric advertiser ids to digit strings', async () => {
    const { fetchImpl } = stubFetch(
      ok({ access_token: ACCESS_TOKEN, advertiser_ids: [7012345678901234567, '  ', 'abc'] }),
    )
    const grant = await exchangeAuthCode(config, AUTH_CODE, { fetchImpl })
    assert.equal(grant.advertiserIds.length, 1)
    assert.match(grant.advertiserIds[0], /^\d+$/)
  })

  it('tolerates a response with no advertiser_ids array', async () => {
    const { fetchImpl } = stubFetch(ok({ access_token: ACCESS_TOKEN }))
    assert.deepEqual((await exchangeAuthCode(config, AUTH_CODE, { fetchImpl })).advertiserIds, [])
  })

  it('rejects an empty auth code before making a request', async () => {
    const { fetchImpl, calls } = stubFetch(ok({ access_token: ACCESS_TOKEN }))
    await assert.rejects(() => exchangeAuthCode(config, '   ', { fetchImpl }), TikTokAdsError)
    assert.equal(calls.length, 0)
  })

  it('treats a 200 with a non-zero code as a failure (TikTok answers 200 for errors)', async () => {
    const { fetchImpl } = stubFetch({
      code: 40001,
      message: 'auth_code is invalid',
      request_id: 'req-err',
    })
    await assert.rejects(
      () => exchangeAuthCode(config, AUTH_CODE, { fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof TikTokAdsError)
        assert.equal(err.detail.code, 40001)
        assert.equal(err.detail.requestId, 'req-err')
        return true
      },
    )
  })

  it('rejects a 200 that carries no access_token rather than storing an empty one', async () => {
    const { fetchImpl } = stubFetch(ok({ scope: [1, 2] }))
    await assert.rejects(() => exchangeAuthCode(config, AUTH_CODE, { fetchImpl }), TikTokAdsError)
  })

  it('rejects a malformed (non-object) body', async () => {
    const { fetchImpl } = stubFetch('not json at all')
    await assert.rejects(() => exchangeAuthCode(config, AUTH_CODE, { fetchImpl }), TikTokAdsError)
  })

  it('never retries: the auth code is single-use, so a second attempt would always fail', async () => {
    let attempts = 0
    const fetchImpl: FetchImpl = async () => {
      attempts += 1
      // A 500 is normally retryable — but not for this call.
      const body = { code: 50000, message: 'server error' }
      return {
        ok: false,
        status: 500,
        json: async () => body,
        text: async () => JSON.stringify(body),
      }
    }
    await assert.rejects(
      () => exchangeAuthCode(config, AUTH_CODE, { fetchImpl, sleep: async () => {} }),
      TikTokAdsError,
    )
    assert.equal(attempts, 1)
  })

  it('keeps the token and the secret out of the thrown error', async () => {
    const { fetchImpl } = stubFetch({
      code: 40105,
      message: `token ${ACCESS_TOKEN} rejected`,
      request_id: 'req-err',
    })
    try {
      await exchangeAuthCode(config, AUTH_CODE, { fetchImpl })
      assert.fail('expected a rejection')
    } catch (err) {
      assert.ok(err instanceof TikTokAdsError)
      // The *public* message is our own Norwegian copy, never TikTok's echoed text.
      assert.ok(!err.message.includes(ACCESS_TOKEN))
      assert.ok(!err.message.includes(APP_SECRET))
      assert.match(err.message, /Koble til TikTok på nytt/)
    }
  })

  it('tags the failure as the token exchange, so the log names the call', async () => {
    const { fetchImpl } = stubFetch({
      code: 40002,
      message: 'auth_code has expired',
      request_id: 'req-err',
    })
    try {
      await exchangeAuthCode(config, AUTH_CODE, { fetchImpl })
      assert.fail('expected a rejection')
    } catch (err) {
      assert.ok(err instanceof TikTokAdsError)
      assert.equal(err.detail.operation, 'token-exchange')
      const line = err.logLine()
      assert.match(line, /^\[tiktok-ads\] op=token-exchange /)
      assert.match(line, /code=40002/)
      assert.match(line, /request_id=req-err/)
      assert.match(line, /message="auth_code has expired"/)
      // The line is the diagnostic record — it must still carry no credential.
      assert.ok(!line.includes(APP_SECRET))
      assert.ok(!line.includes(AUTH_CODE))
    }
  })
})
