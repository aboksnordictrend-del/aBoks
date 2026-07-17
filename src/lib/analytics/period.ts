// Period resolution in the project timezone (Europe/Oslo), DST-aware.
//
// No timezone library is used. Oslo wall-clock boundaries are converted to UTC
// instants via the runtime's Intl timezone data, which already knows the DST rules.
// Everything downstream works in UTC ISO strings.

export const PROJECT_TIMEZONE = 'Europe/Oslo'

export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom'

export type Grouping = 'day' | 'week' | 'month'

export interface Period {
  /** Inclusive start, UTC ISO. */
  from: string
  /** Exclusive end, UTC ISO (start of the day *after* the last included day). */
  to: string
}

export interface ResolvedPeriod extends Period {
  preset: PresetKey
  /** Same-length window immediately before `from`, for period-over-period comparison. */
  previous: Period
  /** Auto-selected bucket size for the timeline. */
  suggestedGrouping: Grouping
}

const MS_PER_DAY = 86_400_000

/** Minutes east of UTC for `date` in `tz` (e.g. Oslo winter = 60, summer = 120). */
function tzOffsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return Math.round((asUTC - date.getTime()) / 60000)
}

/** Convert an Oslo wall-clock time to the corresponding UTC instant (DST-aware). */
function osloWallClockToUtc(
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
): Date {
  const guess = Date.UTC(y, mo, d, h, mi, s)
  const off1 = tzOffsetMinutes(PROJECT_TIMEZONE, new Date(guess))
  let utc = guess - off1 * 60000
  const off2 = tzOffsetMinutes(PROJECT_TIMEZONE, new Date(utc))
  if (off2 !== off1) utc = guess - off2 * 60000
  return new Date(utc)
}

/** The Oslo calendar Y/M/D that `instant` falls on. */
function osloParts(instant: Date): { y: number; mo: number; d: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROJECT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = dtf.formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), mo: get('month'), d: get('day') }
}

/** UTC instant for Oslo local midnight starting the day that contains `instant`. */
function osloStartOfDay(instant: Date): Date {
  const { y, mo, d } = osloParts(instant)
  return osloWallClockToUtc(y, mo - 1, d, 0, 0, 0)
}

function addOsloDays(instant: Date, days: number): Date {
  // Add in wall-clock terms so DST changes don't shift the calendar day.
  const { y, mo, d } = osloParts(instant)
  return osloWallClockToUtc(y, mo - 1, d + days, 0, 0, 0)
}

function pickGrouping(fromMs: number, toMs: number): Grouping {
  const days = Math.round((toMs - fromMs) / MS_PER_DAY)
  if (days <= 31) return 'day'
  if (days <= 92) return 'week'
  return 'month'
}

/**
 * Resolve a preset (or an explicit custom range) into UTC boundaries plus the
 * matching previous window and a suggested grouping. `now` is injectable for tests.
 *
 * For custom ranges, `customFrom`/`customTo` are `YYYY-MM-DD` (Oslo calendar days);
 * `to` is made exclusive by advancing one day past `customTo`.
 */
export function resolvePeriod(
  preset: PresetKey,
  opts: { customFrom?: string; customTo?: string; now?: Date } = {},
): ResolvedPeriod {
  const now = opts.now ?? new Date()
  const todayStart = osloStartOfDay(now)
  const tomorrowStart = addOsloDays(todayStart, 1)

  let fromDate: Date
  let toDate: Date

  switch (preset) {
    case 'today':
      fromDate = todayStart
      toDate = tomorrowStart
      break
    case 'yesterday':
      fromDate = addOsloDays(todayStart, -1)
      toDate = todayStart
      break
    case 'last7':
      fromDate = addOsloDays(todayStart, -6)
      toDate = tomorrowStart
      break
    case 'last30':
      fromDate = addOsloDays(todayStart, -29)
      toDate = tomorrowStart
      break
    case 'thisMonth': {
      const { y, mo } = osloParts(now)
      fromDate = osloWallClockToUtc(y, mo - 1, 1)
      toDate = tomorrowStart
      break
    }
    case 'lastMonth': {
      const { y, mo } = osloParts(now)
      fromDate = osloWallClockToUtc(y, mo - 2, 1)
      toDate = osloWallClockToUtc(y, mo - 1, 1)
      break
    }
    case 'thisYear': {
      const { y } = osloParts(now)
      fromDate = osloWallClockToUtc(y, 0, 1)
      toDate = tomorrowStart
      break
    }
    case 'custom': {
      if (!opts.customFrom || !opts.customTo) {
        throw new Error('custom period requires customFrom and customTo')
      }
      const [fy, fm, fd] = opts.customFrom.split('-').map(Number)
      const [ty, tm, td] = opts.customTo.split('-').map(Number)
      if (!fy || !fm || !fd || !ty || !tm || !td) {
        throw new Error('custom dates must be YYYY-MM-DD')
      }
      fromDate = osloWallClockToUtc(fy, fm - 1, fd)
      // exclusive end = start of the day after customTo
      toDate = osloWallClockToUtc(ty, tm - 1, td + 1)
      break
    }
    default:
      throw new Error(`unknown preset: ${preset as string}`)
  }

  if (toDate.getTime() <= fromDate.getTime()) {
    throw new Error('period start must be before period end')
  }

  const span = toDate.getTime() - fromDate.getTime()
  const previous: Period = {
    from: new Date(fromDate.getTime() - span).toISOString(),
    to: fromDate.toISOString(),
  }

  return {
    preset,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    previous,
    suggestedGrouping: pickGrouping(fromDate.getTime(), toDate.getTime()),
  }
}

/** ISO date (YYYY-MM-DD) of the Oslo day an instant belongs to — used as bucket key. */
export function osloDateKey(instant: Date): string {
  const { y, mo, d } = osloParts(instant)
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Bucket key + human label for a given instant under a grouping. */
export function bucketFor(instant: Date, grouping: Grouping): { key: string; label: string } {
  const { y, mo, d } = osloParts(instant)
  if (grouping === 'month') {
    const key = `${y}-${String(mo).padStart(2, '0')}`
    return { key, label: `${MONTHS_NB[mo - 1]} ${y}` }
  }
  if (grouping === 'week') {
    const { week, year } = isoWeek(y, mo, d)
    return { key: `${year}-W${String(week).padStart(2, '0')}`, label: `Uke ${week}` }
  }
  return { key: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`, label: `${d}.${mo}` }
}

const MONTHS_NB = [
  'jan', 'feb', 'mar', 'apr', 'mai', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'des',
]

/** ISO-8601 week number for a calendar date. */
function isoWeek(y: number, mo: number, d: number): { week: number; year: number } {
  const date = new Date(Date.UTC(y, mo - 1, d))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY))
  return { week, year: date.getUTCFullYear() }
}

/**
 * Ordered, gap-filled bucket keys covering [from, to) so the timeline shows empty
 * days/weeks/months as zero instead of skipping them.
 */
export function enumerateBuckets(period: Period, grouping: Grouping): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const seen = new Set<string>()
  const end = new Date(period.to).getTime()
  let cursor = osloStartOfDay(new Date(period.from))
  // step by day and dedupe into buckets — robust across DST and month lengths
  let guard = 0
  while (cursor.getTime() < end && guard < 4000) {
    const b = bucketFor(cursor, grouping)
    if (!seen.has(b.key)) {
      seen.add(b.key)
      out.push(b)
    }
    cursor = addOsloDays(cursor, 1)
    guard++
  }
  return out
}
