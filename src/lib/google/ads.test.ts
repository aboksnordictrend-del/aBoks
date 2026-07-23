import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSupportedCurrency,
  findEarliestSpendDate,
  getGoogleAdsAccountInfo,
  getGoogleAdsDailySpend,
  microsToAmount,
} from './ads'
import type { FetchImpl } from './auth'
import type { GoogleAdsConfig } from './config'
import { GoogleAdsError } from './errors'

const SECRETS = {
  clientSecret: 'CLIENT-SECRET-should-never-leak',
  refreshToken: 'REFRESH-TOKEN-should-never-leak',
  developerToken: 'DEV-TOKEN-should-never-leak',
}

const config: GoogleAdsConfig = {
  clientId: 'client-id',
  clientSecret: SECRETS.clientSecret,
  developerToken: SECRETS.developerToken,
  refreshToken: SECRETS.refreshToken,
  customerId: '1234567890',
  loginCustomerId: '9876543210',
  apiVersion: 'v24',
  baseUrl: 'https://googleads.googleapis.com/v24',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  historyStart: '2015-01-01',
}

/** Options that bypass OAuth and make retries instant. */
function opts(fetchImpl: FetchImpl) {
  return {
    config,
    fetchImpl,
    getToken: async () => 'access-token',
    sleep: async () => {},
  }
}

/** A fake fetch that answers every search POST with the given body. */
function okFetch(bodyFor: (body: string) => unknown): FetchImpl {
  return async (_url, init) => {
    const payload = bodyFor(init?.body ?? '')
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    }
  }
}

function spendRow(date: string, costMicros: string | number) {
  return { segments: { date }, metrics: { costMicros } }
}

describe('microsToAmount (#2, #12)', () => {
  it('divides by 1 000 000 without integer division', () => {
    assert.equal(microsToAmount(1_234_560_000), 1234.56)
    assert.equal(microsToAmount(1_500_000), 1.5)
    assert.equal(microsToAmount(500_000), 0.5)
  })

  it('keeps sub-krone amounts instead of truncating to 0', () => {
    assert.equal(microsToAmount(10_000), 0.01)
    assert.equal(microsToAmount(1_000), 0)
    assert.equal(microsToAmount(999_999), 1) // 0.999999 → 1.00 at 2 decimals
  })

  it('is NaN-safe', () => {
    assert.equal(microsToAmount(Number.NaN), 0)
  })
})

