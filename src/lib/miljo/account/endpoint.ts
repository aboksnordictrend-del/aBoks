import { after } from 'next/server'
import { resolveApplicationOrigin } from '@/lib/appOrigin'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { clientIpFromHeaders } from '@/lib/rateLimit'
import { SITE_URL } from '@/lib/site'
import { dbRateLimitStore } from '@/lib/security/dbRateLimit'
import type { StepResult } from '@/lib/miljo/registration/service'
import { ACCOUNT_MESSAGES } from './constants'
import type { AccountDeps } from './service'
import { clearedSessionCookieHeader, currentSession, readSessionToken, sessionCookieHeader, type MiljoSession, type SessionGate } from './session'

/**
 * The HTTP edge of the Miljø account area (/api/miljo/konto/*): JSON in, JSON out,
 * `Cache-Control: no-store`, nothing about the request logged.
 *
 *   • CSRF: every POST must carry an `Origin` header from this deployment's own allowlist (the same
 *     one Payload uses) — not merely «absent or trusted». Browsers always send it on fetch POSTs.
 *     Together with SameSite=Lax on the session cookie, a cross-site page can neither sign a
 *     browser in or out nor act with its session.
 *   • Session: only the `aboks-miljo-session` cookie (./session); `payload-token` is ignored.
 */

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const appOrigin = resolveApplicationOrigin({ fallback: SITE_URL })
const trustedOrigins = new Set([...buildCsrfOrigins(appOrigin), ...buildCsrfOrigins(SITE_URL)])

export function json(status: number, body: unknown, cookie?: string): Response {
  const headers = new Headers(HEADERS)
  if (cookie) headers.append('Set-Cookie', cookie)
  return Response.json(body, { status, headers })
}

export async function accountDeps(): Promise<AccountDeps> {
  // Imported here so the request checks below can be tested without the Payload config.
  const { getPayloadClient } = await import('@/lib/payload')
  const payload = await getPayloadClient()
  return {
    payload,
    rateLimits: dbRateLimitStore(payload),
    // Sent after the response: «Glemt passord» must answer equally fast whether or not an account exists.
    sendEmail: async (message) => {
      after(async () => {
        try {
          await payload.sendEmail(message)
        } catch (err) {
          payload.logger.error(`[miljo-account] e-mail not sent: ${err instanceof Error ? err.name : 'unknown'}`)
        }
      })
    },
    siteUrl: appOrigin,
  }
}

export interface ParsedPost {
  body: Record<string, unknown>
  ip: string
  token: string | null
}

/** Trusted Origin (required), JSON body, client address and the Miljø cookie — or the refusal. */
export async function parsePost(request: Request): Promise<ParsedPost | Response> {
  const origin = request.headers.get('origin')
  if (!origin || !trustedOrigins.has(origin)) return json(403, { ok: false, message: 'Forespørselen ble avvist.' })
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return json(415, { ok: false, message: 'Ugyldig forespørsel.' })
  let body: Record<string, unknown>
  try {
    const raw = await request.json()
    body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  } catch {
    return json(400, { ok: false, message: 'Ugyldig forespørsel.' })
  }
  return { body, ip: clientIpFromHeaders(request.headers), token: readSessionToken(request.headers.get('cookie')) }
}

/**
 * The authorised session of the request, or the refusal: 403 `password_change_required` while the
 * account still has a temporary password (the cookie is kept — it is needed to change it), otherwise
 * a 401 that also clears a stale cookie. Every Min side route uses the default `'full'` gate; only
 * the password change passes `'password-change'`.
 */
export async function requireSession(deps: AccountDeps, token: string | null, gate: SessionGate = 'full'): Promise<MiljoSession | Response> {
  const session = await currentSession(deps.payload, token, gate).catch(() => null)
  if (session) return session
  if (gate === 'full' && token && (await currentSession(deps.payload, token, 'password-change').catch(() => null))) {
    return json(403, { ok: false, message: ACCOUNT_MESSAGES.passwordChangeRequired, code: 'password_change_required' })
  }
  return json(401, { ok: false, message: ACCOUNT_MESSAGES.notSignedIn, code: 'signed_out' }, token ? clearedSessionCookieHeader() : undefined)
}

export function failure(result: Extract<StepResult<object>, { ok: false }>): Response {
  return json(result.status, { ok: false, message: result.message, ...(result.field ? { field: result.field } : {}), ...(result.code ? { code: result.code } : {}) })
}

export const signedInCookie = sessionCookieHeader
export const signedOutCookie = clearedSessionCookieHeader
