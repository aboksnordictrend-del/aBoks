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
    // Every declared channel is live today, so the roadmap behaviour is asserted against a
    // synthetic def — that keeps the rule covered no matter which channels happen to ship.
    const comingSoon = { ...meta, id: 'snapchat', href: null, syncEndpoint: null, available: false }
    const card = buildChannelCard(comingSoon, false)
    assert.equal(card.status, STATUS.comingSoon)
    assert.equal(card.href, null)
    assert.equal(card.enabled, false)
    assert.equal(card.syncEndpoint, null)
    assert.equal(card.connectEndpoint, null)
    // An unavailable channel stays "Kommer snart" even if its env happens to be present.
    assert.equal(buildChannelCard(comingSoon, true).status, STATUS.comingSoon)
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

describe('Pinterest Ads card', () => {
  const pinterest = MARKETING_CHANNEL_DEFS.find((d) => d.id === 'pinterest')!

  const CONFIGURED_ENV = {
    PINTEREST_ACCESS_TOKEN: 'token',
    PINTEREST_AD_ACCOUNT_ID: '549755885175',
  }

  it('is a live channel, not a "Kommer snart" placeholder', () => {
    assert.equal(pinterest.title, 'Pinterest Ads')
    assert.equal(pinterest.available, true)
    assert.equal(pinterest.description, 'Synkroniser annonseringskostnader fra Pinterest Ads.')
    assert.ok(!/Kommer snart/i.test(pinterest.description))
  })

  it('points at its own detail route', () => {
    assert.equal(pinterest.href, MARKETING_ROUTES.pinterest)
    assert.equal(pinterest.href, '/admin/collections/marketing-expenses/pinterest')
  })

  it('counts only pinterest-ads rows, so manual entries never inflate the total', () => {
    assert.equal(pinterest.sourceValue, 'pinterest-ads')
    assert.equal(pinterest.channelValue, 'pinterest')
  })

  it('reports "Ikke konfigurert" — enabled false, but still openable — without env', () => {
    const configured = isChannelConfigured(pinterest, {})
    assert.equal(configured, false)
    const card = buildChannelCard(pinterest, configured)
    assert.equal(card.status, STATUS.notConfigured)
    assert.equal(card.enabled, false)
    // Still linked: the panel is where the missing configuration is explained.
    assert.equal(card.href, MARKETING_ROUTES.pinterest)
  })

  it('reports "Tilkoblet" with a summary when the env vars are present', () => {
    const configured = isChannelConfigured(pinterest, CONFIGURED_ENV)
    assert.equal(configured, true)
    const card = buildChannelCard(pinterest, configured, {
      totalSpend: 987.65,
      days: 7,
      lastSyncedAt: '2026-07-30T08:00:00.000Z',
      firstDate: '2026-07-24',
      lastDate: '2026-07-30',
    })
    assert.equal(card.status, 'Tilkoblet')
    assert.equal(card.enabled, true)
    assert.equal(card.summary.totalSpend, 987.65)
    assert.equal(card.summary.days, 7)
    assert.equal(card.summary.firstDate, '2026-07-24')
  })

  it('does not require the optional app credentials', () => {
    assert.ok(!pinterest.envKeys.includes('PINTEREST_APP_ID'))
    assert.ok(!pinterest.envKeys.includes('PINTEREST_APP_SECRET'))
    assert.equal(isChannelConfigured(pinterest, CONFIGURED_ENV), true)
  })

  it('treats a blank env var as not configured', () => {
    assert.equal(
      isChannelConfigured(pinterest, { ...CONFIGURED_ENV, PINTEREST_ACCESS_TOKEN: '  ' }),
      false,
    )
  })

  it('offers the quick-sync endpoint only when connected', () => {
    assert.equal(buildChannelCard(pinterest, true).syncEndpoint, MARKETING_API.pinterestSync)
    assert.equal(buildChannelCard(pinterest, false).syncEndpoint, null)
  })
})

describe('quick "Oppdater" availability across channels', () => {
  it('every card exposes a syncEndpoint field; coming-soon channels never get one', () => {
    for (const def of MARKETING_CHANNEL_DEFS) {
      const card = buildChannelCard(def, true)
      // The field is always present (the card UI reads it to enable/disable the action).
      assert.ok('syncEndpoint' in card)
      if (!def.available) {
        // Listed but not buildable → no quick sync even if "configured".
        assert.equal(card.syncEndpoint, null)
      }
    }
  })

  it('every live channel carries a sync endpoint (def level)', () => {
    const byId = Object.fromEntries(MARKETING_CHANNEL_DEFS.map((d) => [d.id, d]))
    assert.equal(byId.meta.syncEndpoint, MARKETING_API.metaSync)
    assert.equal(byId.google.syncEndpoint, MARKETING_API.googleSync)
    assert.equal(byId.pinterest.syncEndpoint, MARKETING_API.pinterestSync)
    assert.equal(byId.tiktok.syncEndpoint, MARKETING_API.tiktokSync)
  })
})

