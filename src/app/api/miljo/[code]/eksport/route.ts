import { rateLimit, clientIpFromHeaders } from '@/lib/rateLimit'
import { isValidPublicCode } from '@/lib/miljo/code'
import { isCsvType } from '@/lib/miljo/csv'
import { buildCsvExport, buildPdfExport, downloadResponse } from '@/lib/miljo/exports'
import { PeriodError, resolveMiljoPeriod } from '@/lib/miljo/period'
import { loadRecords, resolveOrganization } from '@/lib/miljo/service'
import { createMiljoRequest } from '@/lib/miljo/server'

// GET /api/miljo/<publicCode>/eksport?format=pdf|csv&type=registreringer|leveranser|sammendrag
//     &preset=…&from=…&to=…
//
// Public downloads behind «Eksporter miljørapport (PDF)» and «Last ned statistikk (CSV)». Same
// scope and data rules as the statistics endpoint: one organisation, the selected period, only
// approved reporting columns (the `public` CSV audience), invalidated records excluded. PDFs cost
// more to build, so they have a tighter per-client limit.

export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: HEADERS })

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params
  if (!isValidPublicCode(code)) return fail(404, 'Ikke tilgjengelig.')

  const url = new URL(request.url)
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv'
  const type = url.searchParams.get('type') ?? 'sammendrag'
  if (format === 'csv' && !isCsvType(type)) return fail(400, 'Ukjent eksporttype.')

  const ip = clientIpFromHeaders(request.headers)
  const limited = await rateLimit({
    key: `miljo-export-${format}:${ip}`,
    limit: format === 'pdf' ? 30 : 60,
    windowMs: 60 * 60 * 1000,
  })
  if (!limited.ok) return fail(429, 'For mange nedlastinger. Prøv igjen om litt.')

  let period
  try {
    period = resolveMiljoPeriod({ preset: url.searchParams.get('preset'), from: url.searchParams.get('from'), to: url.searchParams.get('to') })
  } catch (err) {
    return fail(400, err instanceof PeriodError ? err.message : 'Ugyldig periode.')
  }

  try {
    const req = await createMiljoRequest()
    const resolved = await resolveOrganization(req, code)
    if (resolved.kind !== 'active') return fail(404, 'Ikke tilgjengelig.')
    const { org } = resolved
    const { registrations, deliveries } = await loadRecords(req, { organizationId: org.id, period })
    const scope = {
      audience: 'public' as const,
      organizationName: org.name,
      offered: org.policy.categories.map((c) => ({ value: c.value, label: c.label })),
      period,
      registrations,
      deliveries,
    }
    const file = format === 'pdf' ? await buildPdfExport(scope) : buildCsvExport(scope, type as Parameters<typeof buildCsvExport>[1])
    return downloadResponse(file)
  } catch (err) {
    console.error(JSON.stringify({ scope: 'miljo-export', format, error: err instanceof Error ? err.message : 'unknown' }))
    return fail(500, 'Kunne ikke lage filen.')
  }
}
