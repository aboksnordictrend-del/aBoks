import { randomUUID } from 'node:crypto'
import { PRODUCTION_SITE_URL } from '@/lib/site'

/**
 * Strict Cloudflare Turnstile verification for the public Miljøregistrering forms, following
 * Cloudflare's server-side validation guide:
 *
 *   • every submission carries a token, and every token is sent to Siteverify — there is no
 *     «already verified» shortcut, so a direct request without the page gets nowhere;
 *   • a token is at most 2048 characters, valid for 300 seconds and accepted ONCE; a replay or an
 *     expired token comes back as `timeout-or-duplicate`;
 *   • on a successful answer `hostname` and `action` are compared with what this site expects;
 *   • only `internal-error` and network failures are retried — once, with the same
 *     `idempotency_key` — and everything else is final.
 *
 * Unlike the optional @/lib/turnstile used by other forms, this one FAILS CLOSED on a deployment
 * (Vercel Production or Preview): missing keys, a rejected secret or Cloudflare being unreachable
 * all refuse the submission. Only a local run without keys skips the check, so `npm run dev`
 * works out of the box; with Cloudflare's test keys locally the check runs for real.
 *
 * The secret is read from the server environment only. It is never logged, returned or sent
 * anywhere but Siteverify; logs carry the outcome and Cloudflare's error codes, never the token.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048

/** Cloudflare's published dummy secrets (always pass / always fail / already spent). */
const TEST_SECRET = /^[123]x0{30,}AA$/

export type TurnstileFailure =
  | 'missing-token'
  | 'malformed-token'
  | 'invalid-token'
  | 'expired-or-duplicate'
  | 'hostname-mismatch'
  | 'action-mismatch'
  | 'misconfigured'
  | 'unavailable'

export type TurnstileOutcome = { ok: true; skipped?: boolean } | { ok: false; reason: TurnstileFailure }

export interface TurnstileEnv {
  TURNSTILE_SECRET_KEY?: string
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string
  VERCEL_ENV?: string
}

export interface TurnstilePolicy {
  /** `enforce`: verify, fail closed. `skip`: local run without keys. `misconfigured`: refuse everything. */
  mode: 'enforce' | 'skip' | 'misconfigured'
  /** Compare hostname and action (Production only: Preview hosts vary, test keys answer «localhost»). */
  strictClaims: boolean
  problem?: string
}

export function turnstilePolicy(env: TurnstileEnv = process.env as TurnstileEnv): TurnstilePolicy {
  const secret = env.TURNSTILE_SECRET_KEY?.trim() ?? ''
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ''
  const production = env.VERCEL_ENV === 'production'
  const deployed = production || env.VERCEL_ENV === 'preview'

  if (!deployed) {
    if (!secret) return { mode: 'skip', strictClaims: false }
    return siteKey ? { mode: 'enforce', strictClaims: false } : { mode: 'misconfigured', strictClaims: false, problem: 'site key missing' }
  }
  if (!secret || !siteKey) {
    return { mode: 'misconfigured', strictClaims: production, problem: `${!secret ? 'secret' : 'site key'} missing` }
  }
  if (production && TEST_SECRET.test(secret)) {
    return { mode: 'misconfigured', strictClaims: true, problem: 'test secret in production' }
  }
  return { mode: 'enforce', strictClaims: production }
}

/** Hostnames a Production token may have been issued on. */
export function expectedHostnames(): Set<string> {
  const host = new URL(PRODUCTION_SITE_URL).hostname
  return new Set([host, `www.${host}`])
}

export interface VerifyOptions {
  /** The widget's `data-action`; checked in Production. */
  action: string
  remoteIp?: string
  env?: TurnstileEnv
  fetchImpl?: typeof fetch
  /** Per attempt. Two attempts at most. */
  timeoutMs?: number
  retryDelayMs?: number
}

interface SiteverifyBody {
  success?: unknown
  hostname?: unknown
  action?: unknown
  'error-codes'?: unknown
}

function log(level: 'warn' | 'error', fields: Record<string, unknown>): void {
  const line = JSON.stringify({ scope: 'miljo-turnstile', level, ...fields })
  if (level === 'error') console.error(line)
  else console.warn(line)
}

let warnedSkip = false

type Attempt = { kind: 'answer'; body: SiteverifyBody } | { kind: 'retry'; why: string }

