import { accountDeps, failure, json, parsePost } from '@/lib/miljo/account/endpoint'
import { resetPassword } from '@/lib/miljo/account/service'

// POST /api/miljo/konto/nytt-passord — use a one-time reset link; every session of the account is revoked.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parsePost(request)
  if (parsed instanceof Response) return parsed
  const { body, ip } = parsed
  const result = await resetPassword(await accountDeps(), { token: body.token, password: body.password, passwordConfirmation: body.passwordConfirmation, ip })
  if (!result.ok) return failure(result)
  return json(200, { ok: true, message: result.message })
}
