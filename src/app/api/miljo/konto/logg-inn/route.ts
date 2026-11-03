import { accountDeps, failure, json, parsePost, signedInCookie } from '@/lib/miljo/account/endpoint'
import { signIn } from '@/lib/miljo/account/service'

// POST /api/miljo/konto/logg-inn — sign a Miljø account in; the token goes ONLY into the
// HttpOnly session cookie, never into the response body. Rules: @/lib/miljo/account/service.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parsePost(request)
  if (parsed instanceof Response) return parsed
  const result = await signIn(await accountDeps(), { email: parsed.body.email, password: parsed.body.password, ip: parsed.ip })
  if (!result.ok) return failure(result)
  return json(200, { ok: true }, signedInCookie(result.token))
}
