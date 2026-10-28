import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  assignQuestionIds,
  dropUnusedOptions,
  questionnaireFingerprint,
  resolvePublicQuestions,
  validateQuestionnaire,
  type QuestionConfig,
} from './questionnaire'
import { defaultQuestions } from './defaultQuestionnaire'
import {
  CATEGORY_KEYS,
  CATEGORY_OPTIONS,
  LEGACY_STAT_KEYS,
  QUESTION_TYPES,
  STAT_KEY_OPTIONS,
  categoryLabel,
  categoryOf,
  statKeyOptionsFor,
} from './constants'
import { RESERVED_PILOT_SLUGS, slugify, uniqueSlug, validatePilotSlug } from './slug'

describe('slugify / uniqueSlug / validatePilotSlug', () => {
  it('transliterates Norwegian letters and joins words with hyphens', () => {
    assert.equal(slugify('Hitra kommune'), 'hitra-kommune')
    assert.equal(slugify('Hitraskolen'), 'hitraskolen')
    assert.equal(slugify('Bø kommune – Ærlig Å-prosjekt!'), 'bo-kommune-aerlig-a-prosjekt')
    assert.equal(slugify('  Bedrift ABC AS  '), 'bedrift-abc-as')
  })

  it('suffixes a taken slug and skips reserved words', () => {
    assert.equal(uniqueSlug('hitra-kommune', new Set()), 'hitra-kommune')
    assert.equal(uniqueSlug('hitra-kommune', new Set(['hitra-kommune'])), 'hitra-kommune-2')
    assert.equal(uniqueSlug('hitra-kommune', new Set(['hitra-kommune', 'hitra-kommune-2'])), 'hitra-kommune-3')
    assert.equal(uniqueSlug('admin', new Set()), 'admin-2')
    assert.equal(uniqueSlug('', new Set()), 'pilot-2', 'an empty base falls back to a non-reserved word')
  })

  it('accepts clean slugs and rejects malformed or reserved ones', () => {
    assert.equal(validatePilotSlug('hitra-kommune'), null)
    assert.match(validatePilotSlug('')!, /påkrevd/)
    assert.match(validatePilotSlug('Hitra Kommune')!, /små bokstaver/)
    assert.match(validatePilotSlug('-hitra')!, /bindestrek/)
    assert.match(validatePilotSlug('a'.repeat(81))!, /maks/)
    for (const reserved of RESERVED_PILOT_SLUGS) {
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reserved)) assert.match(validatePilotSlug(reserved)!, /reservert/)
    }
  })
})

describe('default questionnaire', () => {
  it('has the ten specified questions, valid as delivered', () => {
    const qs = defaultQuestions()
    assert.equal(qs.length, 10)
    assert.equal(qs[0]!.label, 'Hvor har du brukt aBoks?')
    assert.equal(qs[0]!.type, 'shortText', 'question 1 is free text, not a dropdown')
    assert.equal(qs[0]!.required, true)
    assert.equal(qs[0]!.placeholder, 'Navn på bedrift, skole eller institusjon...')
    assert.equal(qs[1]!.optionsSource, 'projectModels')
    assert.equal(qs[1]!.required, true)
    assert.deepEqual(qs[2]!.options!.map((o) => o.label), ['Daglig', 'Ukentlig', 'Noen få ganger', 'Ikke brukt ennå'])
    assert.equal(qs[3]!.type, 'rating')
    assert.equal(qs[4]!.type, 'rating')
    assert.deepEqual(qs[5]!.options!.map((o) => o.label), ['Ja', 'Delvis', 'Nei', 'Vet ikke'])
    assert.deepEqual(qs[6]!.options!.map((o) => o.label), ['Ja', 'Kanskje', 'Nei'])
    assert.equal(qs[9]!.required, false)
    assert.deepEqual(validateQuestionnaire(qs, { modelCount: 2 }), [])
  })

  it('returns an independent copy every call', () => {
    const a = defaultQuestions()
    a[0]!.label = 'Endret'
    a[2]!.options!.push({ label: 'X' })
    const b = defaultQuestions()
    assert.equal(b[0]!.label, 'Hvor har du brukt aBoks?')
    assert.equal(b[2]!.options!.length, 4)
  })
})

