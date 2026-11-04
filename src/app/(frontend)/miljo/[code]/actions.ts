'use server'

import { headers } from 'next/headers'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import { rateLimitSubject, trustedClientIp } from '@/lib/security/clientIp'
import { TURNSTILE_MESSAGES, verifyTurnstileToken } from '@/lib/security/turnstileVerify'
import { BATTERY_CATEGORIES, DELIVERY_LIMITS, TURNSTILE_ACTIONS, type BatteryCategory } from '@/lib/miljo/constants'
import { deliveryRules } from '@/lib/miljo/abuse'
import { isValidPublicCode } from '@/lib/miljo/code'
import { HONEYPOT_FIELD, TURNSTILE_FIELD, checkRegistrationShape } from '@/lib/miljo/formShape'
import { quantityFieldName } from '@/lib/miljo/validation'
import { publicBudget, submitDeliveryOnServer, submitRegistrationOnServer } from '@/lib/miljo/server'
import type { DeliveryActionResult, RegistrationActionResult } from './results'

const trustedOrigins = new Set(buildCsrfOrigins(SITE_URL))

/** PII-free diagnostic: outcome and reason only. Never quantities with an IP, never a PIN or token. */
function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ scope: 'miljo-action', ...fields }))
}

const REJECTED = 'Forespørselen ble avvist. Last siden på nytt og prøv igjen.'

/**
 * Shared first gate of both actions: Origin (when present), honeypot and code shape. These are
 * cheap filters, not the protection — a script sets any header it likes. The protection is the
 * Turnstile check on every submission and the database-backed limits behind it.
 */
async function gate(formData: FormData, kind: string): Promise<{ ip: string; code: string } | { message: string }> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin && !trustedOrigins.has(origin)) {
    log({ kind, event: 'rejected', reason: 'origin' })
    return { message: REJECTED }
  }
  if (String(formData.get(HONEYPOT_FIELD) ?? '').trim() !== '') {
    log({ kind, event: 'rejected', reason: 'honeypot' })
    return { message: 'Noe gikk galt. Prøv igjen senere.' }
  }
  const code = String(formData.get('code') ?? '')
  if (!isValidPublicCode(code)) {
    log({ kind, event: 'rejected', reason: 'shape' })
    return { message: REJECTED }
  }
  return { ip: trustedClientIp(h), code }
}

/** Siteverify for this submission's token; the refusal message, or null when it passed. */
async function botCheck(formData: FormData, ip: string, action: string, kind: string): Promise<string | null> {
  const outcome = await verifyTurnstileToken(formData.get(TURNSTILE_FIELD), { action, remoteIp: ip })
  if (outcome.ok) return null
  log({ kind, event: 'rejected', reason: 'turnstile', detail: outcome.reason })
  return TURNSTILE_MESSAGES[outcome.reason]
}

/**
 * «Registrer batterier». Anonymous: the address is used for duplicate detection (in memory) and as
 * a hashed rate-limit key; it is never stored in clear or logged. Order: request shape → gate →
 * Turnstile (no database work for a bot without a token) → organisation, validation and the
 * persistent limits in @/lib/miljo/service → insert.
 */
