import { ACCOUNT_MESSAGES, ACCOUNT_RATE_LIMITS } from '@/lib/miljo/account/constants'
import { accountDeps, json, requireSession } from '@/lib/miljo/account/endpoint'
import { accountExport, accountOrganization } from '@/lib/miljo/account/organization'
import { readSessionToken } from '@/lib/miljo/account/session'
import { isCsvType } from '@/lib/miljo/csv'
import { downloadResponse } from '@/lib/miljo/exports'
import { PeriodError, resolveMiljoPeriod } from '@/lib/miljo/period'
import { withinLimits } from '@/lib/security/dbRateLimit'

// GET /api/miljo/konto/eksport?format=pdf|csv&type=registreringer|leveranser|sammendrag&preset=…&from=…&to=…
//
// The miljørapport (PDF) and CSV downloads on Min side: the same files as the public page's
// exports (same builders, same `public` columns), for the signed-in account's OWN organisation —
// taken from the session, never from the request.
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv'
  const type = url.searchParams.get('type') ?? 'sammendrag'
  if (format === 'csv' && !isCsvType(type)) return json(400, { error: 'Ukjent eksporttype.' })

  const deps = await accountDeps()
  const session = await requireSession(deps, readSessionToken(request.headers.get('cookie')))
  if (session instanceof Response) return session
  const rule = format === 'pdf' ? ACCOUNT_RATE_LIMITS.pdfPerAccount : ACCOUNT_RATE_LIMITS.csvPerAccount
  if (!(await withinLimits(deps.rateLimits, [{ key: `acct:export-${format}:${String(session.account.id)}`, ...rule }]))) {
    return json(429, { error: ACCOUNT_MESSAGES.rateLimited })
  }

  let period
  try {
    period = resolveMiljoPeriod({ preset: url.searchParams.get('preset'), from: url.searchParams.get('from'), to: url.searchParams.get('to') })
  } catch (err) {
    return json(400, { error: err instanceof PeriodError ? err.message : 'Ugyldig periode.' })
  }

  try {
    const account = await accountOrganization(session)
    if (!account) return json(404, { error: 'Organisasjonen har ingen registreringsside ennå. Kontakt aBoks.' })
    return downloadResponse(await accountExport(session, account, { format, type, period }))
  } catch (err) {
    deps.payload.logger.error(`[miljo-account] ${format} export failed: ${err instanceof Error ? err.name : 'unknown'}`)
    return json(500, { error: 'Kunne ikke lage filen.' })
  }
}
