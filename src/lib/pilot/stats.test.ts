import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computePilotStats, modelOptions, responsesOverTime, type EvaluationRecord, type QuestionSummary } from './stats'
import { compareModels, compareProjects } from './comparison'
import { evaluationsCsv } from './csv'
import { modelFromAnswers, validateAnswers } from './answers'
import { resolvePublicQuestions, type QuestionConfig, type QuestionnaireSnapshot } from './questionnaire'
import { defaultQuestions } from './defaultQuestionnaire'

const MODELS = [
  { id: 1, title: 'aBoks Vegg' },
  { id: 2, title: 'aBoks Mini' },
]

function snapshotFor(version = 1, questions = defaultQuestions()): QuestionnaireSnapshot {
  return { version, intro: '', closingMessage: '', questions: resolvePublicQuestions(questions, MODELS) }
}

/**
 * The default questionnaire as it was saved before the six universal categories: the old category
 * per question, and no «Ingen produkterfaring» flag (the frequency category carried that meaning).
 */
function legacyQuestions(): QuestionConfig[] {
  const old: Record<string, string> = {
    brukssted: 'location',
    modell: 'model',
    bruksfrekvens: 'frequency',
    brukervennlighet: 'usability',
    nytte: 'usefulness',
    organisering: 'organization',
    fortsette: 'continue',
    forbedringer: 'improvements',
    kommentarer: 'comments',
    rom: 'room',
  }
  return defaultQuestions().map((q) => ({
    ...q,
    statKey: old[q.questionId!],
    options: q.options?.map(({ noProductExperience: _, ...o }) => o),
  }))
}

/** A snapshot as stored before the «Ingen produkterfaring» flag existed: no flag on any option. */
function preFlag(snapshot: QuestionnaireSnapshot): QuestionnaireSnapshot {
  return {
    ...snapshot,
    questions: snapshot.questions.map((q) => ({ ...q, options: q.options.map(({ noProductExperience: _, ...o }) => o) })),
  }
}

let seq = 0
/** Builds a record exactly the way the submission path stores one. */
function evaluation(
  answers: Record<string, string | string[]>,
  opts: { projectId?: number; at?: string; snapshot?: QuestionnaireSnapshot } = {},
): EvaluationRecord {
  const snapshot = opts.snapshot ?? snapshotFor()
  const raw = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]))
  const result = validateAnswers(snapshot.questions, raw)
  if (!result.ok) throw new Error(`invalid fixture: ${JSON.stringify(result)}`)
  const model = modelFromAnswers(snapshot.questions, result.answers)
  return {
    id: ++seq,
    projectId: opts.projectId ?? 10,
    submittedAt: opts.at ?? '2026-10-20T10:00:00.000Z',
    ...model,
    answers: result.answers,
    snapshot,
  }
}

const base = { brukssted: 'Hitra', modell: 'aBoks Vegg' }

const byId = (qs: QuestionSummary[], id: string) => qs.find((q) => q.questionId === id)!
const counts = (q: QuestionSummary) => Object.fromEntries(q.distribution!.entries.map((e) => [e.label, e.count]))

