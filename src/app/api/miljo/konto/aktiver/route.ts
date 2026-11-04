import { accountDeps, failure, json, parsePost, signedInCookie } from '@/lib/miljo/account/endpoint'
import { acceptInvitation } from '@/lib/miljo/account/invitation'

// POST /api/miljo/konto/aktiver — accept an invitation from aBoks (one-time link) and choose a
// password; the token goes ONLY into the HttpOnly session cookie. Rules: @/lib/miljo/account/invitation.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parsePost(request)
  if (parsed instanceof Response) return parsed
  const { body, ip } = parsed
  const result = await acceptInvitation(await accountDeps(), { token: body.token, password: body.password, passwordConfirmation: body.passwordConfirmation, ip })
  if (!result.ok) return failure(result)
  return json(200, { ok: true, message: result.message, signedIn: result.token !== '' }, result.token ? signedInCookie(result.token) : undefined)
}
