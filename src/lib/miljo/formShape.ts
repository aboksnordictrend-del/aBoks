// The exact shape of a public registration request. Pure.
//
// The registration form sends a handful of short text fields and nothing else. Anything outside
// that — an unknown field, a field twice, a file, an oversized value, a malformed flag — is not a
// browser using the page, so it is refused before any network or database work.

import { BATTERY_CATEGORIES } from './constants'
import { quantityFieldName } from './validation'
import { TURNSTILE_TOKEN_MAX_LENGTH } from '@/lib/security/turnstileVerify'

export const TURNSTILE_FIELD = 'cf-turnstile-response'
export const HONEYPOT_FIELD = 'referansekode'

const FLAG_FIELDS = new Set(['bekreftAntall', 'bekreftDuplikat'])

const MAX_LENGTH: Record<string, number> = {
  code: 16,
  submissionKey: 64,
  [HONEYPOT_FIELD]: 256,
  [TURNSTILE_FIELD]: TURNSTILE_TOKEN_MAX_LENGTH,
  bekreftAntall: 1,
  bekreftDuplikat: 1,
  ...Object.fromEntries(BATTERY_CATEGORIES.map((c) => [quantityFieldName(c), 16])),
}

export const REGISTRATION_FIELDS: ReadonlySet<string> = new Set(Object.keys(MAX_LENGTH))

export type ShapeProblem = 'unexpected-field' | 'repeated-field' | 'file-field' | 'oversized-field' | 'malformed-flag'

export function checkRegistrationShape(form: FormData): { ok: true } | { ok: false; problem: ShapeProblem } {
  const seen = new Set<string>()
  for (const [name, value] of form.entries()) {
    if (!REGISTRATION_FIELDS.has(name)) return { ok: false, problem: 'unexpected-field' }
    if (seen.has(name)) return { ok: false, problem: 'repeated-field' }
    seen.add(name)
    if (typeof value !== 'string') return { ok: false, problem: 'file-field' }
    if (value.length > MAX_LENGTH[name]!) return { ok: false, problem: 'oversized-field' }
    if (FLAG_FIELDS.has(name) && value !== '' && value !== '1') return { ok: false, problem: 'malformed-flag' }
  }
  return { ok: true }
}
