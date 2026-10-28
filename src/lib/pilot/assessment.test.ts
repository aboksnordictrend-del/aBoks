import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyAnswer,
  classifyEvaluation,
  classifyOption,
  classifyRating,
  computeOverallAssessment,
  percentsSummingTo100,
} from './assessment'
import { computePilotStats, type EvaluationRecord } from './stats'
import { modelFromAnswers, validateAnswers } from './answers'
import { resolvePublicQuestions, type QuestionConfig, type QuestionnaireSnapshot } from './questionnaire'
import { defaultQuestions } from './defaultQuestionnaire'
import { handlePilotAnalytics } from '../../endpoints/pilotAnalytics'

const MODELS = [
  { id: 1, title: 'aBoks' },
  { id: 2, title: 'aBoks XL' },
]

const opt = (label: string, extra: { excludeFromAverages?: boolean; isPositive?: boolean } = {}) => ({
  label,
  excludeFromAverages: extra.excludeFromAverages ?? false,
  isPositive: extra.isPositive ?? false,
})

/** The shape of the live Hitra kommune questionnaire (version 8). */
function hitraQuestions(): QuestionConfig[] {
  return [
    {
      questionId: 'brukssted',
      type: 'singleChoice',
      label: 'Hvor har du brukt aBoks?',
      enabled: true,
      statKey: null,
      options: [opt('Kontor / arbeidsplass'), opt('Møterom'), opt('Annet')],
    },
    {
      questionId: 'modell',
      type: 'singleChoice',
      label: 'Hvilken aBoks-modell har du brukt?',
      enabled: true,
      statKey: 'model',
      optionsSource: 'projectModels',
      options: [opt('Flere modeller', { excludeFromAverages: true }), opt('Vet ikke', { excludeFromAverages: true })],
    },
    {
      questionId: 'bruksfrekvens',
      type: 'singleChoice',
      label: 'Hvor ofte har du brukt produktet?',
      enabled: true,
      statKey: 'frequency',
      options: [opt('Daglig'), opt('Flere ganger i uken'), opt('Har ikke brukt produktet ennå', { excludeFromAverages: true })],
    },
    { questionId: 'brukervennlighet', type: 'rating', label: 'Hvor enkelt er produktet å bruke?', enabled: true, statKey: 'usability' },
    { questionId: 'nytte', type: 'rating', label: 'Hvor nyttig er aBoks på arbeidsplassen?', enabled: true, statKey: 'usefulness' },
    {
      questionId: 'organisering',
      type: 'singleChoice',
      label: 'Har aBoks bidratt til bedre organisering av batterier?',
      enabled: true,
      statKey: 'organization',
      options: [opt('Ja', { isPositive: true }), opt('Delvis'), opt('Nei'), opt('Vet ikke', { excludeFromAverages: true })],
    },
    {
      questionId: 'fortsette',
      type: 'singleChoice',
      label: 'Ønsker du å fortsette å bruke aBoks?',
      enabled: true,
      statKey: 'continue',
      options: [opt('Ja', { isPositive: true }), opt('Kanskje'), opt('Nei')],
    },
    {
      questionId: 'rom',
      type: 'rating',
      label: 'Hvor sannsynlig er det at du vil anbefale aBoks til en kollega eller en annen avdeling?',
      enabled: true,
      statKey: null,
    },
    { questionId: 'forbedringer', type: 'longText', label: 'Hva bør forbedres?', enabled: true, statKey: 'improvements' },
  ]
}

function snapshotOf(questions: QuestionConfig[], version = 8): QuestionnaireSnapshot {
  return { version, intro: '', closingMessage: '', questions: resolvePublicQuestions(questions, MODELS) }
}

/** A snapshot as stored before the «Ingen produkterfaring» flag existed: no flag on any option. */
function preFlag(snapshot: QuestionnaireSnapshot): QuestionnaireSnapshot {
  return {
    ...snapshot,
    questions: snapshot.questions.map((q) => ({
      ...q,
      options: q.options.map(({ noProductExperience: _, ...o }) => o),
    })),
  }
}

/** Hitra v8 exactly as its evaluations stored it (before the flag). */
const HITRA = preFlag(snapshotOf(hitraQuestions()))

