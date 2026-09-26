/**
 * The solution pages that have been written.
 *
 * `/bedrifter/<slug>` looks its content up here: a solution with an entry renders the full
 * page, one without keeps the "Mer informasjon kommer" placeholder. Publishing the next
 * package is a content module plus one line in this registry.
 */

import { KONTORPAKKE } from './kontorpakke'
import type { SolutionPageContent } from './types'

const SOLUTION_PAGES: Record<string, SolutionPageContent> = {
  [KONTORPAKKE.slug]: KONTORPAKKE,
  // produksjonspakke, skolepakke, borettslagspakke — still placeholders.
}

/** The written page for this solution, or undefined while it is still a placeholder. */
export function solutionPageContent(slug: string): SolutionPageContent | undefined {
  return SOLUTION_PAGES[slug]
}

export type { SolutionPageContent } from './types'
