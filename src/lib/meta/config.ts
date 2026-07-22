// Server-only Meta Marketing API configuration. Every value comes from server env vars —
// never NEXT_PUBLIC_*, so the access token can never reach the browser. Importing this
// module in client code would fail at build time (no process.env values), which is the
// intended boundary.
//
// The Graph API version lives in one place (META_GRAPH_API_VERSION) instead of being
// hard-coded across call sites.

export interface MetaConfig {
  appId: string
  accessToken: string
  adAccountId: string
  graphApiVersion: string
  baseUrl: string
}

const DEFAULT_GRAPH_VERSION = 'v24.0'

class MetaConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetaConfigError'
  }
}

/**
 * Read + validate the Meta configuration from env. Throws MetaConfigError with a safe,
 * token-free message when required values are missing. The returned object is never
 * logged or serialized to a client response.
 */
export function getMetaConfig(): MetaConfig {
  const appId = (process.env.META_APP_ID ?? '').trim()
  const accessToken = (process.env.META_ACCESS_TOKEN ?? '').trim()
  const adAccountId = (process.env.META_AD_ACCOUNT_ID ?? '').trim()
  const graphApiVersion = (process.env.META_GRAPH_API_VERSION ?? '').trim() || DEFAULT_GRAPH_VERSION

  const missing: string[] = []
  if (!accessToken) missing.push('META_ACCESS_TOKEN')
  if (!adAccountId) missing.push('META_AD_ACCOUNT_ID')
  if (missing.length > 0) {
    throw new MetaConfigError(
      `Meta-integrasjonen mangler konfigurasjon: ${missing.join(', ')} er ikke satt.`,
    )
  }

  // Meta ad account ids are always `act_` followed by digits. Canonicalize robustly:
  // extract the numeric part and re-form `act_<digits>`. This tolerates the common env
  // typos — a wrong separator (`act=123`, `act123`), a bare number (`123`), or an
  // accidental double prefix (`act_act_123`) — instead of forwarding a malformed id that
  // Meta then rejects as "Object … does not exist".
  const digits = adAccountId.replace(/\D/g, '')
  if (!digits) {
    throw new MetaConfigError(
      `META_AD_ACCOUNT_ID inneholder ikke et gyldig kontonummer (fikk «${adAccountId}»). Forventet formatet act_1234567890.`,
    )
  }
  const normalizedAccount = `act_${digits}`

  return {
    appId,
    accessToken,
    adAccountId: normalizedAccount,
    graphApiVersion,
    baseUrl: `https://graph.facebook.com/${graphApiVersion}`,
  }
}

export { MetaConfigError }