describe('computePilotStats', () => {
  const records = [
    evaluation({ ...base, bruksfrekvens: 'Daglig', brukervennlighet: '5', nytte: '4', organisering: 'Ja', fortsette: 'Ja', forbedringer: 'Større lokk' }),
    evaluation({ ...base, modell: 'aBoks Mini', bruksfrekvens: 'Ukentlig', brukervennlighet: '3', nytte: '2', organisering: 'Delvis', fortsette: 'Kanskje' }),
    // «Ikke brukt ennå» is marked «Ingen produkterfaring»: its ratings stay out of every average.
    evaluation({ ...base, bruksfrekvens: 'Ikke brukt ennå', brukervennlighet: '1', nytte: '1', organisering: 'Nei', fortsette: 'Ja' }),
    // «Vet ikke» is counted but kept out of the organisation share's base.
    evaluation({ ...base, modell: 'Flere modeller', bruksfrekvens: 'Daglig', organisering: 'Vet ikke', fortsette: 'Nei', kommentarer: 'Fint!' }),
    // Nothing optional answered.
    evaluation({ ...base }),
  ]
  const s = computePilotStats(records)

  it('counts responses (submissions, not people)', () => {
    assert.equal(s.totalResponses, 5)
    assert.equal(s.withoutProductExperience, 1)
  })

  it('rating questions: average, distribution and count over valid, applicable answers only', () => {
    const usability = byId(s.questions, 'brukervennlighet')
    assert.equal(usability.rating!.average, 4, '(5 + 3) / 2 — the «Ikke brukt ennå» 1 and unanswered ones are excluded')
    assert.equal(usability.rating!.count, 2)
    assert.equal(usability.answered, 3, 'answered still counts the left-out rating')
    assert.deepEqual(
      usability.rating!.distribution.map((d) => d.count),
      [0, 0, 1, 0, 1],
    )
    assert.equal(byId(s.questions, 'nytte').rating!.average, 3)
    assert.equal(usability.distribution, null)
    assert.equal(usability.written, null)
  })

  it('pools every applicable rating for the overview card', () => {
    assert.equal(s.ratings.count, 4)
    assert.equal(s.ratings.average, 3.5)
    assert.equal(s.ratings.questions, 2)
  })

  it('single choice: count and share per option, kept-out options outside the base', () => {
    const org = byId(s.questions, 'organisering')
    // «organisering» has a «Positivt svar» option, so it is evaluating: the non-user's «Nei» is
    // stored and counted as answered, but kept out of the shares.
    assert.deepEqual(counts(org), { Ja: 1, Delvis: 1, Nei: 0, 'Vet ikke': 1 })
    assert.equal(org.answered, 4)
    assert.equal(org.withoutExperience, 1)
    assert.equal(org.distribution!.base, 2)
    assert.equal(org.distribution!.entries.find((e) => e.label === 'Ja')!.share, 1 / 2)
    assert.equal(org.distribution!.entries.find((e) => e.label === 'Vet ikke')!.share, null)

    const cont = byId(s.questions, 'fortsette')
    assert.equal(cont.answered, 4)
    assert.equal(cont.withoutExperience, 1)
    assert.equal(cont.distribution!.positiveShare, 1 / 3)
    // Descriptive questions keep the non-user's answer.
    assert.equal(byId(s.questions, 'bruksfrekvens').withoutExperience, 0)
    assert.equal(byId(s.questions, 'modell').withoutExperience, 0)
  })

  it('distributes models from the stored model, and frequency as a plain single-choice question', () => {
    const models = Object.fromEntries(s.models.entries.map((e) => [e.label, e.count]))
    assert.deepEqual(models, { 'aBoks Vegg': 3, 'aBoks Mini': 1, 'Flere modeller': 1 })
    assert.deepEqual(counts(byId(s.questions, 'bruksfrekvens')), { Daglig: 2, Ukentlig: 1, 'Noen få ganger': 0, 'Ikke brukt ennå': 1 })
  })

  it('text questions: lists the written answers, no averages', () => {
    assert.deepEqual(byId(s.questions, 'forbedringer').written!.map((w) => w.text), ['Større lokk'])
    assert.deepEqual(byId(s.questions, 'kommentarer').written!.map((w) => w.text), ['Fint!'])
    assert.equal(byId(s.questions, 'brukssted').written!.length, 5)
    assert.equal(byId(s.questions, 'brukssted').rating, null)
    assert.equal(s.writtenCount, 7)
  })

  it('groups questions under the six categories in fixed order, leaving empty ones out', () => {
    assert.deepEqual(
      s.groups.map((g) => [g.label, g.questions.map((q) => q.questionId)]),
      [
        ['Bruk og erfaring', ['brukssted', 'modell', 'bruksfrekvens', 'rom']],
        ['Brukervennlighet', ['brukervennlighet']],
        ['Nytte og effekt', ['nytte', 'organisering']],
        ['Anbefaling og videre bruk', ['fortsette']],
        ['Forbedringer og kommentarer', ['forbedringer', 'kommentarer']],
      ],
    )
  })

  it('handles an empty set', () => {
    const empty = computePilotStats([])
    assert.equal(empty.totalResponses, 0)
    assert.equal(empty.ratings.average, null)
    assert.deepEqual(empty.questions, [])
    assert.deepEqual(empty.groups, [])
    assert.deepEqual(empty.timeline, [])
  })
})

