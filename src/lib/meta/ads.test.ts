import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getMetaDailySpend } from './ads'
import type { FetchImpl } from './client'
import type { MetaConfig } from './config'
import { MetaError } from './errors'

const TOKEN = 'SECRET-TOKEN-should-never-leak'

const config: MetaConfig = {
  appId: '123',
  accessToken: TOKEN,
  adAccountId: 'act_999',
  graphApiVersion: 'v24.0',
  baseUrl: 'https://graph.facebook.com/v24.0',
}

/** Build a fake fetch that returns the given body for any URL, 200 OK. */
function okFetch(bodyFor: (url: string) => unknown): FetchImpl {
  return async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => bodyFor(url),
    text: async () => JSON.stringify(bodyFor(url)),
  })
}

function row(date: string, spend: string, currency = 'NOK') {
  return { date_start: date, date_stop: date, spend, account_currency: currency }
}

describe('getMetaDailySpend — normalization', () => {
  it('maps insights rows to MetaDailySpend[]', async () => {
    const fetchImpl = okFetch(() => ({
      data: [row('2026-07-11', '123.45'), row('2026-07-12', '10')],
    }))
    const out = await getMetaDailySpend({ since: '2026-07-11', until: '2026-07-12' }, { config, fetchImpl })
    assert.deepEqual(out, [
      { date: '2026-07-11', spend: 123.45, currency: 'NOK' },
      { date: '2026-07-12', spend: 10, currency: 'NOK' },
    ])
  })

  it('sends time_range when both dates are given and never leaks the token in output', async () => {
    let seenUrl = ''
    const fetchImpl: FetchImpl = async (url) => {
      seenUrl = url
      return { ok: true, status: 200, json: async () => ({ data: [row('2026-07-11', '5')] }), text: async () => '' }
    }
    const out = await getMetaDailySpend({ since: '2026-07-11', until: '2026-07-11' }, { config, fetchImpl })
    assert.ok(seenUrl.includes('time_range'))
    assert.ok(!JSON.stringify(out).includes(TOKEN))
  })

  it('uses date_preset=maximum when no dates are given', async () => {
    let seenUrl = ''
    const fetchImpl: FetchImpl = async (url) => {
      seenUrl = url
      return { ok: true, status: 200, json: async () => ({ data: [] }), text: async () => '' }
    }
    await getMetaDailySpend({}, { config, fetchImpl })
    assert.ok(seenUrl.includes('date_preset=maximum'))
  })
})

describe('getMetaDailySpend — pagination', () => {
  it('follows paging.next and concatenates pages', async () => {
    const fetchImpl = okFetch((url) =>
      url.includes('__page2__')
        ? { data: [row('2026-07-13', '3')] }
        : { data: [row('2026-07-11', '1'), row('2026-07-12', '2')], paging: { next: 'https://x/__page2__' } },
    )
    const out = await getMetaDailySpend({ since: '2026-07-11', until: '2026-07-13' }, { config, fetchImpl })
    assert.equal(out.length, 3)
    assert.deepEqual(out.map((d) => d.date), ['2026-07-11', '2026-07-12', '2026-07-13'])
  })
})

describe('getMetaDailySpend — edge cases', () => {
  it('returns [] for an empty response', async () => {
    const out = await getMetaDailySpend({}, { config, fetchImpl: okFetch(() => ({ data: [] })) })
    assert.deepEqual(out, [])
  })

  it('coerces invalid or negative spend to 0', async () => {
    const fetchImpl = okFetch(() => ({
      data: [row('2026-07-11', 'not-a-number'), row('2026-07-12', '-5'), row('2026-07-13', '')],
    }))
    const out = await getMetaDailySpend({}, { config, fetchImpl })
    assert.deepEqual(out.map((d) => d.spend), [0, 0, 0])
  })

  it('skips rows without a usable date', async () => {
    const fetchImpl = okFetch(() => ({ data: [{ spend: '5', account_currency: 'NOK' }, row('2026-07-11', '2')] }))
    const out = await getMetaDailySpend({}, { config, fetchImpl })
    assert.deepEqual(out, [{ date: '2026-07-11', spend: 2, currency: 'NOK' }])
  })
})

describe('getMetaDailySpend — currency guard', () => {
  it('throws (no conversion) when the account currency is not NOK', async () => {
    const fetchImpl = okFetch(() => ({ data: [row('2026-07-11', '5', 'USD')] }))
    await assert.rejects(
      () => getMetaDailySpend({}, { config, fetchImpl }),
      (err: unknown) => err instanceof MetaError && /USD/.test(err.message),
    )
  })
})

describe('getMetaDailySpend — errors', () => {
  it('maps a non-2xx Meta error envelope to MetaError without leaking the token', async () => {
    const fetchImpl: FetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'Invalid OAuth token', type: 'OAuthException', code: 190, fbtrace_id: 'AbC' },
      }),
      text: async () => '',
    })
    await assert.rejects(
      () => getMetaDailySpend({}, { config, fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof MetaError)
        assert.equal(err.httpStatus, 400)
        assert.equal(err.detail.code, 190)
        assert.ok(!err.message.includes(TOKEN))
        assert.ok(!err.logLine().includes(TOKEN))
        return true
      },
    )
  })

  it('maps an aborted request (timeout) to a MetaError', async () => {
    const fetchImpl: FetchImpl = async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    }
    await assert.rejects(
      () => getMetaDailySpend({}, { config, fetchImpl, timeoutMs: 5 }),
      (err: unknown) => err instanceof MetaError && /Tidsavbrudd/.test(err.message),
    )
  })
})
