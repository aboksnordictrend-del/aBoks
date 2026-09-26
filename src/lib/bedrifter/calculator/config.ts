import type { CalculatorField, SolutionKind } from './types'

/**
 * Everything tunable about the calculator, in one place.
 *
 * The rules in `calculate.ts` read every number from {@link CALCULATOR_RULES} and never
 * inline one of their own, so tuning the recommendations after real B2B experience — or
 * moving these values into the CMS later — touches this file and nothing else.
 *
 * These are starting points, not requirements. Nothing here is a safety, capacity or
 * regulatory figure; they are opinions about what tends to be practical.
 */
export const CALCULATOR_RULES = {
  /**
   * For a workplace, aBoks XL is the *central* collection point: one place the local units
   * are emptied into. Local units scale with the building; the central point does not, so a
   * plant with forty local units still has one XL until someone tells us otherwise.
   *
   * A borettslag is the exception and has no entry here — its XL is *distributed*, one per
   * oppgang, building or boliggruppe, because the residents are.
   */
  centralXlUnits: 1,

  kontor: {
    /** One aBoks Office per this many employees, before work areas are considered. */
    employeesPerOfficeUnit: 15,
    /**
     * A ceiling on Office units relative to headcount, so "80 small offices, 6 employees"
     * cannot recommend 80 units. Expressed per employee.
     */
    maxOfficeUnitsPerEmployee: 1,
  },
  produksjon: {
    /** One aBoks per this many employees, before office areas are considered. */
    employeesPerAboks: 25,
    /**
     * Headcount alone must not fill a plant with office units: with office areas entered,
     * the recommendation stops at this many aBoks per office area.
     */
    maxAboksPerOfficeArea: 2,
    /** One aBoks Spesial per production / warehouse / workshop zone. */
    spesialPerZone: 1,
  },
  skole: {
    /** One aBoks Office per staff or administrative work area. */
    officePerStaffArea: 1,
    /**
     * Classrooms and common areas are grouped behind one Spesial rather than each getting
     * their own — one per classroom would be an unreasonable number for most schools.
     */
    roomsPerSpesial: 5,
  },
  borettslag: {
    /** The natural starting point: every apartment covered by the solution gets one. */
    aboksPerApartment: 1,
  },
} as const

/** The solution each kind leads to, and the products its recommendation can contain. */
export const CALCULATOR_SOLUTIONS: Record<
  SolutionKind,
  {
    label: string
    /** Short line under the label on the type card. */
    hint: string
    /** Slug of the solution page — also the route the result links to. */
    solutionSlug: string
    solutionName: string
    /** Fallback display names by product slug; the live CMS title wins where available. */
    productNames: Record<string, string>
  }
> = {
  kontor: {
    label: 'Kontor',
    hint: 'Kontor og administrasjon',
    solutionSlug: 'kontorpakke',
    solutionName: 'aBoks Kontorpakke',
    productNames: { 'aboks-office': 'aBoks Office', 'aboks-xl': 'aBoks XL' },
  },
  produksjon: {
    label: 'Produksjon / lager',
    hint: 'Produksjon, lager og verksted',
    solutionSlug: 'produksjonspakke',
    solutionName: 'aBoks Produksjonspakke',
    productNames: {
      aboks: 'aBoks',
      'aboks-spesial': 'aBoks Spesial',
      'aboks-xl': 'aBoks XL',
    },
  },
  skole: {
    label: 'Skole / undervisning',
    hint: 'Skole og undervisning',
    solutionSlug: 'skolepakke',
    solutionName: 'aBoks Skolepakke',
    productNames: {
      'aboks-office': 'aBoks Office',
      'aboks-spesial': 'aBoks Spesial',
      'aboks-xl': 'aBoks XL',
    },
  },
  borettslag: {
    label: 'Borettslag / sameie',
    hint: 'Borettslag og sameier',
    solutionSlug: 'borettslagspakke',
    solutionName: 'aBoks Borettslagspakke',
    productNames: { aboks: 'aBoks', 'aboks-xl': 'aBoks XL' },
  },
}

/** The order the type cards appear in. */
export const CALCULATOR_KINDS: SolutionKind[] = ['kontor', 'produksjon', 'skole', 'borettslag']

/** Property types for a borettslag, which decide how the XL rule reads. */
export const BORETTSLAG_PROPERTY = {
  oneBuilding: 'ett-bygg',
  severalBuildings: 'flere-bygg',
  rekkehus: 'rekkehus',
} as const

/**
 * The questions each kind asks. Few and short on purpose — this is a recommendation, and a
 * long form would cost more answers than it gains accuracy.
 */
