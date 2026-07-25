import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Reviews } from './Reviews'
import { ReviewInvitations } from './ReviewInvitations'

type AccessFn = (args: { req: { user: unknown } }) => unknown

describe('Reviews access control', () => {
  const read = Reviews.access!.read as AccessFn
  const create = Reviews.access!.create as AccessFn

  it('limits public reads to approved reviews only (pending/hidden/rejected excluded)', () => {
    const result = read({ req: { user: null } })
    assert.deepEqual(result, { status: { equals: 'approved' } })
  })

  it('lets an authenticated admin read everything', () => {
    assert.equal(read({ req: { user: { id: 1 } } }), true)
  })

  it('forbids public creation of reviews (only the server handler with overrideAccess)', () => {
    assert.equal(create({ req: { user: null } }), false)
  })
})

describe('ReviewInvitations access control', () => {
  const acc = ReviewInvitations.access!
  it('is fully closed to the public across read/create/update/delete', () => {
    for (const key of ['read', 'create', 'update', 'delete'] as const) {
      const fn = acc[key] as AccessFn
      assert.equal(fn({ req: { user: null } }), false, `${key} must be closed to public`)
      assert.equal(fn({ req: { user: { id: 1 } } }), true, `${key} allowed for admin`)
    }
  })
})
