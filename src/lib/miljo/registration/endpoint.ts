import { resolveApplicationOrigin } from '@/lib/appOrigin'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import { rateLimitSubject, trustedClientIp } from '@/lib/security/clientIp'
import { dbRateLimitStore } from '@/lib/security/dbRateLimit'
import { TURNSTILE_MESSAGES, verifyTurnstileToken } from '@/lib/security/turnstileVerify'
import { lookupOrganization } from './brreg'
import type { RegistrationDeps, StepResult } from './service'

/**
 * The HTTP edge of Miljøregistrering self-registration (/api/miljo/registrering/*): JSON in, JSON
 * out, `Cache-Control: no-store`, nothing cached and nothing about the request logged.
 *
 *   • Origin: required, and one of this deployment's own origins (the same allowlist as Payload's
 *     CSRF check). Browsers always send it on a fetch POST, so a cross-site page cannot drive these
 *     forms and a direct request without it gets nowhere.
 *   • Bot check: the strict Turnstile of the public QR page (@/lib/security/turnstileVerify) on the
 *     purchase check, the organisation lookup and the submission. It fails CLOSED on a deployment
 *     when the keys are missing, and compares hostname and action in Production. Confirmation and
 *     «send again» carry a 256-bit secret from the e-mail or the page instead, and are rate-limited.
 *   • Client address: read only from headers the platform controls; IPv6 counted per /64.
 *   • Rate limits and every decision live in ./service.
 */

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const appOrigin = resolveApplicationOrigin({ fallback: SITE_URL })
const trustedOrigins = new Set([...buildCsrfOrigins(appOrigin), ...buildCsrfOrigins(SITE_URL)])

export const json = (status: number, body: unknown) => Response.json(body, { status, headers: HEADERS })

export async function registrationDeps(): Promise<RegistrationDeps> {
  // Imported here so the request checks below can be tested without the Payload config.
  const { getPayloadClient } = await import('@/lib/payload')
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
  /** A rate-limit subject, never a raw header value. */
  ip: string
}

/** Origin, content type, body and (when `botAction` is given) Turnstile — or the Response that refuses it. */
export async function parseRequest(request: Request, { botAction }: { botAction?: string } = {}): Promise<ParsedRequest | Response> {
  const origin = request.headers.get('origin')
  if (!origin || !trustedOrigins.has(origin)) return json(403, { ok: false, message: 'Forespørselen ble avvist.' })
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
  const address = trustedClientIp(request.headers)
  if (botAction) {
    const outcome = await verifyTurnstileToken(body.turnstileToken, { action: botAction, remoteIp: address })
    if (!outcome.ok) {
      const unavailable = outcome.reason === 'misconfigured' || outcome.reason === 'unavailable'
      return json(unavailable ? 503 : 400, { ok: false, message: TURNSTILE_MESSAGES[outcome.reason], code: 'turnstile' })
    }
  }
  return { body, ip: rateLimitSubject(address) }
}

/** A service result as the HTTP response. Only the fields the form needs are returned. */
export function respond<T extends object>(result: StepResult<T>): Response {
  if (result.ok) return json(200, result)
  return json(result.status, { ok: false, message: result.message, ...(result.field ? { field: result.field } : {}), ...(result.code ? { code: result.code } : {}) })
}
