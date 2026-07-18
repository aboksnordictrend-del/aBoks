// Auth-guarded analytics endpoint, registered on the Payload config as `/api/analytics`.
//
// Security boundary for the whole dashboard: every response requires an authenticated
// Payload user (req.user). Aggregation happens here on the server; only summarized,
// non-personal data leaves this handler. Query params are validated; on failure a
// generic message is returned and the real error is logged server-side only.

import type { Endpoint, PayloadRequest } from 'payload'
import { runAnalyticsDetailed, type AnalyticsQuery } from '../lib/analytics/aggregate'
import { marketingCsv, ordersCsv, productsCsv } from '../lib/analytics/csv'
import { expenseOverlapsPeriod } from '../lib/analytics/marketing'
import type { Grouping, PresetKey } from '../lib/analytics/period'

const PRESETS: PresetKey[] = [
  'today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'thisYear', 'custom',
]
const GROUPINGS: Grouping[] = ['day', 'week', 'month']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

class BadRequest extends Error {}

function str(query: Record<string, unknown>, key: string): string | undefined {
  const raw = query[key]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return undefined
}

function parseQuery(req: PayloadRequest): AnalyticsQuery {
  const query = (req.query ?? {}) as Record<string, unknown>

  const preset = (str(query, 'preset') ?? 'last30') as PresetKey
  if (!PRESETS.includes(preset)) throw new BadRequest('Ugyldig periode.')

  const groupingRaw = str(query, 'grouping')
  if (groupingRaw && !GROUPINGS.includes(groupingRaw as Grouping)) {
    throw new BadRequest('Ugyldig gruppering.')
  }

  const paidOnly = str(query, 'paidOnly') !== 'false' // default true

  let customFrom: string | undefined
  let customTo: string | undefined
  if (preset === 'custom') {
    customFrom = str(query, 'from')
    customTo = str(query, 'to')
    if (!customFrom || !customTo) throw new BadRequest('Egendefinert periode krever fra- og til-dato.')
    if (!DATE_RE.test(customFrom) || !DATE_RE.test(customTo)) {
      throw new BadRequest('Datoer må være på formatet ÅÅÅÅ-MM-DD.')
    }
    if (customFrom > customTo) throw new BadRequest('Startdato kan ikke være etter sluttdato.')
    // Guard against unbounded ranges.
    const days = (Date.parse(customTo) - Date.parse(customFrom)) / 86_400_000
    if (days > 1100) throw new BadRequest('Perioden er for lang (maks ca. 3 år).')
  }

  return {
    preset,
    customFrom,
    customTo,
    paidOnly,
    grouping: groupingRaw as Grouping | undefined,
    isAdmin: (req.user as { role?: string } | null | undefined)?.role === 'admin',
  }
}

export const analyticsEndpoint: Endpoint = {
  path: '/analytics',
  method: 'get',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let parsed: AnalyticsQuery
    try {
      parsed = parseQuery(req)
    } catch (err) {
      const message = err instanceof BadRequest ? err.message : 'Ugyldig forespørsel.'
      return Response.json({ error: message }, { status: 400 })
    }

    try {
      const { response, current, expenses } = await runAnalyticsDetailed(req.payload, parsed)

      const format = (req.query as Record<string, unknown>)?.format
      if (format === 'csv') {
        const type = (req.query as Record<string, unknown>)?.type
        const period = { from: response.period.from, to: response.period.to }

        if (type === 'marketing' && !parsed.isAdmin) {
          return Response.json({ error: 'Kun for administratorer.' }, { status: 403 })
        }

        let body: string
        let slug: string
        if (type === 'orders') {
          body = ordersCsv(current)
          slug = 'ordre'
        } else if (type === 'marketing') {
          body = marketingCsv(expenses.filter((e) => expenseOverlapsPeriod(e, period)))
          slug = 'markedsforing'
        } else {
          body = productsCsv(response.products, period)
          slug = 'produkter'
        }

        const filename = `aboks-${slug}-${period.from.slice(0, 10)}_${period.to.slice(0, 10)}.csv`
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        })
      }

      return Response.json(response, { status: 200 })
    } catch (err) {
      // Never leak internals to the client.
      req.payload.logger.error(
        `[analytics] aggregation failed: ${err instanceof Error ? err.message : 'unknown'}`,
      )
      return Response.json({ error: 'Kunne ikke hente analysedata.' }, { status: 500 })
    }
  },
}
