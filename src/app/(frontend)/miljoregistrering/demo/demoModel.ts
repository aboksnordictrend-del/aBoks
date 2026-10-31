// The interactive demo on /miljoregistrering. Pure, browser-only state — nothing here touches
// Payload, a server action, an API route or browser storage.
//
// The rules are the real ones: quantities go through the production `validateRegistration` and
// `validateDelivery`, and every figure is computed by the production aggregation in
// src/lib/miljo/stats.ts. Only the data is different — a fictional organisation with fictional
// records, held in React state and gone on reload.
//
// As in the real system, «Registrerte batterier» (self-reported counts) and «Leverte batterier»
// (deliveries in kg or stk.) are separate measurements: never added together, never converted.

import { REGISTRATION_LIMITS, type BatteryCategory } from '@/lib/miljo/constants'
import type { CategoryOption, RegistrationPolicy } from '@/lib/miljo/policy'
import { validateDelivery, validateRegistration, type RegistrationLine } from '@/lib/miljo/validation'
import { resolveMiljoPeriod, type MiljoPeriod } from '@/lib/miljo/period'
import {
  publicDeliveryRows,
  registrationTrend,
  summarizeDeliveries,
  summarizeRegistrations,
  type DeliveryRecord,
  type RegistrationRecord,
} from '@/lib/miljo/stats'
import { osloDateKey } from '@/lib/analytics/period'

export const DEMO_ORG_NAME = 'Demo Bedrift AS'
export const DEMO_LABEL = 'DEMO – EKSEMPELDATA'

/**
 * The demo PIN. Real PINs are 6–10 digits (PIN_POLICY), so the demo uses six — a four-digit PIN
 * would teach a format the real form rejects. Compared only in the browser.
 */
export const DEMO_PIN = '123456'

/** Same wording as PIN_REJECTED_MESSAGE in src/lib/miljo/service.ts (server-only module). */
export const DEMO_PIN_REJECTED =
  'PIN-koden ble ikke godtatt. Kontroller koden og prøv igjen. I demoen er PIN-koden 123456.'

/** AA and AAA — the default every new organisation starts with (DEFAULT_ALLOWED_CATEGORIES). */
export const DEMO_CATEGORIES: CategoryOption[] = [
  { value: 'aa', label: 'AA' },
  { value: 'aaa', label: 'AAA' },
]

/** The production defaults, so the demo enforces exactly the limits a new organisation gets. */
export const DEMO_POLICY: RegistrationPolicy = {
  categories: DEMO_CATEGORIES,
  maxPerCategory: REGISTRATION_LIMITS.maxPerCategory,
  maxPerSubmission: REGISTRATION_LIMITS.maxPerSubmission,
  confirmAbove: REGISTRATION_LIMITS.confirmAbove,
  dailyFlagThreshold: REGISTRATION_LIMITS.dailyFlagThreshold,
}

export interface DemoState {
  registrations: RegistrationRecord[]
  deliveries: DeliveryRecord[]
  nextId: number
}

// ── Fictional sample data ──
//
// Placed relative to «now» so the chart always has the last twelve months filled. Sums: AA 86,
// AAA 54, total 140 across 14 registrations; three deliveries, two in kg and one in stk.

const SEED_REGISTRATIONS: [daysAgo: number, aa: number, aaa: number][] = [
  [320, 6, 4],
  [290, 8, 2],
  [262, 4, 6],
  [231, 10, 4],
  [200, 5, 3],
  [171, 7, 5],
  [140, 6, 6],
  [118, 9, 2],
  [95, 4, 4],
  [70, 8, 6],
  [48, 6, 3],
  [30, 5, 5],
  [14, 4, 2],
  [5, 4, 2],
]

const SEED_DELIVERIES: [daysAgo: number, quantity: number, unit: 'kg' | 'stk', documented: boolean][] = [
  [250, 1.8, 'kg', true],
  [120, 1.4, 'kg', false],
  [20, 45, 'stk', true],
]

export const DEMO_OPERATOR = 'Demo Miljømottak (fiktivt)'

const DAY = 86_400_000

const linesOf = (aa: number, aaa: number): RegistrationLine[] =>
  [
    { category: 'aa' as const, quantity: aa },
    { category: 'aaa' as const, quantity: aaa },
  ].filter((l) => l.quantity > 0)

function registration(id: number, registeredAt: string, lines: RegistrationLine[]): RegistrationRecord {
  return {
    id,
    organizationId: 0,
    organizationName: DEMO_ORG_NAME,
    registeredAt,
    status: 'registered',
    lines,
    submittedTotal: lines.reduce((s, l) => s + l.quantity, 0),
    flags: [],
    reviewState: 'none',
  }
}

