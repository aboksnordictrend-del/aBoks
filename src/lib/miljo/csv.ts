// CSV exports for Miljøregistrering. Pure.
//
// Same Excel (nb-NO) target and cell escaping as the pilot export, whose `csvCell` is reused:
// UTF-8 with BOM, semicolons, CRLF, decimal comma, and an apostrophe in front of any text a
// spreadsheet would read as a formula (operator names are typed by the public).
//
// Two audiences:
//   • public — only aggregated, approved reporting data for one organisation: no flags, review
//     state, references, documents or audit details;
//   • admin  — adds organisation, status, review flags and the delivery reference.
// Invalidated records are left out unless the caller passes them in on purpose (admin only).

import { csvCell } from '../pilot/csv'
import { osloDateKey } from '../analytics/period'
import { CATEGORY_LABELS, DELIVERY_UNIT_LABELS, RECORD_STATUS_OPTIONS, REGISTRATION_FLAG_OPTIONS, type BatteryCategory } from './constants'
import { periodLabel, type MiljoPeriod } from './period'
import type { DeliveryRecord, DeliveryTrendPoint, RegistrationRecord, TrendPoint } from './stats'

const BOM = String.fromCharCode(0xfeff)
const DELIM = ';'
const EOL = '\r\n'

export type CsvAudience = 'public' | 'admin'

export interface CsvContext {
  audience: CsvAudience
  /** Organisation name, or «Alle organisasjoner» in the admin. */
  title: string
  period: MiljoPeriod
  categories: BatteryCategory[]
  /** Label used for «Andre» when the organisation has its own. */
  otherLabel?: string
}

const row = (cells: (string | number | null | undefined)[]): string => cells.map(csvCell).join(DELIM)

function osloDateTime(iso: string): string {
  const d = new Date(iso)
  const time = new Intl.DateTimeFormat('nb-NO', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
  return `${osloDateKey(d)} ${time}`
}

function preamble(ctx: CsvContext, what: string, note: string): string[] {
  return [row([`aBoks Miljøregistrering – ${what} – ${ctx.title} – ${periodLabel(ctx.period)}`]), row([note]), '']
}

const NOTE_REGISTRATIONS =
  'Registrerte batterier er egenrapportert av ansatte og ikke kontrollert. Tallene dokumenterer ikke gjenvinning.'
const NOTE_DELIVERIES =
  'Leverte mengder er oppgitt av organisasjonens ansvarlige. Kilo og stk. regnes aldri om til hverandre.'

function categoryLabel(c: BatteryCategory, ctx: CsvContext): string {
  return c === 'other' && ctx.otherLabel ? ctx.otherLabel : CATEGORY_LABELS[c]
}

const statusLabel = (v: string) => RECORD_STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v
const flagLabel = (v: string) => REGISTRATION_FLAG_OPTIONS.find((o) => o.value === v)?.label ?? v

export function registrationsCsv(records: RegistrationRecord[], ctx: CsvContext): string {
  const admin = ctx.audience === 'admin'
  const header = [
    ...(admin ? ['Organisasjon'] : []),
    'Tidspunkt',
    ...ctx.categories.map((c) => categoryLabel(c, ctx)),
    'Totalt',
    ...(admin ? ['Status', 'Opprinnelig totalt', 'Merknader'] : []),
  ]
  const lines = [...preamble(ctx, 'Registrerte batterier (egenrapportert)', NOTE_REGISTRATIONS), row(header)]
  for (const r of [...records].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))) {
    const qty = (c: BatteryCategory) => r.lines.filter((l) => l.category === c).reduce((s, l) => s + l.quantity, 0)
    lines.push(
      row([
        ...(admin ? [r.organizationName] : []),
        osloDateTime(r.registeredAt),
        ...ctx.categories.map(qty),
        r.lines.reduce((s, l) => s + l.quantity, 0),
        ...(admin ? [statusLabel(r.status), r.submittedTotal, r.flags.map(flagLabel).join(', ')] : []),
      ]),
    )
  }
  return BOM + lines.join(EOL) + EOL
}

export function deliveriesCsv(records: DeliveryRecord[], ctx: CsvContext, references?: Map<number, string>): string {
  const admin = ctx.audience === 'admin'
  const header = [
    ...(admin ? ['Organisasjon'] : []),
    'Dato for levering',
    'Levert mengde',
    'Enhet',
    'Mottak / avfallsselskap',
    'Dokumentasjon',
    ...(admin ? ['Status', 'Kvittering / referanse', 'Registrert'] : []),
  ]
  const lines = [...preamble(ctx, 'Leverte batterier (oppgitt eller dokumentert)', NOTE_DELIVERIES), row(header)]
  for (const d of [...records].sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) || a.id - b.id)) {
    lines.push(
      row([
        ...(admin ? [d.organizationName] : []),
        d.deliveryDate,
        d.quantity,
        DELIVERY_UNIT_LABELS[d.unit],
        d.operator,
        d.documentationStatus === 'documented' ? 'Dokumentert med kvittering' : 'Oppgitt av ansvarlig',
        ...(admin ? [statusLabel(d.status), references?.get(d.id) ?? '', osloDateTime(d.registeredAt)] : []),
      ]),
    )
  }
  return BOM + lines.join(EOL) + EOL
}

/** One row per period bucket; registrations and each delivery unit in their own columns. */
export function summaryCsv(trend: TrendPoint[], deliveries: DeliveryTrendPoint[], ctx: CsvContext): string {
  const header = [
    'Periode',
    'Registreringer',
    ...ctx.categories.map((c) => categoryLabel(c, ctx)),
    'Registrerte batterier totalt',
    'Leveranser',
    'Levert (kg)',
    'Levert (stk.)',
  ]
  const lines = [
    ...preamble(ctx, 'Sammendrag per periode', `${NOTE_REGISTRATIONS} ${NOTE_DELIVERIES}`),
    row(header),
  ]
  const byKey = new Map(deliveries.map((d) => [d.key, d]))
  for (const p of trend) {
    const d = byKey.get(p.key)
    lines.push(
      row([p.key, p.registrations, ...ctx.categories.map((c) => p[c]), p.total, d?.deliveries ?? 0, d?.kg ?? 0, d?.stk ?? 0]),
    )
  }
  return BOM + lines.join(EOL) + EOL
}

export const CSV_TYPES = ['registreringer', 'leveranser', 'sammendrag'] as const
export type CsvType = (typeof CSV_TYPES)[number]
export const isCsvType = (v: unknown): v is CsvType => typeof v === 'string' && (CSV_TYPES as readonly string[]).includes(v)

/** ASCII-only file name segment. */
export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'o')
      .replace(/å/g, 'a')
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'organisasjon'
  )
}
