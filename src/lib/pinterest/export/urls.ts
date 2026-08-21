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

// ── Per-row Link uniqueness ────────────────────────────────────────────────────────────────
//
// Pinterest's bulk importer keeps only the FIRST row carrying a given Link value and silently
// drops every later row that repeats it. There is no error, no message and no entry in the
// result email — the rows simply never become Pins. Three controlled uploads established it:
//
//   3 rows sharing 1 Link ............................ 1 imported
//   5 rows with 5 distinct Links ..................... 5 imported
//   5 rows on ONE base URL, differing only by ?pin=1…5  5 imported
//
// The third is what makes the fix below viable: Pinterest compares the full Link string
// including the query, so a per-row parameter is enough to make every row distinct. Without it
// the 60-row catalogue export collapses to the 22 distinct destinations it actually contains —
// 20 of its rows point at /produkter/aboks alone.

/** Query parameter carrying the row identity. Read by nothing on the storefront. */
export const PIN_PARAM = 'pin'

/** Longest readable slug kept before the hash suffix, so a long Blob path cannot bloat the URL. */
const PIN_SLUG_MAX = 60

/**
 * FNV-1a (32-bit). Deterministic and dependency-free; only ever used to build an id.
 *
 * Lives here rather than in items.ts so both the source-id builder and the Link parameter can
 * share one implementation without items.ts and urls.ts importing each other.
 */
export function hash32(value: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * The `pin` value for one row: a readable slug, then a hash of the full row key.
 *
 * `${sourceType}:${sourceId}` is already the export's canonical row identity — it is the same
 * key the POST handler matches edited preview rows against — so it is unique by construction.
 * Slugifying it for the URL is what puts that uniqueness at risk: `a-b.webp` and `a_b.webp`
 * both fold to `a-b-webp`, and a blob sourceId is built from an arbitrary admin-supplied
 * filename. A collision would silently drop a Pin, which is the exact failure this whole change
 * exists to remove, so the hash restores the injectivity that slugification loses.
 *
 * The hash is taken over the FULL key, never the truncated slug, so `PIN_SLUG_MAX` can shorten
 * the readable part without ever making two different rows collide.
 *
 * The `sourceType:` prefix is not repeated when the sourceId already carries it — product and
 * blob ids do, variant and homepage ids do not — which keeps `product-4-image-66` from
 * becoming `product-product-4-image-66`.
 */
export function pinParamValue(sourceType: string, sourceId: string): string {
  const key = sourceId.startsWith(`${sourceType}:`) ? sourceId : `${sourceType}:${sourceId}`
  const slug = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, PIN_SLUG_MAX)
    .replace(/-+$/, '')
  const digest = hash32(key)
  return slug ? `${slug}-${digest}` : digest
}

/**
 * `url` with this row's `pin` parameter appended — `?pin=` when there is no query yet,
 * `&pin=` when there is, so an existing `?variant=<sku>` survives untouched.
 *
 * Deliberately string concatenation rather than `new URL()` + `searchParams.set()`: the latter
 * re-serializes the whole query and would silently re-encode a variant SKU. The inputs are
 * always URLs this module built itself from the server-side allowlist, and they never carry a
 * fragment.
 */
export function appendPinParam(url: string, sourceType: string, sourceId: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${PIN_PARAM}=${pinParamValue(sourceType, sourceId)}`
}
