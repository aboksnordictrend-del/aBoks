import { parseRequest, registrationDeps, respond } from '@/lib/miljo/registration/endpoint'
import { resendConfirmation } from '@/lib/miljo/registration/service'

// POST /api/miljo/registrering/send-pa-nytt — a new confirmation link (the old one stops working).
// Thin adapter: see @/lib/miljo/registration/service for every rule.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequest(request, { requireBotCheck: false })
  if (parsed instanceof Response) return parsed
  const { body, ip } = parsed
  return respond(await resendConfirmation(await registrationDeps(), { resendKey: body.resendKey, ip }))
}
