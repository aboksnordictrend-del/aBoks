import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Payload, PayloadRequest } from 'payload'
import { assignOrderNumber } from './orderNumber'
import { allocateOrderNumber, formatOrderNumber } from '@/lib/orderNumber'
import { Orders } from '../Orders'

/** Minimal Payload stand-in: a drizzle executor plus the `find` used by the fallback. */
function fakePayload(opts: {
  sequence?: () => unknown
  taken?: string[]
}): { payload: Payload; findCalls: string[] } {
  const findCalls: string[] = []
  const payload = {
    db: {
      drizzle: {
        execute: async () => {
          if (!opts.sequence) throw new Error('relation "orders_order_number_seq" does not exist')
          return opts.sequence()
        },
      },
    },
    find: async ({ where }: { where: { orderNumber: { equals: string } } }) => {
      const candidate = where.orderNumber.equals
      findCalls.push(candidate)
      return { docs: opts.taken?.includes(candidate) ? [{ id: 1 }] : [] }
    },
    logger: { warn: () => {}, error: () => {} },
  } as unknown as Payload

  return { payload, findCalls }
}

const reqWith = (payload: Payload) => ({ payload }) as unknown as PayloadRequest

describe('formatOrderNumber', () => {
  it('keeps the existing AB- + 6 digit series', () => {
    assert.equal(formatOrderNumber(37514), 'AB-037514')
    assert.equal(formatOrderNumber(1), 'AB-000001')
  })
})

describe('allocateOrderNumber', () => {
  it('formats the value handed out by the sequence', async () => {
    // node-postgres returns bigint as a string.
    const { payload } = fakePayload({ sequence: () => ({ rows: [{ counter: '37514' }] }) })
    assert.equal(await allocateOrderNumber(payload), 'AB-037514')
  })

  it('accepts a driver that returns bare rows instead of { rows }', async () => {
    const { payload } = fakePayload({ sequence: () => [{ counter: 37515 }] })
    assert.equal(await allocateOrderNumber(payload), 'AB-037515')
  })

  it('never issues the same number twice — consecutive calls follow the sequence', async () => {
    let counter = 37513
    const { payload } = fakePayload({ sequence: () => ({ rows: [{ counter: String(++counter) }] }) })
    const numbers = [
      await allocateOrderNumber(payload),
      await allocateOrderNumber(payload),
      await allocateOrderNumber(payload),
    ]
    assert.deepEqual(numbers, ['AB-037514', 'AB-037515', 'AB-037516'])
  })

  it('falls back to an unused random number when the sequence is missing', async () => {
    const { payload, findCalls } = fakePayload({ taken: [] })
    const number = await allocateOrderNumber(payload)
    assert.match(number, /^AB-\d{6}$/)
    // The fallback verifies the candidate against existing orders instead of using it blind.
    assert.deepEqual(findCalls, [number])
  })

  it('fallback skips a candidate that an order already uses', async (t) => {
    // Deterministic draws: 'AB-029399' first, then 'AB-030399'.
    const draws = [0.1, 0.2]
    t.mock.method(Math, 'random', () => draws.shift() ?? 0.2)

    const { payload, findCalls } = fakePayload({ taken: ['AB-029399'] })
    assert.equal(await allocateOrderNumber(payload), 'AB-030399')
    assert.deepEqual(findCalls, ['AB-029399', 'AB-030399'])
  })
})

describe('assignOrderNumber hook', () => {
  it('generates a number on create when the admin form submitted none', async () => {
    const { payload } = fakePayload({ sequence: () => ({ rows: [{ counter: '37514' }] }) })
    const data = { subtotal: 100, total: 100 } as Record<string, unknown>

    const result = await assignOrderNumber({
      data,
      operation: 'create',
      req: reqWith(payload),
    } as never)

    assert.equal((result as { orderNumber: string }).orderNumber, 'AB-037514')
    // Mutated in place — Payload carries `data` on into validation.
    assert.equal(data.orderNumber, 'AB-037514')
  })

  it('treats an empty string from the read-only input as missing', async () => {
    const { payload } = fakePayload({ sequence: () => ({ rows: [{ counter: '37520' }] }) })
    const data = { orderNumber: '   ' } as Record<string, unknown>

    await assignOrderNumber({ data, operation: 'create', req: reqWith(payload) } as never)
    assert.equal(data.orderNumber, 'AB-037520')
  })

  it('keeps the number the checkout already allocated', async () => {
    const { payload } = fakePayload({ sequence: () => ({ rows: [{ counter: '99999' }] }) })
    const data = { orderNumber: 'AB-037001' } as Record<string, unknown>

    await assignOrderNumber({ data, operation: 'create', req: reqWith(payload) } as never)
    assert.equal(data.orderNumber, 'AB-037001')
  })

  it('never touches an existing order on update', async () => {
    const { payload } = fakePayload({ sequence: () => ({ rows: [{ counter: '99999' }] }) })
    const data = { status: 'shipped' } as Record<string, unknown>

    await assignOrderNumber({ data, operation: 'update', req: reqWith(payload) } as never)
    assert.equal(data.orderNumber, undefined)
  })
})

describe('orderNumber field validation', () => {
  const field = Orders.fields.find(
    (f) => 'name' in f && f.name === 'orderNumber',
  ) as { validate: (value: unknown, opts: { operation: 'create' | 'update' }) => unknown }

  it('lets an empty value through on create — the hook fills it in', () => {
    assert.equal(field.validate('', { operation: 'create' }), true)
    assert.equal(field.validate(undefined, { operation: 'create' }), true)
  })

  it('still refuses to blank the number on update', () => {
    assert.equal(field.validate('AB-037514', { operation: 'update' }), true)
    assert.equal(typeof field.validate('', { operation: 'update' }), 'string')
    assert.equal(typeof field.validate(null, { operation: 'update' }), 'string')
  })
})
