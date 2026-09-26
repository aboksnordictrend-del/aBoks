/**
 * The B2B solution calculator: types shared by its configuration, its rules and its UI.
 *
 * The calculator suggests *roughly how many* units a workplace is likely to need. It is a
 * recommendation, never a requirement — every result the UI renders says so, and nothing
 * here is used for pricing, stock or checkout.
 */

/** The four kinds of workplace, each mapping to one written solution page. */
export type SolutionKind = 'kontor' | 'produksjon' | 'skole' | 'borettslag'

/** A question that takes a whole number. */
export interface CalculatorNumberField {
  type: 'number'
  id: string
  label: string
  /** One short line under the label. */
  help?: string
  /** Upper bound, so a slip of the keyboard cannot produce an absurd recommendation. */
  max: number
  /**
   * How the field reads back in the "Basert på …" sentence: `{ one: 'ansatt', many:
   * 'ansatte' }`. A field with no phrase is used by the rules but not named in the summary.
   */
  phrase?: { one: string; many: string }
}

/** A question answered by picking one of a few options. */
export interface CalculatorChoiceField {
  type: 'choice'
  id: string
  label: string
  help?: string
  options: { value: string; label: string }[]
}

export type CalculatorField = (CalculatorNumberField | CalculatorChoiceField) & {
  /** Shown only when another field currently holds this value. */
  showWhen?: { field: string; equals: string }
}

/** Everything the customer has answered for one kind, before any rule runs. */
export interface CalculatorAnswers {
  /** Whole numbers by field id. A field left blank is simply absent. */
  numbers: Record<string, number | undefined>
  /** Chosen options by field id. */
  choices: Record<string, string | undefined>
}

/** One product in a recommendation. */
export interface RecommendedLine {
  /** The Payload slug, which is also the URL parameter the solution page reads. */
  slug: string
  /** Fallback display name, used when the CMS product is not available to the page. */
  name: string
  quantity: number
  /** Why this many, in plain words — never the formula. */
  note: string
}

export interface Recommendation {
  kind: SolutionKind
  /** The solution page this leads to, e.g. `borettslagspakke`. */
  solutionSlug: string
  solutionName: string
  /** Only products with a quantity above zero. */
  lines: RecommendedLine[]
  /** "Basert på 48 leiligheter og 3 oppganger." */
  basis: string
  /**
   * Set when one part of the recommendation cannot be worked out yet — a rekkehus with no
   * number of boliggrupper entered, say. Better than inventing a number.
   */
  pending?: string
}

/** What the calculator has to show right now. */
export type CalculatorOutcome =
  | { status: 'incomplete'; message: string }
  | { status: 'ready'; recommendation: Recommendation }
