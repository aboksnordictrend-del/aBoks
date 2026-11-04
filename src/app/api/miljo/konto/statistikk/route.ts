import { ACCOUNT_MESSAGES, ACCOUNT_RATE_LIMITS } from '@/lib/miljo/account/constants'
import { accountDeps, json, requireSession } from '@/lib/miljo/account/endpoint'
import { accountOrganization, accountStatistics } from '@/lib/miljo/account/organization'
import { readSessionToken } from '@/lib/miljo/account/session'
import { PeriodError, resolveMiljoPeriod } from '@/lib/miljo/period'
import { withinLimits } from '@/lib/security/dbRateLimit'

// GET /api/miljo/konto/statistikk?preset=thisYear|thisMonth|lastMonth|lastYear|custom&from&to
//
// «Miljøstatistikk» on Min side: the same figures as /api/miljo/<code>/statistikk, for the
// signed-in account's OWN organisation — taken from the session, never from the request.
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  const deps = await accountDeps()
  const session = await requireSession(deps, readSessionToken(request.headers.get('cookie')))
  if (session instanceof Response) return session
  if (!(await withinLimits(deps.rateLimits, [{ key: `acct:stats:${String(session.account.id)}`, ...ACCOUNT_RATE_LIMITS.statsPerAccount }]))) {
    return json(429, { error: ACCOUNT_MESSAGES.rateLimited })
  }

  const url = new URL(request.url)
  let period
  try {
    period = resolveMiljoPeriod({ preset: url.searchParams.get('preset'), from: url.searchParams.get('from'), to: url.searchParams.get('to') })
  } catch (err) {
    return json(400, { error: err instanceof PeriodError ? err.message : 'Ugyldig periode.' })
  }

  try {
    const account = await accountOrganization(session)
    if (!account) return json(404, { error: 'Organisasjonen har ingen registreringsside ennå. Kontakt aBoks.' })
    return json(200, await accountStatistics(session, account, period))
  } catch (err) {
    deps.payload.logger.error(`[miljo-account] statistics failed: ${err instanceof Error ? err.name : 'unknown'}`)
    return json(500, { error: 'Kunne ikke hente statistikken.' })
  }
}
