import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MILJO_ACCOUNTS_SLUG,
  accountCanAuthenticate,
  isEligibleOrderStatus,
  isMiljoAccountUser,
  orderGrantsEligibility,
  relationshipId,
} from './business'
import { isAdminUser, isStaffUser } from '@/lib/security/staffAccess'

const verified = '2026-11-03T10:00:00.000Z'
const account = (over: Record<string, unknown> = {}) => ({
  collection: MILJO_ACCOUNTS_SLUG,
  id: 7,
  status: 'active',
  emailVerifiedAt: verified,
  businessCustomer: 42,
  ...over,
})

describe('eligible order statuses', () => {
  it('confirmed, shipped and delivered qualify — an invoice order once confirmed', () => {
    for (const s of ['confirmed', 'shipped', 'delivered']) assert.equal(isEligibleOrderStatus(s), true, s)
  })
  it('pending, cancelled and anything unknown do not (fail closed)', () => {
    for (const s of ['pending', 'cancelled', '', null, undefined, 'refunded', 1]) assert.equal(isEligibleOrderStatus(s), false, String(s))
  })
})

describe('Miljø account principal', () => {
  it('only the miljo-accounts collection is a Miljø account', () => {
    assert.equal(isMiljoAccountUser(account()), true)
    for (const u of [null, undefined, {}, { collection: 'users', role: 'admin' }, 'miljo-accounts']) assert.equal(isMiljoAccountUser(u), false)
  })

  it('may authenticate only when active AND e-mail verified', () => {
    assert.equal(accountCanAuthenticate(account()), true)
    assert.equal(accountCanAuthenticate(account({ status: 'invited' })), false)
    assert.equal(accountCanAuthenticate(account({ status: 'disabled' })), false)
    assert.equal(accountCanAuthenticate(account({ emailVerifiedAt: null })), false)
    assert.equal(accountCanAuthenticate(account({ emailVerifiedAt: '' })), false)
    assert.equal(accountCanAuthenticate(null), false)
  })

  it('is never staff, even with a field that happens to be called role', () => {
    const sneaky = account({ role: 'admin' })
    assert.equal(isStaffUser(sneaky), false)
    assert.equal(isAdminUser(sneaky), false)
  })
})

describe('orderGrantsEligibility', () => {
  it('only an order linked to THIS business customer and currently eligible counts', () => {
    assert.equal(orderGrantsEligibility({ businessCustomer: 42, status: 'confirmed' }, 42), true)
    assert.equal(orderGrantsEligibility({ businessCustomer: { id: 42 }, status: 'delivered' }, '42'), true)
    assert.equal(orderGrantsEligibility({ businessCustomer: 43, status: 'confirmed' }, 42), false, 'another company')
    assert.equal(orderGrantsEligibility({ businessCustomer: null, status: 'confirmed' }, 42), false, 'unlinked')
    assert.equal(orderGrantsEligibility({ businessCustomer: 42, status: 'cancelled' }, 42), false, 'link kept, no longer eligible')
    assert.equal(orderGrantsEligibility({ businessCustomer: 42, status: 'pending' }, 42), false)
    assert.equal(orderGrantsEligibility(null, 42), false)
  })
})

describe('relationshipId', () => {
  it('reads raw ids and populated documents', () => {
    assert.equal(relationshipId(5), 5)
    assert.equal(relationshipId('5'), '5')
    assert.equal(relationshipId({ id: 5 }), 5)
    for (const v of [null, undefined, '', {}, { id: null }]) assert.equal(relationshipId(v), null)
  })
})
