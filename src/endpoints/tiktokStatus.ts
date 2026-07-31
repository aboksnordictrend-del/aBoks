// Admin-only TikTok Ads connection status, registered as GET
// /api/admin/integrations/tiktok/status.
//
// Never calls the TikTok Ads API — opening the panel must not spend quota. Everything comes
// from (a) the *presence* of server env vars, (b) the stored connection global, (c) the
// stored marketing-expenses records, and (d) the in-process sync state. The advertiser id is
// returned masked; no secret value is read, let alone returned. Mirrors
// src/endpoints/pinterestStatus.ts.

import type { Endpoint, PayloadRequest } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import {
  TIKTOK_ADS_REQUIRED_ENV,
  getTikTokAdsConfig,
  maskAdvertiserId,
  normalizeAdvertiserId,
  TikTokAdsConfigError,
} from '@/lib/tiktok/config'
import { TIKTOK_ADS_CHANNEL, TIKTOK_ADS_SOURCE } from '@/lib/tiktok/sync'
import { getStoredConnection, hasStoredToken } from '@/lib/tiktok/tokenStore'
import { expensesSummary, type ExpenseRow } from '@/lib/marketing/expenseSummary'
import { getSyncState } from '@/lib/marketing/syncState'

/** Currency / API version recorded by the most recent import, if any. */
interface ImportContext {
  currency: string | null
  apiVersion: string | null
  timezone: string | null
}

function readImportContext(doc: MarketingExpense | undefined): ImportContext {
  const meta = doc?.syncMetadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { currency: null, apiVersion: null, timezone: null }
  }
  const m = meta as Record<string, unknown>
  return {
    currency: typeof m.currency === 'string' ? m.currency : null,
    apiVersion: typeof m.apiVersion === 'string' ? m.apiVersion : null,
    timezone: typeof m.timezone === 'string' ? m.timezone : null,
  }
}

export const tiktokStatusEndpoint: Endpoint = {
  path: '/admin/integrations/tiktok/status',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
    }

    // Config presence only. A missing/invalid value yields configured:false plus a safe
    // Norwegian explanation — never a stack trace, never a secret.
    let configured = false
    let configError: string | null = null
    let apiVersion: string | null = null
    let envAdvertiserId = ''
    try {
      const config = getTikTokAdsConfig()
      configured = true
      apiVersion = config.apiVersion
      envAdvertiserId = config.advertiserId
    } catch (err) {
      configError =
        err instanceof TikTokAdsConfigError
          ? err.message
          : 'TikTok Ads-konfigurasjonen mangler eller er ugyldig.'
      envAdvertiserId = normalizeAdvertiserId((process.env.TIKTOK_ADVERTISER_ID ?? '').trim())
    }

    const missingEnv = TIKTOK_ADS_REQUIRED_ENV.filter(
      (k) => !(typeof process.env[k] === 'string' && process.env[k]!.trim() !== ''),
    )

    try {
      // --- Authorization state. Only booleans and masked/non-secret metadata leave here. ---
      const connection = await getStoredConnection(req.payload)
      // An env-supplied token counts as connected, exactly as it does for Meta/Pinterest.
      const envToken = (process.env.TIKTOK_ACCESS_TOKEN ?? '').trim() !== ''
      const authorized = envToken || (await hasStoredToken(req.payload))
      const advertiserId = envAdvertiserId || connection?.advertiserId || ''
      const needsAdvertiser = authorized && !advertiserId

      // Currency is resolved the same way the sync resolves it, so the panel can never claim
      // a currency the import would refuse. `advertiser/info` is not called here — opening
      // the panel must not spend quota — so only the stored and configured values apply.
      const envCurrency = (process.env.TIKTOK_ADVERTISER_CURRENCY ?? '').trim().toUpperCase()
      const currency = connection?.currency ?? (envCurrency || null)

      const result = await req.payload.find({
        collection: 'marketing-expenses',
        where: {
          and: [
            { channel: { equals: TIKTOK_ADS_CHANNEL } },
            { source: { equals: TIKTOK_ADS_SOURCE } },
          ],
        },
        depth: 0,
        limit: 10_000,
        sort: '-date',
        overrideAccess: false,
        user: req.user,
      })

      const docs = result.docs as MarketingExpense[]
      const rows: ExpenseRow[] = docs.map((d) => ({
        id: String(d.id),
        date: d.date,
        amount: typeof d.amount === 'number' ? d.amount : 0,
        amountExVat: typeof d.amountExVat === 'number' ? d.amountExVat : 0,
        source: d.source ?? 'manual',
        description: d.description,
        lastSyncedAt: d.lastSyncedAt,
      }))
      const summary = expensesSummary(rows)
      // Sorted by -date, so docs[0] is the most recently imported day.
      const context = readImportContext(docs[0])

      return Response.json(
        {
          provider: TIKTOK_ADS_SOURCE,
          configured,
          configError,
          missingEnv,
          /** True once an access token exists (env or stored OAuth grant). */
          authorized,
          /** True when authorized but no single advertiser has been resolved yet. */
          needsAdvertiser,
          /**
           * False when `GET /advertiser/info/` was refused (Reporting scope without Ad
           * Account Management). Optional metadata only — the spend import is unaffected.
           */
          metadataAvailable: connection?.metadataAvailable ?? false,
          /** Result of the connect-time report probe; null when none has run. */
          reportingOk: connection?.reportingOk ?? null,
          /** True when no currency could be established — the import stays blocked. */
          needsCurrency: authorized && Boolean(advertiserId) && !(context.currency ?? currency),
          accountId: advertiserId ? maskAdvertiserId(advertiserId) : '—',
          accountName: connection?.advertiserName ?? null,
          connectedAt: connection?.connectedAt ?? null,
          apiVersion: context.apiVersion ?? apiVersion,
          currency: context.currency ?? currency,
          timezone: context.timezone ?? connection?.timezone ?? null,
          summary,
          hasData: rows.length > 0,
          sync: getSyncState(TIKTOK_ADS_SOURCE),
        },
        { status: 200 },
      )
    } catch (err) {
      req.payload.logger.error(
        `[marketing] tiktok status failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke hente TikTok Ads-status.' }, { status: 500 })
    }
  },
}
