import { REGISTRATION_TURNSTILE_ACTIONS } from '@/lib/miljo/registration/constants'
import { parseRequest, registrationDeps, respond } from '@/lib/miljo/registration/endpoint'
import { verifyPurchase } from '@/lib/miljo/registration/service'

// POST /api/miljo/registrering/kjop — step 1: order number + purchase e-mail.
// Thin adapter: see @/lib/miljo/registration/service for every rule.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequest(request, { botAction: REGISTRATION_TURNSTILE_ACTIONS.purchase })
  if (parsed instanceof Response) return parsed
  const { body, ip } = parsed
  return respond(await verifyPurchase(await registrationDeps(), { orderNumber: body.orderNumber, email: body.email, ip }))
}
