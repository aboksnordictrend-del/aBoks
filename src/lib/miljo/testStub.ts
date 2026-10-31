// In-memory stand-in for the slice of the Payload local API that ./service and ./admin use.
// Test-only. Supports the `where` operators those modules send: equals, not_equals, in,
// greater_than_equal, less_than, less_than_equal, plus and/or and one level of array paths
// (e.g. 'codeHistory.code'). Mirrors Payload's unique submissionKey and the hooks' immutability.

import type { PayloadRequest } from 'payload'

type Doc = Record<string, unknown> & { id: number }
type Where = Record<string, unknown>

function valueAt(doc: Doc, path: string): unknown[] {
  const [head, ...rest] = path.split('.')
  const v = doc[head!]
  if (rest.length === 0) return [v && typeof v === 'object' && 'id' in (v as object) ? (v as { id: unknown }).id : v]
  if (Array.isArray(v)) return v.map((row) => (row as Record<string, unknown>)[rest.join('.')])
  return []
}

function matches(doc: Doc, where?: Where): boolean {
  if (!where) return true
  for (const [key, cond] of Object.entries(where)) {
    if (key === 'and') {
      if (!(cond as Where[]).every((w) => matches(doc, w))) return false
      continue
    }
    if (key === 'or') {
      if (!(cond as Where[]).some((w) => matches(doc, w))) return false
      continue
    }
    const values = valueAt(doc, key)
    for (const [op, expected] of Object.entries(cond as Record<string, unknown>)) {
      const test = (v: unknown) => {
        switch (op) {
          case 'equals':
            return v === expected || String(v) === String(expected)
          case 'not_equals':
            return v !== expected
          case 'in':
            return (expected as unknown[]).map(String).includes(String(v))
          case 'greater_than_equal':
            return String(v) >= String(expected)
          case 'less_than':
            return String(v) < String(expected)
          case 'less_than_equal':
            return String(v) <= String(expected)
          default:
            throw new Error(`stub: unsupported operator ${op}`)
        }
      }
      if (op === 'not_equals' ? !values.every(test) : !values.some(test)) return false
    }
  }
  return true
}

export interface Stub {
  req: PayloadRequest
  db: Record<string, Doc[]>
  logs: string[]
}

export function createStub(seed: Record<string, Partial<Doc>[]> = {}, user: unknown = null): Stub {
  const db: Record<string, Doc[]> = {}
  let nextId = 1
  for (const [c, docs] of Object.entries(seed)) db[c] = docs.map((d) => ({ ...d, id: d.id ?? nextId++ }) as Doc)
  const logs: string[] = []
  const col = (c: string) => (db[c] ??= [])
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

  const payload = {
    logger: { error: (m: string) => logs.push(m), info: (m: string) => logs.push(m), warn: (m: string) => logs.push(m) },
    db: {},
    async find({ collection, where, limit }: { collection: string; where?: Where; limit?: number }) {
      const docs = col(collection).filter((d) => matches(d, where)).map(clone)
      return { docs: limit ? docs.slice(0, limit) : docs, totalDocs: docs.length }
    },
    async findByID({ collection, id }: { collection: string; id: number }) {
      const d = col(collection).find((x) => x.id === Number(id))
      if (!d) throw new Error('Not Found')
      return clone(d)
    },
    async count({ collection, where }: { collection: string; where?: Where }) {
      return { totalDocs: col(collection).filter((d) => matches(d, where)).length }
    },
    async create({ collection, data, file }: { collection: string; data: Record<string, unknown>; file?: { name: string } }) {
      if (data.submissionKey && col(collection).some((d) => d.submissionKey === data.submissionKey)) {
        throw new Error('duplicate key value violates unique constraint')
      }
      if (collection.endsWith('-audit') && data.performedBy === -1) throw new Error('audit write failed')
      const doc = { ...clone(data), id: nextId++, ...(file ? { filename: file.name } : {}) } as Doc
      col(collection).push(doc)
      return clone(doc)
    },
    async update({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) {
      const d = col(collection).find((x) => x.id === Number(id))
      if (!d) throw new Error('Not Found')
      const frozen = ['submittedLines', 'submittedTotal', 'submittedValues', 'submissionKey', 'organization', 'registeredAt']
      for (const [k, v] of Object.entries(data)) if (!frozen.includes(k)) d[k] = clone(v)
      if (Array.isArray(d.lines)) d.totalQuantity = (d.lines as { quantity: number }[]).reduce((s, l) => s + l.quantity, 0)
      return clone(d)
    },
  }
  return { req: { payload, user } as unknown as PayloadRequest, db, logs }
}
