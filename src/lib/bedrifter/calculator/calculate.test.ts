import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateRecommendation, recommendationHref } from './calculate'
import { BORETTSLAG_PROPERTY, CALCULATOR_SOLUTIONS } from './config'
import type { CalculatorAnswers, SolutionKind } from './types'
import { solutionPageContent } from '@/lib/solutions'

/**
 * The recommendation rules. They are guidance, so these tests pin down the behaviour that
 * must not drift — nothing invented from an empty form, no silly quantities from a lopsided
 * one — rather than every coefficient, which we expect to tune.
 */

const answers = (
  numbers: Record<string, number>,
  choices: Record<string, string> = {},
): CalculatorAnswers => ({ numbers, choices })

/** The quantity recommended for one product, or 0 when it is not in the result. */
function qty(kind: SolutionKind, input: CalculatorAnswers, slug: string): number {
  const outcome = calculateRecommendation(kind, input)
  if (outcome.status !== 'ready') return 0
  return outcome.recommendation.lines.find((line) => line.slug === slug)?.quantity ?? 0
}

describe('calculator — nothing invented from nothing', () => {
  for (const kind of ['kontor', 'produksjon', 'skole', 'borettslag'] as SolutionKind[]) {
    it(`${kind}: an empty form has no recommendation`, () => {
      const outcome = calculateRecommendation(kind, answers({}))
      assert.equal(outcome.status, 'incomplete')
      if (outcome.status === 'incomplete') {
        assert.match(outcome.message, /Fyll inn/)
      }
    })
  }

  it('zeroes are not answers', () => {
    const outcome = calculateRecommendation('kontor', answers({ ansatte: 0, arbeidsomrader: 0 }))
    assert.equal(outcome.status, 'incomplete')
  })

  it('a result never contains a zero line', () => {
    const outcome = calculateRecommendation('produksjon', answers({ kontorer: 2 }))
    assert.equal(outcome.status, 'ready')
    if (outcome.status !== 'ready') return
    assert.ok(outcome.recommendation.lines.every((line) => line.quantity > 0))
  })
})

describe('calculator — kontor', () => {
  it('a small office gets one unit and one shared point', () => {
    const input = answers({ ansatte: 8, arbeidsomrader: 1 })
    assert.equal(qty('kontor', input, 'aboks-office'), 1)
    assert.equal(qty('kontor', input, 'aboks-xl'), 1)
  })

  it('work areas drive the number of Office units', () => {
    const input = answers({ ansatte: 20, arbeidsomrader: 6 })
    assert.equal(qty('kontor', input, 'aboks-office'), 6)
  })

  it('headcount alone still produces a sensible number', () => {
    // 60 / 15 = 4
    assert.equal(qty('kontor', answers({ ansatte: 60 }), 'aboks-office'), 4)
  })

  it('does not put a unit in every tiny room of a small company', () => {
    // 40 rooms but 3 people: capped by headcount, not by the room count.
    assert.equal(qty('kontor', answers({ ansatte: 3, arbeidsomrader: 40 }), 'aboks-office'), 3)
  })

  it('keeps one central collection point however big the office is', () => {
    // The XL is where the local units are emptied — it does not multiply with them.
    assert.equal(qty('kontor', answers({ ansatte: 20, arbeidsomrader: 4, etasjer: 3 }), 'aboks-xl'), 1)
    assert.equal(qty('kontor', answers({ ansatte: 240 }), 'aboks-xl'), 1)
    assert.equal(qty('kontor', answers({ ansatte: 15, fellesomrader: 7 }), 'aboks-xl'), 1)
    assert.equal(
      qty(
        'kontor',
        answers({ ansatte: 2000, arbeidsomrader: 120, etasjer: 9, fellesomrader: 20 }),
        'aboks-xl',
      ),
      1,
    )
  })

  it('still scales the local units with the workplace', () => {
    assert.equal(qty('kontor', answers({ ansatte: 300, arbeidsomrader: 42 }), 'aboks-office'), 42)
  })
})

