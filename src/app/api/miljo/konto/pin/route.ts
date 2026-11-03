import { accountDeps, failure, json, parsePost, requireSession } from '@/lib/miljo/account/endpoint'
import { revealPin } from '@/lib/miljo/account/service'

// POST /api/miljo/konto/pin — «Vis PIN»: the active delivery PIN of the signed-in account's OWN organisation.
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const parsed = await parsePost(request)
  if (parsed instanceof Response) return parsed
  const deps = await accountDeps()
  const session = await requireSession(deps, parsed.token)
  if (session instanceof Response) return session
  const result = await revealPin(deps, session)
  if (!result.ok) return failure(result)
  return json(200, { ok: true, pin: result.pin })
}
