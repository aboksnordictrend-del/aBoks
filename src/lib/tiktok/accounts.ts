// Advertiser discovery and metadata for the TikTok Marketing API.
//
// Two reads live here:
//  - `listAuthorizedAdvertisers` → `GET /oauth2/advertiser/get/`, the advertisers the current
//    authorization can reach. Used once, during the OAuth callback, to decide which account
//    the integration will import from.
//  - `getAdvertiserInfo` → `GET /advertiser/info/`, the currency + reporting time zone +
//    creation date of the selected advertiser. Read before every sync, because both the
//    currency guard and the full-import start depend on it.
//
// TikTok responses are treated as untrusted throughout: field names have moved between API
// generations (`name` → `advertiser_name`, `timezone` → `display_timezone`), so both spellings
// are accepted, and anything unusable degrades to null rather than propagating into the data.

import { DATE_RE } from '@/lib/marketing/dateMath'
import { tiktokGet, type TikTokRequestOptions } from './client'
import type { TikTokAdsConfig } from './config'
import { TikTokAdsError } from './errors'
import type {
  TikTokAdvertiserInfo,
  TikTokAdvertiserInfoItem,
  TikTokAdvertiserListItem,
  TikTokAdvertiserRef,
  TikTokResolvedCurrency,
} from './types'

const ADVERTISER_LIST_PATH = 'oauth2/advertiser/get/'
const ADVERTISER_INFO_PATH = 'advertiser/info/'

const REQUIRED_CURRENCY = 'NOK'

