import { getPayloadClient } from '@/lib/payload'
import { resolveApplicationOrigin } from '@/lib/appOrigin'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { clientIpFromHeaders } from '@/lib/rateLimit'
import { SITE_URL } from '@/lib/site'
import { dbRateLimitStore } from '@/lib/security/dbRateLimit'
import { turnstileConfigured, verifyTurnstile } from '@/lib/turnstile'
import { lookupOrganization } from './brreg'
import type { RegistrationDeps, StepResult } from './service'

/**
 * The HTTP edge of Miljøregistrering self-registration (/api/miljo/registrering/*): JSON in, JSON
 * out, `Cache-Control: no-store`, nothing cached and nothing about the request logged.
 *
 *   • Origin: a present Origin must be one of this deployment's own origins (the same allowlist as
 *     Payload's CSRF check). No cookie is involved in Stage 2.2a, but a cross-site page still may
 *     not drive these forms.
 *   • Bot check: Cloudflare Turnstile when configured (`turnstileToken` in the body); skipped
 *     otherwise, like the review and inquiry forms.
 *   • Rate limits and every decision live in ./service.
 */

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const appOrigin = resolveApplicationOrigin({ fallback: SITE_URL })
const trustedOrigins = new Set([...buildCsrfOrigins(appOrigin), ...buildCsrfOrigins(SITE_URL)])

export const json = (status: number, body: unknown) => Response.json(body, { status, headers: HEADERS })

export async function registrationDeps(): Promise<RegistrationDeps> {
  const payload = await getPayloadClient()
  return {
    payload,
    rateLimits: dbRateLimitStore(payload),
    lookupOrganization: (n) => lookupOrganization(n),
    sendEmail: async (message) => {
      await payload.sendEmail(message)
    },
    siteUrl: appOrigin,
  }
}

export interface ParsedRequest {
  body: Record<string, unknown>
  ip: string
}

/** Origin, content type, body and (optionally) Turnstile — or the Response that refuses it. */
export async function parseRequest(request: Request, { requireBotCheck }: { requireBotCheck: boolean }): Promise<ParsedRequest | Response> {
  const origin = request.headers.get('origin')
  if (origin && !trustedOrigins.has(origin)) return json(403, { ok: false, message: 'Forespørselen ble avvist.' })
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return json(415, { ok: false, message: 'Ugyldig forespørsel.' })
  }
  let body: Record<string, unknown>
  try {
    const raw = await request.json()
    body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  } catch {
    return json(400, { ok: false, message: 'Ugyldig forespørsel.' })
  }
  const ip = clientIpFromHeaders(request.headers)
  if (requireBotCheck && turnstileConfigured()) {
    const token = typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined
    if (!(await verifyTurnstile(token, ip))) return json(400, { ok: false, message: 'Bekreft at du ikke er en robot, og prøv igjen.' })
  }
  return { body, ip }
}

/** A service result as the HTTP response. Only the fields the form needs are returned. */
export function respond<T extends object>(result: StepResult<T>): Response {
  if (result.ok) return json(200, result)
  return json(result.status, { ok: false, message: result.message, ...(result.field ? { field: result.field } : {}), ...(result.code ? { code: result.code } : {}) })
}
