// Admin-only catalog data for the Markedsføringskostnader landing page, registered as
// GET /api/admin/marketing/channels. Returns one card per marketing channel with its
// connection status (derived from server env *presence* only — never secret values) and a
// spend summary computed from that channel's imported records (meta-api, google-ads, …).
// No account ids or tokens leave this handler.

import type { Endpoint, PayloadRequest } from 'payload'
import type { MarketingExpense } from '@/payload-types'
import {
  MARKETING_CHANNEL_DEFS,
  buildChannelCard,
  isChannelConfigured,
  type MarketingChannelCard,
  type MarketingChannelSummary,
} from '@/lib/marketing/channels'
import { expensesSummary, type ExpenseRow } from '@/lib/marketing/expenseSummary'
import { hasStoredToken } from '@/lib/tiktok/tokenStore'

/** Spend summary for a channel from its own imported day records (never manual rows). */
async function channelSummary(
  req: PayloadRequest,
  channelValue: string,
  sourceValue: string,
): Promise<MarketingChannelSummary> {
  const result = await req.payload.find({
    collection: 'marketing-expenses',
    where: {
      and: [{ channel: { equals: channelValue } }, { source: { equals: sourceValue } }],
    },
    depth: 0,
    limit: 10_000,
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
  const s = expensesSummary(rows)
  return {
    totalSpend: s.totalInclVat,
    days: s.days,
    lastSyncedAt: s.lastSyncedAt,
    firstDate: s.firstDay,
    lastDate: s.lastDay,
  }
}

/**
 * Whether a channel with an OAuth step already holds a usable authorization. Returns only a
 * boolean — the token is never read into this handler, let alone into the response.
 *
 * TikTok is the only such channel today. An env-supplied TIKTOK_ACCESS_TOKEN counts, matching
 * the env-first model Meta and Pinterest use; otherwise the stored OAuth grant decides. A
 * failed lookup degrades to "not authorized", so the card offers "Koble til" rather than a
 * sync that could not run.
 */
async function isChannelAuthorized(req: PayloadRequest, channelId: string): Promise<boolean> {
  if (channelId !== 'tiktok') return true
  if ((process.env.TIKTOK_ACCESS_TOKEN ?? '').trim() !== '') return true
  try {
    return await hasStoredToken(req.payload)
  } catch {
    return false
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
          ? await channelSummary(req, def.channelValue, def.sourceValue)
          : undefined
        // Only a channel with an OAuth step can be "configured but not authorized"; the
        // others pass `true` and behave exactly as before. Boolean only — the token itself
        // is never read here.
        const authorized = def.connectEndpoint
          ? await isChannelAuthorized(req, def.id)
          : true
        cards.push(buildChannelCard(def, configured, summary, authorized))
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