/** `data.list` shape shared by both advertiser endpoints. */
interface AdvertiserListData<T> {
  list?: T[]
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** `advertiser_id` may arrive as a number; normalize to digits. */
function idOf(item: TikTokAdvertiserListItem): string {
  const raw = item?.advertiser_id
  const asString = typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : String(raw ?? '')
  return asString.replace(/\D/g, '')
}

/** v1.3 returns `advertiser_name`; older payloads use `name`. Accept either. */
function nameOf(item: TikTokAdvertiserListItem): string | null {
  return text(item?.advertiser_name) ?? text(item?.name)
}

/**
 * `create_time` → YYYY-MM-DD. TikTok documents a Unix timestamp; seconds and milliseconds
 * have both been observed, and an ISO string is accepted defensively. Anything unparseable
 * yields null, which simply means "fall back to the configured floor".
 */
export function parseCreatedDate(raw: string | number | undefined): string | null {
  if (raw == null) return null

  if (typeof raw === 'string' && raw.includes('-') && DATE_RE.test(raw.slice(0, 10))) {
    return raw.slice(0, 10)
  }

  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  // Values below ~1e11 cannot be milliseconds (that would be 1973), so they are seconds.
  const ms = n < 1e11 ? n * 1000 : n
  const day = new Date(ms).toISOString().slice(0, 10)
  return DATE_RE.test(day) ? day : null
}

/**
 * Guard: we never convert currencies. A non-NOK advertiser stops the import with a clear
 * message instead of silently being treated as NOK. Mirrors the Pinterest Ads guard.
 */
export function assertSupportedCurrency(currencyCode: string): void {
  if (currencyCode && currencyCode !== REQUIRED_CURRENCY) {
    throw new TikTokAdsError(
      `TikTok-annonsekontoen rapporterer i ${currencyCode}, ikke ${REQUIRED_CURRENCY}. Import er stoppet — beløp konverteres ikke automatisk.`,
      { message: `unexpected advertiser currency: ${currencyCode}` },
    )
  }
}

/**
 * Advertisers the current authorization can reach.
 *
 * `app_id` and `secret` are query parameters on this endpoint (that is TikTok's contract for
 * it) *in addition to* the Access-Token header — this is the one read where the app secret
 * leaves the process, and it goes only to TikTok over TLS.
 */
export async function listAuthorizedAdvertisers(
  config: TikTokAdsConfig,
  accessToken: string,
  options: TikTokRequestOptions = {},
): Promise<TikTokAdvertiserRef[]> {
  const data = await tiktokGet<AdvertiserListData<TikTokAdvertiserListItem>>(
    config,
    accessToken,
    ADVERTISER_LIST_PATH,
    { app_id: config.appId, secret: config.appSecret },
    { ...options, operation: options.operation ?? 'advertiser-list' },
  )

  const list = Array.isArray(data?.list) ? data.list : []
  const advertisers: TikTokAdvertiserRef[] = []
  for (const item of list) {
    const id = idOf(item)
    if (!id) continue // an entry without a usable id is not selectable
    advertisers.push({ id, name: nameOf(item) })
  }
  return advertisers
}

/**
 * Currency, reporting time zone and creation date for one advertiser.
 *
 * `fields` is deliberately omitted: TikTok returns the full advertiser object when it is not
 * specified, and naming fields explicitly would hard-code names that have changed between API
 * generations. The response is read defensively instead.
 */
export async function getAdvertiserInfo(
  config: TikTokAdsConfig,
  accessToken: string,
  advertiserId: string,
  options: TikTokRequestOptions = {},
): Promise<TikTokAdvertiserInfo> {
  const data = await tiktokGet<AdvertiserListData<TikTokAdvertiserInfoItem>>(
    config,
    accessToken,
    ADVERTISER_INFO_PATH,
    { advertiser_ids: JSON.stringify([advertiserId]) },
    { ...options, operation: options.operation ?? 'advertiser-info' },
  )

  const list = Array.isArray(data?.list) ? data.list : []
  // Match by id when TikTok echoes it; a single-entry response without an id is accepted.
  const item =
    list.find((entry) => idOf(entry) === advertiserId) ?? (list.length === 1 ? list[0] : undefined)

  if (!item) {
    throw new TikTokAdsError(
      'Fant ikke TikTok-annonsekontoen. Kontroller at autorisasjonen fortsatt gjelder for denne kontoen.',
      {
        message: `advertiser not present in advertiser/info response (${list.length} rows)`,
        operation: 'advertiser-info',
      },
    )
  }

  return {
    id: advertiserId,
    name: nameOf(item),
    currency: text(item.currency) ?? '',
    timezone: text(item.timezone) ?? text(item.display_timezone),
    createdDate: parseCreatedDate(item.create_time),
  }
}

/**
 * Advertiser metadata as *best-effort*: returns null instead of throwing when TikTok refuses
 * the call.
 *
 * `GET /advertiser/info/` requires the **Ad Account Management** scope. A read-only
 * spend integration is authorized for **Reporting**, so this endpoint answers
 * `code 40001 — the access token lacks the required scope`. That is not a reason to fail:
 * nothing in the daily-spend path needs it. `report/integrated/get` needs only the
 * advertiser id, the account name comes from `oauth2/advertiser/get`, a missing time zone
 * degrades to UTC, and a missing creation date degrades to the configured history floor.
 *
 * Every failure mode is treated the same way — permission, network, a reshaped response.
 * Classifying TikTok's error codes here would only add guesswork, and the authoritative test
 * of whether this advertiser is reachable is the report call itself, which is not swallowed.
 *
 * `onUnavailable` receives the error so the caller can log it with its `op=` tag; it is never
 * shown to the browser.
 */
export async function getAdvertiserInfoIfPermitted(
  config: TikTokAdsConfig,
  accessToken: string,
  advertiserId: string,
  options: TikTokRequestOptions & { onUnavailable?: (err: TikTokAdsError) => void } = {},
): Promise<TikTokAdvertiserInfo | null> {
  const { onUnavailable, ...requestOptions } = options
  try {
    return await getAdvertiserInfo(config, accessToken, advertiserId, requestOptions)
  } catch (err) {
    if (err instanceof TikTokAdsError) {
      if (!err.detail.operation) err.detail.operation = 'advertiser-info'
      onUnavailable?.(err)
      return null
    }
    throw err
  }
}

/**
 * Resolve the advertiser's reporting currency, in descending order of authority:
 *
 *   1. `advertiser/info` — TikTok's own answer, when the scope allows reading it;
 *   2. `TIKTOK_ADVERTISER_CURRENCY` — an explicit operator declaration;
 *   3. the value captured on the stored connection at connect time.
 *
 * Returns `{ code: '', source: 'unknown' }` when none resolves. It never falls back to NOK:
 * a guessed currency would silently mis-state every marketing KPI, so the caller stops
 * instead. Nothing here infers a currency from country, locale or account location.
 */
export function resolveCurrency(
  candidates: {
    fromAdvertiserInfo?: string | null
    fromConfig?: string | null
    fromStored?: string | null
  },
): TikTokResolvedCurrency {
  const info = (candidates.fromAdvertiserInfo ?? '').trim().toUpperCase()
  if (info) return { code: info, source: 'advertiser-info' }

  const configured = (candidates.fromConfig ?? '').trim().toUpperCase()
  if (configured) return { code: configured, source: 'config' }

  const stored = (candidates.fromStored ?? '').trim().toUpperCase()
  if (stored) return { code: stored, source: 'stored' }

  return { code: '', source: 'unknown' }
}

/** Outcome of choosing which advertiser the integration should import from. */
export type AdvertiserSelection =
  | { kind: 'selected'; advertiser: TikTokAdvertiserRef }
  | { kind: 'none' }
  | { kind: 'ambiguous'; advertisers: TikTokAdvertiserRef[] }
  | { kind: 'not-authorized'; advertisers: TikTokAdvertiserRef[]; configuredId: string }

/**
 * Decide which advertiser to import from, given what the authorization returned and what (if
 * anything) TIKTOK_ADVERTISER_ID pins.
 *
 *  - configured id present  → it must be among the authorized advertisers, otherwise
 *                             `not-authorized` (never fall back to a different account);
 *  - no configured id, one authorized advertiser → selected automatically, matching the
 *                             single-account convention the other providers use;
 *  - no configured id, several → `ambiguous`, so the caller can list the names and ids and
 *                             ask for TIKTOK_ADVERTISER_ID;
 *  - nothing authorized     → `none`.
 *
 * Pure, so every branch is directly testable.
 */
export function selectAdvertiser(
  advertisers: TikTokAdvertiserRef[],
  configuredId: string,
): AdvertiserSelection {
  if (configuredId) {
    const match = advertisers.find((a) => a.id === configuredId)
    if (match) return { kind: 'selected', advertiser: match }
    return { kind: 'not-authorized', advertisers, configuredId }
  }
  if (advertisers.length === 0) return { kind: 'none' }
  if (advertisers.length === 1) return { kind: 'selected', advertiser: advertisers[0] }
  return { kind: 'ambiguous', advertisers }
}
