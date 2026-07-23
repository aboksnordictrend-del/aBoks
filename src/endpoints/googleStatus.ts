// Admin-only Google Ads connection status, registered as GET
// /api/admin/integrations/google/status.
//
// Never calls the Google Ads API — opening the panel must not spend quota. Everything comes
// from (a) the *presence* of server env vars, (b) the stored marketing-expenses records, and
// (c) the in-process sync state. The customer and manager ids are returned masked; no
// secret value is read, let alone returned.

import type { Endpoint, PayloadRequest } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import {
  GOOGLE_ADS_REQUIRED_ENV,
  getGoogleAdsConfig,
  maskCustomerId,
  normalizeCustomerId,
  GoogleAdsConfigError,
} from '@/lib/google/config'
import { GOOGLE_ADS_CHANNEL, GOOGLE_ADS_SOURCE } from '@/lib/google/sync'
import { expensesSummary, type ExpenseRow } from '@/lib/marketing/expenseSummary'
import { getSyncState } from '@/lib/marketing/syncState'

/** Currency / time zone / API version recorded by the most recent import, if any. */
interface ImportContext {
  currency: string | null
  timeZone: string | null
  apiVersion: string | null
}

function readImportContext(doc: MarketingExpense | undefined): ImportContext {
  const meta = doc?.syncMetadata
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { currency: null, timeZone: null, apiVersion: null }
  }
  const m = meta as Record<string, unknown>
  return {
    currency: typeof m.currency === 'string' ? m.currency : null,
    timeZone: typeof m.timeZone === 'string' ? m.timeZone : null,
    apiVersion: typeof m.apiVersion === 'string' ? m.apiVersion : null,
  }
}

export const googleStatusEndpoint: Endpoint = {
  path: '/admin/integrations/google/status',
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
    let managerId: string | null = null
    let apiVersion: string | null = null
    try {
      const config = getGoogleAdsConfig()
      configured = true
      accountId = maskCustomerId(config.customerId)
      managerId = config.loginCustomerId ? maskCustomerId(config.loginCustomerId) : null
      apiVersion = config.apiVersion
    } catch (err) {
      configError =
        err instanceof GoogleAdsConfigError
          ? err.message
          : 'Google Ads-konfigurasjonen mangler eller er ugyldig.'
      // Fall back to the raw env value only to show a *masked* id while unconfigured.
      const raw = normalizeCustomerId((process.env.GOOGLE_ADS_CUSTOMER_ID ?? '').trim())
      if (raw) accountId = maskCustomerId(raw)
    }

    const missingEnv = GOOGLE_ADS_REQUIRED_ENV.filter(
      (k) => !(typeof process.env[k] === 'string' && process.env[k]!.trim() !== ''),
    )

    try {
      const result = await req.payload.find({
        collection: 'marketing-expenses',
        where: {
          and: [
            { channel: { equals: GOOGLE_ADS_CHANNEL } },
            { source: { equals: GOOGLE_ADS_SOURCE } },
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
          provider: GOOGLE_ADS_SOURCE,
          configured,
          configError,
          missingEnv,
          accountId,
          managerId,
          apiVersion: context.apiVersion ?? apiVersion,
          currency: context.currency,
          timeZone: context.timeZone,
          summary,
          hasData: rows.length > 0,
          sync: getSyncState(GOOGLE_ADS_SOURCE),
        },
        { status: 200 },
      )
    } catch (err) {
      req.payload.logger.error(
        `[marketing] google status failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke hente Google Ads-status.' }, { status: 500 })
    }
  },
}
