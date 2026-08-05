// Browser-side attribution signals for the Conversions API: the two Meta cookies, the
// customer's IP and their user agent.
//
// ── Why this is captured at checkout and not in the webhook ──
//
// The Kustom push webhook is a server-to-server call from api.kustom.co. Its `x-forwarded-for`
// and `user-agent` describe *Kustom's* machine, and it carries none of the customer's cookies.
// Sending those to Meta would not merely be useless, it would be actively wrong: every order
// would report the same "customer". The only request that is genuinely the buyer's browser is
// the one that creates the Kustom checkout, so the signals are captured there and stored on
// the order for the webhook to use later.
//
// Everything here is best-effort. A missing cookie, a proxy that strips the IP header or a
// blocked pixel each simply mean one less field in `user_data`.

export interface MetaAttribution {
  /** Meta's browser id cookie, `_fbp` — `fb.1.<ts>.<random>`. */
  fbp?: string
  /** Meta's click id cookie, `_fbc` — `fb.1.<ts>.<fbclid>`. */
  fbc?: string
  clientIpAddress?: string
  clientUserAgent?: string
}

/** Case-insensitive header/cookie lookup, so `Headers`, a plain object or a map all fit. */
export type ValueLookup = (name: string) => string | null | undefined

/**
 * Header order, most trustworthy first.
 *
 * `x-vercel-forwarded-for` is set by Vercel's edge from the connection it terminated and
 * cannot be spoofed by the client, which is why it wins. `x-real-ip` is Vercel's single-value
 * copy of the same thing. Plain `x-forwarded-for` is last and is a *list* — the client's own
 * address is the first entry, every later entry is a proxy, and a client can prepend
 * arbitrary values to it. Only the first valid address is ever kept; the proxy chain is
 * discarded rather than stored.
 */
const IP_HEADERS = ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for'] as const

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
const IPV6_CHARS = /^[0-9a-f:.]+$/i

/**
 * A syntactically valid, externally meaningful address.
 *
 * Loopback and the RFC1918 ranges are rejected: they show up in local development and behind
 * some corporate proxies, they identify nobody, and storing them would put a fake "customer
 * IP" on real orders.
 */
export function isUsableIp(value: string): boolean {
  const v4 = IPV4.exec(value)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    if (v4.slice(1).some((part) => Number(part) > 255)) return false
    if (a === 127 || a === 0 || a === 10) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 169 && b === 254) return false
    return true
  }

  if (!value.includes(':')) return false
  if (!IPV6_CHARS.test(value)) return false
  const lower = value.toLowerCase()
  if (lower === '::1' || lower === '::') return false
  // fc00::/7 (unique local) and fe80::/10 (link local).
  if (/^f[cd]/.test(lower) || lower.startsWith('fe8') || lower.startsWith('fe9')) return false
  return true
}

/** `1.2.3.4:56789` → `1.2.3.4`, `[2001:db8::1]` → `2001:db8::1`. */
function cleanAddress(raw: string): string {
  let value = raw.trim()
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    if (end > 0) return value.slice(1, end)
  }
  // A single colon on an IPv4 literal is a port, never part of the address. IPv6 has many.
  const colons = value.split(':').length - 1
  if (colons === 1) value = value.slice(0, value.indexOf(':'))
  return value
}

/** The customer's own IP, or null when no trusted header carries a usable one. */
export function clientIpFromHeaders(getHeader: ValueLookup): string | null {
  for (const header of IP_HEADERS) {
    const raw = getHeader(header)
    if (typeof raw !== 'string' || !raw) continue

    for (const part of raw.split(',')) {
      const candidate = cleanAddress(part)
      if (candidate && isUsableIp(candidate)) return candidate
    }
  }
  return null
}

/**
 * Rebuilds `_fbc` from a raw `fbclid` when the cookie is missing.
 *
 * Meta's format is `fb.<subdomainIndex>.<creationTimeMs>.<fbclid>`; version 1 is what the
 * pixel writes for a single-domain site. This is the documented fallback for the case where
 * the pixel was blocked (or consent was declined) on the landing page but the click id is
 * still visible in the URL.
 */
export function fbcFromFbclid(fbclid: string | null | undefined, nowMs: number): string | null {
  if (typeof fbclid !== 'string') return null
  const value = fbclid.trim()
  if (!value || value.length > 500 || !/^[\w.-]+$/.test(value)) return null
  return `fb.1.${nowMs}.${value}`
}

/**
 * Cookies come from the customer and go straight into an outbound API call, so they are
 * length-capped and stripped of anything that is not a plain token character. A malformed
 * cookie becomes an omitted field, never a rejected event.
 */
function sanitizeCookie(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 255) return null
  return /^[\w.-]+$/.test(trimmed) ? trimmed : null
}

/** User agents are long but bounded; anything past this is not a real browser string. */
const MAX_USER_AGENT = 512

export interface ResolveAttributionInput {
  getCookie: ValueLookup
  getHeader: ValueLookup
  /** `fbclid` from the current URL, used only if the `_fbc` cookie is absent. */
  fbclid?: string | null
  nowMs?: number
}

/**
 * Collects whatever the browser actually offered. Absent fields are left out entirely rather
 * than stored as empty strings — `buildPurchaseEventPayload` would have to strip them again,
 * and an empty string in `user_data` is a match signal that matches nothing.
 */
export function resolveMetaAttribution(input: ResolveAttributionInput): MetaAttribution {
  const nowMs = input.nowMs ?? Date.now()

  const fbp = sanitizeCookie(input.getCookie('_fbp'))
  const fbc = sanitizeCookie(input.getCookie('_fbc')) ?? fbcFromFbclid(input.fbclid, nowMs)
  const ip = clientIpFromHeaders(input.getHeader)

  const rawUserAgent = input.getHeader('user-agent')
  const userAgent =
    typeof rawUserAgent === 'string' && rawUserAgent.trim()
      ? rawUserAgent.trim().slice(0, MAX_USER_AGENT)
      : null

  return {
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    ...(ip ? { clientIpAddress: ip } : {}),
    ...(userAgent ? { clientUserAgent: userAgent } : {}),
  }
}

/** True when there is at least one signal worth storing on the order. */
export function hasAttribution(attribution: MetaAttribution): boolean {
  return Object.keys(attribution).length > 0
}
