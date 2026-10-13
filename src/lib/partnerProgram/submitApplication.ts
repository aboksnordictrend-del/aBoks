import {
  APPLICATION_FIELDS,
  validateApplicationInput,
  type ApplicationErrors,
  type RawApplicationInput,
} from './application'

/**
 * The application form's submission logic, outside the component so it can be tested with
 * no DOM and no network — the same split as `@/lib/bedrifter/submitInquiry`.
 *
 * Isomorphic: nothing server-only may be imported here. `success` is returned ONLY for a 2xx
 * carrying `{ ok: true }`, which the server sends only after both e-mails were accepted.
 */

export const APPLICATION_ENDPOINT = '/api/bli-partner/soknad'

export const APPLICATION_FIELD_SUMMARY =
  'Søknaden ble ikke sendt. Sjekk feltene som er markert med rødt.'

export type SubmitApplicationOutcome =
  | { kind: 'success' }
  | { kind: 'field-errors'; errors: ApplicationErrors; summary: string }
  | { kind: 'error'; message: string }

export interface ApplicationSubmitExtras {
  turnstileToken?: string
  honeypot?: string
}

export function pickApplicationErrors(raw: unknown): ApplicationErrors {
  if (typeof raw !== 'object' || raw === null) return {}
  const source = raw as Record<string, unknown>
  const errors: ApplicationErrors = {}
  for (const key of APPLICATION_FIELDS) {
    const value = source[key]
    if (typeof value === 'string' && value) errors[key] = value
  }
  return errors
}

export async function submitApplication(
  values: RawApplicationInput,
  extras: ApplicationSubmitExtras = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitApplicationOutcome> {
  const validation = validateApplicationInput(values)
  if (!validation.ok) {
    return { kind: 'field-errors', errors: validation.errors, summary: APPLICATION_FIELD_SUMMARY }
  }

  let res: Response
  try {
    res = await fetchImpl(APPLICATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validation.value,
        ...(extras.turnstileToken ? { turnstileToken: extras.turnstileToken } : {}),
        ...(extras.honeypot ? { referansekode: extras.honeypot } : {}),
      }),
    })
  } catch {
    return { kind: 'error', message: '' }
  }

  const data = (await res.json().catch(() => ({}))) as {
    ok?: unknown
    message?: unknown
    errors?: unknown
  }
  const message = typeof data.message === 'string' ? data.message : ''

  if (res.ok && data.ok === true) return { kind: 'success' }

  const errors = pickApplicationErrors(data.errors)
  if (Object.keys(errors).length > 0) {
    return { kind: 'field-errors', errors, summary: message || APPLICATION_FIELD_SUMMARY }
  }
  return { kind: 'error', message }
}