describe('assignQuestionIds', () => {
  let n = 0
  const next = () => `q-new${++n}`

  it('keeps valid ids and fills in missing ones', () => {
    const out = assignQuestionIds([{ questionId: 'modell', label: 'A' }, { label: 'B' }], [], next)
    assert.equal(out[0]!.questionId, 'modell')
    assert.match(out[1]!.questionId!, /^q-new/)
  })

  it('resolves a duplicated row: the stored owner keeps the id, the copy gets a new one', () => {
    const previous: QuestionConfig[] = [{ id: 'row-a', questionId: 'nytte', label: 'Nytte' }]
    // The administrator duplicated the row and moved the copy above the original.
    const out = assignQuestionIds(
      [
        { id: 'row-b', questionId: 'nytte', label: 'Nytte (kopi)' },
        { id: 'row-a', questionId: 'nytte', label: 'Nytte' },
      ],
      previous,
      next,
    )
    assert.equal(out[1]!.questionId, 'nytte', 'the original row keeps its id — history points at it')
    assert.notEqual(out[0]!.questionId, 'nytte')
    assert.equal(new Set(out.map((q) => q.questionId)).size, 2)
  })

  it('without a stored owner, the first occurrence keeps the id', () => {
    const out = assignQuestionIds([{ questionId: 'x1' }, { questionId: 'x1' }], [], next)
    assert.equal(out[0]!.questionId, 'x1')
    assert.notEqual(out[1]!.questionId, 'x1')
  })

  it('replaces malformed ids', () => {
    const out = assignQuestionIds([{ questionId: 'Has Spaces' }], [], next)
    assert.match(out[0]!.questionId!, /^q-new/)
  })
})

describe('validateQuestionnaire', () => {
  const base = (over: Partial<QuestionConfig>): QuestionConfig => ({
    questionId: 'q1',
    type: 'shortText',
    label: 'Spørsmål',
    ...over,
  })

  it('rejects duplicate question ids', () => {
    const errors = validateQuestionnaire([base({}), base({ label: 'Annet' })], { modelCount: 0 })
    assert.ok(errors.some((e) => /brukt mer enn én gang/.test(e)))
  })

  it('rejects empty labels, invalid types and choice questions without options', () => {
    const errors = validateQuestionnaire(
      [
        base({ label: '' }),
        base({ questionId: 'q2', type: 'bogus' }),
        base({ questionId: 'q3', type: 'singleChoice', options: [] }),
        base({ questionId: 'q4', type: 'dropdown', optionsSource: 'projectModels', options: [] }),
      ],
      { modelCount: 0 },
    )
    assert.ok(errors.some((e) => /Spørsmål 1: spørsmålsteksten mangler/.test(e)))
    assert.ok(errors.some((e) => /Spørsmål 2: ugyldig spørsmålstype/.test(e)))
    assert.ok(errors.some((e) => /Spørsmål 3: legg til minst ett svaralternativ/.test(e)))
    assert.ok(errors.some((e) => /Spørsmål 4: velg minst én aBoks-modell/.test(e)))
  })

  it('accepts a model-sourced question when the project has models', () => {
    const q = base({ type: 'singleChoice', optionsSource: 'projectModels', options: [] })
    assert.deepEqual(validateQuestionnaire([q], { modelCount: 1 }), [])
  })

  it('rejects duplicate option labels (case-insensitive)', () => {
    const q = base({ type: 'multipleChoice', options: [{ label: 'Ja' }, { label: 'ja' }] })
    assert.ok(validateQuestionnaire([q], { modelCount: 0 }).some((e) => /finnes flere ganger/.test(e)))
  })

  it('accepts each of the six categories on every question type', () => {
    for (const statKey of CATEGORY_KEYS) {
      for (const type of QUESTION_TYPES) {
        const q = base({ type, statKey, options: [{ label: 'A' }] })
        assert.deepEqual(validateQuestionnaire([q], { modelCount: 0 }), [], `${statKey} on ${type}`)
      }
    }
  })

  it('lets several active questions share one category', () => {
    const shared = [
      base({ type: 'rating', statKey: 'usability' }),
      base({ questionId: 'q2', type: 'rating', statKey: 'usability' }),
      base({ questionId: 'q3', type: 'longText', statKey: 'usability' }),
    ]
    assert.deepEqual(validateQuestionnaire(shared, { modelCount: 0 }), [])
  })

  it('keeps the category optional: no value, empty and «Ingen kategori» all save', () => {
    for (const statKey of [undefined, null, '', 'none']) {
      assert.deepEqual(validateQuestionnaire([base({ statKey })], { modelCount: 0 }), [], String(statKey))
    }
  })

  it('still accepts legacy categories, on any type, and rejects unknown values', () => {
    for (const statKey of LEGACY_STAT_KEYS) {
      assert.deepEqual(validateQuestionnaire([base({ type: 'rating', statKey })], { modelCount: 0 }), [], statKey)
    }
    assert.ok(
      validateQuestionnaire([base({ statKey: 'tull' })], { modelCount: 0 }).some((e) => /ugyldig analysekategori/.test(e)),
    )
  })
})

