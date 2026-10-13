import { createHash } from 'node:crypto'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import {
  rateLimit as defaultRateLimit,
  type RateLimitOptions,
  type RateLimitResult,
} from '@/lib/rateLimit'
import { verifyTurnstile as defaultVerifyTurnstile } from '@/lib/turnstile'
import { ADMIN_EMAIL } from '@/lib/orderEmails'
import { getEmailSendTimeoutMs } from '@/lib/mailTransport'
import { HONEYPOT_FIELD } from '@/lib/bedrifter/inquiryEndpoint'
import { createAdminPartnerApplicationEmail } from '@/emails/admin-partner-application'
import { createPartnerApplicationConfirmationEmail } from '@/emails/partner-application-confirmation'
import {
  validateApplicationInput,
  type ApplicationErrors,
  type CleanApplication,
} from './application'
import { APPLICATION_RESPONSE_MESSAGES } from './applicationResponses'

/**
 * Everything behind `POST /api/bli-partner/soknad`, kept out of the route so it can be tested
 * without Payload — the same split, the same order of checks and the same spam protection as
 * the /bedrifter inquiry (`@/lib/bedrifter/inquiryEndpoint`):
 *
 *   Origin → content type → body size → JSON → honeypot → rate limit → Turnstile →
 *   field validation → duplicate guard → send.
 *
 * ── What an application does, and does not do ──
 *
 * It produces two e-mails — the internal notification to post@aboks.no, then the applicant's
 * receipt — and nothing else. No database row, no promo code, no partner record, no payout.
 * Approving an applicant, signing the agreement and creating their partner code are manual
 * steps in the Payload admin, which stays the only source of truth for partners. This is the
 * same "a submission is a message, not a record" decision the B2B inquiry made.
 *
 * Logs carry shape and outcome only — never a name, address, phone, text or raw IP.
 */

export const MAX_BODY_BYTES = 16_384
export const RATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 } as const
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000
const SOURCE_PAGE = '/bli-partner'

export { HONEYPOT_FIELD }

export type ApplicationFailureReason =
  | 'invalid_request'
  | 'forbidden_origin'
  | 'rate_limited'
  | 'turnstile_failed'
  | 'validation_failed'
  | 'server_error'

export type ApplicationResponse =
  | { ok: true; message: string }
  | {
      ok: false
      reason: ApplicationFailureReason
      message: string
      errors?: ApplicationErrors
      retryAfter?: number
    }

export interface ApplicationEndpointResult {
  status: number
  body: ApplicationResponse
  headers?: Record<string, string>
}

export { APPLICATION_RESPONSE_MESSAGES }

/* ------------------------------ duplicate guard ------------------------------ */

/** Per-isolate, best-effort — see the note on the inquiry endpoint's identical guard. */
const inFlight = new Map<string, Promise<ApplicationEndpointResult>>()
const recentlySent = new Map<string, number>()

export function resetApplicationDuplicateGuard(): void {
  inFlight.clear()
  recentlySent.clear()
}

export function applicationFingerprint(value: CleanApplication): string {
  const material = [
    value.applicantType,
    value.fullName,
    value.companyName ?? '',
    value.orgNumber ?? '',
    value.email.toLowerCase(),
    value.phone ?? '',
    value.website ?? '',
    value.promotionPlan,
  ].join(' ')
  return createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 32)
}

const hashIp = (ip: string): string =>
  createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 12)

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function turnstileTokenOf(body: Record<string, unknown>): string | undefined {
  for (const candidate of [body.turnstileToken, body['cf-turnstile-response']]) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
  }
  return undefined
}

/* ------------------------------ sending ------------------------------ */

export interface OutgoingEmail {
  to: string
  subject: string
  html: string
  text: string
}

