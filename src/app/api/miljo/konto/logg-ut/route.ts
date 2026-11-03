import { accountDeps, json, parsePost, signedOutCookie } from '@/lib/miljo/account/endpoint'
import { signOut } from '@/lib/miljo/account/service'

// POST /api/miljo/konto/logg-ut — revoke this session and clear the Miljø cookie.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parsePost(request)
  if (parsed instanceof Response) return parsed
  await signOut(await accountDeps(), parsed.token).catch(() => undefined)
  return json(200, { ok: true }, signedOutCookie())
}
