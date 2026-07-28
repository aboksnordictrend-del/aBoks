import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Field } from 'payload'
import { PromoCodes } from './PromoCodes'
import {
  COMMISSION_BASE_OPTIONS,
  DEFAULT_COMMISSION_BASE,
} from '@/lib/partner/constants'

/**
 * Stage 2 wiring checks for the partner section.
 *
 * These deliberately go through the exported `CollectionConfig` — the same approach
 * `Reviews.test.ts` takes for access control — rather than through separately exported
 * helpers. The risk in this stage is not the arithmetic (Stage 1 covers that exhaustively);
 * it is whether the fields are actually attached, conditioned and validated on the document.
 * Reaching in through the config is what tests that.
 */

/* ------------------------------ field lookup ------------------------------ */

/** Every named field, flattened through the presentational `row` / `collapsible` wrappers. */
function flatten(fields: Field[]): Field[] {
  return fields.flatMap((field) =>
    'fields' in field && Array.isArray(field.fields)
      ? [...(('name' in field) ? [field] : []), ...flatten(field.fields as Field[])]
      : [field],
  )
}

const ALL_FIELDS = flatten(PromoCodes.fields as Field[])

function fieldNamed(name: string): Field {
  const found = ALL_FIELDS.find((f) => 'name' in f && f.name === name)
  assert.ok(found, `expected a field named "${name}" on promo-codes`)
  return found
}

/** Payload's validate/condition signatures, narrowed to what these tests supply. */
type Validate = (value: unknown, args: { siblingData: unknown }) => unknown
type Condition = (data: unknown, siblingData: unknown, ctx: unknown) => boolean

const validatorFor = (name: string): Validate => {
  const field = fieldNamed(name) as { validate?: unknown }
  assert.ok(typeof field.validate === 'function', `${name} must have a validate function`)
  return field.validate as Validate
}

const conditionFor = (name: string): Condition => {
  const field = fieldNamed(name) as { admin?: { condition?: unknown } }
  const condition = field.admin?.condition
  assert.ok(typeof condition === 'function', `${name} must have an admin condition`)
  return condition as Condition
}

const PARTNER = { isPartnerCode: true }
const ORDINARY = { isPartnerCode: false }

/** The fields that must appear only once the code is marked as a partner code. */
const CONDITIONAL_FIELDS = [
  'partnerName',
  'partnerEmail',
  'partnerPhone',
  'commissionRate',
  'commissionBase',
  'partnerNote',
] as const

/* ------------------------------ 1–2. the fields exist ------------------------------ */

describe('PromoCodes — partner section', () => {
  it('adds every partner field to the collection', () => {
    for (const name of ['isPartnerCode', ...CONDITIONAL_FIELDS]) {
      assert.ok(fieldNamed(name), name)
    }
  })

  it('groups them under «Partner og provisjon»', () => {
    const section = (PromoCodes.fields as Field[]).find(
      (f) => f.type === 'collapsible' && f.label === 'Partner og provisjon',
    )
    assert.ok(section, 'expected a «Partner og provisjon» collapsible')
  })

  it('marks the partner flag as a checkbox defaulting to off', () => {
    const field = fieldNamed('isPartnerCode') as { type: string; defaultValue?: unknown }
    assert.equal(field.type, 'checkbox')
    assert.equal(field.defaultValue, false)
  })

  it('uses the field types the model calls for', () => {
    const types: Record<string, string> = {
      partnerName: 'text',
      partnerEmail: 'email',
      partnerPhone: 'text',
      commissionRate: 'number',
      commissionBase: 'select',
      partnerNote: 'textarea',
    }

    for (const [name, type] of Object.entries(types)) {
      assert.equal((fieldNamed(name) as { type: string }).type, type, name)
    }
  })

  it('reuses the Stage 1 base options and default rather than restating them', () => {
    const field = fieldNamed('commissionBase') as { options?: unknown; defaultValue?: unknown }
    assert.deepEqual(field.options, COMMISSION_BASE_OPTIONS)
    assert.equal(field.defaultValue, DEFAULT_COMMISSION_BASE)
  })

  it('leaves every partner field optional at the schema level', () => {
    // Requiredness is conditional, so it lives in the validators — never in `required: true`,
    // which Payload would enforce unconditionally and which would block saving WELCOME10.
    for (const name of ['isPartnerCode', ...CONDITIONAL_FIELDS]) {
      const field = fieldNamed(name) as { required?: unknown }
      assert.notEqual(field.required, true, `${name} must not be unconditionally required`)
    }
  })
})

/* ------------------------------ conditional visibility ------------------------------ */