async function sendWithTimeout(
  send: (message: OutgoingEmail) => Promise<unknown>,
  message: OutgoingEmail,
  timeoutMs: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      send(message),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Email send timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/* ------------------------------ handler ------------------------------ */

const trustedOrigins = new Set(buildCsrfOrigins(SITE_URL))
const defaultOriginAllowed = (origin: string | null): boolean => !origin || trustedOrigins.has(origin)

export interface ApplicationEndpointDeps {
  sendEmail: (message: OutgoingEmail) => Promise<unknown>
  rateLimit?: (options: RateLimitOptions) => Promise<RateLimitResult>
  originAllowed?: (origin: string | null) => boolean
  verifyTurnstile?: (token: string | undefined, remoteIp?: string) => Promise<boolean>
  log?: (line: Record<string, unknown>) => void
  now?: () => Date
  sendTimeoutMs?: number
}

export interface ApplicationEndpointInput {
  origin: string | null
  contentType: string | null
  ip: string
  rawBody: string
}

const failure = (
  status: number,
  reason: ApplicationFailureReason,
  message: string,
  extra: { errors?: ApplicationErrors; retryAfter?: number } = {},
): ApplicationEndpointResult => ({ status, body: { ok: false, reason, message, ...extra } })

const success = (): ApplicationEndpointResult => ({
  status: 200,
  body: { ok: true, message: APPLICATION_RESPONSE_MESSAGES.success },
})

export async function handlePartnerApplication(
  deps: ApplicationEndpointDeps,
  input: ApplicationEndpointInput,
): Promise<ApplicationEndpointResult> {
  const startedAt = Date.now()
  const limiter = deps.rateLimit ?? defaultRateLimit
  const originAllowed = deps.originAllowed ?? defaultOriginAllowed
  const verifyTurnstile = deps.verifyTurnstile ?? defaultVerifyTurnstile
  const log = deps.log ?? ((line: Record<string, unknown>) => console.log(JSON.stringify(line)))
  const now = deps.now ?? (() => new Date())
  const ipHash = hashIp(input.ip)
  const M = APPLICATION_RESPONSE_MESSAGES

  const finish = (result: ApplicationEndpointResult, extra: Record<string, unknown> = {}) => {
    log({
      scope: 'partner-application',
      status: result.status,
      ok: result.body.ok,
      ...(result.body.ok ? {} : { reason: result.body.reason }),
      ipHash,
      durationMs: Date.now() - startedAt,
      ...extra,
    })
    return result
  }

  if (!originAllowed(input.origin)) {
    return finish(failure(403, 'forbidden_origin', M.forbiddenOrigin), { stage: 'origin' })
  }
  if (!input.contentType || !input.contentType.toLowerCase().includes('application/json')) {
    return finish(failure(415, 'invalid_request', M.invalidRequest), { stage: 'content-type' })
  }
  if (Buffer.byteLength(input.rawBody, 'utf8') > MAX_BODY_BYTES) {
    return finish(failure(413, 'invalid_request', M.invalidRequest), { stage: 'body-size' })
  }

  let json: unknown
  try {
    json = JSON.parse(input.rawBody)
  } catch {
    return finish(failure(400, 'invalid_request', M.invalidRequest), { stage: 'json' })
  }
  if (!isRecord(json)) {
    return finish(failure(400, 'invalid_request', M.invalidRequest), { stage: 'shape' })
  }

  const honeypot = json[HONEYPOT_FIELD]
  if (typeof honeypot === 'string' && honeypot.trim() !== '') {
    return finish(failure(400, 'invalid_request', M.invalidRequest), { stage: 'honeypot' })
  }

  const rl = await limiter({
    key: `partner-application:${ipHash}`,
    limit: RATE_LIMIT.limit,
    windowMs: RATE_LIMIT.windowMs,
  })
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil(rl.resetMs / 1000))
    const result = failure(429, 'rate_limited', M.rateLimited, { retryAfter })
    result.headers = { 'Retry-After': String(retryAfter) }
    return finish(result, { stage: 'rate-limit' })
  }

  if (!(await verifyTurnstile(turnstileTokenOf(json), input.ip))) {
    return finish(failure(400, 'turnstile_failed', M.turnstileFailed), { stage: 'turnstile' })
  }

  const validation = validateApplicationInput({
    applicantType: json.applicantType,
    fullName: json.fullName,
    companyName: json.companyName,
    orgNumber: json.orgNumber,
    email: json.email,
    phone: json.phone,
    website: json.website,
    promotionPlan: json.promotionPlan,
    privacyAccepted: json.privacyAccepted,
    approvalAcknowledged: json.approvalAcknowledged,
  })
  if (!validation.ok) {
    return finish(
      failure(400, 'validation_failed', M.validationFailed, { errors: validation.errors }),
      { stage: 'validation', fields: Object.keys(validation.errors) },
    )
  }

  const value = validation.value
  const fingerprint = applicationFingerprint(value)

  const sentUntil = recentlySent.get(fingerprint)
  if (sentUntil !== undefined && sentUntil > Date.now()) {
    return finish(success(), { stage: 'duplicate', duplicate: 'recent', fingerprint })
  }
  const pending = inFlight.get(fingerprint)
  if (pending) {
    return finish(await pending, { stage: 'duplicate', duplicate: 'in-flight', fingerprint })
  }

  const work = sendApplicationEmails(deps, value, now(), fingerprint, log, ipHash)
  inFlight.set(fingerprint, work)
  let result: ApplicationEndpointResult
  try {
    result = await work
  } finally {
    inFlight.delete(fingerprint)
  }

  if (result.body.ok) {
    recentlySent.set(fingerprint, Date.now() + DUPLICATE_WINDOW_MS)
    if (recentlySent.size >= 256) {
      const nowMs = Date.now()
      for (const [key, until] of recentlySent) if (until <= nowMs) recentlySent.delete(key)
    }
  }

  return finish(result, { stage: 'send', fingerprint, applicantType: value.applicantType })
}

async function sendApplicationEmails(
  deps: ApplicationEndpointDeps,
  value: CleanApplication,
  submittedAt: Date,
  fingerprint: string,
  log: (line: Record<string, unknown>) => void,
  ipHash: string,
): Promise<ApplicationEndpointResult> {
  const timeoutMs = deps.sendTimeoutMs ?? getEmailSendTimeoutMs()
  const stages: { stage: 'admin' | 'confirmation'; message: OutgoingEmail }[] = [
    {
      stage: 'admin',
      message: {
        to: ADMIN_EMAIL,
        ...createAdminPartnerApplicationEmail({
          ...value,
          submittedAt: submittedAt.toISOString(),
          source: SOURCE_PAGE,
        }),
      },
    },
    { stage: 'confirmation', message: { to: value.email, ...createPartnerApplicationConfirmationEmail(value) } },
  ]

  for (const { stage, message } of stages) {
    const stageStart = Date.now()
    try {
      await sendWithTimeout(deps.sendEmail, message, timeoutMs)
      log({ scope: 'partner-application', event: 'email-sent', stage, fingerprint, ipHash, durationMs: Date.now() - stageStart })
    } catch (err) {
      log({
        scope: 'partner-application',
        event: 'email-failed',
        stage,
        fingerprint,
        ipHash,
        durationMs: Date.now() - stageStart,
        adminSent: stage === 'confirmation',
        error: err instanceof Error ? err.message : String(err),
      })
      return failure(500, 'server_error', APPLICATION_RESPONSE_MESSAGES.serverError)
    }
  }
  return success()
}
