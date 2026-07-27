import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROMO_UNSUPPORTED_MESSAGE,
  SUPPORTED_USAGE_MODES,
  checkPromoLaunchSupport,
} from './supportPolicy'
import { PromoCodes } from '@/collections/PromoCodes'

const supported = (promo: Parameters<typeof checkPromoLaunchSupport>[0]) =>
  checkPromoLaunchSupport(promo).supported

const refusedFor = (promo: Parameters<typeof checkPromoLaunchSupport>[0]) => {
  const decision = checkPromoLaunchSupport(promo)
  assert.equal(decision.supported, false)
  if (decision.supported) throw new Error('unreachable')
  assert.equal(decision.customerMessage, PROMO_UNSUPPORTED_MESSAGE)
  return decision.reason
}

describe('checkPromoLaunchSupport — supported configurations', () => {
  it('accepts a plain reusable code', () => {
    assert.equal(supported({ usageMode: 'unlimited' }), true)
  })

  it('treats a blank or absent mode as reusable', () => {
    assert.equal(supported({}), true)
    assert.equal(supported({ usageMode: null }), true)
    assert.equal(supported({ usageMode: '' }), true)
  })

  it('does not care about percentage vs fixed, dates, minimums or product limits', () => {
    // None of those fields are inputs to this decision at all — only the usage ceiling is.
    assert.equal(supported({ usageMode: 'unlimited', maxUses: null }), true)
    assert.equal(supported({ usageMode: 'unlimited', maxUses: 0 }), true)
  })
})

describe('checkPromoLaunchSupport — unsupported configurations', () => {
  it('refuses a globally single-use code', () => {
    assert.equal(refusedFor({ usageMode: 'single_use_global' }), 'single_use_not_supported')
  })

  it('refuses a limited-count code', () => {
    assert.equal(refusedFor({ usageMode: 'limited', maxUses: 50 }), 'limited_uses_not_supported')
  })

  it('refuses a once-per-customer code', () => {
    assert.equal(refusedFor({ usageMode: 'once_per_customer' }), 'once_per_customer_not_supported')
  })

  it('refuses an unknown mode rather than assuming it is unlimited', () => {
    assert.equal(refusedFor({ usageMode: 'some_future_mode' }), 'unknown_mode_not_supported')
    assert.equal(refusedFor({ usageMode: 'UNLIMITED' }), 'unknown_mode_not_supported')
  })

  it('refuses a stale usage ceiling even when the mode says unlimited', () => {
    // A row whose mode was switched back but whose limit was left behind is ambiguous, and
    // ambiguity must fail closed — never silently become an unlimited code.
    assert.equal(refusedFor({ usageMode: 'unlimited', maxUses: 5 }), 'limited_uses_not_supported')
  })

  it('never leaks the specific mode to the customer', () => {
    for (const mode of ['single_use_global', 'limited', 'once_per_customer', 'bogus']) {
      const decision = checkPromoLaunchSupport({ usageMode: mode, maxUses: 3 })
      if (decision.supported) throw new Error('unreachable')
      assert.equal(decision.customerMessage, 'Denne rabattkoden er ikke tilgjengelig akkurat nå.')
    }
  })
})

describe('admin surface', () => {
  it('offers only the supported modes in the admin select', () => {
    const row = PromoCodes.fields.find(
      (f) => 'fields' in f && f.fields.some((sub) => 'name' in sub && sub.name === 'usageMode'),
    ) as { fields: { name?: string; options?: { value: string }[]; validate?: unknown }[] }
    const field = row.fields.find((f) => f.name === 'usageMode')!

    assert.deepEqual(field.options?.map((o) => o.value), ['unlimited'])
    assert.equal(typeof field.validate, 'function', 'a save-time guard is attached too')
  })

  it('the admin guard blocks each unsupported configuration with a Norwegian message', () => {
    const row = PromoCodes.fields.find(
      (f) => 'fields' in f && f.fields.some((sub) => 'name' in sub && sub.name === 'usageMode'),
    ) as { fields: { name?: string; validate?: (v: unknown, o: unknown) => unknown }[] }
    const validate = row.fields.find((f) => f.name === 'usageMode')!.validate!

    assert.equal(validate('unlimited', { siblingData: {} }), true)
    for (const mode of ['single_use_global', 'limited', 'once_per_customer']) {
      const result = validate(mode, { siblingData: { maxUses: 5 } })
      assert.equal(typeof result, 'string', `${mode} must be blocked`)
      assert.match(String(result), /gjenbrukbare/)
    }
    // A stale limit is blocked too.
    assert.equal(typeof validate('unlimited', { siblingData: { maxUses: 5 } }), 'string')
  })

  it('exports exactly the modes an admin may currently choose', () => {
    assert.deepEqual(SUPPORTED_USAGE_MODES, ['unlimited'])
  })
})