describe('questions are independent of categories', () => {
  const custom: QuestionConfig[] = [
    { questionId: 'trivsel', type: 'rating', label: 'Hvor fornøyd er du?' },
    { questionId: 'ryddig', type: 'rating', label: 'Er det ryddigere nå?', statKey: 'benefit' },
    { questionId: 'tid', type: 'rating', label: 'Sparer du tid?', statKey: 'benefit' },
    {
      questionId: 'hvor',
      type: 'multipleChoice',
      label: 'Hvor brukes den?',
      statKey: 'none',
      options: [{ label: 'Kontor' }, { label: 'Verksted' }, { label: 'Lager' }, { label: 'Vet ikke', excludeFromAverages: true }],
    },
    { questionId: 'anbefale', type: 'yesNo', label: 'Vil du anbefale aBoks?', statKey: 'recommendation' },
    { questionId: 'annet', type: 'shortText', label: 'Noe mer?' },
  ]
  const snap = snapshotFor(1, custom)
  const records = [
    evaluation({ trivsel: '5', ryddig: '4', tid: '2', hvor: ['Kontor', 'Verksted'], anbefale: 'Ja', annet: 'Bra' }, { snapshot: snap }),
    evaluation({ trivsel: '3', ryddig: '5', hvor: ['Kontor'], anbefale: 'Nei' }, { snapshot: snap }),
    evaluation({ hvor: ['Vet ikke'] }, { snapshot: snap }),
  ]
  const s = computePilotStats(records)

  it('questions without a category get full statistics under «Andre spørsmål»', () => {
    const other = s.groups.find((g) => g.category === null)!
    assert.equal(other.label, 'Andre spørsmål')
    assert.deepEqual(other.questions.map((q) => q.questionId), ['trivsel', 'hvor', 'annet'])
    assert.equal(byId(s.questions, 'trivsel').rating!.average, 4)
    assert.deepEqual(byId(s.questions, 'annet').written!.map((w) => w.text), ['Bra'])
  })

  it('two questions sharing a category keep separate statistics', () => {
    const benefit = s.groups.find((g) => g.category === 'benefit')!
    assert.deepEqual(benefit.questions.map((q) => [q.questionId, q.rating!.average, q.rating!.count]), [
      ['ryddig', 4.5, 2],
      ['tid', 2, 1],
    ])
  })

  it('multiple choice: each option as a share of answers, so shares may exceed 100 % in total', () => {
    const q = byId(s.questions, 'hvor')
    assert.deepEqual(counts(q), { Kontor: 2, Verksted: 1, Lager: 0, 'Vet ikke': 1 })
    assert.equal(q.distribution!.answered, 3)
    assert.equal(q.distribution!.base, 2, 'an answer of only «Vet ikke» is outside the base')
    assert.deepEqual(
      q.distribution!.entries.map((e) => e.share),
      [1, 0.5, 0, null],
    )
  })

  it('Ja / Nei: counts and shares like any single-answer question', () => {
    assert.deepEqual(counts(byId(s.questions, 'anbefale')), { Ja: 1, Nei: 1 })
  })

  it('a question id reused for another type is a separate question', () => {
    const v2 = snapshotFor(2, [{ questionId: 'trivsel', type: 'shortText', label: 'Beskriv trivselen' }])
    const both = computePilotStats([...records, evaluation({ trivsel: 'God' }, { snapshot: v2, at: '2026-10-25T10:00:00Z' })])
    const trivsel = both.questions.filter((q) => q.questionId === 'trivsel')
    assert.deepEqual(trivsel.map((q) => [q.type, q.answered]), [
      ['rating', 2],
      ['shortText', 1],
    ])
  })
})

describe('rating development over time', () => {
  it('averages per Oslo month from the first to the last, gaps left empty', () => {
    const s = computePilotStats([
      evaluation({ ...base, brukervennlighet: '2' }, { at: '2026-08-10T10:00:00Z' }),
      evaluation({ ...base, brukervennlighet: '4' }, { at: '2026-08-20T10:00:00Z' }),
      // 22:30 UTC on 31 Oct is already November in Oslo.
      evaluation({ ...base, brukervennlighet: '5' }, { at: '2026-10-31T23:30:00Z' }),
    ])
    assert.deepEqual(
      byId(s.questions, 'brukervennlighet').ratingTrend!.map((p) => [p.key, p.average, p.count]),
      [
        ['2026-08', 3, 2],
        ['2026-09', null, 0],
        ['2026-10', null, 0],
        ['2026-11', 5, 1],
      ],
    )
  })
})

