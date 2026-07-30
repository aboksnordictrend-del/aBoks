// URL resolution and validation for the Pinterest export.
//
// Pinterest fetches every media URL from its own servers and every destination URL is a
// permanent public link on a Pin, so both must be absolute https URLs on the canonical
// production origin. A Preview hostname or a localhost URL would produce Pins that 404
// forever — which is why this deliberately does NOT use resolveApplicationOrigin()
// (src/lib/appOrigin.ts), whose whole purpose is to return the *current* deployment's origin.

import type { Media } from '@/payload-types'

/** Production origin. Used whenever the configured site URL is missing or not https. */
export const PINTEREST_CANONICAL_FALLBACK = 'https://aboks.no'

export interface CanonicalBase {
  baseUrl: string
  /** True when the configured value was unusable and the fallback above was applied. */
  fallback: boolean
}

/**
 * The origin every exported URL is built on.
 *
 * Accepts only an https origin — in local development NEXT_PUBLIC_SERVER_URL is
 * `http://localhost:3000`, and exporting Pins that point at a developer's laptop is never
 * what is wanted. The fallback is reported so the admin page can say so out loud.
 */
export function resolveCanonicalBase(configured: string | null | undefined): CanonicalBase {
  if (typeof configured === 'string' && configured.trim()) {
    try {
      const url = new URL(configured.trim())
      if (url.protocol === 'https:' && url.hostname.includes('.')) {
        return { baseUrl: url.origin, fallback: false }
      }
    } catch {
      // Fall through to the production origin.
    }
  }
  return { baseUrl: PINTEREST_CANONICAL_FALLBACK, fallback: true }
}

/** A publicly fetchable https URL with a real host and no embedded credentials. */
export function isPublicHttpsUrl(value: string | null | undefined): boolean {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value.trim())
    return (
      url.protocol === 'https:' &&
      url.hostname.length > 0 &&
      url.hostname.includes('.') &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}

/** An https URL on the canonical origin — the only destinations a Pin is allowed to point at. */
export function isCanonicalDestination(value: string, baseUrl: string): boolean {
  if (!isPublicHttpsUrl(value)) return false
  try {
    return new URL(value).origin === new URL(baseUrl).origin
  } catch {
    return false
  }
}

/**
 * A canonical spelling of a URL, used only for comparison — never for what is written to the
 * CSV. `new URL().href` lowercases the scheme and host and percent-encodes non-ASCII path
 * characters, so `…/Pa-soverommet.png` and `…/Pa-soverommet.png` written with a raw `ø`
 * converge, and `HTTPS://ABOKS.NO/x` matches `https://aboks.no/x`. The fragment is dropped;
 * the query is kept, because `?variant=…` is a real difference in destination.
 */
export function normalizeUrlForComparison(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href
  } catch {
    return value.trim()
  }
}

/** Join a site-relative path onto the canonical origin. Leading slash is optional. */
export function canonicalUrl(path: string, baseUrl: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${suffix}`
}

/**
 * A Payload upload's public URL, made absolute.
 *
 * Prefers the `hero` size (1920w) — Pinterest re-encodes and rewards large source images —
 * then `card` (800²), then the original. When the Vercel Blob plugin is active these are
 * already absolute `https://….public.blob.vercel-storage.com/…` URLs; without the plugin
 * Payload returns a relative `/api/media/file/…`, which is promoted against `baseUrl`.
 *
 * Returns null for an unresolved relationship (depth too shallow) or a missing URL.
 */
export function resolveMediaUrl(
  media: number | Media | null | undefined,
  baseUrl: string,
): string | null {
  if (!media || typeof media !== 'object') return null
  const raw = media.sizes?.hero?.url || media.sizes?.card?.url || media.url
  if (typeof raw !== 'string' || !raw.trim()) return null
  const absolute = /^https?:\/\//i.test(raw) ? raw : canonicalUrl(raw, baseUrl)
  return isPublicHttpsUrl(absolute) ? absolute : null
}