let seq = 0
/** Builds a record exactly the way the submission path stores one. */
function evaluation(
  answers: Record<string, string | string[]>,
  opts: { projectId?: number; at?: string; snapshot?: QuestionnaireSnapshot } = {},
): EvaluationRecord {
  const snapshot = opts.snapshot ?? HITRA
  const raw = new Map(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]))
  const result = validateAnswers(snapshot.questions, raw)
  if (!result.ok) throw new Error(`invalid fixture: ${JSON.stringify(result)}`)
  return {
    id: ++seq,
    projectId: opts.projectId ?? 1,
    submittedAt: opts.at ?? '2026-10-20T10:00:00.000Z',
    ...modelFromAnswers(snapshot.questions, result.answers),
    answers: result.answers,
    snapshot,
  }
}

const full = {
  brukssted: 'Møterom',
  modell: 'aBoks',
  bruksfrekvens: 'Daglig',
  brukervennlighet: '5',
  nytte: '4',
  organisering: 'Ja',
  fortsette: 'Ja',
  rom: '5',
  forbedringer: 'Ja, større lokk', // free text that reads positive must not count
}

describe('classification rules', () => {
  it('rating scale: 4–5 positive, 3 neutral, 1–2 negative, anything else unclassified', () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(classifyRating), ['negative', 'negative', 'neutral', 'positive', 'positive'])
    for (const bad of [0, 6, 2.5, '4', null, undefined]) assert.equal(classifyRating(bad), null)
  })

  it('choice options: positive flag, exact answer words, exclusions', () => {
    const o = (label: string, isPositive = false, excludeFromAverages = false) => ({ value: label, label, isPositive, excludeFromAverages })
    assert.equal(classifyOption(o('Ja', true)), 'positive')
    assert.equal(classifyOption(o('Delvis')), 'neutral')
    assert.equal(classifyOption(o('Kanskje')), 'neutral')
    assert.equal(classifyOption(o('Nei')), 'negative')
    assert.equal(classifyOption(o('Nei.')), 'negative', 'trailing punctuation is normalised')
    assert.equal(classifyOption(o('Vet ikke', false, true)), null)
    assert.equal(classifyOption(o('Vet ikke')), null, 'unknown word without a mark is not guessed')
    assert.equal(classifyOption(o('Ikke relevant')), null)
    assert.equal(classifyOption(o('Nei, ikke ennå')), null, 'no substring matching')
    assert.equal(classifyOption(o('Ja', true, true)), null, 'kept out of shares wins over positive')
    assert.equal(classifyOption(o('Nei', true)), null, 'label contradicting its positive mark is left out')
    assert.equal(classifyOption(o('Ja')), null, 'an unmarked «Ja» is not overruled into positive')
    assert.equal(classifyOption(o('Veldig fornøyd', true)), 'positive', 'positive mark is authoritative')
  })

  it('only evaluating questions count — descriptive ones never do, whatever the answer text', () => {
    const byId = new Map(HITRA.questions.map((q) => [q.questionId, q]))
    const a = (questionId: string, value: string | number) => ({
      questionId,
      questionLabel: '',
      questionType: byId.get(questionId)!.type,
      value,
      displayValue: String(value),
    })
    assert.equal(classifyAnswer(byId.get('brukssted')!, a('brukssted', 'Møterom')), null)
    assert.equal(classifyAnswer(byId.get('modell')!, a('modell', 'aBoks')), null)
    assert.equal(classifyAnswer(byId.get('bruksfrekvens')!, a('bruksfrekvens', 'Daglig')), null)
    assert.equal(classifyAnswer(byId.get('forbedringer')!, a('forbedringer', 'Ja')), null)
    assert.equal(classifyAnswer(byId.get('rom')!, a('rom', 2)), 'negative', 'uncategorised rating still counts')
    assert.equal(classifyAnswer(byId.get('organisering')!, a('organisering', 'Ukjent alternativ')), null)
    assert.equal(classifyAnswer(byId.get('organisering')!, undefined), null)
  })

  it('a Ja / Nei question counts only in an evaluating category', () => {
    const yesNo = (statKey: QuestionConfig['statKey']) =>
      snapshotOf([{ questionId: 'jn', type: 'yesNo', label: 'Spørsmål', enabled: true, statKey }]).questions[0]!
    const ans = { questionId: 'jn', questionLabel: '', questionType: 'yesNo' as const, value: 'Ja', displayValue: 'Ja' }
    assert.equal(classifyAnswer(yesNo('continue'), ans), 'positive')
    assert.equal(classifyAnswer(yesNo(null), ans), null)
  })

  it('a multiple-choice question never counts', () => {
    const q = snapshotOf([
      { questionId: 'mc', type: 'multipleChoice', label: 'X', enabled: true, options: [opt('Ja', { isPositive: true }), opt('Nei')] },
    ]).questions[0]!
    assert.equal(classifyAnswer(q, { questionId: 'mc', questionLabel: '', questionType: 'multipleChoice', value: ['Ja'], displayValue: 'Ja' }), null)
  })

  it('historical snapshot without product experience: ratings and organisation left out, «fortsette» still counts', () => {
    const r = evaluation({ ...full, bruksfrekvens: 'Har ikke brukt produktet ennå', organisering: 'Nei', fortsette: 'Kanskje', rom: '1' })
    assert.deepEqual(classifyEvaluation(r), ['neutral'])
  })

  it('the same legacy questionnaire snapshotted today: every evaluating answer is left out', () => {
    const today = snapshotOf(hitraQuestions(), 9)
    assert.equal(today.questions.find((q) => q.questionId === 'bruksfrekvens')!.options[2]!.noProductExperience, true)
    const r = evaluation(
      { ...full, bruksfrekvens: 'Har ikke brukt produktet ennå', organisering: 'Nei', fortsette: 'Kanskje', rom: '1' },
      { snapshot: today },
    )
    assert.deepEqual(classifyEvaluation(r), [])
  })

  it('an evaluation without a snapshot contributes nothing', () => {
    assert.deepEqual(classifyEvaluation({ ...evaluation(full), snapshot: null }), [])
  })
})

