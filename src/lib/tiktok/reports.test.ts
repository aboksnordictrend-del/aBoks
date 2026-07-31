import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { FetchImpl } from './client'
import { getTikTokAdsConfig, type TikTokAdsConfig } from './config'
import { TikTokAdsError } from './errors'
import { getTikTokDailySpend, parseSpend, parseStatDay } from './reports'

const ACCESS_TOKEN = 'ACCESS-TOKEN-should-never-leak'
const ADVERTISER = '7012345678901234567'

const config: TikTokAdsConfig = getTikTokAdsConfig({
  TIKTOK_APP_ID: '7668564716072534017',
  TIKTOK_APP_SECRET: 'APP-SECRET-should-never-leak',
  TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
})

const ok = (data: unknown) => ({ code: 0, message: 'OK', request_id: 'req-1', data })

/** One report row in TikTok's nested dimensions/metrics shape. */
function row(day: string, spend: string | number) {
  return {
    dimensions: { advertiser_id: ADVERTISER, stat_time_day: `${day} 00:00:00` },
    metrics: { spend },
  }
}

function page(rows: unknown[], pageNo: number, totalPage: number) {
  return ok({
    list: rows,
    page_info: { page: pageNo, page_size: 1000, total_number: rows.length, total_page: totalPage },
  })
}

/** One canned response. The client reads `text()` and parses it, so that is the real stub. */
function reply(body: unknown, status = 200): Awaited<ReturnType<FetchImpl>> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

/** A fetch double that replies with `bodies[n]` for the n-th call. */
function stubFetch(bodies: unknown[], status = 200) {
  const calls: Array<{ url: string; init?: Parameters<FetchImpl>[1] }> = []
  let i = 0
  const fetchImpl: FetchImpl = async (url, init) => {
    calls.push({ url, init })
    const body = bodies[Math.min(i, bodies.length - 1)]
    i += 1
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      // The client reads the body as text and parses it, so `text` is the meaningful stub.
      text: async () => JSON.stringify(body),
    }
  }
  return { fetchImpl, calls }
}

const fetchSpend = (
  fetchImpl: FetchImpl,
  since = '2026-07-01',
  until = '2026-07-03',
  extra: Record<string, unknown> = {},
) =>
  getTikTokDailySpend(config, ACCESS_TOKEN, ADVERTISER, { since, until }, 'NOK', {
    fetchImpl,
    sleep: async () => {},
    ...extra,
  })

describe('parseStatDay', () => {
  it('takes the calendar day verbatim from stat_time_day, without parsing a Date', () => {
    assert.equal(parseStatDay('2026-07-22 00:00:00'), '2026-07-22')
    assert.equal(parseStatDay('2026-07-22'), '2026-07-22')
  })

  it('rejects a malformed or missing day', () => {
    for (const bad of [undefined, null, 42, '', '22.07.2026', '2026-7-2 00:00:00']) {
      assert.equal(parseStatDay(bad), null, String(bad))
    }
  })
})

describe('parseSpend', () => {
  it('parses TikTok\'s decimal string', () => {
    assert.equal(parseSpend('123.45'), 123.45)
    assert.equal(parseSpend(123.45), 123.45)
  })

  it('treats missing, empty, non-numeric, negative and zero spend as 0', () => {
    for (const bad of [undefined, '', '   ', 'abc', '-5', -5, 0, NaN, Infinity]) {
      assert.equal(parseSpend(bad as never), 0, String(bad))
    }
  })
})

describe('getTikTokDailySpend — request shape', () => {
  it('sends the official advertiser-level daily report parameters', async () => {
    const { fetchImpl, calls } = stubFetch([page([row('2026-07-01', '10')], 1, 1)])
    await fetchSpend(fetchImpl)

    const url = new URL(calls[0].url)
    assert.equal(
      url.origin + url.pathname,
      'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/',
    )
    assert.equal(url.searchParams.get('advertiser_id'), ADVERTISER)
    assert.equal(url.searchParams.get('service_type'), 'AUCTION')
    assert.equal(url.searchParams.get('report_type'), 'BASIC')
    assert.equal(url.searchParams.get('data_level'), 'AUCTION_ADVERTISER')
    assert.equal(url.searchParams.get('dimensions'), '["advertiser_id","stat_time_day"]')
    // Only spend: impressions and conversion value are not marketing cost.
    assert.equal(url.searchParams.get('metrics'), '["spend"]')
    assert.equal(url.searchParams.get('start_date'), '2026-07-01')
    assert.equal(url.searchParams.get('end_date'), '2026-07-03')
    assert.equal(url.searchParams.get('page'), '1')
  })

  it('passes the token in the Access-Token header, never in the URL', async () => {
    const { fetchImpl, calls } = stubFetch([page([], 1, 1)])
    await fetchSpend(fetchImpl)
    assert.equal(calls[0].init?.headers?.['Access-Token'], ACCESS_TOKEN)
    assert.ok(!calls[0].url.includes(ACCESS_TOKEN))
  })

  it('caps page_size at TikTok\'s maximum', async () => {
    const { fetchImpl, calls } = stubFetch([page([], 1, 1)])
    await fetchSpend(fetchImpl, '2026-07-01', '2026-07-03', { pageSize: 99_999 })
    assert.equal(new URL(calls[0].url).searchParams.get('page_size'), '1000')
  })

  it('makes no request at all for an inverted range', async () => {
    const { fetchImpl, calls } = stubFetch([page([], 1, 1)])
    assert.deepEqual(await fetchSpend(fetchImpl, '2026-07-05', '2026-07-01'), [])
    assert.equal(calls.length, 0)
  })

  it('rejects a malformed date before making a request', async () => {
    const { fetchImpl, calls } = stubFetch([page([], 1, 1)])
    await assert.rejects(() => fetchSpend(fetchImpl, '01.07.2026', '2026-07-03'), TikTokAdsError)
    assert.equal(calls.length, 0)
  })
})