describe('analysis categories', () => {
  it('has exactly the six universal categories, in order, with Norwegian labels', () => {
    assert.deepEqual(
      CATEGORY_OPTIONS.map((o) => o.label),
      [
        'Bruk og erfaring',
        'Brukervennlighet',
        'Nytte og effekt',
        'Tilfredshet',
        'Anbefaling og videre bruk',
        'Forbedringer og kommentarer',
      ],
    )
  })

  it('maps legacy categories onto the universal ones, everything else to «Andre spørsmål»', () => {
    assert.deepEqual(
      LEGACY_STAT_KEYS.map((k) => [k, categoryOf(k)]),
      [
        ['location', 'usage'],
        ['model', 'usage'],
        ['frequency', 'usage'],
        ['usefulness', 'benefit'],
        ['organization', 'benefit'],
        ['continue', 'recommendation'],
        ['improvements', 'feedback'],
        ['comments', 'feedback'],
        ['room', 'usage'],
      ],
    )
    assert.equal(categoryOf('usability'), 'usability')
    for (const v of ['none', null, undefined, '', 'tull']) assert.equal(categoryOf(v), null)
    assert.equal(categoryLabel(null), 'Andre spørsmål')
    assert.equal(categoryLabel('continue'), 'Anbefaling og videre bruk')
  })

  it('offers the six categories and «Ingen kategori» — a legacy value only where it is already set', () => {
    assert.deepEqual(
      statKeyOptionsFor(STAT_KEY_OPTIONS, null).map((o) => o.value),
      [...CATEGORY_KEYS, 'none'],
    )
    assert.deepEqual(
      statKeyOptionsFor(STAT_KEY_OPTIONS, 'organization').map((o) => o.value),
      [...CATEGORY_KEYS, 'none', 'organization'],
    )
  })

  it('the default questionnaire uses only the universal categories and keeps its wording and ids', () => {
    const qs = defaultQuestions()
    assert.ok(qs.every((q) => (CATEGORY_KEYS as readonly string[]).includes(q.statKey as string)))
    assert.deepEqual(
      qs.map((q) => q.questionId),
      ['brukssted', 'modell', 'bruksfrekvens', 'brukervennlighet', 'nytte', 'organisering', 'fortsette', 'forbedringer', 'kommentarer', 'rom'],
    )
    assert.equal(qs[3]!.label, 'Hvor enkelt er produktet å bruke?')
    assert.equal(qs[2]!.options!.find((o) => o.label === 'Ikke brukt ennå')!.noProductExperience, true)
  })
})