describe('classification without categories (universal categories and «Ingen kategori»)', () => {
  const choice = (statKey: QuestionConfig['statKey'], options: ReturnType<typeof opt>[], type: 'singleChoice' | 'dropdown' = 'singleChoice') =>
    snapshotOf([{ questionId: 'c', type, label: 'Spørsmål', enabled: true, statKey, options }]).questions[0]!
  const ans = (value: string) => ({ questionId: 'c', questionLabel: '', questionType: 'singleChoice' as const, value, displayValue: value })
  const evaluating = [opt('Ja', { isPositive: true }), opt('Delvis'), opt('Nei'), opt('Vet ikke', { excludeFromAverages: true })]

  it('a choice question with a «Positivt svar» option counts, whatever its category or none', () => {
    for (const statKey of ['benefit', 'recommendation', 'satisfaction', 'none', null] as const) {
      const q = choice(statKey, evaluating)
      assert.deepEqual(
        ['Ja', 'Delvis', 'Nei', 'Vet ikke'].map((v) => classifyAnswer(q, ans(v))),
        ['positive', 'neutral', 'negative', null],
        String(statKey),
      )
    }
    assert.equal(classifyAnswer(choice('usage', evaluating, 'dropdown'), ans('Nei')), 'negative')
  })

  it('a choice question without a «Positivt svar» option never counts — its labels are not guessed', () => {
    for (const statKey of ['benefit', 'recommendation', 'none', null] as const) {
      const q = choice(statKey, [opt('Ja'), opt('Nei')])
      assert.equal(classifyAnswer(q, ans('Ja')), null, String(statKey))
      assert.equal(classifyAnswer(q, ans('Nei')), null, String(statKey))
    }
  })

  it('options that are not exact answer words stay unclassified even in an evaluating question', () => {
    const q = choice('benefit', [opt('Daglig', { isPositive: true }), opt('Ukentlig'), opt('Aldri')])
    assert.equal(classifyAnswer(q, ans('Daglig')), 'positive')
    assert.equal(classifyAnswer(q, ans('Ukentlig')), null)
    assert.equal(classifyAnswer(q, ans('Aldri')), null)
  })

  it('a Ja / Nei question counts when marked «Telles i samlet vurdering» (or with a legacy evaluating category)', () => {
    const yesNo = (statKey: QuestionConfig['statKey'], countInAssessment?: boolean) =>
      snapshotOf([{ questionId: 'c', type: 'yesNo', label: 'Spørsmål', enabled: true, statKey, countInAssessment }]).questions[0]!
    // Unmarked: never, whatever the category.
    assert.equal(classifyAnswer(yesNo('recommendation'), ans('Ja')), null)
    assert.equal(classifyAnswer(yesNo('none'), ans('Ja')), null)
    // Marked: Ja positive, Nei negative, in any category or none.
    for (const statKey of ['recommendation', 'satisfaction', 'none', null] as const) {
      assert.equal(classifyAnswer(yesNo(statKey, true), ans('Ja')), 'positive', String(statKey))
      assert.equal(classifyAnswer(yesNo(statKey, true), ans('Nei')), 'negative', String(statKey))
    }
    // Historical snapshots: the legacy evaluating categories still count without the mark.
    assert.equal(classifyAnswer(yesNo('organization'), ans('Nei')), 'negative')
    assert.equal(classifyAnswer(yesNo('continue'), ans('Ja')), 'positive')
  })

  it('the Ja / Nei mark is ignored on other question types', () => {
    const q = snapshotOf([{ questionId: 'c', type: 'singleChoice', label: 'S', countInAssessment: true, options: [opt('Ja'), opt('Nei')] }]).questions[0]!
    assert.equal(q.countInAssessment, undefined)
    assert.equal(classifyAnswer(q, ans('Ja')), null)
  })

  it('ratings count in every category and without one', () => {
    const rating = (statKey: QuestionConfig['statKey']) =>
      snapshotOf([{ questionId: 'r', type: 'rating', label: 'Skala', enabled: true, statKey }]).questions[0]!
    const r = { questionId: 'r', questionLabel: '', questionType: 'rating' as const, value: 4, displayValue: '4' }
    for (const statKey of ['usage', 'usability', 'benefit', 'satisfaction', 'recommendation', 'feedback', 'none', null] as const) {
      assert.equal(classifyAnswer(rating(statKey), r), 'positive', String(statKey))
    }
  })

  it('the default questionnaire: same overall split as before the new categories', () => {
    const answers = { brukssted: 'Rådhuset', modell: 'aBoks', bruksfrekvens: 'Daglig', brukervennlighet: '5', nytte: '3', organisering: 'Delvis', fortsette: 'Nei', forbedringer: 'Ja' }
    const fresh = evaluation(answers, { snapshot: snapshotOf(defaultQuestions(), 2) })
    const legacyQuestions = defaultQuestions().map((q) => ({
      ...q,
      statKey: ({ brukervennlighet: 'usability', nytte: 'usefulness', organisering: 'organization', fortsette: 'continue', bruksfrekvens: 'frequency', modell: 'model' } as Record<string, string>)[q.questionId!] ?? null,
      options: q.options?.map(({ noProductExperience: _, ...o }) => o),
    }))
    const legacy = evaluation(answers, { snapshot: snapshotOf(legacyQuestions, 1) })
    assert.deepEqual(classifyEvaluation(fresh), ['positive', 'neutral', 'neutral', 'negative'])
    assert.deepEqual(classifyEvaluation(legacy), classifyEvaluation(fresh))
  })

  it('«Ingen produkterfaring»: no rating and no evaluating choice counts; with experience all do', () => {
    const snap = snapshotOf(defaultQuestions(), 2)
    const answers = { brukssted: 'Rådhuset', modell: 'aBoks', brukervennlighet: '1', organisering: 'Nei', fortsette: 'Ja' }
    const without = evaluation({ ...answers, bruksfrekvens: 'Ikke brukt ennå' }, { snapshot: snap })
    const withExperience = evaluation({ ...answers, bruksfrekvens: 'Daglig' }, { snapshot: snap })
    assert.deepEqual(classifyEvaluation(without), [])
    assert.deepEqual(classifyEvaluation(withExperience), ['negative', 'negative', 'positive'])
    const a = computeOverallAssessment([without, withExperience])
    assert.equal(a.total, 3)
    assert.equal(a.evaluations, 1)
  })

  it('«Ingen produkterfaring» works on any single-answer question, in any category or none', () => {
    const qs: QuestionConfig[] = [
      { questionId: 'erfaring', type: 'dropdown', label: 'Har du testet?', statKey: 'none', options: [opt('Ja'), { label: 'Nei, ikke ennå', noProductExperience: true }] },
      { questionId: 'skala', type: 'rating', label: 'Skala', statKey: 'satisfaction' },
      { questionId: 'jn', type: 'yesNo', label: 'Anbefale?', countInAssessment: true },
    ]
    const snap = snapshotOf(qs, 1)
    assert.deepEqual(classifyEvaluation(evaluation({ erfaring: 'Nei, ikke ennå', skala: '5', jn: 'Ja' }, { snapshot: snap })), [])
    assert.deepEqual(classifyEvaluation(evaluation({ erfaring: 'Ja', skala: '5', jn: 'Nei' }, { snapshot: snap })), ['positive', 'negative'])
  })
})

