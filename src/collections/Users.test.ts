import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { Users } from './Users'
import { enforceUserRole } from './hooks/userRole'

/**
 * Users: no privilege escalation from editor to administrator.
 *
 *   • only an administrator assigns or changes a role — field access, plus `enforceUserRole`
 *     because a role stripped by field access falls back to the default (`admin`) on create;
 *   • an editor cannot change or delete an administrator account (no password/e-mail takeover);
 *   • anonymous visitors and accounts from other auth collections cannot touch `users` at all.
 */

const ADMIN = { collection: 'users', id: 1, role: 'admin' }
const EDITOR = { collection: 'users', id: 2, role: 'editor' }
const FOREIGN = { collection: 'miljo-accounts', id: 2, role: 'admin' }
const NO_ROLE = { collection: 'users', id: 3 }

type AccessFn = (args: { req: { user: unknown } }) => unknown
const run = (fn: unknown, user: unknown) => (fn as AccessFn)({ req: { user } })

const roleField = Users.fields.find((f) => (f as { name?: string }).name === 'role') as Field & {
  access?: { create?: unknown; update?: unknown; read?: unknown }
  defaultValue?: unknown
}

type HookArgs = Parameters<typeof enforceUserRole>[0]
const hook = (args: { data: Record<string, unknown>; operation: 'create' | 'update'; user: unknown; originalDoc?: Record<string, unknown> }) =>
  enforceUserRole({
    data: args.data,
    operation: args.operation,
    originalDoc: args.originalDoc,
    req: { user: args.user },
  } as unknown as HookArgs) as Record<string, unknown>

describe('Users — collection access', () => {
  it('only staff can read, create and unlock users', () => {
    for (const op of ['read', 'create', 'unlock'] as const) {
      const fn = Users.access![op]
      assert.equal(run(fn, ADMIN), true, op)
      assert.equal(run(fn, EDITOR), true, op)
      for (const user of [null, FOREIGN, NO_ROLE]) assert.equal(run(fn, user), false, `${op} ${JSON.stringify(user)}`)
    }
  })

  for (const op of ['update', 'delete'] as const) {
    it(`${op}: an admin any user, an editor only editor accounts, nobody else anything`, () => {
      const fn = Users.access![op]
      assert.equal(run(fn, ADMIN), true)
      assert.deepEqual(run(fn, EDITOR), { role: { equals: 'editor' } }, 'editor must never match an admin account')
      for (const user of [null, FOREIGN, NO_ROLE]) assert.equal(run(fn, user), false, JSON.stringify(user))
    })
  }

  it('the admin panel itself is staff only', () => {
    assert.equal(run(Users.access!.admin, ADMIN), true)
    assert.equal(run(Users.access!.admin, EDITOR), true)
    assert.equal(run(Users.access!.admin, FOREIGN), false)
    assert.equal(run(Users.access!.admin, null), false)
  })
})

describe('Users — role field', () => {
  it('can be set on create and changed on update by an administrator only', () => {
    for (const op of ['create', 'update'] as const) {
      const fn = roleField.access?.[op]
      assert.equal(typeof fn, 'function', op)
      assert.equal(run(fn, ADMIN), true, op)
      for (const user of [EDITOR, FOREIGN, NO_ROLE, null]) assert.equal(run(fn, user), false, `${op} ${JSON.stringify(user)}`)
    }
  })

  it('stays readable (the admin list shows it)', () => {
    assert.equal(roleField.access?.read, undefined)
  })

  it('is settled by the collection hook', () => {
    assert.ok(Users.hooks?.beforeChange?.includes(enforceUserRole))
  })
})

describe('enforceUserRole — editors cannot produce or change a role', () => {
  it('a user created by an editor is an editor, even when the default «admin» was filled in', () => {
    // What Payload hands the hook after field access stripped the editor's value and applied the default.
    assert.equal(hook({ data: { email: 'x@aboks.invalid', role: 'admin' }, operation: 'create', user: EDITOR }).role, 'editor')
    assert.equal(hook({ data: { email: 'x@aboks.invalid' }, operation: 'create', user: EDITOR }).role, 'editor')
  })

  it('an editor cannot promote themselves or anyone else', () => {
    const result = hook({ data: { role: 'admin' }, operation: 'update', user: EDITOR, originalDoc: { id: 2, role: 'editor' } })
    assert.equal(result.role, 'editor')
  })

  it('an editor cannot demote an administrator either', () => {
    const result = hook({ data: { role: 'editor' }, operation: 'update', user: EDITOR, originalDoc: { id: 1, role: 'admin' } })
    assert.equal(result.role, 'admin')
  })

  it('an editor can still edit editor accounts — the stored role is simply kept', () => {
    const result = hook({ data: { name: 'Ny', role: 'editor' }, operation: 'update', user: EDITOR, originalDoc: { id: 4, role: 'editor' } })
    assert.deepEqual(result, { name: 'Ny', role: 'editor' })
  })

  it('a foreign-collection account is treated like an editor (it cannot reach users anyway)', () => {
    assert.equal(hook({ data: { role: 'admin' }, operation: 'create', user: FOREIGN }).role, 'editor')
  })

  it('an administrator assigns and changes roles freely', () => {
    assert.equal(hook({ data: { role: 'admin' }, operation: 'create', user: ADMIN }).role, 'admin')
    assert.equal(hook({ data: { role: 'editor' }, operation: 'create', user: ADMIN }).role, 'editor')
    assert.equal(hook({ data: { role: 'admin' }, operation: 'update', user: ADMIN, originalDoc: { id: 2, role: 'editor' } }).role, 'admin')
    assert.equal(hook({ data: { role: 'editor' }, operation: 'update', user: ADMIN, originalDoc: { id: 1, role: 'admin' } }).role, 'editor')
  })

  it('trusted server code and «create first user» (no req.user) keep the submitted role', () => {
    assert.equal(hook({ data: { role: 'admin' }, operation: 'create', user: null }).role, 'admin')
  })
})
