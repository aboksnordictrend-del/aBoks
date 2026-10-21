import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compareModels, compareProjects, computePilotStats, modelOptions, responsesOverTime, type EvaluationRecord } from './stats'
import { evaluationsCsv } from './csv'
import { modelFromAnswers, validateAnswers } from './answers'
import { resolvePublicQuestions, type QuestionnaireSnapshot } from './questionnaire'
import { defaultQuestions } from './defaultQuestionnaire'

const MODELS = [
  { id: 1, title: 'aBoks Vegg' },
  { id: 2, title: 'aBoks Mini' },
]

function snapshotFor(version = 1, questions = defaultQuestions()): QuestionnaireSnapshot {
  return { version, intro: '', closingMessage: '', questions: resolvePublicQuestions(questions, MODELS) }
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

describe('computePilotStats', () => {
  const records = [
    evaluation({ ...base, bruksfrekvens: 'Daglig', brukervennlighet: '5', nytte: '4', organisering: 'Ja', fortsette: 'Ja', forbedringer: 'Større lokk' }),
    evaluation({ ...base, modell: 'aBoks Mini', bruksfrekvens: 'Ukentlig', brukervennlighet: '3', nytte: '2', organisering: 'Delvis', fortsette: 'Kanskje' }),
    // Not used yet: its ratings and organisation answer must stay out of product-experience figures.
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

  it('averages ratings over valid, applicable answers only', () => {
    assert.equal(s.usability.average, 4, '(5 + 3) / 2 — the «Ikke brukt ennå» 1 and unanswered ones are excluded')
    assert.equal(s.usability.count, 2)
    assert.equal(s.usefulness.average, 3)
    assert.deepEqual(
      s.usability.distribution.map((d) => d.count),
      [0, 0, 1, 0, 1],
    )
  })

  it('computes the organisation share without «Vet ikke» and without non-users', () => {
    const counts = Object.fromEntries(s.organization.entries.map((e) => [e.label, e.count]))
    assert.deepEqual(counts, { Ja: 1, Delvis: 1, Nei: 0, 'Vet ikke': 1 })
    assert.equal(s.organization.answered, 3)
    assert.equal(s.organization.base, 2)
    assert.equal(s.organization.positiveShare, 0.5)
    assert.equal(s.organization.entries.find((e) => e.label === 'Vet ikke')!.share, null)
  })

  it('computes the share wishing to continue from those who answered', () => {
    assert.equal(s.continueUsing.answered, 4)
    assert.equal(s.continueUsing.positiveShare, 0.5)
  })

  it('distributes models and frequency', () => {
    const models = Object.fromEntries(s.models.entries.map((e) => [e.label, e.count]))
    assert.deepEqual(models, { 'aBoks Vegg': 3, 'aBoks Mini': 1, 'Flere modeller': 1 })
    const freq = Object.fromEntries(s.frequency.entries.map((e) => [e.label, e.count]))
    assert.deepEqual(freq, { Daglig: 2, Ukentlig: 1, 'Noen få ganger': 0, 'Ikke brukt ennå': 1 })
  })

  it('collects written feedback, including the free-text location', () => {
    const texts = s.written.map((w) => `${w.category}:${w.text}`).sort()
    assert.ok(texts.includes('improvements:Større lokk'))
    assert.ok(texts.includes('comments:Fint!'))
    assert.equal(texts.filter((t) => t.startsWith('location:')).length, 5)
  })

  it('handles an empty set', () => {
    const empty = computePilotStats([])
    assert.equal(empty.totalResponses, 0)
    assert.equal(empty.usability.average, null)
    assert.equal(empty.continueUsing.positiveShare, null)
    assert.deepEqual(empty.timeline, [])
  })
})

describe('historical integrity', () => {
  it('reads each evaluation through its own snapshot, so later edits do not change old answers', () => {
    const v1 = snapshotFor(1)
    const old = evaluation({ ...base, brukervennlighet: '2' }, { snapshot: v1, at: '2026-10-01T10:00:00Z' })

    // Version 2: the usability question is reworded and its category moved to a new question id.
    const edited = defaultQuestions()
    edited[3] = { ...edited[3]!, questionId: 'brukervennlighet-v2', label: 'Hvor lett er aBoks å bruke?' }
    const v2 = snapshotFor(2, edited)
    const fresh = evaluation({ ...base, 'brukervennlighet-v2': '4' }, { snapshot: v2, at: '2026-10-10T10:00:00Z' })

    const s = computePilotStats([old, fresh])
    assert.equal(s.usability.average, 3, 'both versions count under the same analysis category')
    assert.equal(old.answers.find((a) => a.questionId === 'brukervennlighet')!.questionLabel, 'Hvor enkelt er produktet å bruke?')

    const perQuestion = s.questions.map((q) => q.questionId)
    assert.ok(perQuestion.includes('brukervennlighet') && perQuestion.includes('brukervennlighet-v2'))
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
  ]

  it('compares projects, listing projects without responses too', () => {
    const rows = compareProjects(records, [
      { id: 1, label: 'Hitra kommune' },
      { id: 2, label: 'Hitraskolen' },
      { id: 3, label: 'Bedrift ABC' },
    ])
    assert.deepEqual(
      rows.map((r) => [r.label, r.responses, r.usabilityAverage, r.continuePositiveShare]),
      [
        ['Hitra kommune', 2, 4, 0.5],
        ['Hitraskolen', 1, 4, 1],
        ['Bedrift ABC', 0, null, null],
      ],
    )
  })

  it('compares models by stored model id', () => {
    const rows = compareModels(records)
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