describe('percentsSummingTo100', () => {
  it('keeps exact splits and adjusts rounding so the total is 100', () => {
    assert.deepEqual(percentsSummingTo100({ positive: 70, neutral: 20, negative: 10 }), { positive: 70, neutral: 20, negative: 10 })
    assert.deepEqual(percentsSummingTo100({ positive: 1, neutral: 1, negative: 1 }), { positive: 34, neutral: 33, negative: 33 })
    for (const c of [
      { positive: 2, neutral: 2, negative: 3 },
      { positive: 1, neutral: 5, negative: 1 },
      { positive: 17, neutral: 0, negative: 6 },
      { positive: 1, neutral: 0, negative: 0 },
    ]) {
      const p = percentsSummingTo100(c)!
      assert.equal(p.positive + p.neutral + p.negative, 100, JSON.stringify(c))
    }
    assert.equal(percentsSummingTo100({ positive: 0, neutral: 0, negative: 0 }), null)
  })
})

describe('computeOverallAssessment', () => {
  it('empty dataset: no shares, no timeline (empty state, not 0 %)', () => {
    const a = computeOverallAssessment([])
    assert.equal(a.total, 0)
    assert.equal(a.evaluations, 0)
    assert.equal(a.shares, null)
    assert.equal(a.percents, null)
    assert.deepEqual(a.timeline.week, [])
  })

  it('evaluations without classifiable answers give the empty state too', () => {
    const a = computeOverallAssessment([evaluation({ brukssted: 'Møterom', modell: 'aBoks', forbedringer: 'Bra' })])
    assert.equal(a.total, 0)
    assert.equal(a.percents, null)
    assert.equal(a.evaluations, 0)
  })

  it('a single evaluation: one observation per evaluating answer, descriptive ones ignored', () => {
    const a = computeOverallAssessment([evaluation(full)])
    // brukervennlighet, nytte, organisering, fortsette, rom → 5 observations, all positive
    assert.deepEqual(a.counts, { positive: 5, neutral: 0, negative: 0 })
    assert.equal(a.total, 5)
    assert.equal(a.evaluations, 1)
    assert.deepEqual(a.percents, { positive: 100, neutral: 0, negative: 0 })
    assert.equal(a.timeline.day.length, 1)
    assert.equal(a.timeline.week.length, 1)
    assert.equal(a.timeline.month.length, 1)
  })

  it('denominator is classified answers only (70 / 20 / 10 example)', () => {
    const records: EvaluationRecord[] = []
    // 20 evaluations × 5 evaluating answers = 100 observations.
    for (let i = 0; i < 14; i++) records.push(evaluation(full)) // 70 positive
    for (let i = 0; i < 4; i++) {
      records.push(evaluation({ ...full, brukervennlighet: '3', nytte: '3', organisering: 'Delvis', fortsette: 'Kanskje', rom: '3' })) // 20 neutral
    }
    for (let i = 0; i < 2; i++) {
      records.push(evaluation({ ...full, brukervennlighet: '1', nytte: '2', organisering: 'Nei', fortsette: 'Nei', rom: '2' })) // 10 negative
    }
    // Plus answers that must not move the base at all.
    records.push(evaluation({ ...full, brukervennlighet: '', nytte: '', organisering: 'Vet ikke', fortsette: '', rom: '' }))
    const a = computeOverallAssessment(records)
    assert.equal(a.total, 100)
    assert.equal(a.evaluations, 20)
    assert.deepEqual(a.counts, { positive: 70, neutral: 20, negative: 10 })
    assert.deepEqual(a.percents, { positive: 70, neutral: 20, negative: 10 })
    assert.ok(Math.abs(a.shares!.positive - 0.7) < 1e-12)
  })

  it('all answers in one category', () => {
    const a = computeOverallAssessment([
      evaluation({ ...full, brukervennlighet: '1', nytte: '1', organisering: 'Nei', fortsette: 'Nei', rom: '1' }),
    ])
    assert.deepEqual(a.percents, { positive: 0, neutral: 0, negative: 100 })
  })

  it('groups by day, ISO week and month (Oslo time), per period and not cumulative, gaps left empty', () => {
    const records = [
      evaluation(full, { at: '2026-09-28T08:00:00.000Z' }), // Mon, week 40, Sep
      evaluation({ ...full, brukervennlighet: '1', nytte: '1', organisering: 'Nei', fortsette: 'Nei', rom: '1' }, { at: '2026-09-30T22:30:00.000Z' }), // Oslo 1 Oct, week 40
      evaluation({ ...full, brukervennlighet: '3', nytte: '3', organisering: 'Delvis', fortsette: 'Kanskje', rom: '3' }, { at: '2026-10-14T10:00:00.000Z' }), // week 42
    ]
    const a = computeOverallAssessment(records)

    const week = a.timeline.week
    assert.deepEqual(week.map((p) => p.key), ['2026-W40', '2026-W41', '2026-W42'])
    assert.deepEqual(week[0]!.percents, { positive: 50, neutral: 0, negative: 50 })
    assert.equal(week[0]!.evaluations, 2)
    assert.equal(week[1]!.total, 0, 'empty week')
    assert.equal(week[1]!.shares, null, 'no invented value for an empty period')
    assert.deepEqual(week[2]!.percents, { positive: 0, neutral: 100, negative: 0 }, 'not cumulative')

    const month = a.timeline.month
    assert.deepEqual(month.map((p) => p.key), ['2026-09', '2026-10'])
    assert.deepEqual(month[0]!.counts, { positive: 5, neutral: 0, negative: 0 })
    assert.deepEqual(month[1]!.counts, { positive: 0, neutral: 5, negative: 5 }, '22:30 UTC on 30 Sep is 1 Oct in Oslo')

    const day = a.timeline.day
    assert.equal(day[0]!.key, '2026-09-28')
    assert.equal(day[day.length - 1]!.key, '2026-10-14')
    assert.equal(day.length, 17)
    assert.equal(day.filter((p) => p.total > 0).length, 3)
  })

  it('historical versions: each answer is read through its own snapshot', () => {
    // Version 1 (default template): «rom» was a free-text room question, «fortsette» had
    // «Kanskje». Version 2 reuses «rom» as a rating and relabels «Kanskje» to «Usikker» (unknown
    // word: unclassified). Old answers keep their original meaning.
    const v1 = snapshotOf(defaultQuestions(), 1)
    const v2Questions = hitraQuestions().map((q) =>
      q.questionId === 'fortsette' ? { ...q, options: [opt('Ja', { isPositive: true }), opt('Usikker'), opt('Nei')] } : q,
    )
    const v2 = snapshotOf(v2Questions, 2)
    const old = evaluation(
      { brukssted: 'Hitra', modell: 'aBoks', bruksfrekvens: 'Daglig', fortsette: 'Kanskje', rom: 'Kontoret' },
      { snapshot: v1 },
    )
    const current = evaluation({ ...full, fortsette: 'Usikker', rom: '2', brukervennlighet: '', nytte: '', organisering: '' }, { snapshot: v2 })

    assert.deepEqual(classifyEvaluation(old), ['neutral'], 'old «rom» text is not read as a rating; «Kanskje» stays neutral')
    assert.deepEqual(classifyEvaluation(current), ['negative'], '«Usikker» is not guessed; rating 2 is negative')
    const a = computeOverallAssessment([old, current])
    assert.deepEqual(a.counts, { positive: 0, neutral: 1, negative: 1 })
    assert.equal(a.evaluations, 2)
  })

  it('does not change the existing statistics', () => {
    const records = [evaluation(full), evaluation({ ...full, organisering: 'Delvis', fortsette: 'Nei' })]
    const before = JSON.stringify(computePilotStats(records))
    computeOverallAssessment(records)
    assert.equal(JSON.stringify(computePilotStats(records)), before)
  })
})

