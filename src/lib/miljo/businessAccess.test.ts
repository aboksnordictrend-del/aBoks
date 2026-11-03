import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { MILJO_ACCOUNTS_SLUG } from './business'
import { resolveAuthorizedBusinessCustomerId } from './businessAccess'

const verified = '2026-11-03T10:00:00.000Z'
const account = (over: Record<string, unknown> = {}) => ({
  collection: MILJO_ACCOUNTS_SLUG,
  id: 7,
  status: 'active',
  emailVerifiedAt: verified,
  businessCustomer: 42,
  ...over,
})

/** A request whose only database is a map of business customers; counts the lookups. */
function fakeReq(user: unknown, customers: Record<string, { status: string } | undefined>) {
  const calls: unknown[] = []
  const req = {
    user,
    payload: {
      findByID: async (args: { collection: string; id: unknown; overrideAccess?: boolean }) => {
        calls.push(args)
        assert.equal(args.collection, 'business-customers')
        assert.equal(args.overrideAccess, true, 'the status check must not depend on the caller’s access')
        return customers[String(args.id)] ?? null
      },
    },
  } as unknown as PayloadRequest
  return { req, calls }
}

describe('resolveAuthorizedBusinessCustomerId', () => {
  it('authorises an active, verified account whose business customer is «Aktiv»', async () => {
    const { req } = fakeReq(account(), { 42: { status: 'active' } })
    assert.equal(await resolveAuthorizedBusinessCustomerId(req), 42)
  })

  it('a populated business customer is reduced to its id and re-read from the database', async () => {
    // A stale populated status on the account must not count.
    const { req, calls } = fakeReq(account({ businessCustomer: { id: 42, status: 'active' } }), { 42: { status: 'suspended' } })
    assert.equal(await resolveAuthorizedBusinessCustomerId(req), null)
    assert.equal(calls.length, 1)
  })

  for (const status of ['suspended', 'pending', 'anything-else']) {
    it(`refuses every account of a business customer that is «${status}»`, async () => {
      const { req } = fakeReq(account(), { 42: { status } })
      assert.equal(await resolveAuthorizedBusinessCustomerId(req), null)
    })
  }

  it('refuses when the business customer no longer exists, or the lookup fails', async () => {
    assert.equal(await resolveAuthorizedBusinessCustomerId(fakeReq(account(), {}).req), null)
    const failing = { user: account(), payload: { findByID: async () => Promise.reject(new Error('db down')) } } as unknown as PayloadRequest
    assert.equal(await resolveAuthorizedBusinessCustomerId(failing), null)
  })

  it('refuses inactive, unverified, unlinked and non-Miljø principals — without a database call', async () => {
    for (const user of [
      account({ status: 'disabled' }),
      account({ status: 'invited' }),
      account({ emailVerifiedAt: null }),
      account({ businessCustomer: null }),
      { ...account(), collection: 'users', role: 'admin' },
      null,
    ]) {
      const { req, calls } = fakeReq(user, { 42: { status: 'active' } })
      assert.equal(await resolveAuthorizedBusinessCustomerId(req), null, JSON.stringify(user))
      assert.equal(calls.length, 0, JSON.stringify(user))
    }
  })

  it('checks an explicitly given account (login) instead of req.user', async () => {
    const { req } = fakeReq(null, { 42: { status: 'active' }, 43: { status: 'suspended' } })
    assert.equal(await resolveAuthorizedBusinessCustomerId(req, account()), 42)
    assert.equal(await resolveAuthorizedBusinessCustomerId(req, account({ id: 8, businessCustomer: 43 })), null)
  })

  it('reads the business customer once per request, however many access checks ask', async () => {
    const { req, calls } = fakeReq(account(), { 42: { status: 'active' } })
    const answers = await Promise.all([1, 2, 3, 4].map(() => resolveAuthorizedBusinessCustomerId(req)))
    assert.deepEqual(answers, [42, 42, 42, 42])
    assert.equal(calls.length, 1)
  })
})