describe('historical integrity', () => {
  it('reads each evaluation through its own snapshot, so later edits do not change old answers', () => {
    const v1 = snapshotFor(1)
    const old = evaluation({ ...base, brukervennlighet: '2' }, { snapshot: v1, at: '2026-10-01T10:00:00Z' })

    // Version 2: the usability question is reworded (same id) and moved to another category.
    const edited = defaultQuestions()
    edited[3] = { ...edited[3]!, label: 'Hvor lett er aBoks å bruke?', statKey: 'satisfaction' }
    const v2 = snapshotFor(2, edited)
    const fresh = evaluation({ ...base, brukervennlighet: '4' }, { snapshot: v2, at: '2026-10-10T10:00:00Z' })

    const s = computePilotStats([old, fresh])
    const q = byId(s.questions, 'brukervennlighet')
    assert.equal(q.rating!.average, 3, 'both versions are the same question (same id and type)')
    assert.equal(q.label, 'Hvor lett er aBoks å bruke?', 'newest wording')
    assert.equal(q.category, 'satisfaction', 'newest category')
    assert.equal(old.answers.find((a) => a.questionId === 'brukervennlighet')!.questionLabel, 'Hvor enkelt er produktet å bruke?')
  })

  it('legacy snapshots: old categories group under the new ones and keep their exclusion rules', () => {
    const legacy = preFlag(snapshotFor(1, legacyQuestions()))
    const records = [
      evaluation({ ...base, bruksfrekvens: 'Daglig', brukervennlighet: '4', organisering: 'Ja' }, { snapshot: legacy }),
      // Legacy rule: the «Bruksfrekvens» kept-out option means no product experience; ratings and
      // the «Bedre organisering» answer are left out, «Ønsker å fortsette» still counts.
      evaluation({ ...base, bruksfrekvens: 'Ikke brukt ennå', brukervennlighet: '1', organisering: 'Nei', fortsette: 'Ja' }, { snapshot: legacy }),
    ]
    const s = computePilotStats(records)
    assert.equal(s.withoutProductExperience, 1)
    assert.equal(byId(s.questions, 'brukervennlighet').rating!.average, 4)
    assert.deepEqual(counts(byId(s.questions, 'organisering')), { Ja: 1, Delvis: 0, Nei: 0, 'Vet ikke': 0 })
    assert.equal(byId(s.questions, 'fortsette').distribution!.answered, 1)
    assert.deepEqual(
      s.groups.map((g) => g.label),
      ['Bruk og erfaring', 'Brukervennlighet', 'Nytte og effekt', 'Anbefaling og videre bruk', 'Forbedringer og kommentarer'],
    )
    assert.equal(records[0]!.modelId, 1, 'the model is still found in a legacy snapshot')
  })

  it('legacy and new snapshots of the same questionnaire line up question by question', () => {
    const s = computePilotStats([
      evaluation({ ...base, brukervennlighet: '2' }, { snapshot: preFlag(snapshotFor(1, legacyQuestions())), at: '2026-10-01T10:00:00Z' }),
      evaluation({ ...base, brukervennlighet: '4' }, { snapshot: snapshotFor(2), at: '2026-10-10T10:00:00Z' }),
    ])
    assert.equal(byId(s.questions, 'brukervennlighet').rating!.average, 3)
    assert.equal(s.questions.length, 10)
  })
})

describe('responsesOverTime', () => {
  it('buckets by Oslo day and fills the gaps', () => {
    const points = responsesOverTime([
      // 23:30 UTC on 19 Oct is already 20 Oct in Oslo (UTC+2).
      evaluation(base, { at: '2026-10-19T23:30:00Z' }),
      evaluation(base, { at: '2026-10-20T08:00:00Z' }),
      evaluation(base, { at: '2026-10-22T08:00:00Z' }),
    ])
    assert.deepEqual(points, [
      { date: '2026-10-20', count: 2 },
      { date: '2026-10-21', count: 0 },
      { date: '2026-10-22', count: 1 },
    ])
  })
})


