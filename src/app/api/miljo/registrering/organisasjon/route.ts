import { REGISTRATION_TURNSTILE_ACTIONS } from '@/lib/miljo/registration/constants'
import { parseRequest, registrationDeps, respond } from '@/lib/miljo/registration/endpoint'
import { lookupOrganizationForRegistration } from '@/lib/miljo/registration/service'

// POST /api/miljo/registrering/organisasjon — the official name from Enhetsregisteret (after a verified purchase).
// Thin adapter: see @/lib/miljo/registration/service for every rule.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequest(request, { botAction: REGISTRATION_TURNSTILE_ACTIONS.registration })
  if (parsed instanceof Response) return parsed
  const { body, ip } = parsed
  return respond(await lookupOrganizationForRegistration(await registrationDeps(), { orderNumber: body.orderNumber, email: body.email, organizationNumber: body.organizationNumber, ip }))
}