export const CALCULATOR_FIELDS: Record<SolutionKind, CalculatorField[]> = {
  kontor: [
    {
      type: 'number',
      id: 'ansatte',
      label: 'Antall ansatte',
      max: 5000,
      phrase: { one: 'ansatt', many: 'ansatte' },
    },
    {
      type: 'number',
      id: 'arbeidsomrader',
      label: 'Antall kontorer / arbeidsområder',
      help: 'Separate rom eller soner der en lokal aBoks Office er nyttig.',
      max: 500,
      phrase: { one: 'arbeidsområde', many: 'arbeidsområder' },
    },
    {
      type: 'number',
      id: 'etasjer',
      label: 'Antall etasjer',
      max: 100,
      phrase: { one: 'etasje', many: 'etasjer' },
    },
    {
      type: 'number',
      id: 'fellesomrader',
      label: 'Antall fellesområder',
      // Context for us and for the summary sentence. It does not change any quantity.
      help: 'For eksempel resepsjon, fellesarbeidsplass eller teknisk rom.',
      max: 200,
      phrase: { one: 'fellesområde', many: 'fellesområder' },
    },
  ],

  produksjon: [
    {
      type: 'number',
      id: 'ansatte',
      label: 'Antall ansatte',
      max: 5000,
      phrase: { one: 'ansatt', many: 'ansatte' },
    },
    {
      type: 'number',
      id: 'kontorer',
      label: 'Antall kontorer / administrative arbeidsområder',
      max: 500,
      phrase: { one: 'kontorområde', many: 'kontorområder' },
    },
    {
      type: 'number',
      id: 'soner',
      label: 'Antall produksjons-, lager- eller verkstedsoner',
      help: 'Soner der ansatte trenger et lokalt punkt for brukte batterier.',
      max: 500,
      phrase: { one: 'produksjonssone', many: 'produksjonssoner' },
    },
    {
      type: 'number',
      id: 'omrader',
      label: 'Antall etasjer / separate områder',
      max: 100,
      phrase: { one: 'etasje eller område', many: 'etasjer eller områder' },
    },
  ],

  skole: [
    {
      type: 'number',
      id: 'undervisningsrom',
      label: 'Antall undervisningsrom',
      max: 500,
      phrase: { one: 'undervisningsrom', many: 'undervisningsrom' },
    },
    {
      type: 'number',
      id: 'larerrom',
      label: 'Antall lærerrom / kontorer / administrative arbeidsområder',
      max: 200,
      phrase: { one: 'lærerrom eller kontor', many: 'lærerrom og kontorer' },
    },
    {
      type: 'number',
      id: 'fellesomrader',
      label: 'Antall fellesområder / verksted / sløyd / tekniske områder',
      max: 200,
      phrase: { one: 'fellesområde', many: 'fellesområder' },
    },
    {
      type: 'number',
      id: 'etasjer',
      label: 'Antall etasjer / bygg',
      max: 100,
      phrase: { one: 'etasje eller bygg', many: 'etasjer og bygg' },
    },
  ],

  borettslag: [
    {
      type: 'number',
      id: 'leiligheter',
      label: 'Antall leiligheter',
      help: 'Boliger som skal omfattes av løsningen.',
      max: 2000,
      phrase: { one: 'leilighet', many: 'leiligheter' },
    },
    {
      type: 'number',
      id: 'oppganger',
      label: 'Antall oppganger',
      max: 200,
      phrase: { one: 'oppgang', many: 'oppganger' },
    },
    {
      type: 'choice',
      id: 'boligtype',
      label: 'Boligtype',
      options: [
        { value: BORETTSLAG_PROPERTY.oneBuilding, label: 'Ett bygg' },
        { value: BORETTSLAG_PROPERTY.severalBuildings, label: 'Flere bygg' },
        { value: BORETTSLAG_PROPERTY.rekkehus, label: 'Rekkehus / boliggrupper' },
      ],
    },
    {
      type: 'number',
      id: 'bygg',
      label: 'Antall bygg',
      max: 200,
      phrase: { one: 'bygg', many: 'bygg' },
      showWhen: { field: 'boligtype', equals: BORETTSLAG_PROPERTY.severalBuildings },
    },
    {
      type: 'number',
      id: 'boliggrupper',
      label: 'Antall naturlige boliggrupper / fellespunkter',
      max: 200,
      phrase: { one: 'boliggruppe', many: 'boliggrupper' },
      showWhen: { field: 'boligtype', equals: BORETTSLAG_PROPERTY.rekkehus },
    },
  ],
}