describe('comparisons', () => {
  const records = [
    evaluation({ ...base, brukervennlighet: '5', fortsette: 'Ja' }, { projectId: 1 }),
    evaluation({ ...base, modell: 'aBoks Mini', brukervennlighet: '3', fortsette: 'Nei' }, { projectId: 1 }),
    evaluation({ ...base, brukervennlighet: '4', fortsette: 'Ja' }, { projectId: 2 }),
    // A project with its own questions: nothing in common with the others but the overall split.
    evaluation(
      { egen: '1' },
      { projectId: 3, snapshot: snapshotFor(1, [{ questionId: 'egen', type: 'rating', label: 'Egen skala', statKey: 'usability' }]) },
    ),
  ]

  it('compares projects on the overall split and on rating questions they share by id', () => {
    const { columns, rows } = compareProjects(records, [
      { id: 1, label: 'Hitra kommune' },
      { id: 2, label: 'Hitraskolen' },
      { id: 3, label: 'Bedrift ABC' },
      { id: 4, label: 'Uten svar' },
    ])
    // «egen» shares the «Brukervennlighet» category but is not the same question: no column.
    assert.deepEqual(columns, [{ questionId: 'brukervennlighet', label: 'Hvor enkelt er produktet å bruke?' }])
    assert.deepEqual(
      rows.map((r) => [r.label, r.responses, r.assessed, r.percents, r.ratingAverages]),
      [
        ['Hitra kommune', 2, 4, { positive: 50, neutral: 25, negative: 25 }, [4]],
        ['Hitraskolen', 1, 2, { positive: 100, neutral: 0, negative: 0 }, [4]],
        ['Bedrift ABC', 1, 1, { positive: 0, neutral: 0, negative: 100 }, [null]],
        ['Uten svar', 0, 0, null, [null]],
      ],
    )
  })

  it('compares models by stored model id', () => {
    const { rows } = compareModels(records)
    assert.deepEqual(rows.map((r) => [r.key, r.label, r.responses]), [
      ['id:1', 'aBoks Vegg', 2],
      ['id:2', 'aBoks Mini', 1],
    ])
    assert.deepEqual(modelOptions(records), [
      { key: 'id:1', label: 'aBoks Vegg' },
      { key: 'id:2', label: 'aBoks Mini' },
    ])
  })
})

describe('evaluationsCsv', () => {
  it('writes UTF-8 with BOM, semicolons, one column per question id, and guards formulas', () => {
    const records = [
      evaluation({ ...base, brukervennlighet: '4', forbedringer: '=HYPERLINK("x")' }, { projectId: 1, at: '2026-10-20T08:05:00Z' }),
      evaluation({ ...base, brukssted: 'Skole «Fillan»; 2. etg', fortsette: 'Ja' }, { projectId: 1, at: '2026-10-21T09:00:00Z' }),
    ]
    const csv = evaluationsCsv(records, new Map([[1, { name: 'Hitra kommune', organization: 'Hitra kommune' }]]))
    assert.ok(csv.startsWith('﻿'), 'BOM for Excel')
    const lines = csv.slice(1).trimEnd().split('\r\n')
    assert.equal(lines.length, 3)
    const header = lines[0]!.split(';')
    assert.equal(header[0], '"Evaluering-ID"')
    assert.ok(header.includes('"Hvor har du brukt aBoks?"'))
    assert.ok(header.includes('"Ønsker du å fortsette å bruke aBoks?"'))
    assert.ok(lines[1]!.includes('"2026-10-20 10:05"'), 'Oslo local time')
    assert.ok(lines[1]!.includes(`"'=HYPERLINK(""x"")"`), 'formula is neutralised and quotes doubled')
    assert.ok(lines[2]!.includes('"Skole «Fillan»; 2. etg"'), 'a semicolon inside a quoted value stays one cell')
    assert.ok(lines[1]!.includes(';4;'), 'ratings are numbers')
  })
})

