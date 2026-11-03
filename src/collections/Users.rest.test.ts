import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildConfig, getPayload, handleEndpoints, type Payload } from 'payload'
import { Users } from './Users'

/**
 * Users through Payload's REAL REST pipeline — `handleEndpoints`, the handler behind
 * /api/[...slug] — with the project's `Users` collection, real login and JWTs, and an in-memory
 * database instead of Postgres. Everything between the HTTP request and the database is Payload's
 * own code: authentication, the operations, access control (incl. `Where` results ANDed with the
 * request), field access and the `enforceUserRole` hook.
 *
 * The memory adapter implements only what these operations need, and evaluates `where` for the
 * operators they use. Any other adapter method throws, so an unexpected database call fails the
 * test instead of silently succeeding.
 */

type Row = Record<string, unknown> & { id: number }
type Where = Record<string, unknown>

function matches(row: Row, where: Where | undefined): boolean {
  if (!where || Object.keys(where).length === 0) return true
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'and') return (cond as Where[]).every((w) => matches(row, w))
    if (key === 'or') return (cond as Where[]).some((w) => matches(row, w))
    const value = row[key]
    return Object.entries(cond as Record<string, unknown>).every(([op, expected]) => {
      const same = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)
      switch (op) {
        case 'equals':
          return expected === null ? value == null : same(value, expected)
        case 'not_equals':
          return !same(value, expected)
        case 'in':
          return (expected as unknown[]).some((e) => same(value, e))
        case 'not_in':
          return !(expected as unknown[]).some((e) => same(value, e))
        case 'exists':
          return expected ? value != null : value == null
        case 'greater_than':
          return value != null && String(value) > String(expected)
        default:
          throw new Error(`memory adapter: unsupported operator ${op}`)
      }
    })
  })
}

function memoryAdapter(store: Row[]) {
  let nextId = 100
  const clone = (r: Row) => structuredClone(r)
  const impl = {
    name: 'memory',
    packageName: 'memory',
    defaultIDType: 'number',
    sessions: {},
    init: async () => {},
    connect: async () => {},
    destroy: async () => {},
    beginTransaction: async () => null,
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    findOne: async ({ where }: { where?: Where }) => {
      const row = store.find((r) => matches(r, where))
      return row ? clone(row) : null
    },
    find: async ({ where, limit }: { where?: Where; limit?: number }) => {
      const docs = store.filter((r) => matches(r, where)).map(clone)
      const page = limit && limit > 0 ? docs.slice(0, limit) : docs
      return { docs: page, totalDocs: docs.length, hasNextPage: false, hasPrevPage: false, page: 1, totalPages: 1, limit: limit ?? 10, pagingCounter: 1, nextPage: null, prevPage: null }
    },
    count: async ({ where }: { where?: Where }) => ({ totalDocs: store.filter((r) => matches(r, where)).length }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { ...data, id: nextId++ } as Row
      store.push(row)
      return clone(row)
    },
    updateOne: async ({ id, where, data }: { id?: number; where?: Where; data: Record<string, unknown> }) => {
      const row = store.find((r) => (id != null ? String(r.id) === String(id) : matches(r, where)))
      if (!row) return null
      Object.assign(row, data)
      return clone(row)
    },
    deleteOne: async ({ where }: { where?: Where }) => {
      const i = store.findIndex((r) => matches(r, where))
      if (i < 0) return null
      return clone(store.splice(i, 1)[0]!)
    },
    deleteMany: async ({ where }: { where?: Where }) => {
      for (let i = store.length - 1; i >= 0; i--) if (matches(store[i]!, where)) store.splice(i, 1)
    },
  }
  return {
    name: 'memory',
    defaultIDType: 'number' as const,
    init: ({ payload }: { payload: Payload }) =>
      new Proxy({ ...impl, payload } as Record<string | symbol, unknown>, {
        get(target, prop) {
          if (prop in target || prop === 'then' || typeof prop === 'symbol') return target[prop]
          return () => {
            throw new Error(`memory adapter: unexpected call db.${String(prop)}`)
          }
        },
      }),
  }
}

const PASSWORD = 'Stage0-test-only-1'
const store: Row[] = []
let configPromise: ReturnType<typeof buildConfig>
let payload: Payload
const ids = { admin: 0, admin2: 0, editor: 0, editor2: 0 }
const tokens = { admin: '', editor: '' }

