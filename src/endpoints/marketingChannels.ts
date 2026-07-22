// Admin-only catalog data for the Markedsføringskostnader landing page, registered as
// GET /api/admin/marketing/channels. Returns one card per marketing channel with its
// connection status (derived from server env *presence* only — never secret values) and a
// spend summary computed from imported (meta-api) records. No account ids or tokens leave
// this handler.

import type { Endpoint, PayloadRequest } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import {
  MARKETING_CHANNEL_DEFS,
  buildChannelCard,
  isChannelConfigured,
  type MarketingChannelCard,
  type MarketingChannelSummary,
} from '@/lib/marketing/channels'
import { metaExpensesSummary, type MetaExpenseRow } from '@/lib/marketing/metaExpenses'

/** Spend summary for a channel from its imported (meta-api) day records. */
async function channelSummary(
  req: PayloadRequest,
  channelValue: string,
): Promise<MarketingChannelSummary> {
  const result = await req.payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [{ channel: { equals: channelValue } }, { source: { equals: 'meta-api' } }],
    },
    depth: 0,
    limit: 10_000,
    overrideAccess: false,
    user: req.user,
  })
  const rows: MetaExpenseRow[] = result.docs.map((d: MarketingExpense) => ({
    id: String(d.id),
    date: d.date,
    amount: typeof d.amount === 'number' ? d.amount : 0,
    amountExVat: typeof d.amountExVat === 'number' ? d.amountExVat : 0,
    source: d.source ?? 'manual',
    description: d.description,
    lastSyncedAt: d.lastSyncedAt,
  }))
  const s = metaExpensesSummary(rows)
  return {
    totalSpend: s.totalInclVat,
    days: s.days,
    lastSyncedAt: s.lastSyncedAt,
    firstDate: s.firstDay,
    lastDate: s.lastDay,
  }
}

export const marketingChannelsEndpoint: Endpoint = {
  path: '/admin/marketing/channels',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((req.user as { role?: string }).role !== 'admin') {
      return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
    }

    try {
      const cards: MarketingChannelCard[] = []
      for (const def of MARKETING_CHANNEL_DEFS) {
        const configured = isChannelConfigured(def, process.env)
        const summary = def.available
          ? await channelSummary(req, def.channelValue)
          : undefined
        cards.push(buildChannelCard(def, configured, summary))
      }
      return Response.json({ channels: cards }, { status: 200 })
    } catch (err) {
      req.payload.logger.error(
        `[marketing] channels failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke hente kanaler.' }, { status: 500 })
    }
  },
}
