import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { modelFromAnswers, rawAnswersFromFormData, validateAnswers, type RawAnswers } from './answers'
import { resolvePublicQuestions } from './questionnaire'
import { defaultQuestions } from './defaultQuestionnaire'

const questions = resolvePublicQuestions(
  [
    ...defaultQuestions(),
    {
      questionId: 'flervalg',
      type: 'multipleChoice',
      label: 'Hvor står aBoks?',
      options: [{ label: 'Kontor' }, { label: 'Lager' }, { label: 'Klasserom' }],
    },
    { questionId: 'jn', type: 'yesNo', label: 'Anbefale?' },
    { questionId: 'liste', type: 'dropdown', label: 'Avdeling', options: [{ label: 'A' }, { label: 'B' }] },
  ],
  [{ id: 7, title: 'aBoks Vegg' }],
)

const raw = (entries: Record<string, string | string[]>): RawAnswers =>
  new Map(Object.entries(entries).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]))

const minimal = { brukssted: 'Hitra rådhus', modell: 'aBoks Vegg' }

describe('validateAnswers', () => {
  it('accepts a minimal valid submission and stores only answered questions', () => {
    const result = validateAnswers(questions, raw({ ...minimal, forbedringer: '', brukervennlighet: '' }))
    assert.ok(result.ok)
    assert.deepEqual(
      result.answers.map((a) => a.questionId),
      ['brukssted', 'modell'],
    )
    assert.equal(result.answers[0]!.questionLabel, 'Hvor har du brukt aBoks?')
  })

  it('requires the required questions', () => {
    const result = validateAnswers(questions, raw({}))
    assert.ok(!result.ok)
    assert.deepEqual(Object.keys(result.errors).sort(), ['brukssted', 'modell'])
  })

  it('rejects answers to questions outside the questionnaire', () => {
    const result = validateAnswers(questions, raw({ ...minimal, injisert: 'x' }))
    assert.ok(!result.ok)
    assert.match(result.message!, /ikke finnes/)
  })

  it('rejects a disabled question exactly like an unknown one', () => {
    const qs = defaultQuestions()
    qs[9]!.enabled = false
    const pub = resolvePublicQuestions(qs, [{ id: 7, title: 'aBoks Vegg' }])
    const result = validateAnswers(pub, raw({ ...minimal, rom: 'Kontor 2' }))
    assert.ok(!result.ok)
  })

  it('validates ratings strictly as integers 1–5', () => {
    for (const bad of ['0', '6', '3.5', 'abc', ' 2 x']) {
      const r = validateAnswers(questions, raw({ ...minimal, brukervennlighet: bad }))
      assert.ok(!r.ok, `rating ${bad} must be rejected`)
    }
    const ok = validateAnswers(questions, raw({ ...minimal, brukervennlighet: '4' }))
    assert.ok(ok.ok)
    assert.equal(ok.answers.find((a) => a.questionId === 'brukervennlighet')!.value, 4)
    const twice = validateAnswers(questions, raw({ ...minimal, nytte: ['4', '5'] }))
    assert.ok(!twice.ok)
  })

  it('only accepts configured options for choice, dropdown and Ja / Nei', () => {
    assert.ok(!validateAnswers(questions, raw({ ...minimal, modell: 'Konkurrent X' })).ok)
    assert.ok(!validateAnswers(questions, raw({ ...minimal, bruksfrekvens: ['Daglig', 'Ukentlig'] })).ok)
    assert.ok(!validateAnswers(questions, raw({ ...minimal, jn: 'Kanskje' })).ok)
    assert.ok(!validateAnswers(questions, raw({ ...minimal, liste: 'C' })).ok)
    assert.ok(validateAnswers(questions, raw({ ...minimal, jn: 'Ja', liste: 'B', bruksfrekvens: 'Daglig' })).ok)
  })

  it('stores multiple choice in option order without duplicates', () => {
    const r = validateAnswers(questions, raw({ ...minimal, flervalg: ['Klasserom', 'Kontor', 'Kontor'] }))
    assert.ok(r.ok)
    const a = r.answers.find((x) => x.questionId === 'flervalg')!
    assert.deepEqual(a.value, ['Kontor', 'Klasserom'])
    assert.equal(a.displayValue, 'Kontor, Klasserom')
    assert.ok(!validateAnswers(questions, raw({ ...minimal, flervalg: ['Kontor', 'Tak'] })).ok)
  })

  it('cleans text, strips control characters and enforces length limits', () => {
    const r = validateAnswers(questions, raw({ ...minimal, forbedringer: '  Bedre\r\nlokk\u0007  ' }))
    assert.ok(r.ok)
    assert.equal(r.answers.find((a) => a.questionId === 'forbedringer')!.value, 'Bedre\nlokk')
    assert.ok(!validateAnswers(questions, raw({ ...minimal, brukssted: 'x'.repeat(201) })).ok)
    assert.ok(!validateAnswers(questions, raw({ ...minimal, forbedringer: 'x'.repeat(3001) })).ok)
  })

  it('rejects a file posted where text was expected', () => {
    const fd = new FormData()
    fd.append('q:brukssted', new Blob(['x']), 'x.txt')
    fd.append('q:modell', 'aBoks Vegg')
    fd.append('projectId', '1')
    const parsed = rawAnswersFromFormData(fd)
    assert.ok(!parsed.has('projectId'), 'non-answer fields are not answers')
    assert.ok(!validateAnswers(questions, parsed).ok)
  })
})

describe('modelFromAnswers', () => {
  it('links a project model by id and keeps «Flere modeller» as a label only', () => {
    const one = validateAnswers(questions, raw(minimal))
    assert.ok(one.ok)
    assert.deepEqual(modelFromAnswers(questions, one.answers), { modelId: 7, modelLabel: 'aBoks Vegg' })

    const many = validateAnswers(questions, raw({ ...minimal, modell: 'Flere modeller' }))
    assert.ok(many.ok)
    assert.deepEqual(modelFromAnswers(questions, many.answers), { modelId: null, modelLabel: 'Flere modeller' })
  })
})
