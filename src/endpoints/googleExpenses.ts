// Admin-only Google Ads detail data, registered as GET
// /api/admin/integrations/google/expenses?since&until. Returns only imported (source =
// 'google-ads', channel = 'google') day records for the period, plus a computed summary.
// Manual records are never included. No secrets in the response.
//
// Mirrors src/endpoints/metaExpenses.ts field for field.

import type { Endpoint, PayloadRequest, Where } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import { expensesSummary, type ExpenseRow } from '@/lib/marketing/expenseSummary'
import {
  GOOGLE_ADS_CHANNEL,
  GOOGLE_ADS_SOURCE,
  GoogleSyncValidationError,
  validateSyncDates,
} from '@/lib/google/sync'

function str(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return undefined
}

export const googleExpensesEndpoint: Endpoint = {
  path: '/admin/integrations/google/expenses',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
    }

    const query = (req.query ?? {}) as Record<string, unknown>
    let since: string | undefined
    let until: string | undefined
    try {
      // Same rule as sync: both dates or neither; since ≤ until; ÅÅÅÅ-MM-DD.
      ;({ since, until } = validateSyncDates({ since: str(query, 'since'), until: str(query, 'until') }))
    } catch (err) {
      const message = err instanceof GoogleSyncValidationError ? err.message : 'Ugyldig forespørsel.'
      return Response.json({ error: message }, { status: 400 })
    }

    try {
      const and: Where[] = [
        { channel: { equals: GOOGLE_ADS_CHANNEL } },
        { source: { equals: GOOGLE_ADS_SOURCE } },
      ]
      if (since && until) {
        and.push({ date: { greater_than_equal: `${since}T00:00:00.000Z` } })
        and.push({ date: { less_than_equal: `${until}T23:59:59.999Z` } })
      }

      const result = await req.payload.find({
        collection: 'marketing-expenses',
        where: { and },
        depth: 0,
        limit: 10_000,
        sort: '-date',
        overrideAccess: false,
        user: req.user,
      })

      const rows: ExpenseRow[] = result.docs.map((d: MarketingExpense) => ({
        id: String(d.id),
        date: d.date,
        amount: typeof d.amount === 'number' ? d.amount : 0,
        amountExVat: typeof d.amountExVat === 'number' ? d.amountExVat : 0,
        source: d.source ?? 'manual',
        description: d.description,
        lastSyncedAt: d.lastSyncedAt,
      }))

      // Whether ANY imported record exists, independent of the display filter. Drives the
      // primary sync button label (Synkroniser vs Oppdater) — a filter that happens to be
      // empty must not make the page look like a first-time sync.
      const anyImported = await req.payload.find({
        collection: 'marketing-expenses',
        where: {
          and: [
            { channel: { equals: GOOGLE_ADS_CHANNEL } },
            { source: { equals: GOOGLE_ADS_SOURCE } },
          ],
        },
        depth: 0,
        limit: 1,
        pagination: true,
        overrideAccess: false,
        user: req.user,
      })

      return Response.json(
        {
          period: { since: since ?? null, until: until ?? null },
          rows,
          summary: expensesSummary(rows),
          hasData: anyImported.totalDocs > 0,
        },
        { status: 200 },
      )
    } catch (err) {
      req.payload.logger.error(
        `[marketing] google expenses failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke hente Google Ads-kostnader.' }, { status: 500 })
    }
  },
}
