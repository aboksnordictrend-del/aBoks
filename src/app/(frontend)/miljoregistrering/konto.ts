import { cookies } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'
import { MILJO_SESSION_COOKIE } from '@/lib/miljo/account/constants'
import { currentSession, type MiljoSession } from '@/lib/miljo/account/session'

/** The Miljø session of the page request (only the `aboks-miljo-session` cookie), or null. */
export async function pageSession(): Promise<MiljoSession | null> {
  const token = (await cookies()).get(MILJO_SESSION_COOKIE)?.value ?? null
  if (!token) return null
  return currentSession(await getPayloadClient(), token).catch(() => null)
}

export const NO_INDEX = { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
