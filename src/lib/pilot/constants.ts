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
// A category only groups questions in Pilotanalyse. It never decides how an answer is counted:
// that follows from the question type and the option flags («Positivt svar», «Holdes utenfor …»,
// «Ingen produkterfaring»). Any question type may carry any category, several questions may share
// one, and «Ingen kategori» (or no value) is always allowed.

export const CATEGORY_KEYS = [
  'usage',
  'usability',
  'benefit',
  'satisfaction',
  'recommendation',
  'feedback',
] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export const CATEGORY_OPTIONS: { label: string; value: CategoryKey }[] = [
  { label: 'Bruk og erfaring', value: 'usage' },
  { label: 'Brukervennlighet', value: 'usability' },
  { label: 'Nytte og effekt', value: 'benefit' },
  { label: 'Tilfredshet', value: 'satisfaction' },
  { label: 'Anbefaling og videre bruk', value: 'recommendation' },
  { label: 'Forbedringer og kommentarer', value: 'feedback' },
]

/** Explicit «no category». Stored as its own value so the choice is visible in the editor. */
export const NO_CATEGORY = 'none'

/** Heading in Pilotanalyse for questions without a category. */
export const UNCATEGORIZED_LABEL = 'Andre spørsmål'

/**
 * Categories from before the six universal ones. They stay valid values — questionnaires saved
 * with them, and every evaluation snapshot taken from those questionnaires, keep loading — but the
 * editor no longer offers them for a question that does not already have one. Each is grouped
 * under the universal category it belongs to.
 */
export const LEGACY_STAT_KEYS = [
  'location',
  'model',
  'frequency',
  'usefulness',
  'organization',
  'continue',
  'improvements',
  'comments',
  'room',
] as const
export type LegacyStatKey = (typeof LEGACY_STAT_KEYS)[number]

const LEGACY_CATEGORY: Record<LegacyStatKey, { label: string; category: CategoryKey }> = {
  location: { label: 'Brukssted', category: 'usage' },
  model: { label: 'aBoks-modell', category: 'usage' },
  frequency: { label: 'Bruksfrekvens', category: 'usage' },
  room: { label: 'Rom / avdeling', category: 'usage' },
  usefulness: { label: 'Nytteverdi', category: 'benefit' },
  organization: { label: 'Bedre organisering', category: 'benefit' },
  continue: { label: 'Ønsker å fortsette', category: 'recommendation' },
  improvements: { label: 'Forbedringsforslag', category: 'feedback' },
  comments: { label: 'Andre kommentarer', category: 'feedback' },
}

/** Every stored value of the «Analysekategori» field (the database enum). */
export const STAT_KEYS = [...CATEGORY_KEYS, NO_CATEGORY, ...LEGACY_STAT_KEYS] as const
export type StatKey = (typeof STAT_KEYS)[number]

export const STAT_KEY_OPTIONS: { label: string; value: StatKey }[] = [
  ...CATEGORY_OPTIONS,
  { label: 'Ingen kategori', value: NO_CATEGORY },
  ...LEGACY_STAT_KEYS.map((key) => ({
    label: `Eldre: ${LEGACY_CATEGORY[key].label} (vises som «${categoryLabel(LEGACY_CATEGORY[key].category)}»)`,
    value: key,
  })),
]

export function isStatKey(value: unknown): value is StatKey {
  return typeof value === 'string' && (STAT_KEYS as readonly string[]).includes(value)
}

export function isLegacyStatKey(value: unknown): value is LegacyStatKey {
  return typeof value === 'string' && (LEGACY_STAT_KEYS as readonly string[]).includes(value)
}

/** The universal category a stored value groups under; null for «Ingen kategori» and unknown values. */
export function categoryOf(value: unknown): CategoryKey | null {
  if (typeof value !== 'string') return null
  if ((CATEGORY_KEYS as readonly string[]).includes(value)) return value as CategoryKey
  if (isLegacyStatKey(value)) return LEGACY_CATEGORY[value].category
  return null
}

export function categoryLabel(value: unknown): string {
  const key = categoryOf(value)
  return key ? CATEGORY_OPTIONS.find((o) => o.value === key)!.label : UNCATEGORIZED_LABEL
}

/**
 * The options the editor offers for one question: the six categories and «Ingen kategori», plus
 * the question's own legacy value while it still has one (so an existing questionnaire saves
 * unchanged). Payload validates against this same list.
 */
export function statKeyOptionsFor<T extends { value: string }>(options: T[], current: unknown): T[] {
  return options.filter((o) => !isLegacyStatKey(o.value) || o.value === current)
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