describe('resolvePublicQuestions', () => {
  const models = [
    { id: 3, title: 'aBoks Vegg' },
    { id: 5, title: 'aBoks Mini' },
  ]

  it('drops disabled questions and internal fields, expands project models and Ja / Nei', () => {
    const qs = defaultQuestions()
    qs[9]!.enabled = false
    qs.push({ questionId: 'jn', type: 'yesNo', label: 'Vil du anbefale aBoks?' })
    const pub = resolvePublicQuestions(qs, models)
    assert.equal(pub.length, 10)
    assert.ok(!pub.some((q) => q.questionId === 'rom'))
    const model = pub.find((q) => q.questionId === 'modell')!
    assert.deepEqual(
      model.options.map((o) => [o.label, o.modelId ?? null]),
      [
        ['aBoks Vegg', 3],
        ['aBoks Mini', 5],
        ['Flere modeller', null],
      ],
    )
    const yesNo = pub.find((q) => q.questionId === 'jn')!
    assert.deepEqual(yesNo.options.map((o) => o.value), ['Ja', 'Nei'])
    assert.equal(yesNo.options[0]!.isPositive, true)
    for (const q of pub) assert.deepEqual(Object.keys(q).sort(), [
      'helpText', 'label', 'options', 'placeholder', 'questionId', 'required', 'scaleMaxLabel', 'scaleMinLabel', 'statKey', 'type',
    ])
  })

  it('stores «Ingen kategori» as no category and keeps legacy categories in the snapshot', () => {
    const pub = resolvePublicQuestions(
      [
        { questionId: 'a', type: 'rating', label: 'A', statKey: 'none' },
        { questionId: 'b', type: 'rating', label: 'B', statKey: 'usefulness' },
        { questionId: 'c', type: 'rating', label: 'C', statKey: 'benefit' },
      ],
      [],
    )
    assert.deepEqual(
      pub.map((q) => q.statKey),
      [null, 'usefulness', 'benefit'],
    )
  })

  it('marks «Ingen produkterfaring» options, and the legacy «Bruksfrekvens» kept-out option', () => {
    const options = [
      { label: 'Daglig' },
      { label: 'Ikke brukt', noProductExperience: true },
      { label: 'Vet ikke', excludeFromAverages: true },
    ]
    const [flagged, legacy, multi] = resolvePublicQuestions(
      [
        { questionId: 'f1', type: 'singleChoice', label: 'Hvor ofte?', statKey: 'usage', options },
        {
          questionId: 'f2',
          type: 'singleChoice',
          label: 'Hvor ofte?',
          statKey: 'frequency',
          options: [{ label: 'Ikke brukt', excludeFromAverages: true }],
        },
        { questionId: 'f3', type: 'multipleChoice', label: 'Hvor?', options },
      ],
      [],
    )
    assert.deepEqual(
      flagged!.options.map((o) => [o.label, o.noProductExperience === true, o.excludeFromAverages]),
      [
        ['Daglig', false, false],
        ['Ikke brukt', true, true],
        ['Vet ikke', false, true],
      ],
    )
    assert.equal(legacy!.options[0]!.noProductExperience, true)
    assert.ok(!multi!.options.some((o) => o.noProductExperience), 'single-answer questions only')
  })

  it('omits a choice question that resolves to no options', () => {
    const pub = resolvePublicQuestions(
      [{ questionId: 'm', type: 'singleChoice', label: 'Modell?', optionsSource: 'projectModels', options: [] }],
      [],
    )
    assert.equal(pub.length, 0)
  })
})