describe('calculator — produksjon', () => {
  it('offices only: no Spesial at all', () => {
    const input = answers({ kontorer: 3 })
    assert.equal(qty('produksjon', input, 'aboks'), 3)
    assert.equal(qty('produksjon', input, 'aboks-spesial'), 0)
    assert.equal(qty('produksjon', input, 'aboks-xl'), 1)
  })

  it('a large facility: local units scale, the central point does not', () => {
    // 500 employees, 30 office areas, 10 production zones, 3 separate areas.
    const input = answers({ ansatte: 500, kontorer: 30, soner: 10, omrader: 3 })
    assert.equal(qty('produksjon', input, 'aboks'), 30)
    assert.equal(qty('produksjon', input, 'aboks-spesial'), 10)
    assert.equal(qty('produksjon', input, 'aboks-xl'), 1)
  })

  it('no office areas means no aBoks, however many people work there', () => {
    const input = answers({ ansatte: 200, kontorer: 0, soner: 8 })
    assert.equal(qty('produksjon', input, 'aboks'), 0)
    assert.equal(qty('produksjon', input, 'aboks-spesial'), 8)
    assert.equal(qty('produksjon', input, 'aboks-xl'), 1)
  })

  it('omits the empty aBoks row from the result entirely', () => {
    const outcome = calculateRecommendation('produksjon', answers({ ansatte: 200, soner: 8 }))
    assert.equal(outcome.status, 'ready')
    if (outcome.status !== 'ready') return
    assert.deepEqual(
      outcome.recommendation.lines.map((line) => line.slug),
      ['aboks-spesial', 'aboks-xl'],
    )
  })

  it('one Spesial per production zone', () => {
    assert.equal(qty('produksjon', answers({ kontorer: 2, soner: 6 }), 'aboks-spesial'), 6)
  })

  it('zero zones means zero Spesial', () => {
    assert.equal(qty('produksjon', answers({ ansatte: 80, kontorer: 4, soner: 0 }), 'aboks-spesial'), 0)
  })

  it('headcount cannot flood a plant with office units', () => {
    // 500 / 25 = 20, but two office areas hold at most 2 each.
    assert.equal(qty('produksjon', answers({ ansatte: 500, kontorer: 2 }), 'aboks'), 4)
  })

  it('separate areas and zone counts do not multiply the central point', () => {
    assert.equal(qty('produksjon', answers({ kontorer: 2, soner: 3, omrader: 4 }), 'aboks-xl'), 1)
    assert.equal(qty('produksjon', answers({ kontorer: 4, soner: 18 }), 'aboks-xl'), 1)
  })
})

describe('calculator — skole', () => {
  it('one Office per staff or admin area', () => {
    assert.equal(qty('skole', answers({ larerrom: 3 }), 'aboks-office'), 3)
  })

  it('groups classrooms behind shared collection points', () => {
    // 12 classrooms / 5 = 3, not 12
    assert.equal(qty('skole', answers({ undervisningsrom: 12 }), 'aboks-spesial'), 3)
  })

  it('counts classrooms and common areas together', () => {
    // (14 + 6) / 5 = 4
    assert.equal(qty('skole', answers({ undervisningsrom: 14, fellesomrader: 6 }), 'aboks-spesial'), 4)
  })

  it('never recommends one Spesial per classroom', () => {
    const rooms = 40
    assert.ok(qty('skole', answers({ undervisningsrom: rooms }), 'aboks-spesial') < rooms)
  })

  it('keeps one central collection point however big the school is', () => {
    assert.equal(qty('skole', answers({ larerrom: 2, undervisningsrom: 10, etasjer: 3 }), 'aboks-xl'), 1)
    assert.equal(qty('skole', answers({ larerrom: 6, undervisningsrom: 60 }), 'aboks-xl'), 1)
    assert.equal(
      qty(
        'skole',
        answers({ larerrom: 20, undervisningsrom: 200, fellesomrader: 30, etasjer: 6 }),
        'aboks-xl',
      ),
      1,
    )
  })

  it('still scales the local units with the school', () => {
    assert.equal(qty('skole', answers({ larerrom: 20, undervisningsrom: 200 }), 'aboks-office'), 20)
    assert.equal(qty('skole', answers({ larerrom: 20, undervisningsrom: 200 }), 'aboks-spesial'), 40)
  })
})

