import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { PilotProjects } from './PilotProjects'
import { PilotEvaluations } from './PilotEvaluations'
import {
  PILOT_PROJECT_IN_USE_MESSAGE,
  enforceProjectRules,
  guardProjectDelete,
  prepareProject,
  validateSlugField,
} from './hooks/pilotProject'
import { defaultQuestions } from '@/lib/pilot/defaultQuestionnaire'
import { resolvePilotPage, submitPilotEvaluation, type PilotPayload } from '@/lib/pilot/submission'
import { handleLoadDefaultQuestionnaire } from './endpoints/pilotLoadDefaultQuestionnaire'
import { handlePilotAnalytics, parsePilotQuery } from '@/endpoints/pilotAnalytics'

beforeEach(() => {
  mock.method(console, 'log', () => {})
})

type Doc = Record<string, unknown> & { id: number }
type AccessFn = (args: { req: { user: unknown } }) => unknown

const ADMIN = { id: 1, role: 'admin' }
const EDITOR = { id: 2, role: 'editor' }

// ── Minimal in-memory Payload: just the queries the pilot code issues ──

function matches(doc: Doc, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'and') {
      if (!(cond as Record<string, unknown>[]).every((w) => matches(doc, w))) return false
      continue
    }
    const c = cond as Record<string, unknown>
    if (key === 'slugHistory.slug') {
      const rows = (doc.slugHistory as { slug: string }[] | undefined) ?? []
      if (!rows.some((r) => r.slug === c.equals)) return false
      continue
    }
    const value = key === 'project' && typeof doc.project === 'object' ? (doc.project as Doc).id : doc[key]
    if ('equals' in c && value !== c.equals) return false
    if ('not_equals' in c && value === c.not_equals) return false
  }
  return true
}

