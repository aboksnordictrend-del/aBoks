// Brønnøysundregistrene — Enhetsregisteret lookup for Miljøregistrering self-registration.
//
// Open public API, no key: GET https://data.brreg.no/enhetsregisteret/api/enheter/{orgnr}
//   200 → the entity (`navn`, `organisasjonsnummer`, `konkurs`, `underAvvikling`, …)
//   404 → no such entity        410 → deleted from the register
//
// The register proves the COMPANY exists and gives its official name — which is then used as the
// business customer's name. It does NOT prove that the person registering may act for it.
//
// `fetchImpl` is injected so tests never touch the network. Server-only use (no CORS involved).

import { normalizeOrganizationNumber, validateOrganizationNumber } from '@/lib/partner/referral'

export const BRREG_ENHET_URL = 'https://data.brreg.no/enhetsregisteret/api/enheter/'
export const BRREG_TIMEOUT_MS = 6000

export type BrregResult =
  | { ok: true; organizationNumber: string; officialName: string }
  | { ok: false; reason: 'invalid' | 'not_found' | 'deleted' | 'inactive' | 'unavailable'; message: string }

export const BRREG_MESSAGES = {
  not_found: 'Fant ikke organisasjonsnummeret i Enhetsregisteret. Kontroller nummeret.',
  deleted: 'Organisasjonen er slettet i Enhetsregisteret og kan ikke registreres.',
  inactive: 'Organisasjonen er under avvikling eller konkurs i Enhetsregisteret. Kontakt aBoks for hjelp.',
  unavailable: 'Vi får ikke kontakt med Enhetsregisteret akkurat nå. Prøv igjen om litt.',
} as const

type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  status: number
  ok: boolean
  json: () => Promise<unknown>
}>

export async function lookupOrganization(
  rawNumber: unknown,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = BRREG_TIMEOUT_MS,
): Promise<BrregResult> {
  const check = validateOrganizationNumber(rawNumber)
  const digits = normalizeOrganizationNumber(rawNumber)
  if (check !== true || digits == null) {
    return { ok: false, reason: 'invalid', message: check === true ? 'Organisasjonsnummer må fylles ut.' : check }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(`${BRREG_ENHET_URL}${digits}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404) return { ok: false, reason: 'not_found', message: BRREG_MESSAGES.not_found }
    if (res.status === 410) return { ok: false, reason: 'deleted', message: BRREG_MESSAGES.deleted }
    if (!res.ok) return { ok: false, reason: 'unavailable', message: BRREG_MESSAGES.unavailable }

    const body = (await res.json()) as Record<string, unknown> | null
    const name = typeof body?.navn === 'string' ? body.navn.trim() : ''
    if (!name || String(body?.organisasjonsnummer ?? '') !== digits) {
      return { ok: false, reason: 'unavailable', message: BRREG_MESSAGES.unavailable }
    }
    if (body?.slettedato) return { ok: false, reason: 'deleted', message: BRREG_MESSAGES.deleted }
    if (body?.konkurs === true || body?.underAvvikling === true || body?.underTvangsavviklingEllerTvangsopplosning === true) {
      return { ok: false, reason: 'inactive', message: BRREG_MESSAGES.inactive }
    }
    return { ok: true, organizationNumber: digits, officialName: name }
  } catch {
    return { ok: false, reason: 'unavailable', message: BRREG_MESSAGES.unavailable }
  } finally {
    clearTimeout(timer)
  }
}
