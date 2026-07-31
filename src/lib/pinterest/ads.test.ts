import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assertSupportedCurrency,
  getPinterestAdAccountInfo,
  getPinterestDailySpend,
  microsToAmount,
  parseCreatedDate,
} from './ads'
import type { FetchImpl } from './client'
import type { PinterestAdsConfig } from './config'
import { PinterestAdsError } from './errors'

const SECRETS = {
  appSecret: 'APP-SECRET-should-never-leak',
  accessToken: 'ACCESS-TOKEN-should-never-leak',
}

const config: PinterestAdsConfig = {
  appId: 'app-id',
  appSecret: SECRETS.appSecret,
  accessToken: SECRETS.accessToken,
  adAccountId: '549755885175',
  apiVersion: 'v5',
  baseUrl: 'https://api.pinterest.com/v5',
  historyStart: '2019-01-01',
}

/** Options that make retries instant. */
function opts(fetchImpl: FetchImpl) {
  return { config, fetchImpl, sleep: async () => {} }
}

/** A fake fetch that answers every GET with the given body, recording the URLs seen. */
function okFetch(bodyFor: (url: string) => unknown): { fetchImpl: FetchImpl; urls: string[] } {
  const urls: string[] = []
  const fetchImpl: FetchImpl = async (url) => {
    urls.push(url)
    const body = bodyFor(url)
    return {
      ok: true,
      status: 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }
  }
  return { fetchImpl, urls }
}

function spendRow(DATE: string, SPEND_IN_MICRO_DOLLAR: string | number) {
  return { DATE, SPEND_IN_MICRO_DOLLAR }
}

describe('microsToAmount', () => {
  it('divides by 1 000 000 without integer division', () => {
    assert.equal(microsToAmount(1_234_560_000), 1234.56)
    assert.equal(microsToAmount(1_500_000), 1.5)
    assert.equal(microsToAmount(500_000), 0.5)
  })

  it('keeps sub-krone amounts instead of truncating to 0', () => {
    assert.equal(microsToAmount(10_000), 0.01)
    assert.equal(microsToAmount(999_999), 1) // 0.999999 → 1.00 at 2 decimals
  })

  it('is NaN-safe', () => {
    assert.equal(microsToAmount(Number.NaN), 0)
  })
})

describe('assertSupportedCurrency', () => {
  it('accepts NOK and an unknown (empty) currency', () => {
    assert.doesNotThrow(() => assertSupportedCurrency('NOK'))
    assert.doesNotThrow(() => assertSupportedCurrency(''))
  })

  it('refuses to silently treat another currency as NOK', () => {
    assert.throws(() => assertSupportedCurrency('USD'), PinterestAdsError)
  })
})

describe('parseCreatedDate', () => {
  it('reads a Unix timestamp in seconds', () => {
    assert.equal(parseCreatedDate(1_451_431_341), '2015-12-29')
  })

  it('reads a Unix timestamp in milliseconds', () => {
    assert.equal(parseCreatedDate(1_451_431_341_000), '2015-12-29')
  })

  it('reads a numeric string', () => {
    assert.equal(parseCreatedDate('1451431341'), '2015-12-29')
  })

  it('reads an ISO timestamp', () => {
    assert.equal(parseCreatedDate('2024-03-15T10:11:12Z'), '2024-03-15')
  })

  it('returns null for anything unusable, so the configured floor applies', () => {
    assert.equal(parseCreatedDate(undefined), null)
    assert.equal(parseCreatedDate(0), null)
    assert.equal(parseCreatedDate('soon'), null)
  })
})

describe('getPinterestAdAccountInfo', () => {
  it('reads currency, name, country and creation day', async () => {
    const { fetchImpl, urls } = okFetch(() => ({
      id: '549755885175',
      name: 'aBoks',
      country: 'NO',
      currency: 'NOK',
      created_time: 1_710_500_000,
    }))

    const info = await getPinterestAdAccountInfo(opts(fetchImpl))
    assert.equal(info.id, '549755885175')
    assert.equal(info.name, 'aBoks')
    assert.equal(info.country, 'NO')
    assert.equal(info.currency, 'NOK')
    assert.equal(info.createdDate, '2024-03-15')
    assert.equal(urls.length, 1)
    assert.match(urls[0], /\/v5\/ad_accounts\/549755885175$/)
  })

  it('never puts the access token in the URL', async () => {
    const { fetchImpl, urls } = okFetch(() => ({ id: '549755885175', currency: 'NOK' }))
    await getPinterestAdAccountInfo(opts(fetchImpl))
    assert.ok(!urls[0].includes(SECRETS.accessToken))
  })
})

