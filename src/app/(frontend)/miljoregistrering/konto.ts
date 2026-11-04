import { cookies } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'
import { MILJO_PATHS, MILJO_SESSION_COOKIE } from '@/lib/miljo/account/constants'
import { currentSession, type MiljoSession, type SessionGate } from '@/lib/miljo/account/session'

/**
 * The Miljø session of the page request (only the `aboks-miljo-session` cookie), or null. With the
 * default `'full'` gate a session that still has a temporary password is null (see
 * @/lib/miljo/account/session); only the password-change page asks for `'password-change'`.
 */
export async function pageSession(gate: SessionGate = 'full'): Promise<MiljoSession | null> {
  const token = (await cookies()).get(MILJO_SESSION_COOKIE)?.value ?? null
  if (!token) return null
  return currentSession(await getPayloadClient(), token, gate).catch(() => null)
}

/** Where a signed-in visitor belongs: Min side, the forced password change, or nowhere (null). */
export async function signedInDestination(): Promise<string | null> {
  if (await pageSession()) return MILJO_PATHS.dashboard
  if (await pageSession('password-change')) return MILJO_PATHS.changeRequired
  return null
}

export const NO_INDEX = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
