import {
  BORETTSLAG_PROPERTY,
  CALCULATOR_FIELDS,
  CALCULATOR_RULES,
  CALCULATOR_SOLUTIONS,
} from './config'
import type {
  CalculatorAnswers,
  CalculatorNumberField,
  CalculatorOutcome,
  RecommendedLine,
  Recommendation,
  SolutionKind,
} from './types'

/**
 * The recommendation rules, as pure functions over the answers.
 *
 * Every coefficient comes from `CALCULATOR_RULES` — there is not a single number in this
 * file that a reader would have to hunt for. Nothing here touches React, the cart, prices or
 * Payload: give it answers, get quantities and a sentence explaining them.
 *
 * The output is guidance. The UI says so on every result, and the rules are deliberately
 * conservative where a naive formula would produce silly numbers (one collection point per
 * classroom, eighty desk units for six people).
 */

const ceil = (n: number) => Math.ceil(n)

/**
 * What the XL line says for a workplace. The distinction the result has to carry: here the
 * XL is the one central point the local units are emptied into, so it does not grow with
 * them. A borettslag's XL is distributed instead, and writes its own note.
 */
const CENTRAL_XL_NOTE =
  'Ett sentralt innsamlingspunkt som de lokale enhetene tømmes i.'

/** An answered number, or 0. Treats a blank field as "none", never as a reason to guess. */
function num(answers: CalculatorAnswers, id: string): number {
  const value = answers.numbers[id]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Has the customer said enough for a recommendation to mean anything? */
export function hasEnoughInput(kind: SolutionKind, answers: CalculatorAnswers): boolean {
  switch (kind) {
    case 'kontor':
      return num(answers, 'ansatte') > 0 || num(answers, 'arbeidsomrader') > 0
    case 'produksjon':
      return (
        num(answers, 'ansatte') > 0 || num(answers, 'kontorer') > 0 || num(answers, 'soner') > 0
      )
    case 'skole':
      return (
        num(answers, 'undervisningsrom') > 0 ||
        num(answers, 'larerrom') > 0 ||
        num(answers, 'fellesomrader') > 0
      )
    case 'borettslag':
      return num(answers, 'leiligheter') > 0
  }
}

/**
 * "Basert på 48 leiligheter og 3 oppganger." Built from the fields the customer actually
 * answered, in the order they are asked, so the sentence never claims an input that is not
 * there and never mentions one that is blank.
 */
function basisSentence(kind: SolutionKind, answers: CalculatorAnswers): string {
  const parts: string[] = []
  for (const field of CALCULATOR_FIELDS[kind]) {
    if (field.type !== 'number') continue
    const phrase = (field as CalculatorNumberField).phrase
    if (!phrase) continue
    const value = num(answers, field.id)
    if (value <= 0) continue
    parts.push(`${value} ${value === 1 ? phrase.one : phrase.many}`)
  }
  if (parts.length === 0) return ''
  const last = parts.pop() as string
  return parts.length === 0 ? `Basert på ${last}.` : `Basert på ${parts.join(', ')} og ${last}.`
}

/** Drops the products nobody needs, so a result never shows "0 ×" anything. */
function used(lines: RecommendedLine[]): RecommendedLine[] {
  return lines.filter((line) => line.quantity > 0)
}

// ── the four rule sets ───────────────────────────────────────────────────────

function kontorLines(answers: CalculatorAnswers): RecommendedLine[] {
  const r = CALCULATOR_RULES.kontor
  const ansatte = num(answers, 'ansatte')
  const arbeidsomrader = num(answers, 'arbeidsomrader')
  // `etasjer` and `fellesomrader` are asked for context and named in the summary sentence;
  // neither changes a quantity, because the central point does not multiply with the
  // building. See CALCULATOR_RULES.centralXlUnits.

  // Work areas are the real driver; headcount is the floor under them.
  let office = Math.max(ceil(ansatte / r.employeesPerOfficeUnit), arbeidsomrader)
  // Many small rooms and few people should not add up to a unit per room.
  if (ansatte > 0) office = Math.min(office, ansatte * r.maxOfficeUnitsPerEmployee)

  return used([
    {
      slug: 'aboks-office',
      name: CALCULATOR_SOLUTIONS.kontor.productNames['aboks-office'],
      quantity: office,
      note: 'Lokal oppbevaring ved arbeidsplassene, med eget rom for brukte batterier.',
    },
    {
      slug: 'aboks-xl',
      name: CALCULATOR_SOLUTIONS.kontor.productNames['aboks-xl'],
      quantity: CALCULATOR_RULES.centralXlUnits,
      note: CENTRAL_XL_NOTE,
    },
  ])
}

function produksjonLines(answers: CalculatorAnswers): RecommendedLine[] {
  const r = CALCULATOR_RULES.produksjon
  const ansatte = num(answers, 'ansatte')
  const kontorer = num(answers, 'kontorer')
  const soner = num(answers, 'soner')
  // `omrader` is context for the summary sentence; it does not multiply the central point.

  // No office or workroom areas means no aBoks: a plant that says it has none should not be
  // given desk units off the back of its headcount. Those floors are covered by Spesial.
  let aboks = 0
  if (kontorer > 0) {
    // Headcount is the floor under the office areas, and cannot push past what they hold.
    aboks = Math.min(
      Math.max(kontorer, ceil(ansatte / r.employeesPerAboks)),
      kontorer * r.maxAboksPerOfficeArea,
    )
  }

  const spesial = soner * r.spesialPerZone

  return used([
    {
      slug: 'aboks',
      name: CALCULATOR_SOLUTIONS.produksjon.productNames.aboks,
      quantity: aboks,
      note: 'Til kontorer og arbeidsrom, med nye AA- og AAA-batterier og et eget rom for brukte.',
    },
    {
      slug: 'aboks-spesial',
      name: CALCULATOR_SOLUTIONS.produksjon.productNames['aboks-spesial'],
      quantity: spesial,
      note: 'Lokalt innsamlingspunkt i produksjon, på lager og i verksted.',
    },
    {
      slug: 'aboks-xl',
      name: CALCULATOR_SOLUTIONS.produksjon.productNames['aboks-xl'],
      quantity: CALCULATOR_RULES.centralXlUnits,
      note: CENTRAL_XL_NOTE,
    },
  ])
}

function skoleLines(answers: CalculatorAnswers): RecommendedLine[] {
  const r = CALCULATOR_RULES.skole
  const undervisningsrom = num(answers, 'undervisningsrom')
  const larerrom = num(answers, 'larerrom')
  const fellesomrader = num(answers, 'fellesomrader')
  // `etasjer` is context for the summary sentence; the central point stays central.

  const office = larerrom * r.officePerStaffArea
  // Rooms share a collection point rather than each getting one.
  const spesial = ceil((undervisningsrom + fellesomrader) / r.roomsPerSpesial)

  return used([
    {
      slug: 'aboks-office',
      name: CALCULATOR_SOLUTIONS.skole.productNames['aboks-office'],
      quantity: office,
      note: 'Til lærerrom, kontorer og administrasjon.',
    },
    {
      slug: 'aboks-spesial',
      name: CALCULATOR_SOLUTIONS.skole.productNames['aboks-spesial'],
      quantity: spesial,
      note: 'Lokale innsamlingspunkter fordelt på undervisningsrom og fellesområder.',
    },
    {
      slug: 'aboks-xl',
      name: CALCULATOR_SOLUTIONS.skole.productNames['aboks-xl'],
      quantity: CALCULATOR_RULES.centralXlUnits,
      note: CENTRAL_XL_NOTE,
    },
  ])
}

/**
 * Borettslag is the one kind where the shared point follows the building rather than a
 * count of units: one per oppgang in a single building, one per building or entrance group
 * across several, and one per boliggruppe in a rekkehus development.
 */
function borettslagResult(answers: CalculatorAnswers): {
  lines: RecommendedLine[]
  pending?: string
} {
  const r = CALCULATOR_RULES.borettslag
  const leiligheter = num(answers, 'leiligheter')
  const oppganger = num(answers, 'oppganger')
  const bygg = num(answers, 'bygg')
  const boliggrupper = num(answers, 'boliggrupper')
  const boligtype = answers.choices.boligtype ?? BORETTSLAG_PROPERTY.oneBuilding

  const aboks = leiligheter * r.aboksPerApartment

  let xl = 0
  let xlNote = 'Felles innsamlingspunkt for beboerne.'
  let pending: string | undefined

  if (boligtype === BORETTSLAG_PROPERTY.rekkehus) {
    xl = boliggrupper
    xlNote = 'Ett innsamlingspunkt per boliggruppe.'
    if (boliggrupper <= 0 && leiligheter > 0) {
      pending =
        'Fyll inn antall naturlige boliggrupper eller fellespunkter for å få et forslag til antall aBoks XL.'
    }
  } else if (boligtype === BORETTSLAG_PROPERTY.severalBuildings) {
    // Oppganger may be counted across all the buildings, so the larger of the two is the
    // practical number of collection points rather than their sum.
    xl = Math.max(bygg, oppganger, leiligheter > 0 ? 1 : 0)
    xlNote = 'Et praktisk fellespunkt for hvert bygg eller hver oppgang.'
  } else {
    xl = oppganger > 0 ? oppganger : leiligheter > 0 ? 1 : 0
    xlNote = oppganger > 0 ? 'Ett innsamlingspunkt per oppgang.' : 'Ett felles innsamlingspunkt i bygget.'
  }

  return {
    lines: used([
      {
        slug: 'aboks',
        name: CALCULATOR_SOLUTIONS.borettslag.productNames.aboks,
        quantity: aboks,
        note: 'Én i hver leilighet, med eget rom for brukte batterier.',
      },
      {
        slug: 'aboks-xl',
        name: CALCULATOR_SOLUTIONS.borettslag.productNames['aboks-xl'],
        quantity: xl,
        note: xlNote,
      },
    ]),
    pending,
  }
}

// ── the entry point ──────────────────────────────────────────────────────────

/**
 * The recommendation for one kind of workplace, or the reason there is not one yet.
 *
 * Nothing is invented from an empty form: without a meaningful answer the outcome is
 * `incomplete`, never a row of zeroes and never a lone XL.
 */
export function calculateRecommendation(
  kind: SolutionKind,
  answers: CalculatorAnswers,
): CalculatorOutcome {
  if (!hasEnoughInput(kind, answers)) {
    return {
      status: 'incomplete',
      message: 'Fyll inn noen opplysninger for å se anbefalt løsning.',
    }
  }

  const solution = CALCULATOR_SOLUTIONS[kind]
  let lines: RecommendedLine[]
  let pending: string | undefined

  if (kind === 'borettslag') {
    const result = borettslagResult(answers)
    lines = result.lines
    pending = result.pending
  } else if (kind === 'kontor') {
    lines = kontorLines(answers)
  } else if (kind === 'produksjon') {
    lines = produksjonLines(answers)
  } else {
    lines = skoleLines(answers)
  }

  const recommendation: Recommendation = {
    kind,
    solutionSlug: solution.solutionSlug,
    solutionName: solution.solutionName,
    lines,
    basis: basisSentence(kind, answers),
    ...(pending ? { pending } : {}),
  }

  return { status: 'ready', recommendation }
}

/**
 * The solution page for a recommendation, carrying its quantities.
 *
 * `/bedrifter/borettslagspakke?aboks=48&aboks-xl=3#konfigurer` — one parameter per product,
 * named by the product's own slug, which is exactly what the solution route reads back, and
 * a hash naming the section to land on. The link is therefore shareable and survives a
 * refresh, and both of the result's actions use it: `konfigurer` for the configurator and
 * `foresporsel` for the inquiry form, neither losing the quantities.
 *
 * The hash is an ordinary fragment — the browser does the scrolling, and both sections carry
 * a `scroll-margin-top` that clears the fixed header.
 */
export function recommendationHref(recommendation: Recommendation, hash?: string): string {
  const params = new URLSearchParams()
  for (const line of recommendation.lines) {
    if (line.quantity > 0) params.set(line.slug, String(line.quantity))
  }
  const query = params.toString()
  return `/bedrifter/${recommendation.solutionSlug}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`
}
