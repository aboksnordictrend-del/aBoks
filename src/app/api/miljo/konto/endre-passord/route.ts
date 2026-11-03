import { accountDeps, failure, json, parsePost, requireSession, signedInCookie, signedOutCookie } from '@/lib/miljo/account/endpoint'
import { changePassword } from '@/lib/miljo/account/service'

// POST /api/miljo/konto/endre-passord — signed in; revokes every session, then signs this browser in again.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parsePost(request)
  if (parsed instanceof Response) return parsed
  const deps = await accountDeps()
  const session = await requireSession(deps, parsed.token)
  if (session instanceof Response) return session
  const { body } = parsed
  const result = await changePassword(deps, session, { currentPassword: body.currentPassword, password: body.password, passwordConfirmation: body.passwordConfirmation })
  if (!result.ok) return failure(result)
  return json(200, { ok: true, message: result.message, signedIn: result.token !== '' }, result.token ? signedInCookie(result.token) : signedOutCookie())
}