async function attempt(fetchImpl: typeof fetch, form: URLSearchParams, timeoutMs: number): Promise<Attempt> {
  // An explicit (ref'd) timer rather than AbortSignal.timeout, whose timer does not keep the event loop alive.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body: form, signal: controller.signal })
    if (res.status >= 500) return { kind: 'retry', why: `http-${res.status}` }
    const body = (await res.json()) as SiteverifyBody
    if (!body || typeof body !== 'object') return { kind: 'retry', why: 'bad-json' }
    const codes = Array.isArray(body['error-codes']) ? body['error-codes'] : []
    if (body.success !== true && codes.includes('internal-error')) return { kind: 'retry', why: 'internal-error' }
    return { kind: 'answer', body }
  } catch (err) {
    return { kind: 'retry', why: controller.signal.aborted ? 'timeout' : err instanceof Error ? err.name : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

export async function verifyTurnstileToken(token: unknown, options: VerifyOptions): Promise<TurnstileOutcome> {
  const env = options.env ?? (process.env as TurnstileEnv)
  const policy = turnstilePolicy(env)

  if (policy.mode === 'misconfigured') {
    log('error', { message: 'Turnstile is not usable; public Miljø submissions are refused', problem: policy.problem })
    return { ok: false, reason: 'misconfigured' }
  }
  if (policy.mode === 'skip') {
    if (!warnedSkip) {
      warnedSkip = true
      log('warn', { message: 'Turnstile keys not set locally — bot check skipped (never on a deployment)' })
    }
    return { ok: true, skipped: true }
  }

  if (typeof token !== 'string' || token.trim() === '') return { ok: false, reason: 'missing-token' }
  if (token.length > TURNSTILE_TOKEN_MAX_LENGTH) return { ok: false, reason: 'malformed-token' }

  const form = new URLSearchParams()
  form.set('secret', env.TURNSTILE_SECRET_KEY!.trim())
  form.set('response', token)
  if (options.remoteIp && options.remoteIp !== 'unknown') form.set('remoteip', options.remoteIp)
  form.set('idempotency_key', randomUUID())

  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 4000
  let result = await attempt(fetchImpl, form, timeoutMs)
  if (result.kind === 'retry') {
    await new Promise((r) => setTimeout(r, options.retryDelayMs ?? 400))
    result = await attempt(fetchImpl, form, timeoutMs)
  }
  if (result.kind === 'retry') {
    log('error', { message: 'Siteverify unavailable', why: result.why })
    return { ok: false, reason: 'unavailable' }
  }

  const body = result.body
  if (body.success !== true) {
    const codes = (Array.isArray(body['error-codes']) ? body['error-codes'] : []).map(String)
    if (codes.includes('missing-input-secret') || codes.includes('invalid-input-secret')) {
      log('error', { message: 'Siteverify rejected the secret key', codes })
      return { ok: false, reason: 'misconfigured' }
    }
    if (codes.includes('timeout-or-duplicate')) return { ok: false, reason: 'expired-or-duplicate' }
    return { ok: false, reason: 'invalid-token' }
  }

  if (policy.strictClaims) {
    if (typeof body.hostname !== 'string' || !expectedHostnames().has(body.hostname.toLowerCase())) {
      log('warn', { message: 'Turnstile hostname mismatch' })
      return { ok: false, reason: 'hostname-mismatch' }
    }
    if (body.action !== options.action) {
      log('warn', { message: 'Turnstile action mismatch' })
      return { ok: false, reason: 'action-mismatch' }
    }
  }
  return { ok: true }
}

/** What the visitor is told. Hostname and action mismatches read like any invalid token. */
export const TURNSTILE_MESSAGES: Record<TurnstileFailure, string> = {
  'missing-token': 'Sikkerhetskontrollen er ikke ferdig ennå. Vent et øyeblikk og trykk på knappen igjen.',
  'malformed-token': 'Sikkerhetskontrollen kunne ikke bekreftes. Prøv igjen — en ny kontroll startes automatisk.',
  'invalid-token': 'Sikkerhetskontrollen kunne ikke bekreftes. Prøv igjen — en ny kontroll startes automatisk.',
  'expired-or-duplicate': 'Sikkerhetskontrollen er utløpt. Prøv igjen — en ny kontroll startes automatisk.',
  'hostname-mismatch': 'Sikkerhetskontrollen kunne ikke bekreftes. Prøv igjen — en ny kontroll startes automatisk.',
  'action-mismatch': 'Sikkerhetskontrollen kunne ikke bekreftes. Prøv igjen — en ny kontroll startes automatisk.',
  unavailable: 'Vi fikk ikke kontakt med sikkerhetskontrollen. Sjekk nettforbindelsen og prøv igjen om litt.',
  misconfigured: 'Registreringen er midlertidig utilgjengelig. Prøv igjen senere.',
}