// ── Through the endpoint: filters (project, period, model) apply to the new section too ──

interface FakeDoc {
  id: number
  project: number
  submittedAt: string
  model: number | null
  modelLabel: string | null
  answers: { questionId: string; questionLabel: string; questionType: string; value: { answer: unknown }; displayValue: string }[]
  questionnaireSnapshot: QuestionnaireSnapshot | null
}

function storedDoc(r: EvaluationRecord): FakeDoc {
  return {
    id: Number(r.id),
    project: r.projectId!,
    submittedAt: r.submittedAt,
    model: r.modelId,
    modelLabel: r.modelLabel,
    answers: r.answers.map((a) => ({ ...a, value: { answer: a.value } })),
    questionnaireSnapshot: r.snapshot,
  }
}

function fakeReq(docs: FakeDoc[], query: Record<string, string>) {
  const find = async (args: { collection: string; where?: { and: Record<string, Record<string, string>>[] } }) => {
    if (args.collection === 'pilot-projects') {
      return {
        docs: [
          { id: 1, name: 'Hitra', slug: 'hitra', organization: 'Hitra kommune', organizationType: 'kommune', status: 'active' },
          { id: 2, name: 'Skole', slug: 'skole', organization: 'Skole', organizationType: 'skole', status: 'active' },
        ],
      }
    }
    let out = docs
    for (const cond of args.where?.and ?? []) {
      const c = cond.submittedAt!
      if (c.greater_than_equal) out = out.filter((d) => d.submittedAt >= c.greater_than_equal!)
      if (c.less_than) out = out.filter((d) => d.submittedAt < c.less_than!)
    }
    return { docs: out }
  }
  return {
    user: { role: 'admin' },
    query,
    payload: { find, logger: { error: () => {} } },
  } as unknown as Parameters<typeof handlePilotAnalytics>[0]
}

