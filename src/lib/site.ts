/**
 * The public origin of the website — the one source for canonical URLs, Open Graph URLs,
 * structured data, the sitemap and robots.txt.
 *
 * On the live site (`VERCEL_ENV=production`) it is always `https://aboks.no`, whatever
 * `NEXT_PUBLIC_SERVER_URL` says: a canonical URL must never point at localhost, a preview
 * host or a `www.` variant, and a mistyped environment variable should not be able to
 * deindex the site. Everywhere else (local development, Preview) the configured
 * `NEXT_PUBLIC_SERVER_URL` is used, so `npm run dev` keeps producing localhost URLs.
 *
 * The production flag is read from `NEXT_PUBLIC_VERCEL_ENV` first, because this module is
 * also bundled into client components (Breadcrumbs inside ProductClient): only
 * `NEXT_PUBLIC_*` variables are inlined into the browser bundle, so the server and the
 * browser resolve the same value. `VERCEL_ENV` is the server-side fallback.
 */

import { HOME_SHARE_IMAGE } from './homeSeo'

export const PRODUCTION_SITE_URL = 'https://aboks.no'

/** The environment variables the decision reads. Injectable so it is testable. */
export interface SiteUrlEnv {
  NEXT_PUBLIC_SERVER_URL?: string
  NEXT_PUBLIC_VERCEL_ENV?: string
  VERCEL_ENV?: string
}

/**
 * `https://aboks.no/` → `https://aboks.no`; `http://localhost:3000` stays as it is.
 * Anything that is not an absolute http(s) URL is rejected rather than half-trusted.
 */
export function normalizeSiteOrigin(value: string | undefined | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return null
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

export function resolveSiteUrl(env: SiteUrlEnv): string {
  const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV || env.VERCEL_ENV
  if (vercelEnv === 'production') return PRODUCTION_SITE_URL
  return normalizeSiteOrigin(env.NEXT_PUBLIC_SERVER_URL) ?? PRODUCTION_SITE_URL
}

// Each variable is spelled out: Next.js inlines `process.env.NEXT_PUBLIC_*` only when it is
// written literally, so passing `process.env` itself would read nothing in the browser.
export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
})
export const SITE_NAME = 'aBoks'
export const LOGO_URL = `${SITE_URL}/logo.png`

/** The company behind the site, as it is named on receipts and in the footer. */
export const PUBLISHER_NAME = 'ABOKS AS'

/**
 * The shared fallback share image, for pages without one of their own — the same photo the
 * homepage is shared with, so no page falls back to the retired hero.
 */
export const DEFAULT_OG_IMAGE = HOME_SHARE_IMAGE

/** `/` → `https://aboks.no/`, `/produkter` → `https://aboks.no/produkter`. */
export function absoluteUrl(path: string): string {
  if (path === '/' || path === '') return `${SITE_URL}/`
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
