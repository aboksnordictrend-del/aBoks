import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { MARKETING_API, STATUS } from '@/lib/marketing/channels'
import {
  TIKTOK_CALLBACK_MESSAGES,
  TikTokConnectionPanel,
  connectionState,
} from './TikTokMarketingClient'

/**
 * The TikTok connection panel's rendered surface. The surrounding client holds the fetches
 * and Payload's providers; what is asserted here is what an administrator can actually see
 * and reach in each of the four connection states — and, just as importantly, that no
 * credential is ever rendered into the client markup.
 */

const ACCESS_TOKEN = 'ACCESS-TOKEN-should-never-leak'
const APP_SECRET = 'APP-SECRET-should-never-leak'

const EMPTY_SUMMARY = {
  totalInclVat: 0,
  totalExVat: 0,
  days: 0,
  lastSyncedAt: null,
  firstDay: null,
  lastDay: null,
}

const EMPTY_SYNC = {
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastMode: null,
  lastDateFrom: null,
  lastDateTo: null,
  createdCount: null,
  updatedCount: null,
}

type Status = Parameters<typeof TikTokConnectionPanel>[0]['status']

function status(over: Partial<NonNullable<Status>> = {}): NonNullable<Status> {
  return {
    configured: true,
    configError: null,
    missingEnv: [],
    authorized: true,
    needsAdvertiser: false,
    metadataAvailable: true,
    reportingOk: true,
    needsCurrency: false,
    accountId: '•••4567',
    accountName: 'aBoks',
    connectedAt: '2026-07-31T10:00:00.000Z',
    apiVersion: 'v1.3',
    currency: 'NOK',
    timezone: 'Europe/Oslo',
    summary: EMPTY_SUMMARY,
    hasData: false,
    sync: EMPTY_SYNC,
    ...over,
  }
}

const noop = () => {}

function render(over: Partial<Parameters<typeof TikTokConnectionPanel>[0]> = {}): string {
  return renderToStaticMarkup(
    <TikTokConnectionPanel
      status={status()}
      callbackError={null}
      advertisers={null}
      advertisersError={null}
      loadingAdvertisers={false}
      onShowAdvertisers={noop}
      {...over}
    />,
  )
}

describe('connectionState', () => {
  it('maps each combination to exactly one state', () => {
    assert.equal(connectionState(null), 'not-configured')
    assert.equal(connectionState(status({ configured: false })), 'not-configured')
    assert.equal(connectionState(status({ authorized: false })), 'not-connected')
    assert.equal(connectionState(status({ needsAdvertiser: true })), 'needs-advertiser')
    assert.equal(connectionState(status({ needsCurrency: true })), 'needs-currency')
    assert.equal(connectionState(status({ reportingOk: false })), 'reporting-unavailable')
    assert.equal(connectionState(status()), 'connected')
  })

  it('treats "not configured" as stronger than "not authorized"', () => {
    assert.equal(
      connectionState(status({ configured: false, authorized: false })),
      'not-configured',
    )
  })

  it('is connected when only the optional metadata is missing', () => {
    // A refused /advertiser/info/ is not a connection problem — the spend import works.
    assert.equal(connectionState(status({ metadataAvailable: false })), 'connected')
  })

  it('ranks a missing currency above a reporting failure — both block importing', () => {
    assert.equal(
      connectionState(status({ needsCurrency: true, reportingOk: false })),
      'needs-currency',
    )
  })

  it('is connected when the probe has not run (reportingOk null)', () => {
    assert.equal(connectionState(status({ reportingOk: null })), 'connected')
  })
})

describe('TikTok connection panel — missing configuration', () => {
  const html = render({
    status: status({
      configured: false,
      authorized: false,
      configError: 'TikTok Ads-konfigurasjonen mangler eller er ugyldig: TIKTOK_APP_SECRET er ikke satt.',
      missingEnv: ['TIKTOK_APP_SECRET'],
      accountId: '—',
      accountName: null,
      currency: null,
      timezone: null,
      apiVersion: null,
    }),
  })

  it('shows the "Ikke konfigurert" badge', () => {
    assert.ok(html.includes(STATUS.notConfigured))
  })

  it('names which variable is missing, by name only', () => {
    assert.match(html, /TIKTOK_APP_SECRET/)
    assert.match(html, /Mangler: TIKTOK_APP_SECRET/)
  })

  it('offers no "Koble til" action, because connecting cannot work yet', () => {
    assert.ok(!html.includes('Koble til TikTok'))
    assert.ok(!html.includes(MARKETING_API.tiktokConnect))
  })
})

describe('TikTok connection panel — configured but not connected', () => {
  const html = render({ status: status({ authorized: false, accountId: '—', accountName: null }) })

  it('shows the "Ikke tilkoblet" badge', () => {
    assert.ok(html.includes(STATUS.notConnected))
  })

  it('offers "Koble til TikTok" pointing at the OAuth start endpoint', () => {
    assert.ok(html.includes('Koble til TikTok'))
    assert.ok(html.includes(`href="${MARKETING_API.tiktokConnect}"`))
  })

  it('explains that the setup is done and only authorization remains', () => {
    assert.match(html, /Oppsettet er på plass/)
  })
})

