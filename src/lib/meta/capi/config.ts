// Server-only Meta Conversions API configuration.
//
// Deliberately separate from `@/lib/meta/config`: that one authenticates the Marketing API
// (reading ad *spend* into marketing-expenses) with an ad-account token, this one posts
// *conversions* to a pixel/dataset with a Conversions-API token. They are different
// credentials with different scopes, and mixing them would mean one leaked token could do
// both jobs. Only `META_GRAPH_API_VERSION` is shared, because there is one Graph API.
//
// Every value comes from a server env var — never NEXT_PUBLIC_*, so neither the token nor the
// pixel id can reach the browser bundle.

export interface MetaCapiConfig {
  pixelId: string
  accessToken: string
  graphApiVersion: string
  /** Present only when META_TEST_EVENT_CODE is set — see buildPurchaseEventPayload. */
  testEventCode?: string
  /** POST target: https://graph.facebook.com/{version}/{pixelId}/events */
  eventsUrl: string
}

const DEFAULT_GRAPH_VERSION = 'v24.0'

/** The env slice this reads. Injectable so the tests never touch process.env. */
export interface MetaCapiEnv {
  META_PIXEL_ID?: string
  META_CAPI_ACCESS_TOKEN?: string
  META_GRAPH_API_VERSION?: string
  META_TEST_EVENT_CODE?: string
}

/**
 * The CAPI configuration, or `null` when the integration is not configured.
 *
 * Returns null rather than throwing on purpose: the one caller is the Kustom webhook, where a
 * missing env var must degrade to "no Meta event" and never to a failed webhook that makes
 * Kustom retry a paid order. The caller logs the skip.
 */
export function getMetaCapiConfig(
  env: MetaCapiEnv = process.env as unknown as MetaCapiEnv,
): MetaCapiConfig | null {
  const pixelId = (env.META_PIXEL_ID ?? '').trim()
  const accessToken = (env.META_CAPI_ACCESS_TOKEN ?? '').trim()
  if (!pixelId || !accessToken) return null

  const graphApiVersion = (env.META_GRAPH_API_VERSION ?? '').trim() || DEFAULT_GRAPH_VERSION
  const testEventCode = (env.META_TEST_EVENT_CODE ?? '').trim()

  return {
    pixelId,
    accessToken,
    graphApiVersion,
    ...(testEventCode ? { testEventCode } : {}),
    eventsUrl: `https://graph.facebook.com/${graphApiVersion}/${pixelId}/events`,
  }
}

/** Names of the env vars this module needs — used by diagnostics and the setup docs. */
export const META_CAPI_ENV_KEYS = ['META_PIXEL_ID', 'META_CAPI_ACCESS_TOKEN'] as const