describe('PromoCodes — partner fields are hidden until the code is a partner code', () => {
  it('hides all six detail fields when the checkbox is off', () => {
    for (const name of CONDITIONAL_FIELDS) {
      assert.equal(conditionFor(name)(ORDINARY, ORDINARY, {}), false, name)
    }
  })

  it('shows all six when the checkbox is on', () => {
    for (const name of CONDITIONAL_FIELDS) {
      assert.equal(conditionFor(name)(PARTNER, PARTNER, {}), true, name)
    }
  })

  it('treats a missing or non-boolean flag as "not a partner code"', () => {
    for (const data of [{}, { isPartnerCode: null }, { isPartnerCode: 'true' }, undefined]) {
      assert.equal(conditionFor('commissionRate')(data, data, {}), false, JSON.stringify(data))
    }
  })

  it('keeps the checkbox itself always visible', () => {
    const field = fieldNamed('isPartnerCode') as { admin?: { condition?: unknown } }
    assert.equal(field.admin?.condition, undefined)
  })
})

/* ------------------------------ 3. partnerName ------------------------------ */

describe('PromoCodes — partnerName validation', () => {
  const validate = validatorFor('partnerName')

  it('rejects a partner code with no name', () => {
    for (const value of [undefined, null, '', '   ']) {
      const result = validate(value, { siblingData: PARTNER })
      assert.equal(typeof result, 'string', `expected ${JSON.stringify(value)} to be rejected`)
    }
  })

  it('accepts a partner code with a name', () => {
    assert.equal(validate('Ola Nordmann', { siblingData: PARTNER }), true)
  })

  it('accepts an ordinary code with no name at all', () => {
    for (const value of [undefined, null, '']) {
      assert.equal(validate(value, { siblingData: ORDINARY }), true)
    }
  })
})

/* ------------------------------ 4–8. commissionRate ------------------------------ */

describe('PromoCodes — commissionRate validation', () => {
  const validate = validatorFor('commissionRate')

  it('rejects a partner code with no rate', () => {
    for (const value of [undefined, null, '']) {
      assert.equal(typeof validate(value, { siblingData: PARTNER }), 'string')
    }
  })

  it('accepts 0 %', () => {
    assert.equal(validate(0, { siblingData: PARTNER }), true)
  })

  it('accepts 100 %', () => {
    assert.equal(validate(100, { siblingData: PARTNER }), true)
  })

  it('accepts a fractional rate inside the range', () => {
    assert.equal(validate(12.5, { siblingData: PARTNER }), true)
  })

  it('rejects 101 %', () => {
    const result = validate(101, { siblingData: PARTNER })
    assert.equal(typeof result, 'string')
    assert.match(result as string, /100/)
  })

  it('rejects a negative rate', () => {
    assert.equal(typeof validate(-1, { siblingData: PARTNER }), 'string')
  })

  it('rejects a non-numeric rate', () => {
    assert.equal(typeof validate(Number.NaN, { siblingData: PARTNER }), 'string')
  })

  it('accepts an ordinary code with no rate', () => {
    assert.equal(validate(undefined, { siblingData: ORDINARY }), true)
  })

  it('returns Norwegian messages, never a boolean false', () => {
    const result = validate(101, { siblingData: PARTNER })
    assert.equal(typeof result, 'string')
    assert.match(result as string, /Provisjon/)
  })
})

/* ------------------------------ 9. backward compatibility ------------------------------ */

describe('PromoCodes — existing ordinary codes are unaffected', () => {
  it('still validates WELCOME10 exactly as before', () => {
    // The shape an existing row has: no partner columns at all.
    const welcome10 = {
      code: 'WELCOME10',
      active: true,
      discountType: 'percentage' as const,
      discountValue: 10,
      usageMode: 'unlimited' as const,
    }

    assert.equal(validatorFor('partnerName')(undefined, { siblingData: welcome10 }), true)
    assert.equal(validatorFor('commissionRate')(undefined, { siblingData: welcome10 }), true)
  })

  it('leaves the pre-existing fields and validators in place', () => {
    for (const name of [
      'code',
      'active',
      'name',
      'discountType',
      'discountValue',
      'usageMode',
      'maxUses',
      'startsAt',
      'expiresAt',
      'minimumOrderAmount',
      'applicableProducts',
    ]) {
      assert.ok(fieldNamed(name), name)
    }
  })

  it('leaves access control untouched — admin-only in every direction', () => {
    const access = PromoCodes.access!
    for (const key of ['read', 'create', 'update', 'delete'] as const) {
      const fn = access[key] as (args: { req: { user: unknown } }) => unknown
      assert.equal(fn({ req: { user: null } }), false, `${key} must stay closed to the public`)
      assert.equal(fn({ req: { user: { id: 1 } } }), true, `${key} allowed for an admin`)
    }
  })

  it('exposes the two cheap partner columns in the list, and no aggregates', () => {
    const columns = PromoCodes.admin?.defaultColumns ?? []
    assert.ok(columns.includes('partnerName'))
    assert.ok(columns.includes('commissionRate'))
    for (const aggregate of ['usageStats', 'commissionEarned', 'payoutBalance']) {
      assert.equal(columns.includes(aggregate), false, `${aggregate} must not be a list column`)
    }
  })
})