describe('/api/pilot-analytics assessment', () => {
  const docs = [
    evaluation(full, { projectId: 1, at: '2026-10-05T10:00:00.000Z' }), // aBoks, 5 positive
    evaluation({ ...full, modell: 'aBoks XL', brukervennlighet: '1', nytte: '1', organisering: 'Nei', fortsette: 'Nei', rom: '1' }, { projectId: 1, at: '2026-10-12T10:00:00.000Z' }), // XL, 5 negative
    evaluation({ ...full, brukervennlighet: '3', nytte: '3', organisering: 'Delvis', fortsette: 'Kanskje', rom: '3' }, { projectId: 2, at: '2026-10-19T10:00:00.000Z' }), // 5 neutral
  ].map(storedDoc)

  async function assessmentFor(query: Record<string, string>) {
    const res = await handlePilotAnalytics(fakeReq(docs, query))
    assert.equal(res.status, 200)
    const body = (await res.json()) as { assessment: { counts: Record<string, number>; evaluations: number }; stats: { totalResponses: number } }
    return body
  }

  it('all projects together', async () => {
    const b = await assessmentFor({ project: 'all' })
    assert.deepEqual(b.assessment.counts, { positive: 5, neutral: 5, negative: 5 })
    assert.equal(b.assessment.evaluations, 3)
    assert.equal(b.stats.totalResponses, 3, 'existing figures untouched')
  })

  it('project filter', async () => {
    const b = await assessmentFor({ project: '2' })
    assert.deepEqual(b.assessment.counts, { positive: 0, neutral: 5, negative: 0 })
  })

  it('model filter', async () => {
    const b = await assessmentFor({ project: 'all', model: 'id:2' })
    assert.deepEqual(b.assessment.counts, { positive: 0, neutral: 0, negative: 5 })
  })

  it('date filter', async () => {
    const b = await assessmentFor({ project: 'all', from: '2026-10-10', to: '2026-10-15' })
    assert.deepEqual(b.assessment.counts, { positive: 0, neutral: 0, negative: 5 })
    assert.equal(b.assessment.evaluations, 1)
  })
})
