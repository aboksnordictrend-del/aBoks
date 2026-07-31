// Extensible marketing-channel catalog. Adding a future channel (TikTok/Snapchat/…)
// is a matter of appending a definition here and — once it has a sync — a detail view;
// the catalog page and its data endpoint iterate this list and need no rewrite.
//
// No secrets live here. "Connected" status is derived from the *presence* of server env
// vars (never their values), and only ever computed on the server.

import { MARKETING_CHANNELS } from '../marketingChannels'

export const MARKETING_COLLECTION_SLUG = 'marketing-expenses'
const ADMIN_BASE = `/admin/collections/${MARKETING_COLLECTION_SLUG}`

/** Admin URLs for the marketing section (used by views, cards and the back links). */
export const MARKETING_ROUTES = {
  catalog: ADMIN_BASE,
  meta: `${ADMIN_BASE}/meta`,
  google: `${ADMIN_BASE}/google`,
  pinterest: `${ADMIN_BASE}/pinterest`,
  pinterestExport: `${ADMIN_BASE}/pinterest-eksport`,
  tiktok: `${ADMIN_BASE}/tiktok`,
  all: `${ADMIN_BASE}/all`,
} as const

/**
 * API paths. `metaSync` is the existing, unchanged sync endpoint; the Google Ads and
 * Pinterest Ads endpoints follow the same `/api/admin/integrations/{provider}/…` convention.
 */
export const MARKETING_API = {
  channels: '/api/admin/marketing/channels',
  metaExpenses: '/api/admin/integrations/meta/expenses',
  metaSync: '/api/admin/integrations/meta/sync',
  googleExpenses: '/api/admin/integrations/google/expenses',
  googleSync: '/api/admin/integrations/google/sync',
  googleStatus: '/api/admin/integrations/google/status',
  pinterestExpenses: '/api/admin/integrations/pinterest/expenses',
  pinterestSync: '/api/admin/integrations/pinterest/sync',
  pinterestStatus: '/api/admin/integrations/pinterest/status',
  // Pinterest OAuth 2.0. Deliberately NOT under /admin/integrations/: this path is registered
  // as a redirect URI on the Pinterest app, so it is public API surface whose shape must stay
  // stable — moving it later would mean re-registering it with Pinterest.
  pinterestOAuthStart: '/api/pinterest/oauth/start',
  pinterestOAuthCallback: '/api/pinterest/oauth/callback',
  // Bulk-upload CSV export. Preview is a GET; the download is a POST carrying the board name
  // and the (optionally edited) row selection.
  pinterestExportPreview: '/api/admin/integrations/pinterest/export/preview',
  pinterestExport: '/api/admin/integrations/pinterest/export',
  tiktokExpenses: '/api/admin/integrations/tiktok/expenses',
  tiktokSync: '/api/admin/integrations/tiktok/sync',
  tiktokStatus: '/api/admin/integrations/tiktok/status',
  // TikTok is the one provider with a real OAuth step: this starts it (admin-only) and
  // redirects the browser to TikTok's authorization screen.
  tiktokConnect: '/api/admin/integrations/tiktok/connect',
  // Only needed when the authorization covers several advertisers and none is configured.
  tiktokAdvertisers: '/api/admin/integrations/tiktok/advertisers',
} as const

/** Status labels (Norwegian Bokmål) shown on a channel card. */
export const STATUS = {
  connected: 'Tilkoblet',
  /** Env is in place, but the channel's OAuth authorization has not been granted yet. */
  notConnected: 'Ikke tilkoblet',
  /** The authorization existed but was revoked or expired — only a new consent can fix it. */
  reauthRequired: 'Må kobles til på nytt',
  notConfigured: 'Ikke konfigurert',
  comingSoon: 'Kommer snart',
} as const

/**
 * Authorization state of a channel that has an OAuth step.
 *
 * A tri-state, not a boolean, because "never connected" and "the grant was revoked" need
 * different copy and a different call to action: the first is a first-time setup, the second is
 * a repair. Channels that authenticate from env alone always pass 'authorized'.
 */
export type ChannelAuthorization = 'authorized' | 'not-authorized' | 'reauthorization-required'

/** Button label for a channel that needs the admin to visit the provider's consent screen. */
export const CONNECT_LABEL = {
  'not-authorized': 'Koble til',
  'reauthorization-required': 'Koble til på nytt',
} as const

