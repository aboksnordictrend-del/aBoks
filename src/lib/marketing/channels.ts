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
  all: `${ADMIN_BASE}/all`,
} as const

/** API paths. `metaSync` is the existing, unchanged sync endpoint. */
export const MARKETING_API = {
  channels: '/api/admin/marketing/channels',
  metaExpenses: '/api/admin/integrations/meta/expenses',
  metaSync: '/api/admin/integrations/meta/sync',
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
  /** Detail-page href, or null when no detail page exists yet. */
  href: string | null
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

// Stage 1 ships Meta Ads only. The others are declared so the catalog already shows the
// roadmap; they render as "Kommer snart" and are disabled until a sync + detail page lands.
export const MARKETING_CHANNEL_DEFS: MarketingChannelDef[] = [
  {
    id: 'meta',
    title: 'Meta Ads',
    description: 'Synkroniser annonseringskostnader fra Meta Ads.',
    channelValue: 'meta',
    href: MARKETING_ROUTES.meta,
    envKeys: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
    available: true,
  },
  {
    id: 'google',
    title: 'Google Ads',
    description: 'Kommer snart: synkroniser annonseringskostnader fra Google Ads.',
    channelValue: 'google',
    href: null,
    envKeys: [],
    available: false,
  },
  {
    id: 'pinterest',
    title: 'Pinterest Ads',
    description: 'Kommer snart: synkroniser annonseringskostnader fra Pinterest Ads.',
    // No dedicated channel value yet — falls back to "annet" until added to MARKETING_CHANNELS.
    channelValue: 'pinterest',
    href: null,
    envKeys: [],
    available: false,
  },
  {
    id: 'tiktok',
    title: 'TikTok Ads',
    description: 'Kommer snart: synkroniser annonseringskostnader fra TikTok Ads.',
    channelValue: 'tiktok',
    href: null,
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
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    href: def.available ? def.href : null,
    enabled: def.available && configured,
    status: channelStatusLabel(def, configured),
    summary,
  }
}

/** Human label for a channel value, reusing the shared vocabulary. */
export function channelTitle(channelValue: string): string {
  return MARKETING_CHANNELS.find((c) => c.value === channelValue)?.label ?? channelValue
}