describe('calculator — borettslag', () => {
  it('20 apartments in one entrance', () => {
    const input = answers({ leiligheter: 20, oppganger: 1 }, { boligtype: BORETTSLAG_PROPERTY.oneBuilding })
    assert.equal(qty('borettslag', input, 'aboks'), 20)
    assert.equal(qty('borettslag', input, 'aboks-xl'), 1)
  })

  it('48 apartments across 3 entrances', () => {
    const input = answers({ leiligheter: 48, oppganger: 3 }, { boligtype: BORETTSLAG_PROPERTY.oneBuilding })
    assert.equal(qty('borettslag', input, 'aboks'), 48)
    assert.equal(qty('borettslag', input, 'aboks-xl'), 3)
  })

  it('defaults to one shared point when no entrances are given', () => {
    assert.equal(qty('borettslag', answers({ leiligheter: 12 }), 'aboks-xl'), 1)
  })

  it('several buildings: entrances and buildings do not add up', () => {
    // 4 entrances counted across 2 buildings is 4 points, not 6.
    const input = answers(
      { leiligheter: 60, oppganger: 4, bygg: 2 },
      { boligtype: BORETTSLAG_PROPERTY.severalBuildings },
    )
    assert.equal(qty('borettslag', input, 'aboks-xl'), 4)
  })

  it('several buildings with no entrance count uses the buildings', () => {
    const input = answers({ leiligheter: 60, bygg: 3 }, { boligtype: BORETTSLAG_PROPERTY.severalBuildings })
    assert.equal(qty('borettslag', input, 'aboks-xl'), 3)
  })

  it('rekkehus: one point per residential group', () => {
    const input = answers({ leiligheter: 30, boliggrupper: 4 }, { boligtype: BORETTSLAG_PROPERTY.rekkehus })
    assert.equal(qty('borettslag', input, 'aboks-xl'), 4)
  })

  it('rekkehus without groups asks for more rather than guessing', () => {
    const input = answers({ leiligheter: 30 }, { boligtype: BORETTSLAG_PROPERTY.rekkehus })
    const outcome = calculateRecommendation('borettslag', input)
    assert.equal(outcome.status, 'ready')
    if (outcome.status !== 'ready') return
    assert.equal(qty('borettslag', input, 'aboks'), 30)
    assert.equal(qty('borettslag', input, 'aboks-xl'), 0)
    assert.match(outcome.recommendation.pending ?? '', /boliggrupper/)
  })
})

describe('calculator — central versus distributed collection', () => {
  it('a workplace has one central point; a borettslag has one per entrance', () => {
    const workplace = qty(
      'kontor',
      answers({ ansatte: 300, arbeidsomrader: 30, etasjer: 5 }),
      'aboks-xl',
    )
    const housing = qty(
      'borettslag',
      answers({ leiligheter: 48, oppganger: 3 }, { boligtype: BORETTSLAG_PROPERTY.oneBuilding }),
      'aboks-xl',
    )
    assert.equal(workplace, 1)
    assert.equal(housing, 3)
  })

  it('says which kind of point it is, in words', () => {
    const office = calculateRecommendation('kontor', answers({ ansatte: 30, arbeidsomrader: 4 }))
    const housing = calculateRecommendation(
      'borettslag',
      answers({ leiligheter: 48, oppganger: 3 }, { boligtype: BORETTSLAG_PROPERTY.oneBuilding }),
    )
    assert.equal(office.status, 'ready')
    assert.equal(housing.status, 'ready')
    if (office.status !== 'ready' || housing.status !== 'ready') return

    const xlNote = (lines: { slug: string; note: string }[]) =>
      lines.find((line) => line.slug === 'aboks-xl')?.note ?? ''
    assert.match(xlNote(office.recommendation.lines), /sentralt/i)
    assert.match(xlNote(housing.recommendation.lines), /oppgang/i)
  })
})

