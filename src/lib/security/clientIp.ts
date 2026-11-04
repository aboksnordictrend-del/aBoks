import { isIP } from 'node:net'

/**
 * The client address for rate limiting, read only from headers the platform controls.
 *
 * On Vercel the edge sets `x-vercel-forwarded-for`, `x-real-ip` and `x-forwarded-for` itself and
 * overwrites whatever the client sent, so the first address is the real peer. Off Vercel (local
 * development, `next start`) nothing guarantees that, so the value is only a local convenience.
 *
 * Anything that is not a syntactically valid IP address becomes `unknown` — a header can never put
 * arbitrary text into a rate-limit key.
 */

export interface ClientIpEnv {
  VERCEL?: string
}

const firstAddress = (value: string | null): string | null => {
  const first = value?.split(',')[0]?.trim()
  return first ? first : null
}

export function trustedClientIp(headers: Headers, env: ClientIpEnv = process.env as ClientIpEnv): string {
  const candidates =
    env.VERCEL === '1'
      ? [headers.get('x-vercel-forwarded-for'), headers.get('x-real-ip'), headers.get('x-forwarded-for')]
      : [headers.get('x-forwarded-for'), headers.get('x-real-ip')]
  for (const raw of candidates) {
    const ip = firstAddress(raw)
    if (ip && isIP(ip)) return ip
  }
  return 'unknown'
}

/** Expands an IPv6 address to eight 4-digit groups (`::` and an embedded IPv4 tail included). */
function expandIpv6(ip: string): string[] | null {
  let text = ip.toLowerCase()
  const v4 = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4) {
    const p = v4[1]!.split('.').map(Number)
    text = text.slice(0, -v4[1]!.length) + `${((p[0]! << 8) | p[1]!).toString(16)}:${((p[2]! << 8) | p[3]!).toString(16)}`
  }
  const [head, tail] = text.split('::')
  const h = head ? head.split(':') : []
  const t = tail !== undefined ? (tail ? tail.split(':') : []) : null
  const groups = t === null ? h : [...h, ...Array<string>(8 - h.length - t.length).fill('0'), ...t]
  return groups.length === 8 ? groups.map((g) => g.padStart(4, '0')) : null
}

/**
 * The address as a rate-limit subject. IPv4 as is; IPv6 by its /64 prefix, because one device or
 * home connection is normally handed a whole /64 and could otherwise rotate through it freely.
 * IPv4-mapped IPv6 (::ffff:a.b.c.d) counts as the IPv4 address.
 */
export function rateLimitSubject(ip: string): string {
  const kind = isIP(ip)
  if (kind === 4) return ip
  if (kind !== 6) return 'unknown'
  const groups = expandIpv6(ip)
  if (!groups) return 'unknown'
  if (groups.slice(0, 5).every((g) => g === '0000') && groups[5] === 'ffff') {
    const a = parseInt(groups[6]!, 16)
    const b = parseInt(groups[7]!, 16)
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`
  }
  return `${groups.slice(0, 4).join(':')}::/64`
}
