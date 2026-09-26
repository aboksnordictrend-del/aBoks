/**
 * The content of one complete solution page under /bedrifter/<slug>.
 *
 * A solution has an entry here once its page is written; until then the route keeps showing
 * the "Mer informasjon kommer" placeholder. Everything the page renders — copy, steps,
 * benefits, which products the configurator offers — is data, so the next package is a new
 * content module and no new components.
 */

/** One step of the "Slik fungerer" flow. Same shape the flow on /bedrifter uses. */
export interface SolutionStep {
  number: string
  title: string
  text: string
}

/**
 * One product's place in a solution, for a solution whose products do different jobs.
 * A solution that only needs a flat list of rooms uses `placement.items` instead.
 */
export interface SolutionPlacementRole {
  /** The product this is about, as it is written on the page. */
  product: string
  /** What kind of place it belongs in — "Kontor og arbeidsrom". */
  label: string
  text: string
  /** Concrete examples, shown as tags. */
  locations: string[]
}

/** A titled point in the benefits grid. */
export interface SolutionBenefit {
  title: string
  text: string
}

export interface SolutionConfiguratorContent {
  heading: string
  intro: string
  /**
   * The products the customer configures, by Payload slug and in the order they appear.
   * Slugs only: the price, the colours and the stock are read from the CMS at request time,
   * never restated here.
   */
  productSlugs: string[]
  /** Starting quantity per slug. A slug with no entry starts at 0 — a configuration
   *  is something the customer builds, not a bundle handed to them pre-filled. */
  defaultQuantities?: Record<string, number>
  /**
   * A line of guidance under the intro, set apart from it — a rule of thumb for how many
   * units a solution tends to need. Guidance, never a formula the page enforces.
   */
  note?: string
  /** Heading of the summary panel — "Din Kontorpakke". */
  summaryHeading: string
  /** The line above the "Be om tilbud" action beside the summary. */
  quoteHeading: string
  quoteText: string
}

export interface SolutionPageContent {
  /** Matches the solution's slug in `BUSINESS_SOLUTIONS`. */
  slug: string
  eyebrow: string
  /** The page's H1 — the solution's name. */
  title: string
  /** The line under the H1. */
  headline: string
  ingress: string

  steps: {
    /** The small uppercase line above the heading. Names this solution's own flow. */
    eyebrow?: string
    heading: string
    intro?: string
    items: SolutionStep[]
  }
  placement: {
    heading: string
    intro: string
    /** Places the whole solution suits, as tags. Used when `roles` is absent. */
    items?: string[]
    /** Per-product placement. A solution with these renders them instead of `items`. */
    roles?: SolutionPlacementRole[]
    note?: string
  }
  configurator: SolutionConfiguratorContent
  benefits: { heading: string; intro?: string; items: SolutionBenefit[] }
  inquiry: {
    heading: string
    intro: string
    /** One of `INTEREST_OPTIONS` — the dropdown is preset to it. */
    interestOption: string
    /** Prefilled message. Never overwrites what the customer has already typed. */
    message: string
  }

  /**
   * Whether search engines may index the page. Every solution page starts `false` and is
   * turned on once the finished page has been reviewed.
   */
  indexable: boolean
}

/** One colour of a configurable product, as the page hands it to the configurator. */
export interface ConfigurableVariant {
  id: string
  name: string
  colorHex: string
  image: string
  /** Shown as availability. It never caps what the configurator lets you ask for. */
  inventory: number
}

/**
 * A product the configurator offers, assembled from Payload by the route. The price is the
 * product's own `price` plus its sale window — the effective price is worked out where it is
 * displayed, by the same `getEffectivePrice` the product page uses, so this page can never
 * hold a second opinion about what something costs.
 */
export interface ConfigurableProduct {
  id: string
  slug: string
  title: string
  tagline: string
  price: number
  sale: { salePrice?: number | null; saleStartDate?: string | null; saleEndDate?: string | null } | null
  /** The product's own photo, used when a variant has none. */
  image: string
  imageAlt: string
  defaultQuantity: number
  variants: ConfigurableVariant[]
}