describe('TikTok connection panel — authorized but no advertiser chosen', () => {
  const html = render({ status: status({ needsAdvertiser: true }) })

  it('asks for TIKTOK_ADVERTISER_ID rather than claiming success', () => {
    assert.ok(html.includes(STATUS.notConnected))
    assert.match(html, /TIKTOK_ADVERTISER_ID/)
  })

  it('offers the advertiser-discovery action', () => {
    assert.ok(html.includes('Vis tilgjengelige kontoer'))
  })

  it('disables that action while it is loading', () => {
    const loading = render({ status: status({ needsAdvertiser: true }), loadingAdvertisers: true })
    assert.ok(loading.includes('Henter kontoer'))
    assert.match(loading, /<button[^>]*disabled/)
  })

  it('lists the returned advertiser names and ids once fetched', () => {
    const listed = render({
      status: status({ needsAdvertiser: true }),
      advertisers: [
        { id: '7012345678901234567', name: 'aBoks' },
        { id: '7099999999999999999', name: null },
      ],
    })
    assert.match(listed, /aBoks/)
    assert.match(listed, /7012345678901234567/)
    assert.match(listed, /Uten navn/)
  })
})

describe('TikTok connection panel — connected', () => {
  const html = render()

  it('shows the "Tilkoblet" badge with the account name and masked id', () => {
    assert.ok(html.includes(STATUS.connected))
    assert.match(html, /aBoks \(•••4567\)/)
  })

  it('shows currency, time zone and API version', () => {
    assert.match(html, /NOK/)
    assert.match(html, /Europe\/Oslo/)
    assert.match(html, /v1\.3/)
  })

  it('offers a reconnect action rather than a first-time connect', () => {
    assert.ok(html.includes('Koble til på nytt'))
    assert.ok(!html.includes('>Koble til TikTok<'))
  })

  it('links out to TikTok Ads Manager without embedding the advertiser id', () => {
    assert.ok(html.includes('Åpne TikTok Ads Manager'))
    assert.match(html, /https:\/\/ads\.tiktok\.com\/i18n\/dashboard/)
    assert.ok(!html.includes('7012345678901234567'))
  })

  it('surfaces the last failed attempt when there is one', () => {
    const failed = render({
      status: status({ sync: { ...EMPTY_SYNC, lastError: 'TikTok-kvoten er brukt opp.' } }),
    })
    assert.match(failed, /Siste forsøk feilet: TikTok-kvoten er brukt opp\./)
  })
})

describe('TikTok connection panel — Reporting-only app', () => {
  it('shows a connected account while stating that optional metadata is unavailable', () => {
    const html = render({ status: status({ metadataAvailable: false }) })
    // Connected, not an error state: the spend import is unaffected.
    assert.ok(html.includes(STATUS.connected))
    assert.match(html, /Ad Account\s+Management/)
    assert.match(html, /Import av\s+kostnader er ikke påvirket/)
  })

  it('does not show the metadata notice when metadata is available', () => {
    assert.ok(!render().includes('Ad Account'))
  })

  it('asks for TIKTOK_ADVERTISER_CURRENCY when the currency is unknown', () => {
    const html = render({ status: status({ needsCurrency: true, currency: null }) })
    assert.ok(html.includes(STATUS.notConnected))
    assert.match(html, /TIKTOK_ADVERTISER_CURRENCY/)
    assert.match(html, /gjettes aldri/)
  })

  it('never renders NOK as the currency when none is known', () => {
    const html = render({ status: status({ needsCurrency: true, currency: null }) })
    const currencyCell = html.slice(html.indexOf('Valuta'), html.indexOf('Valuta') + 220)
    assert.ok(!currencyCell.includes('NOK'), currencyCell)
  })

  it('reports a refused report probe as its own state', () => {
    const html = render({ status: status({ reportingOk: false }) })
    assert.ok(html.includes(STATUS.notConnected))
    assert.match(html, /testrapport/)
    assert.match(html, /Reporting/)
  })
})

describe('TikTok connection panel — OAuth outcome', () => {
  it('renders a Norwegian message for every reason code the callback can send', () => {
    for (const reason of Object.keys(TIKTOK_CALLBACK_MESSAGES)) {
      const html = render({ status: status({ authorized: false }), callbackError: reason })
      assert.ok(
        html.includes(TIKTOK_CALLBACK_MESSAGES[reason]),
        `no message rendered for reason "${reason}"`,
      )
    }
  })

  it('falls back to the generic message for an unknown reason code', () => {
    const html = render({ callbackError: 'something-new' })
    assert.ok(html.includes(TIKTOK_CALLBACK_MESSAGES.failed))
  })

  it('announces failures with role="alert"', () => {
    const html = render({ callbackError: 'state' })
    assert.match(html, /role="alert"/)
  })
})

describe('TikTok connection panel — no credential ever reaches the client', () => {
  it('renders neither a token nor the app secret in any state', () => {
    const states = [
      render(),
      render({ status: status({ authorized: false }) }),
      render({ status: status({ needsAdvertiser: true }) }),
      render({ status: status({ configured: false, authorized: false }) }),
      render({ callbackError: 'exchange' }),
    ]
    for (const html of states) {
      assert.ok(!html.includes(ACCESS_TOKEN))
      assert.ok(!html.includes(APP_SECRET))
      assert.ok(!/accessToken|access_token|appSecret/.test(html))
    }
  })

  it('never renders the unmasked advertiser id', () => {
    assert.ok(!render().includes('7012345678901234567'))
  })
})
