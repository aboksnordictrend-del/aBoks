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
    const pinterest = MARKETING_CHANNEL_DEFS.find((d) => d.id === 'pinterest')!
    const card = buildChannelCard(pinterest, false)
    assert.equal(card.status, STATUS.comingSoon)
    assert.equal(card.href, null)
    assert.equal(card.enabled, false)
  })

  it('sync button targets the existing sync endpoint (#8)', () => {
    assert.equal(MARKETING_API.metaSync, '/api/admin/integrations/meta/sync')
    // The constant the button uses resolves to the actually-registered endpoint path.
    assert.equal(`/api${metaSyncEndpoint.path}`, MARKETING_API.metaSync)
  })

  it('exposes the incremental-sync endpoint only on a connected card (quick "Oppdater")', () => {
    // Connected → the card carries its sync endpoint for the quick action.
    const connected = buildChannelCard(meta, true)
    assert.equal(connected.syncEndpoint, MARKETING_API.metaSync)
    // Not configured → no quick sync offered (it could only fail).
    assert.equal(buildChannelCard(meta, false).syncEndpoint, null)
  })
})

describe('Google Ads card (#15)', () => {
  const google = MARKETING_CHANNEL_DEFS.find((d) => d.id === 'google')!

  const CONFIGURED_ENV = {
    GOOGLE_ADS_CLIENT_ID: 'client-id',
    GOOGLE_ADS_CLIENT_SECRET: 'secret',
    GOOGLE_ADS_DEVELOPER_TOKEN: 'dev-token',
    GOOGLE_ADS_REFRESH_TOKEN: 'refresh-token',
    GOOGLE_ADS_CUSTOMER_ID: '1234567890',
  }

  it('is a live channel, not a "Kommer snart" placeholder', () => {
    assert.equal(google.title, 'Google Ads')
    assert.equal(google.available, true)
    assert.equal(google.description, 'Synkroniser annonseringskostnader fra Google Ads.')
    assert.ok(!/Kommer snart/i.test(google.description))
  })

  it('points at its own detail route', () => {
    assert.equal(google.href, MARKETING_ROUTES.google)
    assert.equal(google.href, '/admin/collections/marketing-expenses/google')
  })

  it('counts only google-ads rows, so manual entries never inflate the total', () => {
    assert.equal(google.sourceValue, 'google-ads')
    assert.equal(google.channelValue, 'google')
  })

  it('reports "Ikke konfigurert" — enabled false, but still openable — without env', () => {
    const configured = isChannelConfigured(google, {})
    assert.equal(configured, false)
    const card = buildChannelCard(google, configured)
    assert.equal(card.status, STATUS.notConfigured)
    assert.equal(card.enabled, false)
    // Still linked: the panel is where the missing configuration is explained.
    assert.equal(card.href, MARKETING_ROUTES.google)
  })

  it('reports "Tilkoblet" with a summary when the env vars are present', () => {
    const configured = isChannelConfigured(google, CONFIGURED_ENV)
    assert.equal(configured, true)
    const card = buildChannelCard(google, configured, {
      totalSpend: 1234.56,
      days: 14,
      lastSyncedAt: '2026-07-23T08:00:00.000Z',
      firstDate: '2026-07-09',
      lastDate: '2026-07-22',
    })
    assert.equal(card.status, 'Tilkoblet')
    assert.equal(card.enabled, true)
    assert.equal(card.summary.totalSpend, 1234.56)
    assert.equal(card.summary.days, 14)
    assert.equal(card.summary.firstDate, '2026-07-09')
  })

  it('does not require the optional manager account id', () => {
    assert.ok(!google.envKeys.includes('GOOGLE_ADS_LOGIN_CUSTOMER_ID'))
    assert.equal(isChannelConfigured(google, CONFIGURED_ENV), true)
  })

  it('treats a blank env var as not configured', () => {
    assert.equal(
      isChannelConfigured(google, { ...CONFIGURED_ENV, GOOGLE_ADS_REFRESH_TOKEN: '  ' }),
      false,
    )
  })

  it('offers the quick-sync endpoint only when connected', () => {
    assert.equal(buildChannelCard(google, true).syncEndpoint, MARKETING_API.googleSync)
    assert.equal(buildChannelCard(google, false).syncEndpoint, null)
  })
})

describe('quick "Oppdater" availability across channels', () => {
  it('every card exposes a syncEndpoint field; coming-soon channels never get one', () => {
    for (const def of MARKETING_CHANNEL_DEFS) {
      const card = buildChannelCard(def, true)
      // The field is always present (the card UI reads it to enable/disable the action).
      assert.ok('syncEndpoint' in card)
      if (!def.available) {
        // Pinterest / TikTok: listed but not buildable → no quick sync even if "configured".
        assert.equal(card.syncEndpoint, null)
      }
    }
  })

  it('live channels carry a sync endpoint, coming-soon ones do not (def level)', () => {
    const byId = Object.fromEntries(MARKETING_CHANNEL_DEFS.map((d) => [d.id, d]))
    assert.equal(byId.meta.syncEndpoint, MARKETING_API.metaSync)
    assert.equal(byId.google.syncEndpoint, MARKETING_API.googleSync)
    assert.equal(byId.pinterest.syncEndpoint, null)
    assert.equal(byId.tiktok.syncEndpoint, null)
  })
})