describe('getGoogleAdsDailySpend — normalization', () => {
  it('maps rows to one entry per day with micros converted (#2)', async () => {
    const fetchImpl = okFetch(() => ({
      results: [spendRow('2026-07-11', '123450000'), spendRow('2026-07-12', '10000000')],
    }))
    const out = await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-12' }, 'NOK', opts(fetchImpl))
    assert.deepEqual(out, [
      { date: '2026-07-11', costMicros: 123_450_000, spend: 123.45, currency: 'NOK' },
      { date: '2026-07-12', costMicros: 10_000_000, spend: 10, currency: 'NOK' },
    ])
  })

  it('aggregates several rows for the same day into one total (#3)', async () => {
    // Simulates a response split across campaigns: 3 rows, 1 calendar day.
    const fetchImpl = okFetch(() => ({
      results: [
        spendRow('2026-07-11', '1000000'),
        spendRow('2026-07-11', '2500000'),
        spendRow('2026-07-11', '333333'),
      ],
    }))
    const out = await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-11' }, 'NOK', opts(fetchImpl))
    assert.equal(out.length, 1)
    // Micros are summed as integers first, then converted exactly once.
    assert.equal(out[0].costMicros, 3_833_333)
    assert.equal(out[0].spend, 3.83)
  })

  it('sends a GAQL query with the literal dates and never shifts them (#13)', async () => {
    let seenBody = ''
    const fetchImpl: FetchImpl = async (_url, init) => {
      seenBody = init?.body ?? ''
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => '' }
    }
    await getGoogleAdsDailySpend({ since: '2026-01-01', until: '2026-12-31' }, 'NOK', opts(fetchImpl))
    assert.ok(seenBody.includes("segments.date BETWEEN '2026-01-01' AND '2026-12-31'"))
    assert.ok(seenBody.includes('metrics.cost_micros'))
  })

  it('never sends pageSize — v24 rejects it with PAGE_SIZE_NOT_SUPPORTED', async () => {
    // Regression guard: the live API answers 400 INVALID_ARGUMENT /
    // PAGE_SIZE_NOT_SUPPORTED when the request body carries pageSize. Paging must come
    // from nextPageToken alone.
    let seenBody = ''
    const fetchImpl: FetchImpl = async (_url, init) => {
      seenBody = init?.body ?? ''
      return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => '' }
    }
    await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-12' }, 'NOK', opts(fetchImpl))
    assert.ok(!seenBody.includes('pageSize'), 'request body must not contain pageSize')
    assert.deepEqual(Object.keys(JSON.parse(seenBody)), ['query'])
  })

  it('sends only query + pageToken when following a page', async () => {
    const bodies: string[] = []
    const fetchImpl: FetchImpl = async (_url, init) => {
      bodies.push(init?.body ?? '')
      const first = bodies.length === 1
      return {
        ok: true,
        status: 200,
        json: async () =>
          first
            ? { results: [spendRow('2026-07-11', '1000000')], nextPageToken: 'tok-2' }
            : { results: [spendRow('2026-07-12', '2000000')] },
        text: async () => '',
      }
    }
    await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-12' }, 'NOK', opts(fetchImpl))
    assert.equal(bodies.length, 2)
    assert.deepEqual(Object.keys(JSON.parse(bodies[1])).sort(), ['pageToken', 'query'])
    assert.equal(JSON.parse(bodies[1]).pageToken, 'tok-2')
  })

  it('returns the day exactly as Google reported it (#13)', async () => {
    // A date that would roll backwards if parsed as a local-midnight Date in a UTC+ zone.
    const fetchImpl = okFetch(() => ({ results: [spendRow('2026-01-01', '1000000')] }))
    const out = await getGoogleAdsDailySpend({ since: '2026-01-01', until: '2026-01-01' }, 'NOK', opts(fetchImpl))
    assert.equal(out[0].date, '2026-01-01')
  })

  it('follows nextPageToken and concatenates pages', async () => {
    const fetchImpl = okFetch((body) =>
      body.includes('page-2')
        ? { results: [spendRow('2026-07-13', '3000000')] }
        : {
            results: [spendRow('2026-07-11', '1000000'), spendRow('2026-07-12', '2000000')],
            nextPageToken: 'page-2',
          },
    )
    const out = await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-13' }, 'NOK', opts(fetchImpl))
    assert.deepEqual(out.map((d) => d.date), ['2026-07-11', '2026-07-12', '2026-07-13'])
  })

  it('coerces invalid or negative cost to 0 and skips undated rows', async () => {
    const fetchImpl = okFetch(() => ({
      results: [
        spendRow('2026-07-11', 'not-a-number'),
        spendRow('2026-07-12', '-5000000'),
        { metrics: { costMicros: '9000000' } }, // no date ⇒ unusable
      ],
    }))
    const out = await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-12' }, 'NOK', opts(fetchImpl))
    assert.deepEqual(out.map((d) => [d.date, d.spend]), [
      ['2026-07-11', 0],
      ['2026-07-12', 0],
    ])
  })

  it('returns [] for an empty response and for an inverted range', async () => {
    const fetchImpl = okFetch(() => ({ results: [] }))
    assert.deepEqual(await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-12' }, 'NOK', opts(fetchImpl)), [])
    assert.deepEqual(await getGoogleAdsDailySpend({ since: '2026-07-12', until: '2026-07-11' }, 'NOK', opts(fetchImpl)), [])
  })

  it('never leaks a secret into the returned rows (#11)', async () => {
    const fetchImpl = okFetch(() => ({ results: [spendRow('2026-07-11', '1000000')] }))
    const out = await getGoogleAdsDailySpend({ since: '2026-07-11', until: '2026-07-11' }, 'NOK', opts(fetchImpl))
    const json = JSON.stringify(out)
    for (const secret of Object.values(SECRETS)) assert.ok(!json.includes(secret))
  })
})

