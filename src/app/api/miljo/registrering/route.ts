import { REGISTRATION_TURNSTILE_ACTIONS } from '@/lib/miljo/registration/constants'
import { parseRequest, registrationDeps, respond } from '@/lib/miljo/registration/endpoint'
import { submitRegistration } from '@/lib/miljo/registration/service'

// POST /api/miljo/registrering — step 2: store the registration and send ONE confirmation e-mail.
// Thin adapter: see @/lib/miljo/registration/service for every rule.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequest(request, { botAction: REGISTRATION_TURNSTILE_ACTIONS.registration })
  if (parsed instanceof Response) return parsed
  const { body, ip } = parsed
  return respond(await submitRegistration(await registrationDeps(), { orderNumber: body.orderNumber, email: body.email, organizationNumber: body.organizationNumber, contactName: body.contactName, loginEmail: body.loginEmail, password: body.password, passwordConfirmation: body.passwordConfirmation, ip }))
}
