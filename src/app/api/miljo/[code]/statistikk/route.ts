import { rateLimit, clientIpFromHeaders } from '@/lib/rateLimit'
import { isValidPublicCode } from '@/lib/miljo/code'
import { PeriodError, resolveMiljoPeriod } from '@/lib/miljo/period'
import { buildPublicStatistics, loadRecords, resolveOrganization } from '@/lib/miljo/service'
import { createMiljoRequest } from '@/lib/miljo/server'

// GET /api/miljo/<publicCode>/statistikk?preset=thisYear|thisMonth|lastMonth|lastYear|custom&from&to
//
// Public, read-only «Miljøstatistikk» for ONE organisation — the one whose code is in the path.
// Only aggregated reporting data leaves this handler (see buildPublicStatistics): no contacts,
// notes, references, review flags, audit data or PIN state. An inactive organisation, a retired
// code and an unknown code all answer the same 404. Rate-limited per client (best-effort).

export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const notFound = () => Response.json({ error: 'Ikke tilgjengelig.' }, { status: 404, headers: HEADERS })

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await params
  if (!isValidPublicCode(code)) return notFound()

  const limited = await rateLimit({ key: `miljo-stats:${clientIpFromHeaders(request.headers)}`, limit: 240, windowMs: 60 * 60 * 1000 })
  if (!limited.ok) return Response.json({ error: 'For mange forespørsler. Prøv igjen om litt.' }, { status: 429, headers: HEADERS })

  const url = new URL(request.url)
  let period
  try {
    period = resolveMiljoPeriod({
      preset: url.searchParams.get('preset'),
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    })
  } catch (err) {
    return Response.json({ error: err instanceof PeriodError ? err.message : 'Ugyldig periode.' }, { status: 400, headers: HEADERS })
  }

  try {
    const req = await createMiljoRequest()
    const resolved = await resolveOrganization(req, code)
    if (resolved.kind !== 'active') return notFound()
    const { registrations, deliveries } = await loadRecords(req, { organizationId: resolved.org.id, period })
    return Response.json(buildPublicStatistics(resolved.org, period, registrations, deliveries), { headers: HEADERS })
  } catch (err) {
    console.error(JSON.stringify({ scope: 'miljo-statistics', error: err instanceof Error ? err.message : 'unknown' }))
    return Response.json({ error: 'Kunne ikke hente statistikken.' }, { status: 500, headers: HEADERS })
  }
}