describe('reused question ids (Hitra)', () => {
  // Hitra v9 stored its total-experience rating under the old id «bruksfrekvens»; v10 uses
  // «totalvurdering». Another project's «bruksfrekvens» is the template frequency question.
  const hitraV10 = snapshotFor(10, [
    {
      questionId: 'totalvurdering',
      type: 'rating',
      label: 'Hvordan vurderer du totalopplevelsen med aBoks?',
      scaleMinLabel: 'Svært dårlig',
      scaleMaxLabel: 'Svært god',
    },
  ])
  const hitraV9 = snapshotFor(9, [{ questionId: 'bruksfrekvens', type: 'rating', label: 'Hvordan vurderer du totalopplevelsen med aBoks?' }])

  it('the corrected rating appears as its own 1–5 question under «Andre spørsmål»', () => {
    const s = computePilotStats([
      evaluation({ totalvurdering: '5' }, { projectId: 1, snapshot: hitraV10 }),
      evaluation({ totalvurdering: '4' }, { projectId: 1, snapshot: hitraV10 }),
      evaluation({ ...base, bruksfrekvens: 'Daglig' }, { projectId: 2 }),
    ])
    const q = byId(s.questions, 'totalvurdering')
    assert.equal(q.type, 'rating')
    assert.equal(q.rating!.average, 4.5)
    assert.equal(s.groups.find((g) => g.category === null)!.questions[0]!.questionId, 'totalvurdering')
    assert.deepEqual(counts(byId(s.questions, 'bruksfrekvens')), { Daglig: 1, Ukentlig: 0, 'Noen få ganger': 0, 'Ikke brukt ennå': 0 })
  })

  it('CSV: an id reused for another type gets its own column', () => {
    const csv = evaluationsCsv(
      [
        evaluation({ bruksfrekvens: '5' }, { projectId: 1, snapshot: hitraV9, at: '2026-10-20T08:00:00Z' }),
        evaluation({ ...base, bruksfrekvens: 'Daglig' }, { projectId: 2, at: '2026-10-21T08:00:00Z' }),
      ],
      new Map(),
    )
    const [header, first, second] = csv.slice(1).trimEnd().split('\r\n').map((l) => l.split(';'))
    const total = header!.indexOf('"Hvordan vurderer du totalopplevelsen med aBoks?"')
    const freq = header!.indexOf('"Hvor ofte har du brukt produktet?"')
    assert.ok(total > 0 && freq > 0 && total !== freq)
    assert.equal(first![total], '5')
    assert.equal(first![freq], '""')
    assert.equal(second![freq], '"Daglig"')
    assert.equal(second![total], '""')
  })

  // Hitra v11: the recommendation rating, stored under «rom» until v10, is now «anbefaling».
  const hitraV11 = snapshotFor(11, [
    { questionId: 'totalvurdering', type: 'rating', label: 'Hvordan vurderer du totalopplevelsen med aBoks?', scaleMinLabel: 'Svært dårlig', scaleMaxLabel: 'Svært god', required: true },
    {
      questionId: 'anbefaling',
      type: 'rating',
      label: 'Hvor sannsynlig er det at du vil anbefale aBoks til en kollega eller en annen avdeling?',
      scaleMinLabel: 'Svært lite sannsynlig',
      scaleMaxLabel: 'Svært sannsynlig',
      required: true,
    },
  ])

  it('Hitra v11: «anbefaling» is a 1–5 rating of its own, apart from the template «rom» text question', () => {
    const s = computePilotStats([
      evaluation({ totalvurdering: '4', anbefaling: '5' }, { projectId: 1, snapshot: hitraV11 }),
      evaluation({ totalvurdering: '3', anbefaling: '4' }, { projectId: 1, snapshot: hitraV11 }),
      evaluation({ ...base, rom: 'Lærerværelset' }, { projectId: 2 }),
    ])
    const anbefaling = byId(s.questions, 'anbefaling')
    assert.equal(anbefaling.type, 'rating')
    assert.equal(anbefaling.rating!.average, 4.5)
    assert.equal(anbefaling.rating!.count, 2)
    assert.equal(anbefaling.category, null, 'shown under «Andre spørsmål»')
    assert.deepEqual(byId(s.questions, 'rom').written!.map((w) => w.text), ['Lærerværelset'])
    assert.equal(new Set(hitraV11.questions.map((q) => q.questionId)).size, hitraV11.questions.length, 'ids unique')
  })

  it('Hitra v11 CSV: «anbefaling» and the template «rom» get separate columns', () => {
    const csv = evaluationsCsv(
      [
        evaluation({ totalvurdering: '4', anbefaling: '5' }, { projectId: 1, snapshot: hitraV11, at: '2026-10-29T08:00:00Z' }),
        evaluation({ ...base, rom: 'Lærerværelset' }, { projectId: 2, at: '2026-10-30T08:00:00Z' }),
      ],
      new Map(),
    )
    const [header, first, second] = csv.slice(1).trimEnd().split('\r\n').map((l) => l.split(';'))
    const anbefaling = header!.indexOf('"Hvor sannsynlig er det at du vil anbefale aBoks til en kollega eller en annen avdeling?"')
    const rom = header!.indexOf('"Hvilket rom eller hvilken avdeling har du brukt produktet i?"')
    assert.ok(anbefaling > 0 && rom > 0 && anbefaling !== rom)
    assert.equal(first![anbefaling], '5')
    assert.equal(first![rom], '""')
    assert.equal(second![rom], '"Lærerværelset"')
  })
})
