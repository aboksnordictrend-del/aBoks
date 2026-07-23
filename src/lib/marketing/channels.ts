// Extensible marketing-channel catalog. Adding a future channel (Google/Pinterest/TikTok)
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
  all: `${ADMIN_BASE}/all`,
} as const

/**
 * API paths. `metaSync` is the existing, unchanged sync endpoint; the Google Ads endpoints
 * follow the same `/api/admin/integrations/{provider}/…` convention.
 */
export const MARKETING_API = {
  channels: '/api/admin/marketing/channels',
  metaExpenses: '/api/admin/integrations/meta/expenses',
  metaSync: '/api/admin/integrations/meta/sync',
  googleExpenses: '/api/admin/integrations/google/expenses',
  googleSync: '/api/admin/integrations/google/sync',
  googleStatus: '/api/admin/integrations/google/status',
} as const

/** Status labels (Norwegian Bokmål) shown on a channel card. */
export const STATUS = {
  connected: 'Tilkoblet',
  notConfigured: 'Ikke konfigurert',
  comingSoon: 'Kommer snart',
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

// Meta Ads and Google Ads are live. The rest are declared so the catalog already shows the
// roadmap; they render as "Kommer snart" and are disabled until a sync + detail page lands.
export const MARKETING_CHANNEL_DEFS: MarketingChannelDef[] = [
  {
    id: 'meta',
    title: 'Meta Ads',
    description: 'Synkroniser annonseringskostnader fra Meta Ads.',
    channelValue: 'meta',
    sourceValue: 'meta-api',
    href: MARKETING_ROUTES.meta,
    syncEndpoint: MARKETING_API.metaSync,
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
    description: 'Kommer snart: synkroniser annonseringskostnader fra Pinterest Ads.',
    // No dedicated channel value yet — falls back to "annet" until added to MARKETING_CHANNELS.
    channelValue: 'pinterest',
    sourceValue: 'pinterest-ads',
    href: null,
    syncEndpoint: null,
    envKeys: [],
    available: false,
  },
  {
    id: 'tiktok',
    title: 'TikTok Ads',
    description: 'Kommer snart: synkroniser annonseringskostnader fra TikTok Ads.',
    channelValue: 'tiktok',
    sourceValue: 'tiktok-ads',
    href: null,
    syncEndpoint: null,
    envKeys: [],
    available: false,
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

/** Status label for a channel given whether it is available and configured. */
export function channelStatusLabel(def: MarketingChannelDef, configured: boolean): string {
  if (!def.available) return STATUS.comingSoon
  return configured ? STATUS.connected : STATUS.notConfigured
}

/** Assemble the client card for a channel. Pure — env presence + summary are passed in. */
export function buildChannelCard(
  def: MarketingChannelDef,
  configured: boolean,
  summary: MarketingChannelSummary = EMPTY_SUMMARY,
): MarketingChannelCard {
  const enabled = def.available && configured
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    href: def.available ? def.href : null,
    // Offer the quick sync only when a sync could actually succeed (connected channel).
    syncEndpoint: enabled ? def.syncEndpoint : null,
    enabled,
    status: channelStatusLabel(def, configured),
    summary,
  }
}

/** Human label for a channel value, reusing the shared vocabulary. */
export function channelTitle(channelValue: string): string {
  return MARKETING_CHANNELS.find((c) => c.value === channelValue)?.label ?? channelValue
}