describe('getTikTokDailySpend — parsing', () => {
  it('returns one normalized row per day, in chronological order', async () => {
    const { fetchImpl } = stubFetch([
      page([row('2026-07-03', '30.5'), row('2026-07-01', '10.25')], 1, 1),
    ])
    const days = await fetchSpend(fetchImpl)
    assert.deepEqual(days, [
      { date: '2026-07-01', spend: 10.25, currency: 'NOK' },
      { date: '2026-07-03', spend: 30.5, currency: 'NOK' },
    ])
  })

  it('sums multiple rows for the same day, rounding only once at the end', async () => {
    const { fetchImpl } = stubFetch([
      page([row('2026-07-01', '0.005'), row('2026-07-01', '0.005'), row('2026-07-01', '10')], 1, 1),
    ])
    const days = await fetchSpend(fetchImpl)
    assert.equal(days.length, 1)
    assert.equal(days[0].spend, 10.01)
  })

  it('skips rows whose day is unusable instead of inventing one', async () => {
    const { fetchImpl } = stubFetch([
      page(
        [
          { dimensions: { stat_time_day: 'not a day' }, metrics: { spend: '99' } },
          { metrics: { spend: '5' } },
          row('2026-07-02', '7'),
        ],
        1,
        1,
      ),
    ])
    const days = await fetchSpend(fetchImpl)
    assert.deepEqual(days, [{ date: '2026-07-02', spend: 7, currency: 'NOK' }])
  })

  it('treats a negative or non-numeric spend as 0 rather than reducing the day', async () => {
    const { fetchImpl } = stubFetch([
      page([row('2026-07-01', '-100'), row('2026-07-01', 'abc'), row('2026-07-01', '25')], 1, 1),
    ])
    assert.equal((await fetchSpend(fetchImpl))[0].spend, 25)
  })

  it('handles an empty report cleanly', async () => {
    const { fetchImpl } = stubFetch([page([], 1, 1)])
    assert.deepEqual(await fetchSpend(fetchImpl), [])
  })

  it('handles a response with no list and no page_info', async () => {
    const { fetchImpl } = stubFetch([ok({})])
    assert.deepEqual(await fetchSpend(fetchImpl), [])
  })

  it('echoes the account currency onto every row', async () => {
    const { fetchImpl } = stubFetch([page([row('2026-07-01', '10')], 1, 1)])
    const days = await getTikTokDailySpend(
      config,
      ACCESS_TOKEN,
      ADVERTISER,
      { since: '2026-07-01', until: '2026-07-03' },
      'NOK',
      { fetchImpl },
    )
    assert.equal(days[0].currency, 'NOK')
  })
})

describe('getTikTokDailySpend — pagination', () => {
  it('follows page_info.total_page and concatenates every page', async () => {
    const { fetchImpl, calls } = stubFetch([
      page([row('2026-07-01', '10')], 1, 3),
      page([row('2026-07-02', '20')], 2, 3),
      page([row('2026-07-03', '30')], 3, 3),
    ])
    const days = await fetchSpend(fetchImpl)

    assert.equal(calls.length, 3)
    assert.deepEqual(
      calls.map((c) => new URL(c.url).searchParams.get('page')),
      ['1', '2', '3'],
    )
    assert.deepEqual(
      days.map((d) => d.date),
      ['2026-07-01', '2026-07-02', '2026-07-03'],
    )
  })

  it('stops after a single page when total_page is 1', async () => {
    const { fetchImpl, calls } = stubFetch([page([row('2026-07-01', '10')], 1, 1)])
    await fetchSpend(fetchImpl)
    assert.equal(calls.length, 1)
  })

  it('fails loudly rather than truncating when the page count is absurd', async () => {
    const { fetchImpl } = stubFetch([page([row('2026-07-01', '1')], 1, 9999)])
    await assert.rejects(
      () => fetchSpend(fetchImpl, '2026-07-01', '2026-07-03', { maxPages: 3 }),
      /For mange sider/,
    )
  })
})

