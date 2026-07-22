import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { getMetaConfig, MetaConfigError } from './config'

// getMetaConfig reads process.env; snapshot + restore around each case.
const KEYS = ['META_APP_ID', 'META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_GRAPH_API_VERSION']
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))
  process.env.META_ACCESS_TOKEN = 'token-value'
  process.env.META_GRAPH_API_VERSION = 'v24.0'
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('getMetaConfig — account id normalization', () => {
  const canonical = 'act_1342658407836944'

  it('keeps a well-formed act_ id', () => {
    process.env.META_AD_ACCOUNT_ID = 'act_1342658407836944'
    assert.equal(getMetaConfig().adAccountId, canonical)
  })

  it('repairs the `=` typo (act=123 → act_123), not a double prefix', () => {
    process.env.META_AD_ACCOUNT_ID = 'act=1342658407836944'
    const id = getMetaConfig().adAccountId
    assert.equal(id, canonical)
    assert.ok(!id.startsWith('act_act'))
  })

  it('adds the prefix to a bare numeric id', () => {
    process.env.META_AD_ACCOUNT_ID = '1342658407836944'
    assert.equal(getMetaConfig().adAccountId, canonical)
  })

  it('collapses an accidental double prefix (act_act_123 → act_123)', () => {
    process.env.META_AD_ACCOUNT_ID = 'act_act_1342658407836944'
    assert.equal(getMetaConfig().adAccountId, canonical)
  })

  it('throws a clear error when there is no numeric id', () => {
    process.env.META_AD_ACCOUNT_ID = 'act_'
    assert.throws(() => getMetaConfig(), MetaConfigError)
  })

  it('throws when the token is missing (never returned to a client)', () => {
    delete process.env.META_ACCESS_TOKEN
    process.env.META_AD_ACCOUNT_ID = canonical
    assert.throws(() => getMetaConfig(), MetaConfigError)
  })

  it('reads the Graph API version from env', () => {
    process.env.META_AD_ACCOUNT_ID = canonical
    process.env.META_GRAPH_API_VERSION = 'v24.0'
    const cfg = getMetaConfig()
    assert.equal(cfg.graphApiVersion, 'v24.0')
    assert.equal(cfg.baseUrl, 'https://graph.facebook.com/v24.0')
  })
})
