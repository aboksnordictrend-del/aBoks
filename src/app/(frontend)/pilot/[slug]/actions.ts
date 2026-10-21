'use server'

import { headers } from 'next/headers'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import { rateLimit, clientIpFromHeaders } from '@/lib/rateLimit'
import { verifyTurnstile } from '@/lib/turnstile'
import { rawAnswersFromFormData } from '@/lib/pilot/answers'
import { submitPilotEvaluation } from '@/lib/pilot/server'
import type { PilotActionResult } from '@/lib/pilot/submitResult'

const trustedOrigins = new Set(buildCsrfOrigins(SITE_URL))

/** Upper bound on form entries — a real questionnaire never comes close (≤ 40 questions). */
const MAX_FORM_ENTRIES = 400

/** PII-free diagnostic: outcome and reason only. Never answers, never the IP. */
function logResult(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ scope: 'pilot-evaluation-action', ...fields }))
}

/**
 * Server action behind the public pilot questionnaire. In order: Origin check, honeypot, rate
 * limit, optional Turnstile, input shape, then the status- and version-checked submission in
 * @/lib/pilot/server.
 *
 * The client IP is used only as an in-memory rate-limit key for the lifetime of the server
 * instance. It is never stored with the evaluation or logged.
 *
 * Strict contract, as for reviews: `{ success: true }` only when an evaluation was stored.
 */
export async function submitPilotEvaluationAction(formData: FormData): Promise<PilotActionResult> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin && !trustedOrigins.has(origin)) {
    logResult({ event: 'rejected', reason: 'origin' })
    return { success: false, message: 'Forespørselen ble avvist.' }
  }

  // Honeypot: a visually hidden field a person never fills in. Never reported as success.
  if (String(formData.get('referansekode') ?? '').trim() !== '') {
    logResult({ event: 'rejected', reason: 'honeypot' })
    return { success: false, message: 'Noe gikk galt. Prøv igjen senere.' }
  }

  const projectId = Number(formData.get('projectId'))
  const version = Number(formData.get('questionnaireVersion'))
  if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(version) || version <= 0) {
    logResult({ event: 'rejected', reason: 'shape' })
    return { success: false, message: 'Skjemaet er ugyldig. Last siden på nytt og prøv igjen.' }
  }

  // Limits are generous on purpose: a whole school or municipality may submit from one shared
  // network address. Best-effort on serverless (per instance) — see src/lib/rateLimit.ts.
  const ip = clientIpFromHeaders(h)
  const perProject = await rateLimit({ key: `pilot-submit:${projectId}:${ip}`, limit: 40, windowMs: 60 * 60 * 1000 })
  const overall = await rateLimit({ key: `pilot-submit:${ip}`, limit: 80, windowMs: 60 * 60 * 1000 })
  if (!perProject.ok || !overall.ok) {
    logResult({ event: 'rejected', reason: 'rate-limit' })
    return { success: false, message: 'For mange innsendinger på kort tid. Prøv igjen om en liten stund.' }
  }

  const turnstileToken = formData.get('cf-turnstile-response')
  const turnstileOk = await verifyTurnstile(typeof turnstileToken === 'string' ? turnstileToken : undefined, ip)
  if (!turnstileOk) {
    logResult({ event: 'rejected', reason: 'turnstile' })
    return { success: false, message: 'Kunne ikke bekrefte at du er et menneske. Last siden på nytt og prøv igjen.' }
  }

  let entries = 0
  for (const _ of formData.keys()) {
    if (++entries > MAX_FORM_ENTRIES) {
      logResult({ event: 'rejected', reason: 'too-many-fields' })
      return { success: false, message: 'Skjemaet er ugyldig. Last siden på nytt og prøv igjen.' }
    }
  }

  const outcome = await submitPilotEvaluation({ projectId, version, raw: rawAnswersFromFormData(formData) })
  if (!outcome.ok) {
    logResult({ event: 'submit', reason: outcome.reason, stored: false })
    return { success: false, errors: outcome.errors, message: outcome.message, reason: outcome.reason }
  }
  logResult({ event: 'submit', stored: true })
  return { success: true, closingMessage: outcome.closingMessage }
}