describe('getTikTokDailySpend — errors and retries', () => {
  it('treats a 200 with a non-zero code as an error, not as data', async () => {
    const { fetchImpl } = stubFetch([
      { code: 40001, message: 'invalid data_level', request_id: 'req-err' },
    ])
    await assert.rejects(
      () => fetchSpend(fetchImpl),
      (err: unknown) => {
        assert.ok(err instanceof TikTokAdsError)
        assert.equal(err.detail.code, 40001)
        assert.equal(err.retryable, false)
        return true
      },
    )
  })

  it('retries a rate limit and then succeeds', async () => {
    let attempts = 0
    const fetchImpl: FetchImpl = async () => {
      attempts += 1
      if (attempts === 1) return reply({ code: 40100, message: 'too many requests' }, 429)
      return reply(page([row('2026-07-01', '10')], 1, 1))
    }
    const days = await fetchSpend(fetchImpl)
    assert.equal(attempts, 2)
    assert.equal(days.length, 1)
  })

  it('retries TikTok\'s own 5xxxx server-error family (returned under HTTP 200)', async () => {
    let attempts = 0
    const fetchImpl: FetchImpl = async () => {
      attempts += 1
      if (attempts < 3) return reply({ code: 50000, message: 'internal error' })
      return reply(page([], 1, 1))
    }
    await fetchSpend(fetchImpl)
    assert.equal(attempts, 3)
  })

  it('never retries an authorization failure', async () => {
    let attempts = 0
    const fetchImpl: FetchImpl = async () => {
      attempts += 1
      return reply({ code: 40105, message: 'token revoked', request_id: 'r' })
    }
    await assert.rejects(() => fetchSpend(fetchImpl), TikTokAdsError)
    assert.equal(attempts, 1)
  })

  it('preserves a non-JSON body as a truncated excerpt, so a gateway page is diagnosable', async () => {
    const html = `<html><body>502 Bad Gateway ${'x'.repeat(500)}</body></html>`
    const fetchImpl: FetchImpl = async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json')
      },
      text: async () => html,
    })
    try {
      await fetchSpend(fetchImpl, '2026-07-01', '2026-07-03', { maxRetries: 0 })
      assert.fail('expected a rejection')
    } catch (err) {
      assert.ok(err instanceof TikTokAdsError)
      assert.equal(err.httpStatus, 502)
      assert.match(String(err.detail.rawBody), /502 Bad Gateway/)
      assert.ok(String(err.detail.rawBody).length <= 300, 'the excerpt is truncated')
      assert.match(err.logLine(), /raw=/)
    }
  })

  it('names the failing call in the log line, so it can be told apart from the OAuth calls', async () => {
    const fetchImpl: FetchImpl = async () =>
      reply({ code: 40001, message: 'invalid data_level', request_id: 'req-err' })
    try {
      await fetchSpend(fetchImpl)
      assert.fail('expected a rejection')
    } catch (err) {
      assert.ok(err instanceof TikTokAdsError)
      assert.equal(err.detail.operation, 'report')
      assert.match(err.logLine(), /^\[tiktok-ads\] op=report /)
    }
  })

  it('gives up after the retry budget and reports the date chunk in the log detail', async () => {
    let attempts = 0
    const fetchImpl: FetchImpl = async () => {
      attempts += 1
      return reply({ code: 50000, message: 'unavailable' }, 503)
    }
    try {
      await fetchSpend(fetchImpl)
      assert.fail('expected a rejection')
    } catch (err) {
      assert.ok(err instanceof TikTokAdsError)
      assert.equal(attempts, 3) // 1 attempt + 2 retries
      assert.equal(err.detail.chunk, '2026-07-01..2026-07-03')
      assert.match(err.logLine(), /chunk=2026-07-01\.\.2026-07-03/)
      assert.ok(!err.logLine().includes(ACCESS_TOKEN))
    }
  })

  it('maps a network failure to a retryable, secret-free error', async () => {
    const fetchImpl: FetchImpl = async () => {
      throw new Error('ECONNRESET')
    }
    await assert.rejects(
      () => fetchSpend(fetchImpl, '2026-07-01', '2026-07-03', { maxRetries: 0 }),
      (err: unknown) => {
        assert.ok(err instanceof TikTokAdsError)
        assert.equal(err.retryable, true)
        assert.match(err.message, /Kunne ikke nå TikTok Ads/)
        return true
      },
    )
  })
})