describe('TikTok Ads card', () => {
  const tiktok = MARKETING_CHANNEL_DEFS.find((d) => d.id === 'tiktok')!

  const CONFIGURED_ENV = {
    TIKTOK_APP_ID: '7668564716072534017',
    TIKTOK_APP_SECRET: 'app-secret',
    TIKTOK_REDIRECT_URI: 'https://aboks.no/api/admin/integrations/tiktok/callback',
  }

  it('is a live channel, not a "Kommer snart" placeholder', () => {
    assert.equal(tiktok.title, 'TikTok Ads')
    assert.equal(tiktok.available, true)
    assert.equal(tiktok.description, 'Synkroniser annonseringskostnader fra TikTok Ads.')
    assert.ok(!/Kommer snart/i.test(tiktok.description))
  })

  it('points at its own detail route and writes the shared channel/source values', () => {
    assert.equal(tiktok.href, MARKETING_ROUTES.tiktok)
    assert.equal(tiktok.href, '/admin/collections/marketing-expenses/tiktok')
    assert.equal(tiktok.channelValue, 'tiktok')
    assert.equal(tiktok.sourceValue, 'tiktok-ads')
  })

  it('does not require the advertiser id or an access token (OAuth supplies both)', () => {
    assert.ok(!tiktok.envKeys.includes('TIKTOK_ADVERTISER_ID'))
    assert.ok(!tiktok.envKeys.includes('TIKTOK_ACCESS_TOKEN'))
    assert.equal(isChannelConfigured(tiktok, CONFIGURED_ENV), true)
  })

  it('treats a blank env var as not configured', () => {
    assert.equal(
      isChannelConfigured(tiktok, { ...CONFIGURED_ENV, TIKTOK_APP_SECRET: '  ' }),
      false,
    )
  })

  it('reports "Ikke konfigurert" — still openable — without env', () => {
    const card = buildChannelCard(tiktok, false)
    assert.equal(card.status, STATUS.notConfigured)
    assert.equal(card.enabled, false)
    assert.equal(card.syncEndpoint, null)
    // No connect action either: connecting could not work without the app credentials.
    assert.equal(card.connectEndpoint, null)
    // Still linked: the panel is where the missing configuration is explained.
    assert.equal(card.href, MARKETING_ROUTES.tiktok)
  })

  it('reports "Ikke tilkoblet" and offers "Koble til" when configured but not authorized', () => {
    const card = buildChannelCard(tiktok, true, undefined, false)
    assert.equal(card.status, STATUS.notConnected)
    assert.equal(card.enabled, false)
    assert.equal(card.connectEndpoint, MARKETING_API.tiktokConnect)
    // Never both at once: a sync could not succeed without the authorization.
    assert.equal(card.syncEndpoint, null)
  })

  it('reports "Tilkoblet" with a summary once configured and authorized', () => {
    const card = buildChannelCard(
      tiktok,
      true,
      {
        totalSpend: 1234.5,
        days: 9,
        lastSyncedAt: '2026-07-31T08:00:00.000Z',
        firstDate: '2026-07-22',
        lastDate: '2026-07-31',
      },
      true,
    )
    assert.equal(card.status, STATUS.connected)
    assert.equal(card.enabled, true)
    assert.equal(card.syncEndpoint, MARKETING_API.tiktokSync)
    assert.equal(card.connectEndpoint, null)
    assert.equal(card.summary.totalSpend, 1234.5)
    assert.equal(card.summary.days, 9)
  })
})

describe('channels without an OAuth step are unaffected by the authorization flag', () => {
  it('defaults to authorized, so Meta/Google/Pinterest behave exactly as before', () => {
    for (const id of ['meta', 'google', 'pinterest']) {
      const def = MARKETING_CHANNEL_DEFS.find((d) => d.id === id)!
      assert.equal(def.connectEndpoint, null, id)
      const card = buildChannelCard(def, true)
      assert.equal(card.status, STATUS.connected, id)
      assert.equal(card.enabled, true, id)
      assert.equal(card.connectEndpoint, null, id)
    }
  })
})
