import { accountDeps, failure, json, parsePost } from '@/lib/miljo/account/endpoint'
import { requestPasswordReset } from '@/lib/miljo/account/service'

// POST /api/miljo/konto/glemt-passord — always the same answer; an e-mail only for an account that may sign in.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parsePost(request)
  if (parsed instanceof Response) return parsed
  const result = await requestPasswordReset(await accountDeps(), { email: parsed.body.email, ip: parsed.ip })
  if (!result.ok) return failure(result)
  return json(200, { ok: true, message: result.message })
}