describe('calculator — the explanation', () => {
  it('names only what was answered', () => {
    const outcome = calculateRecommendation(
      'borettslag',
      answers({ leiligheter: 48, oppganger: 3 }, { boligtype: BORETTSLAG_PROPERTY.oneBuilding }),
    )
    assert.equal(outcome.status, 'ready')
    if (outcome.status !== 'ready') return
    assert.equal(outcome.recommendation.basis, 'Basert på 48 leiligheter og 3 oppganger.')
  })

  it('uses the singular for one', () => {
    const outcome = calculateRecommendation('kontor', answers({ ansatte: 1 }))
    assert.equal(outcome.status, 'ready')
    if (outcome.status !== 'ready') return
    assert.equal(outcome.recommendation.basis, 'Basert på 1 ansatt.')
  })

  it('never exposes a formula', () => {
    const outcome = calculateRecommendation('skole', answers({ larerrom: 2, undervisningsrom: 12 }))
    assert.equal(outcome.status, 'ready')
    if (outcome.status !== 'ready') return
    const text = [outcome.recommendation.basis, ...outcome.recommendation.lines.map((l) => l.note)].join(' ')
    assert.doesNotMatch(text, /ceil|\/ ?\d|max\(/)
  })
})

describe('calculator — the handoff link', () => {
  const ready = calculateRecommendation(
    'borettslag',
    answers({ leiligheter: 48, oppganger: 3 }, { boligtype: BORETTSLAG_PROPERTY.oneBuilding }),
  )

  it('carries every recommended quantity, named by product slug', () => {
    assert.equal(ready.status, 'ready')
    if (ready.status !== 'ready') return
    assert.equal(
      recommendationHref(ready.recommendation),
      '/bedrifter/borettslagspakke?aboks=48&aboks-xl=3',
    )
  })

  it('lands on the configurator, quantities intact — the primary action', () => {
    assert.equal(ready.status, 'ready')
    if (ready.status !== 'ready') return
    assert.equal(
      recommendationHref(ready.recommendation, 'konfigurer'),
      '/bedrifter/borettslagspakke?aboks=48&aboks-xl=3#konfigurer',
    )
  })

  it('keeps the quantities when pointing at the inquiry form', () => {
    assert.equal(ready.status, 'ready')
    if (ready.status !== 'ready') return
    assert.equal(
      recommendationHref(ready.recommendation, 'foresporsel'),
      '/bedrifter/borettslagspakke?aboks=48&aboks-xl=3#foresporsel',
    )
  })

  it('builds the same shape for every kind, with no special case', () => {
    const cases: [SolutionKind, CalculatorAnswers, string][] = [
      [
        'skole',
        answers({ larerrom: 5, undervisningsrom: 40 }),
        '/bedrifter/skolepakke?aboks-office=5&aboks-spesial=8&aboks-xl=1#konfigurer',
      ],
      [
        'produksjon',
        answers({ ansatte: 500, kontorer: 30, soner: 10, omrader: 3 }),
        '/bedrifter/produksjonspakke?aboks=30&aboks-spesial=10&aboks-xl=1#konfigurer',
      ],
      [
        'kontor',
        answers({ ansatte: 60, arbeidsomrader: 6 }),
        '/bedrifter/kontorpakke?aboks-office=6&aboks-xl=1#konfigurer',
      ],
      [
        'borettslag',
        answers({ leiligheter: 48, oppganger: 3 }, { boligtype: BORETTSLAG_PROPERTY.oneBuilding }),
        '/bedrifter/borettslagspakke?aboks=48&aboks-xl=3#konfigurer',
      ],
    ]

    for (const [kind, input, expected] of cases) {
      const outcome = calculateRecommendation(kind, input)
      assert.equal(outcome.status, 'ready', kind)
      if (outcome.status !== 'ready') continue
      assert.equal(recommendationHref(outcome.recommendation, 'konfigurer'), expected, kind)
    }
  })

  it('points every kind at a solution page that exists and configures those products', () => {
    for (const [kind, solution] of Object.entries(CALCULATOR_SOLUTIONS)) {
      const content = solutionPageContent(solution.solutionSlug)
      assert.ok(content, `${kind} points at a written solution page`)
      for (const slug of Object.keys(solution.productNames)) {
        assert.ok(
          content.configurator.productSlugs.includes(slug),
          `${kind} recommends ${slug}, which ${solution.solutionSlug} must configure`,
        )
      }
    }
  })
})