export async function registerBatteriesAction(formData: FormData): Promise<RegistrationActionResult> {
  const shape = checkRegistrationShape(formData)
  if (!shape.ok) {
    log({ kind: 'registration', event: 'rejected', reason: 'shape', detail: shape.problem })
    return { success: false, message: REJECTED }
  }
  const g = await gate(formData, 'registration')
  if ('message' in g) return { success: false, message: g.message }

  const refused = await botCheck(formData, g.ip, TURNSTILE_ACTIONS.registration, 'registration')
  if (refused) return { success: false, message: refused, reason: 'turnstile' }

  const quantities: Partial<Record<BatteryCategory, unknown>> = {}
  for (const c of BATTERY_CATEGORIES) {
    const v = formData.get(quantityFieldName(c))
    if (v !== null) quantities[c] = typeof v === 'string' ? v : ''
  }

  try {
    const outcome = await submitRegistrationOnServer({
      code: g.code,
      quantities,
      confirmed: formData.get('bekreftAntall') === '1',
      confirmDuplicate: formData.get('bekreftDuplikat') === '1',
      submissionKey: String(formData.get('submissionKey') ?? ''),
      clientKey: g.ip,
    })
    log({ kind: 'registration', event: 'submit', stored: outcome.ok, reason: outcome.ok ? undefined : outcome.reason })
    if (!outcome.ok) return { success: false, message: outcome.message, errors: outcome.errors, reason: outcome.reason }
    return { success: true, total: outcome.total, lines: outcome.lines }
  } catch (err) {
    log({ kind: 'registration', event: 'error', error: err instanceof Error ? err.name : 'unknown' })
    return { success: false, message: 'Noe gikk galt. Prøv igjen om litt.' }
  }
}

/**
 * «Registrer faktisk levering». Requires the organisation's PIN on every submission; the PIN is
 * checked server-side with an atomic per-organisation attempt limit (see @/lib/miljo/pinAttempts)
 * plus a persistent per-network limit here. Every PIN failure returns the same message.
 */
export async function registerDeliveryAction(formData: FormData): Promise<DeliveryActionResult> {
  let entries = 0
  for (const _ of formData.keys()) {
    if (++entries > 20) {
      log({ kind: 'delivery', event: 'rejected', reason: 'too-many-fields' })
      return { success: false, message: REJECTED }
    }
  }
  const g = await gate(formData, 'delivery')
  if ('message' in g) return { success: false, message: g.message }

  const refused = await botCheck(formData, g.ip, TURNSTILE_ACTIONS.delivery, 'delivery')
  if (refused) return { success: false, message: refused, reason: 'turnstile' }

  const budget = await publicBudget(deliveryRules(rateLimitSubject(g.ip)))
  if (budget !== 'ok') {
    log({ kind: 'delivery', event: 'rejected', reason: budget === 'limited' ? 'rate-limit' : 'limiter-unavailable' })
    return {
      success: false,
      message: budget === 'limited' ? 'For mange forsøk på kort tid. Vent litt og prøv igjen.' : 'Leveransen kunne ikke behandles akkurat nå. Prøv igjen om litt.',
    }
  }

  const file = formData.get('vedlegg')
  let document: Uint8Array | null = null
  if (file instanceof File && file.size > 0) {
    if (file.size > DELIVERY_LIMITS.documentMaxBytes) {
      return { success: false, message: 'Vedlegget er for stort. Maks 3,5 MB.', errors: { document: 'Maks 3,5 MB.' } }
    }
    document = new Uint8Array(await file.arrayBuffer())
  }

  const str = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : ''
  }
  try {
    const outcome = await submitDeliveryOnServer({
      code: g.code,
      pin: str('pin').trim(),
      submissionKey: str('submissionKey'),
      fields: {
        deliveryDate: str('deliveryDate'),
        quantity: str('quantity'),
        unit: str('unit'),
        operator: str('operator'),
        reference: str('reference'),
      },
      document,
    })
    log({ kind: 'delivery', event: 'submit', stored: outcome.ok, reason: outcome.ok ? undefined : outcome.reason })
    if (!outcome.ok) return { success: false, message: outcome.message, errors: outcome.errors, reason: outcome.reason }
    const d = outcome.delivery
    return {
      success: true,
      delivery: { deliveryDate: d.deliveryDate, quantity: d.quantity, unit: d.unit, operator: d.operator, documented: d.documented },
    }
  } catch (err) {
    log({ kind: 'delivery', event: 'error', error: err instanceof Error ? err.name : 'unknown' })
    return { success: false, message: 'Noe gikk galt. Prøv igjen om litt.' }
  }
}
