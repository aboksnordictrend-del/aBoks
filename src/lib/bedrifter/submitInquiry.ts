import {
  INQUIRY_FIELDS,
  validateInquiryInput,
  type InquiryFieldKey,
  type RawInquiryInput,
} from './inquiry'

/**
 * The inquiry form's submission logic, extracted from the component for the same reason as
 * @/lib/reviewSubmitResult: it can then be asserted directly, with no DOM and no network,
 * and the component is left holding nothing but state and markup.
 *
 * Isomorphic — it must stay importable from a client bundle, so nothing server-only (no
 * node:crypto, no Payload) may be imported here.
 *
 * The contract is strict on purpose: `success` is returned ONLY for a 2xx carrying
 * `{ ok: true }`, which the server sends only after both e-mails have been accepted. No other
 * path can produce it, so the form cannot show a thank-you for an inquiry that was not sent.
 */

export const INQUIRY_ENDPOINT = '/api/bedrifter/foresporsel'

/** Summary shown under the button when one or more fields are flagged. */
export const FIELD_SUMMARY = 'Forespørselen ble ikke sendt. Sjekk feltene som er markert med rødt.'

export type InquiryFieldErrors = Partial<Record<InquiryFieldKey, string>>

export type SubmitInquiryOutcome =
  | { kind: 'success' }
  | { kind: 'field-errors'; errors: InquiryFieldErrors; summary: string }
  /** Everything else: a 5xx, a rate limit, a failed Turnstile check, an offline browser. */
  | { kind: 'error'; message: string }

/**
 * Whether this outcome may clear the form. Exactly one outcome does — a failed attempt keeps
 * everything the customer typed so they only have to fix what was flagged.
 */
export function clearsForm(outcome: SubmitInquiryOutcome): boolean {
  return outcome.kind === 'success'
}

/** Extras the browser reads off the DOM rather than from React state. */
export interface InquirySubmitExtras {
  turnstileToken?: string
  honeypot?: string
}

/** Shape of a response from the endpoint; anything else is treated as a server error. */
interface InquiryApiResponse {
  ok?: unknown
  message?: unknown
  errors?: unknown
}

/** Keeps only the keys the form actually has fields for, and only non-empty strings. */
export function pickFieldErrors(raw: unknown): InquiryFieldErrors {
  if (typeof raw !== 'object' || raw === null) return {}
  const source = raw as Record<string, unknown>
  const errors: InquiryFieldErrors = {}
  for (const key of INQUIRY_FIELDS) {
    const value = source[key]
    if (typeof value === 'string' && value) errors[key] = value
  }
  return errors
}

/**
 * Validates, then posts. The client-side validation is a courtesy that saves a round trip and
 * puts the message next to the field; the server runs the very same `validateInquiryInput`
 * and is the one that decides.
 */
export async function submitInquiry(
  values: RawInquiryInput,
  extras: InquirySubmitExtras = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SubmitInquiryOutcome> {
  const validation = validateInquiryInput(values)
  if (!validation.ok) {
    return { kind: 'field-errors', errors: validation.errors, summary: FIELD_SUMMARY }
  }

  let res: Response
  try {
    res = await fetchImpl(INQUIRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...validation.value,
        ...(extras.turnstileToken ? { turnstileToken: extras.turnstileToken } : {}),
        ...(extras.honeypot ? { referansekode: extras.honeypot } : {}),
      }),
    })
  } catch {
    // Offline, aborted, DNS failure — indistinguishable to the customer, and none of it is
    // worth showing them beyond "try again".
    return { kind: 'error', message: '' }
  }

  const data = (await res.json().catch(() => ({}))) as InquiryApiResponse
  const message = typeof data.message === 'string' ? data.message : ''

  if (res.ok && data.ok === true) return { kind: 'success' }

  const errors = pickFieldErrors(data.errors)
  if (Object.keys(errors).length > 0) {
    return { kind: 'field-errors', errors, summary: message || FIELD_SUMMARY }
  }

  return { kind: 'error', message }
}