describe('getPinterestDailySpend — normalization', () => {
  it('maps rows to one entry per day with micros converted', async () => {
    const { fetchImpl } = okFetch(() => [
      spendRow('2026-07-20', 1_234_560_000),
      spendRow('2026-07-21', 500_000),
    ])

    const days = await getPinterestDailySpend(
      { since: '2026-07-20', until: '2026-07-21' },
      'NOK',
      opts(fetchImpl),
    )

    assert.deepEqual(days, [
      { date: '2026-07-20', spendMicros: 1_234_560_000, spend: 1234.56, currency: 'NOK' },
      { date: '2026-07-21', spendMicros: 500_000, spend: 0.5, currency: 'NOK' },
    ])
  })

  it('sums multiple rows for the same day before converting to kroner', async () => {
    const { fetchImpl } = okFetch(() => [
      spendRow('2026-07-20', 333_333),
      spendRow('2026-07-20', 333_333),
      spendRow('2026-07-20', 333_334),
    ])

    const days = await getPinterestDailySpend(
      { since: '2026-07-20', until: '2026-07-20' },
      'NOK',
      opts(fetchImpl),
    )
    assert.equal(days.length, 1)
    assert.equal(days[0].spendMicros, 1_000_000)
    assert.equal(days[0].spend, 1)
  })

  it('sends start_date, end_date, DAY granularity and the spend column', async () => {
    const { fetchImpl, urls } = okFetch(() => [])
    await getPinterestDailySpend(
      { since: '2026-07-01', until: '2026-07-31' },
      'NOK',
      opts(fetchImpl),
    )
    const url = urls[0]
    assert.match(url, /\/ad_accounts\/549755885175\/analytics\?/)
    assert.match(url, /start_date=2026-07-01/)
    assert.match(url, /end_date=2026-07-31/)
    assert.match(url, /granularity=DAY/)
    assert.match(url, /columns=SPEND_IN_MICRO_DOLLAR/)
  })

  it('accepts the { items } envelope as well as a bare array', async () => {
    const { fetchImpl } = okFetch(() => ({ items: [spendRow('2026-07-20', 1_000_000)] }))
    const days = await getPinterestDailySpend(
      { since: '2026-07-20', until: '2026-07-20' },
      'NOK',
      opts(fetchImpl),
    )
    assert.deepEqual(days.map((d) => d.spend), [1])
  })

  it('parses a spend value delivered as a string', async () => {
    const { fetchImpl } = okFetch(() => [spendRow('2026-07-20', '2500000')])
    const days = await getPinterestDailySpend(
      { since: '2026-07-20', until: '2026-07-20' },
      'NOK',
      opts(fetchImpl),
    )
    assert.equal(days[0].spend, 2.5)
  })

  it('drops rows without a usable day instead of inventing one', async () => {
    const { fetchImpl } = okFetch(() => [
      spendRow('2026-07-20', 1_000_000),
      { SPEND_IN_MICRO_DOLLAR: 9_000_000 },
      { DATE: 'i går', SPEND_IN_MICRO_DOLLAR: 9_000_000 },
    ])
    const days = await getPinterestDailySpend(
      { since: '2026-07-20', until: '2026-07-20' },
      'NOK',
      opts(fetchImpl),
    )
    assert.deepEqual(days.map((d) => d.date), ['2026-07-20'])
  })

  it('returns the days in chronological order', async () => {
    const { fetchImpl } = okFetch(() => [
      spendRow('2026-07-22', 3_000_000),
      spendRow('2026-07-20', 1_000_000),
      spendRow('2026-07-21', 2_000_000),
    ])
    const days = await getPinterestDailySpend(
      { since: '2026-07-20', until: '2026-07-22' },
      'NOK',
      opts(fetchImpl),
    )
    assert.deepEqual(days.map((d) => d.date), ['2026-07-20', '2026-07-21', '2026-07-22'])
  })

  it('rejects a malformed date and never calls the API', async () => {
    let called = false
    const fetchImpl: FetchImpl = async () => {
      called = true
      throw new Error('should not be reached')
    }
    await assert.rejects(
      () => getPinterestDailySpend({ since: '20-07-2026', until: '2026-07-21' }, 'NOK', opts(fetchImpl)),
      PinterestAdsError,
    )
    assert.equal(called, false)
  })

  it('returns nothing for an inverted range', async () => {
    const { fetchImpl, urls } = okFetch(() => [])
    const days = await getPinterestDailySpend(
      { since: '2026-07-21', until: '2026-07-20' },
      'NOK',
      opts(fetchImpl),
    )
    assert.deepEqual(days, [])
    assert.equal(urls.length, 0)
  })
})

describe('getPinterestDailySpend — failures', () => {
  it('maps a 401 to an actionable, secret-free message', async () => {
    const fetchImpl: FetchImpl = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: 2, message: 'Authentication failed' }),
      text: async () => '',
    })

    await assert.rejects(
      () => getPinterestDailySpend({ since: '2026-07-20', until: '2026-07-20' }, 'NOK', opts(fetchImpl)),
      (err: unknown) => {
        assert.ok(err instanceof PinterestAdsError)
        // Post-OAuth the fix is to re-authorize, not to paste a new env token.
        assert.match(err.message, /Koble til på nytt/)
        assert.ok(!/PINTEREST_ACCESS_TOKEN/.test(err.message))
        assert.ok(!err.message.includes(SECRETS.accessToken))
        assert.ok(!err.logLine().includes(SECRETS.accessToken))
        return true
      },
    )
  })

  it('retries a 429 and succeeds on the next attempt', async () => {
    let calls = 0
    const fetchImpl: FetchImpl = async () => {
      calls += 1
      if (calls === 1) {
        return { ok: false, status: 429, json: async () => ({ code: 29 }), text: async () => '' }
      }
      return {
        ok: true,
        status: 200,
        json: async () => [spendRow('2026-07-20', 1_000_000)],
        text: async () => '',
      }
    }

    const days = await getPinterestDailySpend(
      { since: '2026-07-20', until: '2026-07-20' },
      'NOK',
      opts(fetchImpl),
    )
    assert.equal(calls, 2)
    assert.equal(days[0].spend, 1)
  })

  it('does not retry a non-transient failure', async () => {
    let calls = 0
    const fetchImpl: FetchImpl = async () => {
      calls += 1
      return { ok: false, status: 403, json: async () => ({ code: 3 }), text: async () => '' }
    }

    await assert.rejects(
      () => getPinterestDailySpend({ since: '2026-07-20', until: '2026-07-20' }, 'NOK', opts(fetchImpl)),
      PinterestAdsError,
    )
    assert.equal(calls, 1)
  })
})
