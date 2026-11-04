// Abuse limits for the public /miljo/<code> page. Pure: it only builds rules; the database store
// in @/lib/security/dbRateLimit counts them (one statement per request, fixed one-hour windows).
//
// The numbers come from how the page is really used. One registration takes a person at least
// 15–30 seconds (scan, choose a type, count, the Turnstile check, submit), and a whole workplace or
// municipality usually reaches the internet through ONE address. So:
//
//   • per network and organisation 120/h — one registration every 30 s from the same office for a
//     full hour, far more than a collection day produces, yet it caps one scripted browser;
//   • per network 240/h across organisations — a shared building or a mobile carrier's NAT;
//   • per organisation 400/h from all networks together — the answer to requests spread over many
//     addresses; with a solved Turnstile challenge required for every one of them;
//   • a battery budget of 5 000/h per organisation — each submission is already capped at 500, so
//     ten maximal registrations an hour, which no single container receives;
//   • overall 3 000 registrations per hour for all organisations together — an emergency ceiling
//     far above today's traffic that bounds the database writes from many leaked codes. There is
//     deliberately no overall battery budget: it would let a few large submissions lock out every
//     organisation, and battery totals are an organisation's own matter.
//
// Two tiers (see withinBudget): the requester's own network rules first, the shared rules
// (organisation, overall) only when those passed. A refused request still counts in the tier that
// refused it (fixed window), so a flood keeps itself blocked until the hour ends — but one network
// cannot push the shared counters past what its own budget allows. Only registrations that passed
// Turnstile and validation are counted, so a bot without tokens costs no database write at all.
//
// Statistics and downloads have no Turnstile, so they are counted on every request. A PDF is the
// most expensive thing the page can do, hence its low budgets. Keys are HMAC'ed before storage.

import type { BudgetRule } from '@/lib/security/dbRateLimit'

export const PUBLIC_WINDOW_SECONDS = 60 * 60

export const PUBLIC_LIMITS = {
  registration: {
    perNetworkPerOrg: 120,
    perNetwork: 240,
    perOrg: 400,
    batteriesPerOrg: 5_000,
    overall: 3_000,
  },
  delivery: { perNetwork: 40 },
  statistics: { perNetwork: 240, overall: 5_000 },
  pdf: { perNetwork: 30, overall: 300 },
  csv: { perNetwork: 60, overall: 600 },
} as const

/** Tiers for withinBudget. `subject` is @/lib/security/clientIp#rateLimitSubject of the request. */
export function registrationRules(subject: string, organizationId: number, batteries: number): BudgetRule[][] {
  const L = PUBLIC_LIMITS.registration
  return [
    [
      { key: `miljo:reg:net-org:${subject}:${organizationId}`, limit: L.perNetworkPerOrg },
      { key: `miljo:reg:net:${subject}`, limit: L.perNetwork },
    ],
    [
      { key: `miljo:reg:org:${organizationId}`, limit: L.perOrg },
      { key: `miljo:reg:org-batteries:${organizationId}`, limit: L.batteriesPerOrg, cost: batteries },
      { key: 'miljo:reg:all', limit: L.overall },
    ],
  ]
}

export function deliveryRules(subject: string): BudgetRule[][] {
  return [[{ key: `miljo:delivery:net:${subject}`, limit: PUBLIC_LIMITS.delivery.perNetwork }]]
}

export function readRules(kind: 'statistics' | 'pdf' | 'csv', subject: string): BudgetRule[][] {
  const L = PUBLIC_LIMITS[kind]
  return [[{ key: `miljo:${kind}:net:${subject}`, limit: L.perNetwork }], [{ key: `miljo:${kind}:all`, limit: L.overall }]]
}