describe('getGoogleAdsAccountInfo', () => {
  it('reads currency, time zone and name', async () => {
    const fetchImpl = okFetch(() => ({
      results: [
        {
          customer: {
            id: '1234567890',
            currencyCode: 'NOK',
            timeZone: 'Europe/Oslo',
            descriptiveName: 'aBoks',
          },
        },
      ],
    }))
    const info = await getGoogleAdsAccountInfo(opts(fetchImpl))
    assert.deepEqual(info, {
      id: '1234567890',
      currencyCode: 'NOK',
      timeZone: 'Europe/Oslo',
      descriptiveName: 'aBoks',
    })
  })

  it('throws a clear error when the account is not returned', async () => {
    const fetchImpl = okFetch(() => ({ results: [] }))
    await assert.rejects(
      () => getGoogleAdsAccountInfo(opts(fetchImpl)),
      (err: unknown) => err instanceof GoogleAdsError && /Fant ikke Google Ads-kontoen/.test(err.message),
    )
  })

  it('sends the developer token and login-customer-id as headers only', async () => {
    let seenHeaders: Record<string, string> = {}
    const fetchImpl: FetchImpl = async (_url, init) => {
      seenHeaders = init?.headers ?? {}
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [{ customer: { id: '1', currencyCode: 'NOK', timeZone: 'UTC' } }] }),
        text: async () => '',
      }
    }
    await getGoogleAdsAccountInfo(opts(fetchImpl))
    assert.equal(seenHeaders['developer-token'], SECRETS.developerToken)
    assert.equal(seenHeaders['login-customer-id'], '9876543210')
  })
})

describe('currency guard', () => {
  it('accepts NOK and an unknown/blank code', () => {
    assert.doesNotThrow(() => assertSupportedCurrency('NOK'))
    assert.doesNotThrow(() => assertSupportedCurrency(''))
  })

  it('throws (no conversion) for another currency', () => {
    assert.throws(
      () => assertSupportedCurrency('USD'),
      (err: unknown) => err instanceof GoogleAdsError && /USD/.test(err.message),
    )
  })
})

describe('findEarliestSpendDate', () => {
  it('asks for a single, ascending row and returns its date', async () => {
    let seenBody = ''
    const fetchImpl: FetchImpl = async (_url, init) => {
      seenBody = init?.body ?? ''
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [spendRow('2025-03-04', '1000000')] }),
        text: async () => '',
      }
    }
    const date = await findEarliestSpendDate({ since: '2015-01-01', until: '2026-07-23' }, opts(fetchImpl))
    assert.equal(date, '2025-03-04')
    assert.ok(seenBody.includes('ORDER BY segments.date ASC LIMIT 1'))
  })

  it('returns null when the account has no data at all', async () => {
    const fetchImpl = okFetch(() => ({ results: [] }))
    assert.equal(await findEarliestSpendDate({ since: '2015-01-01', until: '2026-07-23' }, opts(fetchImpl)), null)
  })
})

