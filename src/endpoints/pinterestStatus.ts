// Admin-only Pinterest Ads connection status, registered as GET
// /api/admin/integrations/pinterest/status.
//
// Never calls the Pinterest Ads API — opening the panel must not spend quota. Everything comes
// from (a) the *presence* of server env vars, (b) the stored marketing-expenses records, and
// (c) the in-process sync state. The ad account id is returned masked; no secret value is
// read, let alone returned. Mirrors src/endpoints/googleStatus.ts.

import type { Endpoint, PayloadRequest } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import {
  PINTEREST_ADS_REQUIRED_ENV,
  getPinterestAdsConfig,
  maskAdAccountId,
  normalizeAdAccountId,
  PinterestAdsConfigError,
} from '@/lib/pinterest/config'
import { PINTEREST_ADS_CHANNEL, PINTEREST_ADS_SOURCE } from '@/lib/pinterest/sync'
import { expensesSummary, type ExpenseRow } from '@/lib/marketing/expenseSummary'
import { getSyncState } from '@/lib/marketing/syncState'

/** Currency / API version recorded by the most recent import, if any. */
interface ImportContext {
  currency: string | null
  apiVersion: string | null
}

function readImportContext(doc: MarketingExpense | undefined): ImportContext {
  const meta = doc?.syncMetadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { currency: null, apiVersion: null }
  }
  const m = meta as Record<string, unknown>
  return {
    currency: typeof m.currency === 'string' ? m.currency : null,
    apiVersion: typeof m.apiVersion === 'string' ? m.apiVersion : null,
  }
}

export const pinterestStatusEndpoint: Endpoint = {
  path: '/admin/integrations/pinterest/status',
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
    let accountId = '—'
    let apiVersion: string | null = null
    try {
      const config = getPinterestAdsConfig()
      configured = true
      accountId = maskAdAccountId(config.adAccountId)
      apiVersion = config.apiVersion
    } catch (err) {
      configError =
        err instanceof PinterestAdsConfigError
          ? err.message
          : 'Pinterest Ads-konfigurasjonen mangler eller er ugyldig.'
      // Fall back to the raw env value only to show a *masked* id while unconfigured.
      const raw = normalizeAdAccountId((process.env.PINTEREST_AD_ACCOUNT_ID ?? '').trim())
      if (raw) accountId = maskAdAccountId(raw)
    }

    const missingEnv = PINTEREST_ADS_REQUIRED_ENV.filter(
      (k) => !(typeof process.env[k] === 'string' && process.env[k]!.trim() !== ''),
    )

    try {
      const result = await req.payload.find({
        collection: 'marketing-expenses',
        where: {
          and: [
            { channel: { equals: PINTEREST_ADS_CHANNEL } },
            { source: { equals: PINTEREST_ADS_SOURCE } },
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
          provider: PINTEREST_ADS_SOURCE,
          configured,
          configError,
          missingEnv,
          accountId,
          apiVersion: context.apiVersion ?? apiVersion,
          currency: context.currency,
          summary,
          hasData: rows.length > 0,
          sync: getSyncState(PINTEREST_ADS_SOURCE),
        },
        { status: 200 },
      )
    } catch (err) {
      req.payload.logger.error(
        `[marketing] pinterest status failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke hente Pinterest Ads-status.' }, { status: 500 })
    }
  },
}
