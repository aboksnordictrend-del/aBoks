import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getMetaCapiConfig } from './config'

const configured = {
  META_PIXEL_ID: '1234567890',
  META_CAPI_ACCESS_TOKEN: 'capi-token',
}

describe('getMetaCapiConfig', () => {
  it('builds the events endpoint for the configured pixel and version', () => {
    const cfg = getMetaCapiConfig({ ...configured, META_GRAPH_API_VERSION: 'v24.0' })
    assert.ok(cfg)
    assert.equal(cfg.eventsUrl, 'https://graph.facebook.com/v24.0/1234567890/events')
  })

  it('defaults the Graph API version when it is not set', () => {
    const cfg = getMetaCapiConfig(configured)
    assert.equal(cfg?.graphApiVersion, 'v24.0')
  })

  it('returns null — never throws — when the integration is not configured', () => {
    assert.equal(getMetaCapiConfig({}), null)
    assert.equal(getMetaCapiConfig({ META_PIXEL_ID: '123' }), null)
    assert.equal(getMetaCapiConfig({ META_CAPI_ACCESS_TOKEN: 'tok' }), null)
    assert.equal(getMetaCapiConfig({ ...configured, META_PIXEL_ID: '   ' }), null)
  })

  it('carries the test event code only when it is set and non-blank', () => {
    assert.equal(getMetaCapiConfig(configured)?.testEventCode, undefined)
    assert.equal(
      getMetaCapiConfig({ ...configured, META_TEST_EVENT_CODE: '  ' })?.testEventCode,
      undefined,
    )
    assert.equal(
      getMetaCapiConfig({ ...configured, META_TEST_EVENT_CODE: 'TEST12345' })?.testEventCode,
      'TEST12345',
    )
  })
})
