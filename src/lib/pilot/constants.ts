// Shared vocabulary for the pilot-project system («Pilotprosjekter»). Pure — safe to import from
// collection configs, the public page, the admin bundle and tests alike.

export const PILOT_PROJECTS_SLUG = 'pilot-projects'
export const PILOT_EVALUATIONS_SLUG = 'pilot-evaluations'

/** The admin sidebar group both collections live in. */
export const PILOT_ADMIN_GROUP = 'Pilotprosjekter'

/** Public route prefix. Every project is served by the one dynamic page at /pilot/[slug]. */
export const PILOT_ROUTE_PREFIX = '/pilot'

// ── Project status ──

export const PILOT_STATUSES = ['draft', 'active', 'completed', 'archived'] as const
export type PilotStatus = (typeof PILOT_STATUSES)[number]

export const PILOT_STATUS_OPTIONS: { label: string; value: PilotStatus }[] = [
  { label: 'Utkast', value: 'draft' },
  { label: 'Aktiv', value: 'active' },
  { label: 'Avsluttet', value: 'completed' },
  { label: 'Arkivert', value: 'archived' },
]

export function isPilotStatus(value: unknown): value is PilotStatus {
  return typeof value === 'string' && (PILOT_STATUSES as readonly string[]).includes(value)
}

// ── Organisation type ──

export const ORGANIZATION_TYPES = ['kommune', 'skole', 'bedrift', 'annet'] as const
export type OrganizationType = (typeof ORGANIZATION_TYPES)[number]

export const ORGANIZATION_TYPE_OPTIONS: { label: string; value: OrganizationType }[] = [
  { label: 'Kommune', value: 'kommune' },
  { label: 'Skole', value: 'skole' },
  { label: 'Bedrift', value: 'bedrift' },
  { label: 'Annet', value: 'annet' },
]

export function organizationTypeLabel(value: unknown): string {
  return ORGANIZATION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? ''
}

// ── Question types ──

export const QUESTION_TYPES = [
  'shortText',
  'longText',
  'singleChoice',
  'multipleChoice',
  'rating',
  'yesNo',
  'dropdown',
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_OPTIONS: { label: string; value: QuestionType }[] = [
  { label: 'Kort tekst', value: 'shortText' },
  { label: 'Lang tekst', value: 'longText' },
  { label: 'Enkeltvalg', value: 'singleChoice' },
  { label: 'Flervalg', value: 'multipleChoice' },
  { label: 'Vurderingsskala (1–5)', value: 'rating' },
  { label: 'Ja / Nei', value: 'yesNo' },
  { label: 'Nedtrekksliste', value: 'dropdown' },
]

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && (QUESTION_TYPES as readonly string[]).includes(value)
}

/** Types whose answers are picked from a configured list of options. */
export const CHOICE_TYPES: readonly QuestionType[] = ['singleChoice', 'multipleChoice', 'dropdown']

export function isChoiceType(type: QuestionType): boolean {
  return CHOICE_TYPES.includes(type)
}

export function isTextType(type: QuestionType): boolean {
  return type === 'shortText' || type === 'longText'
}

export const RATING_MIN = 1
export const RATING_MAX = 5

/** Fixed options of a Ja / Nei question. «Ja» counts as the positive answer. */
export const YES_NO_OPTIONS = [
  { label: 'Ja', excludeFromAverages: false, isPositive: true },
  { label: 'Nei', excludeFromAverages: false, isPositive: false },
] as const

// ── Analysis category ──
//
// Questions are freely editable, so the analytics never identify a question by its text or its
// position. Each question may instead carry one analysis category; the dashboard's dedicated
// figures (average usability, model distribution, …) read the question in that category.

export const STAT_KEYS = [
  'location',
  'model',
  'frequency',
  'usability',
  'usefulness',
  'organization',
  'continue',
  'improvements',
  'comments',
  'room',
] as const
export type StatKey = (typeof STAT_KEYS)[number]

export const STAT_KEY_OPTIONS: { label: string; value: StatKey }[] = [
  { label: 'Brukssted', value: 'location' },
  { label: 'aBoks-modell', value: 'model' },
  { label: 'Bruksfrekvens', value: 'frequency' },
  { label: 'Brukervennlighet', value: 'usability' },
  { label: 'Nytteverdi', value: 'usefulness' },
  { label: 'Bedre organisering', value: 'organization' },
  { label: 'Ønsker å fortsette', value: 'continue' },
  { label: 'Forbedringsforslag', value: 'improvements' },
  { label: 'Andre kommentarer', value: 'comments' },
  { label: 'Rom / avdeling', value: 'room' },
]

export function isStatKey(value: unknown): value is StatKey {
  return typeof value === 'string' && (STAT_KEYS as readonly string[]).includes(value)
}

export function statKeyLabel(value: unknown): string {
  return STAT_KEY_OPTIONS.find((o) => o.value === value)?.label ?? ''
}

// ── Option sources ──

export const OPTION_SOURCES = ['manual', 'projectModels'] as const
export type OptionSource = (typeof OPTION_SOURCES)[number]

export const OPTION_SOURCE_OPTIONS: { label: string; value: OptionSource }[] = [
  { label: 'Egendefinerte alternativer', value: 'manual' },
  { label: 'Prosjektets aBoks-modeller (+ alternativene under)', value: 'projectModels' },
]

// ── Limits ──

export const PILOT_LIMITS = {
  slugMax: 80,
  questionsMax: 40,
  optionsMax: 30,
  labelMax: 300,
  optionLabelMax: 120,
  shortTextMax: 200,
  longTextMax: 3000,
  introMax: 2000,
} as const

// ── Default public texts ──

export const DEFAULT_INTRO =
  'Takk for at du tester aBoks! Dine tilbakemeldinger hjelper oss med å forbedre produktene våre. Undersøkelsen er anonym og tar omtrent 2–3 minutter.'

export const DEFAULT_CLOSING = 'Tusen takk for tilbakemeldingen! Din evaluering er registrert.'

export const SUBMIT_LABEL = 'Send inn evaluering'