describe('Google Ads API errors → internal errors (#14)', () => {
  function errorFetch(status: number, body: unknown): FetchImpl {
    return async () => ({
      ok: false,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })
  }

  it('maps a test-access developer token to an actionable Basic Access message', async () => {
    const fetchImpl = errorFetch(403, {
      error: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'The developer token is only approved for use with test accounts.',
        details: [
          {
            requestId: 'req-1',
            errors: [
              {
                errorCode: { authorizationError: 'DEVELOPER_TOKEN_NOT_APPROVED' },
                message: 'test accounts only',
              },
            ],
          },
        ],
      },
    })
    await assert.rejects(
      () => getGoogleAdsAccountInfo({ ...opts(fetchImpl), maxRetries: 0 }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleAdsError)
        assert.match(err.message, /Basic Access/)
        assert.equal(err.httpStatus, 403)
        assert.equal(err.detail.errorValue, 'DEVELOPER_TOKEN_NOT_APPROVED')
        return true
      },
    )
  })

  it('maps a revoked OAuth token, a missing customer and a bad login-customer-id', async () => {
    const cases: Array<[string, RegExp]> = [
      ['OAUTH_TOKEN_REVOKED', /trukket tilbake/],
      ['CUSTOMER_NOT_FOUND', /Fant ikke Google Ads-kontoen/],
      ['CUSTOMER_NOT_ENABLED', /ikke aktiv/],
      ['CUSTOMER_NOT_ALLOWED_FOR_THIS_LOGIN_CUSTOMER_ID', /Administratorkontoen/],
      ['USER_PERMISSION_DENIED', /mangler tilgang/],
    ]
    for (const [value, expected] of cases) {
      const fetchImpl = errorFetch(403, {
        error: {
          status: 'PERMISSION_DENIED',
          details: [{ errors: [{ errorCode: { authenticationError: value } }] }],
        },
      })
      await assert.rejects(
        () => getGoogleAdsAccountInfo({ ...opts(fetchImpl), maxRetries: 0 }),
        (err: unknown) => err instanceof GoogleAdsError && expected.test(err.message),
      )
    }
  })

  it('maps a quota error and a retired API version', async () => {
    const quota = errorFetch(429, { error: { status: 'RESOURCE_EXHAUSTED' } })
    await assert.rejects(
      () => getGoogleAdsAccountInfo({ ...opts(quota), maxRetries: 0 }),
      (err: unknown) => err instanceof GoogleAdsError && /kvoten/.test(err.message),
    )

    const gone = errorFetch(404, { error: { status: 'NOT_FOUND' } })
    await assert.rejects(
      () => getGoogleAdsAccountInfo({ ...opts(gone), maxRetries: 0 }),
      (err: unknown) => err instanceof GoogleAdsError && /GOOGLE_ADS_API_VERSION/.test(err.message),
    )
  })

  it('maps a network timeout without leaking the request', async () => {
    const fetchImpl: FetchImpl = async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    }
    await assert.rejects(
      () => getGoogleAdsAccountInfo({ ...opts(fetchImpl), timeoutMs: 5, maxRetries: 0 }),
      (err: unknown) => err instanceof GoogleAdsError && /Tidsavbrudd/.test(err.message),
    )
  })

  it('never leaks a secret in the message or the log line (#11)', async () => {
    const fetchImpl = errorFetch(400, {
      error: {
        status: 'INVALID_ARGUMENT',
        details: [{ requestId: 'r1', errors: [{ errorCode: { queryError: 'UNRECOGNIZED_FIELD' } }] }],
      },
    })
    await assert.rejects(
      () => getGoogleAdsAccountInfo({ ...opts(fetchImpl), maxRetries: 0 }),
      (err: unknown) => {
        assert.ok(err instanceof GoogleAdsError)
        for (const secret of Object.values(SECRETS)) {
          assert.ok(!err.message.includes(secret))
          assert.ok(!err.logLine().includes(secret))
        }
        assert.match(err.logLine(), /request_id=r1/)
        return true
      },
    )
  })

  it('retries a transient 500 and succeeds on the next attempt', async () => {
    let calls = 0
    const fetchImpl: FetchImpl = async () => {
      calls += 1
      if (calls === 1) {
        return { ok: false, status: 503, json: async () => ({ error: { status: 'UNAVAILABLE' } }), text: async () => '' }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [{ customer: { id: '1', currencyCode: 'NOK', timeZone: 'UTC' } }] }),
        text: async () => '',
      }
    }
    const info = await getGoogleAdsAccountInfo(opts(fetchImpl))
    assert.equal(calls, 2)
    assert.equal(info.currencyCode, 'NOK')
  })

  it('does not retry a non-transient error', async () => {
    let calls = 0
    const fetchImpl: FetchImpl = async () => {
      calls += 1
      return {
        ok: false,
        status: 403,
        json: async () => ({ error: { status: 'PERMISSION_DENIED' } }),
        text: async () => '',
      }
    }
    await assert.rejects(() => getGoogleAdsAccountInfo(opts(fetchImpl)))
    assert.equal(calls, 1)
  })
})