describe('questionnaireFingerprint', () => {
  it('changes when a label, an option or the model selection changes — not for row ids', () => {
    const qs = defaultQuestions()
    const base = questionnaireFingerprint(qs, [1, 2])
    assert.equal(questionnaireFingerprint(qs.map((q, i) => ({ ...q, id: `row-${i}` })), [2, 1]), base)

    const relabelled = defaultQuestions()
    relabelled[3]!.label = 'Hvor lett er aBoks å bruke?'
    assert.notEqual(questionnaireFingerprint(relabelled, [1, 2]), base)

    const option = defaultQuestions()
    option[6]!.options!.push({ label: 'Vet ikke' })
    assert.notEqual(questionnaireFingerprint(option, [1, 2]), base)

    assert.notEqual(questionnaireFingerprint(qs, [1]), base)
  })

  it('changes when a Ja / Nei question is marked «Telles i samlet vurdering», not when the mark is off', () => {
    const q: QuestionConfig = { questionId: 'jn', type: 'yesNo', label: 'Anbefale?' }
    const off = questionnaireFingerprint([q], [])
    assert.equal(questionnaireFingerprint([{ ...q, countInAssessment: false }], []), off)
    assert.notEqual(questionnaireFingerprint([{ ...q, countInAssessment: true }], []), off)
  })

  it('stays the same for questionnaires saved before the option flag and «Ingen kategori» existed', () => {
    const legacy: QuestionConfig[] = [
      { questionId: 'a', type: 'singleChoice', label: 'A', statKey: null, options: [{ label: 'Ja', isPositive: true }] },
    ]
    const sameMeaning: QuestionConfig[] = [
      { ...legacy[0]!, statKey: 'none', options: [{ label: 'Ja', isPositive: true, noProductExperience: false }] },
    ]
    assert.equal(questionnaireFingerprint(sameMeaning, []), questionnaireFingerprint(legacy, []))
    const flagged: QuestionConfig[] = [{ ...legacy[0]!, options: [{ label: 'Ja', isPositive: true, noProductExperience: true }] }]
    assert.notEqual(questionnaireFingerprint(flagged, []), questionnaireFingerprint(legacy, []))
  })
})

describe('dropUnusedOptions', () => {
  it('removes options left behind on rating, text and Ja / Nei questions, and keeps choice options', () => {
    const leftovers = [{ label: 'Daglig' }, { label: 'Sjeldnere', excludeFromAverages: true }]
    const out = dropUnusedOptions([
      // Hitra v9 shape: a frequency question turned into a total-experience rating.
      { questionId: 'totalvurdering', type: 'rating', label: 'Hvordan vurderer du totalopplevelsen med aBoks?', scaleMinLabel: 'Svært dårlig', scaleMaxLabel: 'Svært god', options: leftovers },
      { questionId: 't', type: 'longText', label: 'T', options: leftovers },
      { questionId: 'jn', type: 'yesNo', label: 'J', options: leftovers },
      { questionId: 'c', type: 'singleChoice', label: 'C', options: leftovers },
      { questionId: 'm', type: 'multipleChoice', label: 'M', options: leftovers },
    ])
    assert.deepEqual(
      out.map((q) => q.options?.length ?? 0),
      [0, 0, 0, 2, 2],
    )
    assert.equal(out[0]!.label, 'Hvordan vurderer du totalopplevelsen med aBoks?')
    assert.equal(out[0]!.scaleMinLabel, 'Svært dårlig')
    assert.equal(out[0]!.scaleMaxLabel, 'Svært god')
    assert.equal(leftovers.length, 2, 'input not mutated')
  })

  it('does not change the public form — leftover options were never shown', () => {
    const q: QuestionConfig = { questionId: 'r', type: 'rating', label: 'R', options: [{ label: 'Daglig' }] }
    assert.deepEqual(resolvePublicQuestions([q], []), resolvePublicQuestions(dropUnusedOptions([q]), []))
  })
})