/** Static definition of a marketing channel integration. */
export interface MarketingChannelDef {
  /** Stable id, matches MarketingExpenses.channel value where applicable. */
  id: string
  title: string
  description: string
  /** MarketingExpenses.channel value this card aggregates. */
  channelValue: string
  /**
   * MarketingExpenses.source value written by this channel's importer. The card summary
   * counts only imported rows, so manual entries never inflate an integration's totals.
   */
  sourceValue: string
  /** Detail-page href, or null when no detail page exists yet. */
  href: string | null
  /**
   * POST endpoint for an incremental sync, or null when the channel has no importer yet.
   * The card's quick "Oppdater" action posts here; the detail page uses the same path.
   */
  syncEndpoint: string | null
  /**
   * Endpoint that starts this channel's OAuth flow, or null when it authenticates from env
   * alone (Meta, Google Ads and Pinterest Ads all do). Only TikTok sets one, so the extra
   * "Koble til" state never affects the other cards.
   */
  connectEndpoint: string | null
  /** Server env vars that must be present for the integration to be "connected". */
  envKeys: string[]
  /** False for channels that are listed but not yet buildable (no sync/detail page). */
  available: boolean
}

/** Runtime card shape sent to the client. Never contains secrets or full account ids. */
export interface MarketingChannelCard {
  id: string
  title: string
  description: string
  href: string | null
  /**
   * Incremental-sync endpoint for the card's quick "Oppdater" action, or null when the
   * channel is not connected. Only ever set for an enabled (available + configured) card,
   * so the quick action is offered exactly when a sync can succeed.
   */
  syncEndpoint: string | null
  /**
   * Set only when the channel is configured but still needs an OAuth authorization — the
   * card then offers "Koble til" instead of a sync it could not complete.
   */
  connectEndpoint: string | null
  /** Label for `connectEndpoint`, distinguishing a first connection from a repair. */
  connectLabel: string | null
  enabled: boolean
  status: string
  summary: MarketingChannelSummary
}

export interface MarketingChannelSummary {
  /** Total paid (incl. MVA) across imported/reported records, in NOK. */
  totalSpend: number
  /** Number of imported day records. */
  days: number
  /** ISO timestamp of the last sync, or null. This is NOT a period. */
  lastSyncedAt: string | null
  /**
   * Range of history stored in the database (YYYY-MM-DD). Distinct from the last sync
   * window and from any user display filter.
   */
  firstDate: string | null
  lastDate: string | null
}

const EMPTY_SUMMARY: MarketingChannelSummary = {
  totalSpend: 0,
  days: 0,
  lastSyncedAt: null,
  firstDate: null,
  lastDate: null,
}

