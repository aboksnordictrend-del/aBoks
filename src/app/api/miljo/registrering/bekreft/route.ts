import { parseRequest, registrationDeps, respond } from '@/lib/miljo/registration/endpoint'
import { confirmRegistration } from '@/lib/miljo/registration/service'

// POST /api/miljo/registrering/bekreft — confirm the e-mail (POST, so a mail scanner following the link does nothing). Never activates: only an administrator's approval does.
// Thin adapter: see @/lib/miljo/registration/service for every rule.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequest(request)
  if (parsed instanceof Response) return parsed
  const { body, ip } = parsed
  return respond(await confirmRegistration(await registrationDeps(), { token: body.token, ip }))
}
