// Public URLs of pilot questionnaires. Pure.

import { PILOT_ROUTE_PREFIX } from './constants'

/** Canonical public origin. Matches src/lib/site.ts; repeated here so the admin bundle needs no env. */
export const PUBLIC_PILOT_ORIGIN = 'https://aboks.no'

/** Path of a project's questionnaire: `/pilot/<slug>`. */
export function pilotPath(slug: string): string {
  return `${PILOT_ROUTE_PREFIX}/${encodeURIComponent(slug)}`
}

/**
 * Absolute public URL — what the QR code encodes and what the admin copies. Always the production
 * origin unless another is passed, so a QR code printed from a preview or local admin never points
 * at a temporary host.
 */
export function pilotPublicUrl(slug: string, origin: string = PUBLIC_PILOT_ORIGIN): string {
  return `${origin.replace(/\/+$/, '')}${pilotPath(slug)}`
}
