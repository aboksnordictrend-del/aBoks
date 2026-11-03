// TEST-ONLY. Drives Payload's REAL REST pipeline — `handleEndpoints`, the handler behind
// /api/[...slug] — against an in-memory database, so access control, authentication, hooks and
// field access can be tested end to end without Postgres or a network. Never imported by the app.
//
// The memory adapter implements only what Payload's CRUD and auth operations call, and evaluates
// `where` for the operators those use. Any other adapter method throws, so an unexpected database
// call fails the test instead of silently succeeding. It does NOT enforce unique indexes or foreign
// keys — those are database rules and are verified against a real (preview) database.

import { buildConfig, createLocalReq, getPayload, handleEndpoints, type CollectionConfig, type Payload } from 'payload'

export type Row = Record<string, unknown> & { id: number }
type Where = Record<string, unknown>

const same = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b)
const relId = (v: unknown) => (v && typeof v === 'object' ? (v as { id?: unknown }).id : v)

function compare(value: unknown, op: string, expected: unknown): boolean {
  // A hasMany relationship is stored as an array: any element may match.
  if (Array.isArray(value) && op !== 'exists') {
    const items = value.map(relId)
    if (op === 'not_equals' || op === 'not_in') return items.every((item) => compare(item, op, expected))
    return items.some((item) => compare(item, op, expected))
  }
  switch (op) {
    case 'equals':
      return expected === null ? value == null : same(relId(value), expected)
    case 'not_equals':
      return !same(relId(value), expected)
    case 'in':
      return (expected as unknown[]).some((e) => same(relId(value), e))
    case 'not_in':
      return !(expected as unknown[]).some((e) => same(relId(value), e))
    case 'exists':
      return expected ? value != null && !(Array.isArray(value) && value.length === 0) : value == null
    case 'greater_than':
      return value != null && String(value) > String(expected)
    default:
      throw new Error(`memory adapter: unsupported operator ${op}`)
  }
}

export function matches(row: Row, where: Where | undefined): boolean {
  if (!where || Object.keys(where).length === 0) return true
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'and') return (cond as Where[]).every((w) => matches(row, w))
    if (key === 'or') return (cond as Where[]).some((w) => matches(row, w))
    return Object.entries(cond as Record<string, unknown>).every(([op, expected]) => compare(row[key], op, expected))
  })
}

/** One in-memory table per collection slug. */
export type MemoryStore = Record<string, Row[]>

function memoryAdapter(store: MemoryStore) {
  let nextId = 1000
  const table = (collection: string) => (store[collection] ??= [])
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
    findOne: async ({ collection, where }: { collection: string; where?: Where }) => {
      const row = table(collection).find((r) => matches(r, where))
      return row ? clone(row) : null
    },
    find: async ({ collection, where, limit }: { collection: string; where?: Where; limit?: number }) => {
      const docs = table(collection).filter((r) => matches(r, where)).map(clone)
      const page = limit && limit > 0 ? docs.slice(0, limit) : docs
      return { docs: page, totalDocs: docs.length, hasNextPage: false, hasPrevPage: false, page: 1, totalPages: 1, limit: limit ?? 10, pagingCounter: 1, nextPage: null, prevPage: null }
    },
    count: async ({ collection, where }: { collection: string; where?: Where }) => ({
      totalDocs: table(collection).filter((r) => matches(r, where)).length,
    }),
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      const row = { ...data, id: nextId++ } as Row
      table(collection).push(row)
      return clone(row)
    },
    updateOne: async ({ collection, id, where, data }: { collection: string; id?: number; where?: Where; data: Record<string, unknown> }) => {
      const row = table(collection).find((r) => (id != null ? String(r.id) === String(id) : matches(r, where)))
      if (!row) return null
      // `{ $inc: n }` — Payload's atomic login-attempt counter (auth/strategies/local/incrementLoginAttempts).
      for (const [k, v] of Object.entries(data)) {
        const inc = v && typeof v === 'object' && '$inc' in v ? Number((v as { $inc: unknown }).$inc) : null
        row[k] = inc == null ? v : Number(row[k] ?? 0) + inc
      }
      return clone(row)
    },
    deleteOne: async ({ collection, where }: { collection: string; where?: Where }) => {
      const rows = table(collection)
      const i = rows.findIndex((r) => matches(r, where))
      return i < 0 ? null : clone(rows.splice(i, 1)[0]!)
    },
    deleteMany: async ({ collection, where }: { collection: string; where?: Where }) => {
      const rows = table(collection)
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i]!, where)) rows.splice(i, 1)
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

export interface RestHarness {
  payload: Payload
  store: MemoryStore
  rest: (method: string, path: string, opts?: { token?: string; body?: unknown }) => Promise<{ status: number; json: Record<string, unknown> }>
  /** Log in through REST; returns the JWT. With `context`, through the Local API with that `req.context` instead. */
  login: (collection: string, email: string, password: string, context?: Record<string, unknown>) => Promise<string>
}

export async function createRestHarness(key: string, collections: CollectionConfig[]): Promise<RestHarness> {
  // Outside production Payload would otherwise open a WebSocket to a local Next dev server's HMR
  // endpoint, check package versions, and regenerate src/payload-types.ts on startup.
  process.env.DISABLE_PAYLOAD_HMR = 'true'
  process.env.PAYLOAD_DISABLE_DEPENDENCY_CHECKER = 'true'
  const store: MemoryStore = {}
  const configPromise = buildConfig({
    secret: `${key}-test-secret-not-for-production`,
    serverURL: 'http://localhost:3000',
    collections,
    db: memoryAdapter(store) as never,
    telemetry: false,
    typescript: { autoGenerate: false },
    logger: { options: { level: 'fatal' } } as never,
  })
  const payload = await getPayload({ config: configPromise, key } as never)

  const rest: RestHarness['rest'] = async (method, path, opts = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.token) headers.Authorization = `JWT ${opts.token}`
    const request = new Request(`http://localhost:3000/api${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const res = await handleEndpoints({ config: configPromise, request, payloadInstanceCacheKey: key })
    const text = await res.text()
    return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} }
  }

  const login: RestHarness['login'] = async (collection, email, password, context) => {
    if (context) {
      const req = await createLocalReq({ context }, payload)
      const res = await payload.login({ collection: collection as never, data: { email, password } as never, req })
      return String(res.token)
    }
    const res = await rest('POST', `/${collection}/login`, { body: { email, password } })
    if (res.status !== 200) throw new Error(`login ${collection} ${email}: ${res.status} ${JSON.stringify(res.json)}`)
    return String(res.json.token)
  }

  return { payload, store, rest, login }
}
