import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MARKETING_API,
  MARKETING_CHANNEL_DEFS,
  MARKETING_ROUTES,
  STATUS,
  buildChannelCard,
  channelStatusLabel,
  isChannelConfigured,
} from './channels'
import { metaSyncEndpoint } from '../../endpoints/metaSync'

const meta = MARKETING_CHANNEL_DEFS.find((d) => d.id === 'meta')!

describe('marketing channel catalog', () => {
  it('includes a Meta Ads card (#1)', () => {
    assert.ok(meta, 'meta channel def exists')
    assert.equal(meta.title, 'Meta Ads')
    assert.equal(meta.description, 'Synkroniser annonseringskostnader fra Meta Ads.')
    assert.equal(meta.available, true)
  })

  it('points the Meta card at the correct route (#2)', () => {
    const card = buildChannelCard(meta, true)
    assert.equal(card.href, MARKETING_ROUTES.meta)
    assert.equal(card.href, '/admin/collections/marketing-expenses/meta')
  })

  it('reports "Ikke konfigurert" when the env vars are missing (#3)', () => {
    const configured = isChannelConfigured(meta, {})
    assert.equal(configured, false)
    assert.equal(channelStatusLabel(meta, configured), STATUS.notConfigured)
    assert.equal(buildChannelCard(meta, configured).status, 'Ikke konfigurert')
    assert.equal(buildChannelCard(meta, configured).enabled, false)
  })

  it('reports "Tilkoblet" when the env vars are present (#4)', () => {
    const env = { META_ACCESS_TOKEN: 'tok', META_AD_ACCOUNT_ID: 'act_123' }
    const configured = isChannelConfigured(meta, env)
    assert.equal(configured, true)
    assert.equal(channelStatusLabel(meta, configured), STATUS.connected)
    assert.equal(buildChannelCard(meta, configured).status, 'Tilkoblet')
    assert.equal(buildChannelCard(meta, configured).enabled, true)
  })

  it('treats a blank env var as not configured', () => {
    assert.equal(isChannelConfigured(meta, { META_ACCESS_TOKEN: '  ', META_AD_ACCOUNT_ID: 'act_1' }), false)
  })

  it('marks not-yet-available channels as "Kommer snart" with no href', () => {
    const google = MARKETING_CHANNEL_DEFS.find((d) => d.id === 'google')!
    const card = buildChannelCard(google, false)
    assert.equal(card.status, STATUS.comingSoon)
    assert.equal(card.href, null)
    assert.equal(card.enabled, false)
  })

  it('sync button targets the existing sync endpoint (#8)', () => {
    assert.equal(MARKETING_API.metaSync, '/api/admin/integrations/meta/sync')
    // The constant the button uses resolves to the actually-registered endpoint path.
    assert.equal(`/api${metaSyncEndpoint.path}`, MARKETING_API.metaSync)
  })
})