export function seedState(now: Date): DemoState {
  let id = 1
  const registrations = SEED_REGISTRATIONS.map(([daysAgo, aa, aaa]) =>
    registration(id++, new Date(now.getTime() - daysAgo * DAY).toISOString(), linesOf(aa, aaa)),
  )
  const deliveries: DeliveryRecord[] = SEED_DELIVERIES.map(([daysAgo, quantity, unit, documented]) => ({
    id: id++,
    organizationId: 0,
    organizationName: DEMO_ORG_NAME,
    deliveryDate: osloDateKey(new Date(now.getTime() - daysAgo * DAY)),
    quantity,
    unit,
    operator: DEMO_OPERATOR,
    documentationStatus: documented ? 'documented' : 'reported',
    status: 'registered',
    registeredAt: new Date(now.getTime() - daysAgo * DAY).toISOString(),
  }))
  return { registrations, deliveries, nextId: id }
}

// ── Actions ──

export type DemoAction =
  | { type: 'register'; lines: RegistrationLine[]; at: string }
  | { type: 'deliver'; delivery: Omit<DeliveryRecord, 'id' | 'organizationId' | 'organizationName' | 'status'> }
  | { type: 'reset'; now: Date }

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'register':
      return {
        ...state,
        registrations: [...state.registrations, registration(state.nextId, action.at, action.lines)],
        nextId: state.nextId + 1,
      }
    case 'deliver':
      return {
        ...state,
        deliveries: [
          ...state.deliveries,
          { ...action.delivery, id: state.nextId, organizationId: 0, organizationName: DEMO_ORG_NAME, status: 'registered' },
        ],
        nextId: state.nextId + 1,
      }
    case 'reset':
      return seedState(action.now)
  }
}

// ── Submissions (validated exactly as the real server does) ──

export type DemoRegistrationResult =
  | { ok: true; total: number; lines: RegistrationLine[] }
  | { ok: false; message: string; errors: Partial<Record<BatteryCategory | 'total', string>> }

export function checkDemoRegistration(
  counts: Partial<Record<BatteryCategory, string>>,
  confirmed: boolean,
): DemoRegistrationResult {
  const result = validateRegistration(counts, confirmed, DEMO_POLICY)
  if (!result.ok) return { ok: false, message: result.message, errors: result.errors }
  return { ok: true, total: result.total, lines: result.lines }
}

export interface DemoDeliveryInput {
  deliveryDate: string
  quantity: string
  unit: 'kg' | 'stk'
  operator: string
  reference: string
  pin: string
  /** A file was chosen. The demo never reads it — only whether one is attached. */
  hasAttachment: boolean
}

export type DemoDeliveryResult =
  | { ok: true; delivery: Extract<DemoAction, { type: 'deliver' }>['delivery'] }
  | { ok: false; reason: 'invalid' | 'pin'; message: string; errors: Record<string, string> }

/**
 * Same order as the real service: field checks first (a typo never costs a PIN attempt), then
 * the PIN. The PIN is a constant compared in the browser — no hashing, no attempt counter, no
 * request.
 */
export function checkDemoDelivery(input: DemoDeliveryInput, now: Date): DemoDeliveryResult {
  const result = validateDelivery(
    {
      deliveryDate: input.deliveryDate,
      quantity: input.quantity,
      unit: input.unit,
      operator: input.operator,
      reference: input.reference,
    },
    osloDateKey(now),
  )
  if (!result.ok) return { ok: false, reason: 'invalid', message: result.message, errors: result.errors }
  if (input.pin !== DEMO_PIN) return { ok: false, reason: 'pin', message: DEMO_PIN_REJECTED, errors: {} }
  const { deliveryDate, quantity, unit, operator } = result.value
  return {
    ok: true,
    delivery: {
      deliveryDate,
      quantity,
      unit,
      operator,
      documentationStatus: input.hasAttachment ? 'documented' : 'reported',
      registeredAt: now.toISOString(),
    },
  }
}

// ── Statistics ──

/** The last twelve months, ending today: always monthly bars, whatever day the page is opened. */
export function demoPeriod(now: Date): MiljoPeriod {
  const today = osloDateKey(now)
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const start = new Date(Date.UTC(y, m - 1 - 11, 1)).toISOString().slice(0, 10)
  return resolveMiljoPeriod({ preset: 'custom', from: start, to: today, grouping: 'month' }, now)
}

export function demoStatistics(state: DemoState, now: Date) {
  const period = demoPeriod(now)
  const inPeriod = (r: RegistrationRecord) => r.registeredAt >= period.from && r.registeredAt < period.to
  const deliveriesInPeriod = state.deliveries.filter((d) => d.deliveryDate >= period.fromKey && d.deliveryDate <= period.toKey)
  const registrations = state.registrations.filter(inPeriod)
  return {
    period,
    registrations: summarizeRegistrations(registrations),
    deliveries: summarizeDeliveries(deliveriesInPeriod),
    trend: registrationTrend(registrations, period),
    deliveryRows: publicDeliveryRows(deliveriesInPeriod),
  }
}

export type DemoStatistics = ReturnType<typeof demoStatistics>
