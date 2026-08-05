import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MetaError } from '../errors'
import type { MetaCapiConfig } from './config'
import { buildPurchaseEventPayload } from './event'
import { sendPurchaseEvent, type CapiFetchImpl } from './send'

const config: MetaCapiConfig = {
  pixelId: '1234567890',
  accessToken: 'capi-token',
  graphApiVersion: 'v24.0',
  eventsUrl: 'https://graph.facebook.com/v24.0/1234567890/events',
}

const payload = buildPurchaseEventPayload({
  kustomOrderId: 'kustom-1',
  orderNumber: 'AB-000123',
  value: 748,
  email: 'ola@example.no',
  contents: [{ id: '12', quantity: 2, itemPrice: 349 }],
  eventTimeMs: 1_785_000_000_000,
})

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => JSON.stringify(body),
})

describe('sendPurchaseEvent', () => {
  it('POSTs JSON to the pixel events endpoint', async () => {
    let seenUrl = ''
    let seenInit: Parameters<CapiFetchImpl>[1] | undefined

    const fetchImpl: CapiFetchImpl = async (url, init) => {
      seenUrl = url
      seenInit = init
      return okResponse({ events_received: 1, fbtrace_id: 'AbC' })
    }

    const result = await sendPurchaseEvent(config, payload, { fetchImpl })

    assert.ok(seenUrl.startsWith('https://graph.facebook.com/v24.0/1234567890/events'))
    assert.equal(seenInit?.method, 'POST')
    assert.equal(seenInit?.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(seenInit!.body), payload)
    assert.equal(result.eventsReceived, 1)
    assert.equal(result.fbTraceId, 'AbC')
  })

  it('puts the access token in the URL and never in the body', async () => {
    let seenUrl = ''
    let seenBody = ''
    const fetchImpl: CapiFetchImpl = async (url, init) => {
      seenUrl = url
      seenBody = init.body
      return okResponse({ events_received: 1 })
    }

    await sendPurchaseEvent(config, payload, { fetchImpl })

    assert.ok(seenUrl.includes('access_token=capi-token'))
    assert.ok(!seenBody.includes('capi-token'))
  })

  it('turns a Meta error envelope into a MetaError carrying code and status', async () => {
    const fetchImpl: CapiFetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: { message: 'Invalid parameter', code: 100, error_subcode: 2804003, type: 'OAuthException' },
      }),
      text: async () => '',
    })

    await assert.rejects(
      () => sendPurchaseEvent(config, payload, { fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof MetaError)
        assert.equal(err.httpStatus, 400)
        assert.equal(err.detail.code, 100)
        assert.equal(err.detail.errorSubcode, 2804003)
        // The public message must stay token-free and safe to log.
        assert.ok(!err.message.includes('capi-token'))
        return true
      },
    )
  })

  it('turns a network failure into a MetaError that does not leak the URL', async () => {
    const fetchImpl: CapiFetchImpl = async () => {
      throw new Error('getaddrinfo ENOTFOUND graph.facebook.com')
    }

    await assert.rejects(
      () => sendPurchaseEvent(config, payload, { fetchImpl }),
      (err: unknown) => {
        assert.ok(err instanceof MetaError)
        assert.ok(!err.message.includes('capi-token'))
        return true
      },
    )
  })
})
