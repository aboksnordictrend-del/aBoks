import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRestHarness, type RestHarness, type Row } from '@/lib/testing/payloadRestHarness'
import { Users } from './Users'

/**
 * Users through Payload's REAL REST pipeline — `handleEndpoints`, the handler behind
 * /api/[...slug] — with the project's `Users` collection, real login and JWTs, and an in-memory
 * database instead of Postgres. Everything between the HTTP request and the database is Payload's
 * own code: authentication, the operations, access control (incl. `Where` results ANDed with the
 * request), field access and the `enforceUserRole` hook.
 *
 * The in-memory database and the REST helper are shared: see @/lib/testing/payloadRestHarness.
 */

const PASSWORD = 'Stage0-test-only-1'
let h: RestHarness
let store: Row[]
const ids = { admin: 0, admin2: 0, editor: 0, editor2: 0 }
const tokens = { admin: '', editor: '' }

const rest: RestHarness['rest'] = (...args) => h.rest(...args)
const row = (id: number) => store.find((r) => r.id === id)

before(async () => {
  h = await createRestHarness('users-rest-test', [Users])

  // Seeded with the Local API and overrideAccess — the trusted path, like Payload's first-user screen.
  const make = async (email: string, role: string) =>
    (await h.payload.create({ collection: 'users', data: { email, password: PASSWORD, role } as never })).id as number
  ids.admin = await make('admin@aboks.invalid', 'admin')
  ids.admin2 = await make('admin2@aboks.invalid', 'admin')
  ids.editor = await make('editor@aboks.invalid', 'editor')
  ids.editor2 = await make('editor2@aboks.invalid', 'editor')
  store = h.store.users!

  tokens.admin = await h.login('users', 'admin@aboks.invalid', PASSWORD)
  tokens.editor = await h.login('users', 'editor@aboks.invalid', PASSWORD)
})

after(async () => {
  await h?.payload.destroy?.()
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