async function rest(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token) headers.Authorization = `JWT ${opts.token}`
  const request = new Request(`http://localhost:3000/api${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  const res = await handleEndpoints({ config: configPromise, request, payloadInstanceCacheKey: 'users-rest-test' })
  const text = await res.text()
  return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} }
}

const row = (id: number) => store.find((r) => r.id === id)

before(async () => {
  // Outside production Payload would otherwise open a WebSocket to a local Next dev server's HMR
  // endpoint, check package versions, and regenerate src/payload-types.ts on startup.
  process.env.DISABLE_PAYLOAD_HMR = 'true'
  process.env.PAYLOAD_DISABLE_DEPENDENCY_CHECKER = 'true'
  configPromise = buildConfig({
    secret: 'users-rest-test-secret-not-for-production',
    serverURL: 'http://localhost:3000',
    collections: [Users],
    db: memoryAdapter(store) as never,
    telemetry: false,
    typescript: { autoGenerate: false },
    logger: { options: { level: 'error' } } as never,
  })
  payload = await getPayload({ config: configPromise, key: 'users-rest-test' } as never)

  // Seeded with the Local API and overrideAccess — the trusted path, like Payload's first-user screen.
  const make = async (email: string, role: string) =>
    (await payload.create({ collection: 'users', data: { email, password: PASSWORD, role } as never })).id as number
  ids.admin = await make('admin@aboks.invalid', 'admin')
  ids.admin2 = await make('admin2@aboks.invalid', 'admin')
  ids.editor = await make('editor@aboks.invalid', 'editor')
  ids.editor2 = await make('editor2@aboks.invalid', 'editor')

  for (const who of ['admin', 'editor'] as const) {
    const res = await rest('POST', '/users/login', { body: { email: `${who}@aboks.invalid`, password: PASSWORD } })
    assert.equal(res.status, 200, `${who} login: ${JSON.stringify(res.json)}`)
    tokens[who] = String(res.json.token)
  }
})

after(async () => {
  await payload?.destroy?.()
})

describe('Users over REST — editor', () => {
  it('POST /api/users (create) → 403, nothing stored', async () => {
    const before = store.length
    const res = await rest('POST', '/users', { token: tokens.editor, body: { email: 'new@aboks.invalid', password: PASSWORD, role: 'editor' } })
    assert.equal(res.status, 403)
    assert.equal(store.length, before)
  })

  it('DELETE /api/users/:id → 403 for an administrator, another editor and themselves', async () => {
    for (const id of [ids.admin, ids.editor2, ids.editor]) {
      const res = await rest('DELETE', `/users/${id}`, { token: tokens.editor })
      assert.equal(res.status, 403, `id ${id}`)
      assert.ok(row(id), `user ${id} still exists`)
    }
  })

  it('bulk DELETE /api/users?where[id][in]=… → 403, nobody deleted', async () => {
    const before = store.length
    const res = await rest('DELETE', `/users?where[id][in]=${ids.admin},${ids.editor2}`, { token: tokens.editor })
    assert.equal(res.status, 403)
    assert.equal(store.length, before)
  })

  it('PATCH /api/users/:adminId (e-mail, password, name) → 403, administrator unchanged', async () => {
    const snapshot = structuredClone(row(ids.admin))
    const res = await rest('PATCH', `/users/${ids.admin}`, {
      token: tokens.editor,
      body: { email: 'taken@aboks.invalid', password: 'Hijacked-1', name: 'x' },
    })
    assert.equal(res.status, 403)
    assert.deepEqual(row(ids.admin), snapshot)
  })

  it('PATCH /api/users/:otherEditorId → 403', async () => {
    const snapshot = structuredClone(row(ids.editor2))
    const res = await rest('PATCH', `/users/${ids.editor2}`, { token: tokens.editor, body: { name: 'x' } })
    assert.equal(res.status, 403)
    assert.deepEqual(row(ids.editor2), snapshot)
  })

  it('bulk PATCH /api/users?where[role][equals]=admin → changes no administrator', async () => {
    const snapshots = [ids.admin, ids.admin2].map((id) => structuredClone(row(id)))
    await rest('PATCH', '/users?where[role][equals]=admin', { token: tokens.editor, body: { name: 'bulk' } })
    assert.deepEqual([ids.admin, ids.admin2].map((id) => row(id)), snapshots)
  })

  it('PATCH own profile: name is saved; role «admin» is ignored and stays editor', async () => {
    const res = await rest('PATCH', `/users/${ids.editor}`, { token: tokens.editor, body: { name: 'Redaktør Test', role: 'admin' } })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    assert.equal(row(ids.editor)?.name, 'Redaktør Test')
    assert.equal(row(ids.editor)?.role, 'editor')
  })

  it('PATCH own profile cannot write Payload auth internals (login attempts, lock, hash)', async () => {
    const snapshot = structuredClone(row(ids.editor))
    await rest('PATCH', `/users/${ids.editor}`, {
      token: tokens.editor,
      body: { loginAttempts: 99, lockUntil: '2099-01-01T00:00:00.000Z', hash: 'x', salt: 'y' },
    })
    const after = row(ids.editor)!
    for (const key of ['loginAttempts', 'lockUntil', 'hash', 'salt']) assert.deepEqual(after[key], snapshot?.[key], key)
  })
})

describe('Users over REST — anonymous', () => {
  it('cannot create, list, change or delete users', async () => {
    const before = structuredClone(store)
    assert.equal((await rest('POST', '/users', { body: { email: 'anon@aboks.invalid', password: PASSWORD } })).status, 403)
    assert.equal((await rest('GET', '/users')).status, 403)
    assert.equal((await rest('PATCH', `/users/${ids.editor2}`, { body: { name: 'x' } })).status, 403)
    assert.equal((await rest('DELETE', `/users/${ids.editor2}`)).status, 403)
    assert.deepEqual(store, before)
  })
})

describe('Users over REST — administrator (unchanged)', () => {
  it('creates a user with a chosen role', async () => {
    const res = await rest('POST', '/users', { token: tokens.admin, body: { email: 'made@aboks.invalid', password: PASSWORD, role: 'editor' } })
    assert.equal(res.status, 201, JSON.stringify(res.json))
    const created = store.find((r) => r.email === 'made@aboks.invalid')
    assert.equal(created?.role, 'editor')
  })

  it('changes another user’s role', async () => {
    const res = await rest('PATCH', `/users/${ids.editor2}`, { token: tokens.admin, body: { role: 'admin' } })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    assert.equal(row(ids.editor2)?.role, 'admin')
  })

  it('deletes a user', async () => {
    const id = store.find((r) => r.email === 'made@aboks.invalid')!.id
    const res = await rest('DELETE', `/users/${id}`, { token: tokens.admin })
    assert.equal(res.status, 200, JSON.stringify(res.json))
    assert.equal(row(id), undefined)
  })
})
