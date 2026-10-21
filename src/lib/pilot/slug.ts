// Slugs for /pilot/[slug]. Pure.

import { PILOT_LIMITS } from './constants'

/**
 * Words a project may not use as its slug. The page lives under /pilot/, so nothing collides
 * with the storefront's own top-level routes; these are kept free for routing, previews and
 * future sub-pages of the pilot section, and to keep obviously confusing URLs out of print.
 */
export const RESERVED_PILOT_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'pilot',
  'pilotprosjekter',
  'ny',
  'new',
  'index',
  'preview',
  'forhandsvisning',
  'takk',
  'evaluering',
  'evalueringer',
  'resultater',
  'qr',
  'p',
  'id',
  'static',
  '_next',
])

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Turns a project name into a URL slug: lowercase ASCII, words joined by single hyphens.
 * Norwegian letters are transliterated (æ→ae, ø→o, å→a) rather than dropped, so
 * «Hitraskolen Fillan» → `hitraskolen-fillan` and «Bø kommune» → `bo-kommune`.
 */
export function slugify(input: string): string {
  const transliterated = input
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
  const slug = transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, PILOT_LIMITS.slugMax)
    .replace(/-+$/g, '')
  return slug
}

/** Returns a Norwegian error message, or null when the slug is usable. */
export function validatePilotSlug(slug: unknown): string | null {
  if (typeof slug !== 'string' || slug.trim() === '') return 'URL-slug er påkrevd.'
  if (slug.length > PILOT_LIMITS.slugMax) return `URL-slug kan ha maks ${PILOT_LIMITS.slugMax} tegn.`
  if (!SLUG_PATTERN.test(slug)) {
    return 'URL-slug kan bare inneholde små bokstaver (a–z), tall og bindestrek, og kan ikke starte eller slutte med bindestrek.'
  }
  if (RESERVED_PILOT_SLUGS.has(slug)) return `«${slug}» er reservert og kan ikke brukes som URL-slug.`
  return null
}

/**
 * The first candidate not in `taken`: `base`, then `base-2`, `base-3`, … A reserved base is
 * suffixed straight away. Used when a slug is generated automatically from the project name.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || 'pilot'
  const free = (s: string) => !taken.has(s) && !RESERVED_PILOT_SLUGS.has(s)
  if (free(root)) return root
  for (let n = 2; n < 10_000; n++) {
    const suffix = `-${n}`
    const candidate = `${root.slice(0, PILOT_LIMITS.slugMax - suffix.length).replace(/-+$/g, '')}${suffix}`
    if (free(candidate)) return candidate
  }
  throw new Error('Fant ingen ledig URL-slug.')
}