// Meta Ads, Google Ads, Pinterest Ads and TikTok Ads are live. Any future channel is
// declared here so the catalog already shows the roadmap; it renders as "Kommer snart" and
// is disabled until a sync + detail page lands.
export const MARKETING_CHANNEL_DEFS: MarketingChannelDef[] = [
  {
    id: 'meta',
    title: 'Meta Ads',
    description: 'Synkroniser annonseringskostnader fra Meta Ads.',
    channelValue: 'meta',
    sourceValue: 'meta-api',
    href: MARKETING_ROUTES.meta,
    syncEndpoint: MARKETING_API.metaSync,
    connectEndpoint: null,
    envKeys: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
    available: true,
  },
  {
    id: 'google',
    title: 'Google Ads',
    description: 'Synkroniser annonseringskostnader fra Google Ads.',
    channelValue: 'google',
    sourceValue: 'google-ads',
    href: MARKETING_ROUTES.google,
    syncEndpoint: MARKETING_API.googleSync,
    connectEndpoint: null,
    // GOOGLE_ADS_LOGIN_CUSTOMER_ID is deliberately not required: it is only needed when the
    // ad account sits under a manager (MCC) account, so requiring it would mark a valid
    // standalone setup as "Ikke konfigurert".
    envKeys: [
      'GOOGLE_ADS_CLIENT_ID',
      'GOOGLE_ADS_CLIENT_SECRET',
      'GOOGLE_ADS_DEVELOPER_TOKEN',
      'GOOGLE_ADS_REFRESH_TOKEN',
      'GOOGLE_ADS_CUSTOMER_ID',
    ],
    available: true,
  },
  {
    id: 'pinterest',
    title: 'Pinterest Ads',
    description: 'Synkroniser annonseringskostnader fra Pinterest Ads.',
    channelValue: 'pinterest',
    sourceValue: 'pinterest-ads',
    href: MARKETING_ROUTES.pinterest,
    syncEndpoint: MARKETING_API.pinterestSync,
    connectEndpoint: MARKETING_API.pinterestOAuthStart,
    // The app credentials ARE required now: they are what the OAuth flow authenticates with.
    // PINTEREST_ACCESS_TOKEN is deliberately absent — the token is obtained by "Koble til" and
    // stored encrypted in the database, so requiring an env token would mark a properly
    // connected integration as "Ikke konfigurert". The env var survives only as a temporary
    // migration fallback; see src/lib/pinterest/oauth/accessToken.ts.
    envKeys: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET', 'PINTEREST_AD_ACCOUNT_ID'],
    available: true,
  },
  {
    id: 'tiktok',
    title: 'TikTok Ads',
    description: 'Synkroniser annonseringskostnader fra TikTok Ads.',
    channelValue: 'tiktok',
    sourceValue: 'tiktok-ads',
    href: MARKETING_ROUTES.tiktok,
    syncEndpoint: MARKETING_API.tiktokSync,
    connectEndpoint: MARKETING_API.tiktokConnect,
    // TIKTOK_ADVERTISER_ID is deliberately not required: the OAuth flow discovers the
    // authorized advertisers and selects automatically when there is exactly one, so
    // requiring it would mark a valid single-account setup as "Ikke konfigurert". Same
    // reasoning as GOOGLE_ADS_LOGIN_CUSTOMER_ID and PINTEREST_APP_ID above.
    // TIKTOK_ACCESS_TOKEN is likewise optional — the normal path obtains one via "Koble til",
    // and the env var is only the escape hatch for a token issued elsewhere.
    // See src/lib/tiktok/config.ts.
    envKeys: ['TIKTOK_APP_ID', 'TIKTOK_APP_SECRET', 'TIKTOK_REDIRECT_URI'],
    available: true,
  },
]

/** True when every env var the channel needs is present and non-empty. */
export function isChannelConfigured(
  def: MarketingChannelDef,
  env: Record<string, string | undefined>,
): boolean {
  if (def.envKeys.length === 0) return false
  return def.envKeys.every((k) => typeof env[k] === 'string' && env[k]!.trim() !== '')
}

/**
 * Status label for a channel.
 *
 * `authorization` only ever matters for a channel with an OAuth step (TikTok, Pinterest Ads):
 * the others pass the default 'authorized', so their labels are unchanged.
 */
export function channelStatusLabel(
  def: MarketingChannelDef,
  configured: boolean,
  authorization: ChannelAuthorization = 'authorized',
): string {
  if (!def.available) return STATUS.comingSoon
  if (!configured) return STATUS.notConfigured
  if (authorization === 'reauthorization-required') return STATUS.reauthRequired
  return authorization === 'authorized' ? STATUS.connected : STATUS.notConnected
}

/**
 * Assemble the client card for a channel. Pure — env presence, authorization state and the
 * summary are all passed in.
 *
 * `authorization` defaults to 'authorized' so a channel that authenticates from env alone
 * behaves exactly as before; only TikTok and Pinterest Ads pass a computed value.
 */
export function buildChannelCard(
  def: MarketingChannelDef,
  configured: boolean,
  summary: MarketingChannelSummary = EMPTY_SUMMARY,
  authorization: ChannelAuthorization = 'authorized',
): MarketingChannelCard {
  const enabled = def.available && configured && authorization === 'authorized'
  // Offer a connect action exactly when the setup is complete but the authorization is not.
  const needsConnect = def.available && configured && authorization !== 'authorized'
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    href: def.available ? def.href : null,
    // Offer the quick sync only when a sync could actually succeed (connected channel).
    syncEndpoint: enabled ? def.syncEndpoint : null,
    connectEndpoint: needsConnect ? def.connectEndpoint : null,
    connectLabel: needsConnect ? CONNECT_LABEL[authorization] : null,
    enabled,
    status: channelStatusLabel(def, configured, authorization),
    summary,
  }
}

/** Human label for a channel value, reusing the shared vocabulary. */
export function channelTitle(channelValue: string): string {
  return MARKETING_CHANNELS.find((c) => c.value === channelValue)?.label ?? channelValue
}