function stubPayload(seed: { projects?: Doc[]; evaluations?: Doc[]; products?: Doc[] } = {}) {
  const store: Record<string, Doc[]> = {
    'pilot-projects': seed.projects ?? [],
    'pilot-evaluations': seed.evaluations ?? [],
    products: seed.products ?? [],
  }
  let nextId = 100
  const populate = (doc: Doc, depth: number | undefined): Doc => {
    if (!depth || !Array.isArray(doc.models)) return doc
    return { ...doc, models: (doc.models as number[]).map((id) => store.products!.find((p) => p.id === id) ?? id) }
  }
  const payload = {
    logger: { error: () => {}, warn: () => {}, info: () => {} },
    find: async ({ collection, where, depth }: { collection: string; where?: Record<string, unknown>; depth?: number }) => {
      const docs = store[collection]!.filter((d) => matches(d, where)).map((d) => populate(d, depth))
      return { docs, totalDocs: docs.length }
    },
    findByID: async ({ collection, id, depth }: { collection: string; id: number; depth?: number }) => {
      const doc = store[collection]!.find((d) => d.id === Number(id))
      if (!doc) throw new Error('Not Found')
      return populate(doc, depth)
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const doc = { id: ++nextId, ...data } as Doc
      store[collection]!.push(doc)
      return doc
    },
    count: async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => ({
      totalDocs: store[collection]!.filter((d) => matches(d, where)).length,
    }),
    update: async ({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) => {
      const doc = store[collection]!.find((d) => d.id === Number(id))!
      Object.assign(doc, data)
      return doc
    },
  }
  return { payload, store }
}

const reqWith = (payload: unknown, user: unknown = ADMIN) => ({ payload, user }) as unknown as PayloadRequest

// Hook signatures carry many fields the pilot hooks never read.
type AnyHook = (args: Record<string, unknown>) => Promise<unknown> | unknown
const runPrepare = (args: Record<string, unknown>) => (prepareProject as unknown as AnyHook)(args)
const runRules = (args: Record<string, unknown>) => (enforceProjectRules as unknown as AnyHook)(args) as Promise<Record<string, unknown>>

// ── Access control ──

describe('pilot access control', () => {
  it('restricts every pilot project operation to administrators', () => {
    for (const op of ['read', 'create', 'update', 'delete'] as const) {
      const fn = PilotProjects.access![op] as AccessFn
      assert.equal(fn({ req: { user: null } }), false, `${op}: public`)
      assert.equal(fn({ req: { user: EDITOR } }), false, `${op}: editor`)
      assert.equal(fn({ req: { user: ADMIN } }), true, `${op}: admin`)
    }
  })

  it('never exposes evaluations publicly and makes them immutable for everyone', () => {
    const acc = PilotEvaluations.access!
    for (const op of ['read', 'create', 'update', 'delete'] as const) {
      assert.equal((acc[op] as AccessFn)({ req: { user: null } }), false, `${op}: public`)
    }
    assert.equal((acc.read as AccessFn)({ req: { user: ADMIN } }), true)
    assert.equal((acc.delete as AccessFn)({ req: { user: ADMIN } }), true)
    assert.equal((acc.create as AccessFn)({ req: { user: ADMIN } }), false, 'only the server action creates')
    assert.equal((acc.update as AccessFn)({ req: { user: ADMIN } }), false, 'history cannot be rewritten')
  })

  it('stores no IP address, name or e-mail on an evaluation', () => {
    const names: string[] = []
    const walk = (fields: unknown[]) => {
      for (const f of fields as { name?: string; fields?: unknown[] }[]) {
        if (f.name) names.push(f.name.toLowerCase())
        if (f.fields) walk(f.fields)
      }
    }
    walk(PilotEvaluations.fields)
    assert.ok(names.includes('answers'), 'walker sees the fields')
    for (const forbidden of ['ip', 'ipaddress', 'email', 'name', 'customername', 'useragent', 'user']) {
      assert.ok(!names.includes(forbidden), `field ${forbidden} must not exist`)
    }
  })
})

// ── Creating and editing projects ──

describe('creating and editing projects', () => {
  it('generates a unique slug from the name, avoiding current and earlier slugs', async () => {
    const { payload } = stubPayload({
      projects: [
        { id: 1, slug: 'hitra-kommune', slugHistory: [] },
        { id: 2, slug: 'annet', slugHistory: [{ slug: 'hitra-kommune-2' }] },
      ],
    })
    const data = (await runPrepare({ data: { name: 'Hitra kommune' }, req: reqWith(payload) })) as Record<string, unknown>
    assert.equal(data.slug, 'hitra-kommune-3')
  })

  it('normalises a typed slug and validates uniqueness and reserved words inline', async () => {
    const { payload } = stubPayload({ projects: [{ id: 1, slug: 'hitraskolen', slugHistory: [{ slug: 'gammel' }] }] })
    const data = (await runPrepare({ data: { name: 'X', slug: ' Bedrift ABC ' }, req: reqWith(payload) })) as Record<string, unknown>
    assert.equal(data.slug, 'bedrift-abc')

    const validate = validateSlugField as unknown as (v: unknown, o: Record<string, unknown>) => Promise<unknown>
    assert.match(String(await validate('hitraskolen', { req: reqWith(payload), id: 5 })), /allerede i bruk/)
    assert.match(String(await validate('gammel', { req: reqWith(payload), id: 5 })), /har vært brukt/)
    assert.equal(await validate('hitraskolen', { req: reqWith(payload), id: 1 }), true, 'its own slug is fine')
    assert.match(String(await validate('admin', { req: reqWith(payload) })), /reservert/)
  })

  it('assigns question ids on save', async () => {
    const { payload } = stubPayload()
    const data = (await runPrepare({
      data: { name: 'P', questions: [{ type: 'shortText', label: 'Nytt spørsmål' }] },
      req: reqWith(payload),
    })) as { questions: { questionId: string }[] }
    assert.match(data.questions[0]!.questionId, /^q-[a-z0-9]{10}$/)
  })

  it('starts new projects from a copy of the default questionnaire', () => {
    const tabs = (PilotProjects.fields[0] as { tabs: { fields: { name?: string; defaultValue?: unknown }[] }[] }).tabs
    const questions = tabs[1]!.fields.find((f) => f.name === 'questions')!
    const value = (questions.defaultValue as () => unknown)()
    assert.deepEqual(value, defaultQuestions())
  })

  it('versions the questionnaire: unchanged edits keep it, question changes bump it', async () => {
    const req = reqWith(stubPayload().payload)
    const created = await runRules({ data: { questions: defaultQuestions(), models: [1] }, operation: 'create', req })
    assert.equal(created.questionnaireVersion, 1)

    const original = { id: 9, ...created, slug: 's', slugHistory: [] }
    const same = await runRules({ data: { name: 'Nytt navn' }, originalDoc: original, operation: 'update', req })
    assert.equal(same.questionnaireVersion, 1)

    const edited = defaultQuestions()
    edited[0]!.label = 'Hvor har du testet aBoks?'
    const bumped = await runRules({ data: { questions: edited }, originalDoc: original, operation: 'update', req })
    assert.equal(bumped.questionnaireVersion, 2)

    const models = await runRules({ data: { models: [1, 2] }, originalDoc: original, operation: 'update', req })
    assert.equal(models.questionnaireVersion, 2, 'models are options of the model question')
  })

  it('rejects invalid questionnaires, activation without questions and an end before the start', async () => {
    const req = reqWith(stubPayload().payload)
    await assert.rejects(
      runRules({ data: { questions: [{ questionId: 'a', type: 'singleChoice', label: 'X', options: [] }] }, operation: 'create', req }),
      /svaralternativ|invalid/i,
    )
    await assert.rejects(
      runRules({ data: { status: 'active', questions: [{ ...defaultQuestions()[0]!, enabled: false }] }, operation: 'create', req }),
    )
    await assert.rejects(
      runRules({ data: { status: 'active', questions: defaultQuestions(), models: [] }, operation: 'create', req }),
      /aBoks-modell/,
      'cannot activate while the model question has no models to list',
    )
    await runRules({ data: { status: 'draft', questions: defaultQuestions(), models: [] }, operation: 'create', req })
    await assert.rejects(
      runRules({
        data: { questions: defaultQuestions(), models: [1], startDate: '2026-11-01', endDate: '2026-10-01' },
        operation: 'create',
        req,
      }),
    )
  })

  it('records the previous slug when it changes, so old links redirect', async () => {
    const req = reqWith(stubPayload().payload)
    const original = { id: 9, slug: 'hitra', slugHistory: [], questions: defaultQuestions(), models: [1] }
    const out = await runRules({ data: { slug: 'hitra-kommune' }, originalDoc: original, operation: 'update', req })
    assert.deepEqual((out.slugHistory as { slug: string }[]).map((r) => r.slug), ['hitra'])

    // Changing back reclaims the old slug from the history.
    const back = await runRules({
      data: { slug: 'hitra' },
      originalDoc: { ...original, slug: 'hitra-kommune', slugHistory: out.slugHistory },
      operation: 'update',
      req,
    })
    assert.deepEqual((back.slugHistory as { slug: string }[]).map((r) => r.slug), ['hitra-kommune'])
  })

  it('refuses to delete a project that has evaluations', async () => {
    const { payload } = stubPayload({ evaluations: [{ id: 1, project: 5 }] })
    const run = guardProjectDelete as unknown as AnyHook
    await assert.rejects(Promise.resolve(run({ id: 5, req: reqWith(payload) })), new RegExp(PILOT_PROJECT_IN_USE_MESSAGE.slice(0, 30)))
    await Promise.resolve(run({ id: 6, req: reqWith(payload) }))
  })

  it('«Last inn standard spørreskjema» is admin-only', async () => {
    const { payload } = stubPayload({ projects: [{ id: 5 }] })
    const asReq = (user: unknown) => ({ payload, user, routeParams: { id: '5' } }) as unknown as PayloadRequest
    assert.equal((await handleLoadDefaultQuestionnaire(asReq(null))).status, 401)
    assert.equal((await handleLoadDefaultQuestionnaire(asReq(EDITOR))).status, 403)
    assert.equal((await handleLoadDefaultQuestionnaire(asReq(ADMIN))).status, 200)
  })
})

// ── Public page and anonymous submissions ──

const VEGG = { id: 1, title: 'aBoks Vegg' }

function activeProject(over: Partial<Doc> = {}): Doc {
  return {
    id: 5,
    name: 'Hitra kommune',
    slug: 'hitra-kommune',
    organization: 'Hitra kommune',
    status: 'active',
    questionnaireVersion: 3,
    intro: 'Intro',
    closingMessage: 'Takk!',
    contactEmail: 'hemmelig@hitra.kommune.no',
    internalNotes: 'Intern',
    models: [1],
    questions: defaultQuestions(),
    slugHistory: [{ slug: 'hitra' }],
    ...over,
  }
}

const answers = (entries: Record<string, string>) => new Map(Object.entries(entries).map(([k, v]) => [k, [v]]))

describe('public questionnaire page', () => {
  it('shows only the public questionnaire for an active project', async () => {
    const { payload } = stubPayload({ projects: [activeProject()], products: [VEGG] })
    const res = await resolvePilotPage(payload as unknown as PilotPayload, 'hitra-kommune', { preview: false })
    assert.equal(res.kind, 'page')
    if (res.kind !== 'page') return
    assert.equal(res.state, 'active')
    assert.equal(res.view!.snapshot.version, 3)
    const serialized = JSON.stringify(res.view)
    assert.ok(!serialized.includes('hemmelig') && !serialized.includes('Intern'), 'no internal data')
  })

  it('shows a status message without project data for draft, completed and archived', async () => {
    for (const status of ['draft', 'completed', 'archived']) {
      const { payload } = stubPayload({ projects: [activeProject({ status })], products: [VEGG] })
      const res = await resolvePilotPage(payload as unknown as PilotPayload, 'hitra-kommune', { preview: false })
      assert.deepEqual(res, { kind: 'page', state: status })
    }
  })

  it('shows any status to an administrator preview', async () => {
    const { payload } = stubPayload({ projects: [activeProject({ status: 'draft' })], products: [VEGG] })
    const res = await resolvePilotPage(payload as unknown as PilotPayload, 'hitra-kommune', { preview: true })
    assert.ok(res.kind === 'page' && res.state === 'draft' && res.view)
  })

  it('redirects an earlier slug and reports unknown or malformed slugs as not found', async () => {
    const { payload } = stubPayload({ projects: [activeProject()], products: [VEGG] })
    const p = payload as unknown as PilotPayload
    assert.deepEqual(await resolvePilotPage(p, 'hitra', { preview: false }), { kind: 'redirect', slug: 'hitra-kommune' })
    assert.deepEqual(await resolvePilotPage(p, 'finnes-ikke', { preview: false }), { kind: 'page', state: 'notFound' })
    assert.deepEqual(await resolvePilotPage(p, '../admin', { preview: false }), { kind: 'page', state: 'notFound' })
  })
})

describe('anonymous submissions', () => {
  it('stores an evaluation tied to the project id, with a snapshot and no personal data', async () => {
    const { payload, store } = stubPayload({ projects: [activeProject()], products: [VEGG] })
    const res = await submitPilotEvaluation(payload as unknown as PilotPayload, {
      projectId: 5,
      version: 3,
      raw: answers({ brukssted: 'Rådhuset', modell: 'aBoks Vegg', brukervennlighet: '5' }),
    })
    assert.ok(res.ok)
    assert.equal(res.closingMessage, 'Takk!')
    const saved = store['pilot-evaluations']![0]!
    assert.equal(saved.project, 5)
    assert.equal(saved.model, 1)
    assert.equal(saved.modelLabel, 'aBoks Vegg')
    assert.equal(saved.questionnaireVersion, 3)
    assert.equal((saved.questionnaireSnapshot as { questions: unknown[] }).questions.length, 10)
    assert.deepEqual(
      (saved.answers as { questionId: string; questionLabel: string }[]).map((a) => [a.questionId, a.questionLabel]),
      [
        ['brukssted', 'Hvor har du brukt aBoks?'],
        ['modell', 'Hvilken aBoks-modell har du brukt?'],
        ['brukervennlighet', 'Hvor enkelt er produktet å bruke?'],
      ],
    )
    assert.deepEqual(
      (saved.answers as { value: unknown }[]).map((a) => a.value),
      [{ answer: 'Rådhuset' }, { answer: 'aBoks Vegg' }, { answer: 5 }],
      'json values are wrapped — a bare string would be parsed as JSON text by Payload',
    )
    assert.ok(!JSON.stringify(saved).includes('hemmelig'))
  })

  it('identifies the project by id, whatever the participant typed as location', async () => {
    const { payload, store } = stubPayload({
      projects: [activeProject(), activeProject({ id: 6, slug: 'hitraskolen', name: 'Hitraskolen' })],
      products: [VEGG],
    })
    await submitPilotEvaluation(payload as unknown as PilotPayload, {
      projectId: 6,
      version: 3,
      raw: answers({ brukssted: 'Hitra kommune', modell: 'aBoks Vegg' }),
    })
    assert.equal(store['pilot-evaluations']![0]!.project, 6)
  })

  it('refuses inactive or missing projects and stale questionnaire versions', async () => {
    for (const status of ['draft', 'completed', 'archived']) {
      const { payload, store } = stubPayload({ projects: [activeProject({ status })], products: [VEGG] })
      const res = await submitPilotEvaluation(payload as unknown as PilotPayload, {
        projectId: 5,
        version: 3,
        raw: answers({ brukssted: 'X', modell: 'aBoks Vegg' }),
      })
      assert.ok(!res.ok && res.reason === 'closed')
      assert.equal(store['pilot-evaluations']!.length, 0)
    }
    const { payload, store } = stubPayload({ projects: [activeProject()], products: [VEGG] })
    const p = payload as unknown as PilotPayload
    const missing = await submitPilotEvaluation(p, { projectId: 99, version: 1, raw: answers({}) })
    assert.ok(!missing.ok && missing.reason === 'closed')
    const stale = await submitPilotEvaluation(p, { projectId: 5, version: 2, raw: answers({ brukssted: 'X', modell: 'aBoks Vegg' }) })
    assert.ok(!stale.ok && stale.reason === 'stale')
    assert.equal(store['pilot-evaluations']!.length, 0)
  })

  it('returns field errors and stores nothing for invalid answers', async () => {
    const { payload, store } = stubPayload({ projects: [activeProject()], products: [VEGG] })
    const res = await submitPilotEvaluation(payload as unknown as PilotPayload, {
      projectId: 5,
      version: 3,
      raw: answers({ modell: 'Ukjent modell' }),
    })
    assert.ok(!res.ok && res.reason === 'invalid')
    assert.deepEqual(Object.keys(res.errors!).sort(), ['brukssted', 'modell'])
    assert.equal(store['pilot-evaluations']!.length, 0)
  })
})

// ── Analytics endpoint ──

describe('pilot analytics endpoint', () => {
  it('is admin-only', async () => {
    const { payload } = stubPayload()
    const asReq = (user: unknown) => ({ payload, user, query: {} }) as unknown as PayloadRequest
    assert.equal((await handlePilotAnalytics(asReq(null))).status, 401)
    assert.equal((await handlePilotAnalytics(asReq(EDITOR))).status, 403)
  })

  it('validates filters', () => {
    assert.deepEqual(parsePilotQuery({ project: '5', from: '2026-10-01', to: '2026-10-31', model: 'id:1' }), {
      projectId: 5,
      from: '2026-10-01',
      to: '2026-10-31',
      model: 'id:1',
      format: 'json',
    })
    assert.throws(() => parsePilotQuery({ project: 'abc' }))
    assert.throws(() => parsePilotQuery({ from: '01.10.2026' }))
    assert.throws(() => parsePilotQuery({ from: '2026-10-31', to: '2026-10-01' }))
    assert.throws(() => parsePilotQuery({ model: 'drop table' }))
    assert.equal(parsePilotQuery({ format: 'csv' }).format, 'csv')
  })

  it('returns stats and a CSV export for an administrator', async () => {
    const { payload, store } = stubPayload({ projects: [activeProject()], products: [VEGG] })
    await submitPilotEvaluation(payload as unknown as PilotPayload, {
      projectId: 5,
      version: 3,
      raw: answers({ brukssted: 'Rådhuset', modell: 'aBoks Vegg', brukervennlighet: '4', fortsette: 'Ja' }),
    })
    // The stub keeps `submittedAt` as written; the endpoint reads stored docs.
    assert.equal(store['pilot-evaluations']!.length, 1)
    const json = await handlePilotAnalytics({ payload, user: ADMIN, query: { project: '5' } } as unknown as PayloadRequest)
    assert.equal(json.status, 200)
    const body = (await json.json()) as { stats: { totalResponses: number; usability: { average: number } } }
    assert.equal(body.stats.totalResponses, 1)
    assert.equal(body.stats.usability.average, 4)

    const csv = await handlePilotAnalytics({ payload, user: ADMIN, query: { format: 'csv' } } as unknown as PayloadRequest)
    assert.equal(csv.headers.get('content-type'), 'text/csv; charset=utf-8')
    assert.match(csv.headers.get('content-disposition')!, /pilotevalueringer-alle-/)
    const text = await csv.text()
    assert.ok(text.includes('Rådhuset'))
  })
})
