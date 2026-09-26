/**
 * The solution pages that have been written.
 *
 * `/bedrifter/<slug>` looks its content up here: a solution with an entry renders the full
 * page, one without keeps the "Mer informasjon kommer" placeholder. Publishing the next
 * package is a content module plus one line in this registry — all four are written now,
 * and a fifth solution follows the same two steps.
 */

import { BORETTSLAGSPAKKE } from './borettslagspakke'
import { KONTORPAKKE } from './kontorpakke'
import { PRODUKSJONSPAKKE } from './produksjonspakke'
import { SKOLEPAKKE } from './skolepakke'
import type { SolutionPageContent } from './types'

const SOLUTION_PAGES: Record<string, SolutionPageContent> = {
  [KONTORPAKKE.slug]: KONTORPAKKE,
  [PRODUKSJONSPAKKE.slug]: PRODUKSJONSPAKKE,
  [SKOLEPAKKE.slug]: SKOLEPAKKE,
  [BORETTSLAGSPAKKE.slug]: BORETTSLAGSPAKKE,
}

/** The written page for this solution, or undefined while it is still a placeholder. */
export function solutionPageContent(slug: string): SolutionPageContent | undefined {
  return SOLUTION_PAGES[slug]
}

export type { SolutionPageContent } from './types'
