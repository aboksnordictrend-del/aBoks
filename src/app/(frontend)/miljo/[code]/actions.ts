'use server'

import { headers } from 'next/headers'
import { buildCsrfOrigins } from '@/lib/csrfOrigins'
import { SITE_URL } from '@/lib/site'
import { rateLimit, clientIpFromHeaders } from '@/lib/rateLimit'
import { verifyTurnstile } from '@/lib/turnstile'
import { BATTERY_CATEGORIES, DELIVERY_LIMITS, type BatteryCategory } from '@/lib/miljo/constants'
import { isValidPublicCode } from '@/lib/miljo/code'
import { quantityFieldName } from '@/lib/miljo/validation'
import { submitDeliveryOnServer, submitRegistrationOnServer } from '@/lib/miljo/server'
import type { DeliveryActionResult, RegistrationActionResult } from './results'

const trustedOrigins = new Set(buildCsrfOrigins(SITE_URL))
const HOUR = 60 * 60 * 1000

/** PII-free diagnostic: outcome and reason only. Never quantities with an IP, never a PIN. */
function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ scope: 'miljo-action', ...fields }))
}

const REJECTED = 'Forespørselen ble avvist. Last siden på nytt og prøv igjen.'

/** Origin, honeypot, shape and entry count — shared first gate of both actions. */
async function gate(formData: FormData, maxEntries: number, kind: string): Promise<{ ip: string; code: string } | { message: string }> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin && !trustedOrigins.has(origin)) {
    log({ kind, event: 'rejected', reason: 'origin' })
    return { message: REJECTED }
  }
  if (String(formData.get('referansekode') ?? '').trim() !== '') {
    log({ kind, event: 'rejected', reason: 'honeypot' })
    return { message: 'Noe gikk galt. Prøv igjen senere.' }
  }
  let entries = 0
  for (const _ of formData.keys()) {
    if (++entries > maxEntries) {
      log({ kind, event: 'rejected', reason: 'too-many-fields' })
      return { message: REJECTED }
    }
  }
  const code = String(formData.get('code') ?? '')
  if (!isValidPublicCode(code)) {
    log({ kind, event: 'rejected', reason: 'shape' })
    return { message: REJECTED }
  }
  return { ip: clientIpFromHeaders(h), code }
}

async function turnstileOk(formData: FormData, ip: string): Promise<boolean> {
  const token = formData.get('cf-turnstile-response')
  return verifyTurnstile(typeof token === 'string' ? token : undefined, ip)
}

/**
 * «Registrer batterier». Anonymous: the IP is only an in-memory rate-limit and duplicate key for
 * the life of the server instance; it is never stored or logged. Limits are generous because a
 * whole workplace usually shares one network address.
 */
export async function registerBatteriesAction(formData: FormData): Promise<RegistrationActionResult> {
  const g = await gate(formData, 20, 'registration')
  if ('message' in g) return { success: false, message: g.message }

  const perOrg = await rateLimit({ key: `miljo-reg:${g.code}:${g.ip}`, limit: 60, windowMs: HOUR })
  const overall = await rateLimit({ key: `miljo-reg:${g.ip}`, limit: 120, windowMs: HOUR })
  if (!perOrg.ok || !overall.ok) {
    log({ kind: 'registration', event: 'rejected', reason: 'rate-limit' })
    return { success: false, message: 'For mange registreringer på kort tid. Prøv igjen om en liten stund.' }
  }
  if (!(await turnstileOk(formData, g.ip))) {
    log({ kind: 'registration', event: 'rejected', reason: 'turnstile' })
    return { success: false, message: 'Kunne ikke bekrefte at du er et menneske. Last siden på nytt og prøv igjen.' }
  }

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
 * plus this per-client limit. Every PIN failure returns the same message.
 */
export async function registerDeliveryAction(formData: FormData): Promise<DeliveryActionResult> {
  const g = await gate(formData, 20, 'delivery')
  if ('message' in g) return { success: false, message: g.message }

  const limited = await rateLimit({ key: `miljo-delivery:${g.ip}`, limit: 20, windowMs: 15 * 60 * 1000 })
  if (!limited.ok) {
    log({ kind: 'delivery', event: 'rejected', reason: 'rate-limit' })
    return { success: false, message: 'For mange forsøk på kort tid. Vent litt og prøv igjen.' }
  }
  if (!(await turnstileOk(formData, g.ip))) {
    log({ kind: 'delivery', event: 'rejected', reason: 'turnstile' })
    return { success: false, message: 'Kunne ikke bekrefte at du er et menneske. Last siden på nytt og prøv igjen.' }
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
