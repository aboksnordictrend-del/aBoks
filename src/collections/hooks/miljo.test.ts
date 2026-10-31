import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { enforceDeliveryRules } from './miljo'

type HookArgs = Parameters<typeof enforceDeliveryRules>[0]
const run = (args: Partial<HookArgs>) => enforceDeliveryRules({ context: {}, req: {} as never, collection: {} as never, ...args } as HookArgs)

describe('battery-deliveries hook — documentation integrity', () => {
  it('refuses «documented» without a document on create, from any caller', async () => {
    await assert.rejects(async () => run({ operation: 'create', data: { documentationStatus: 'documented', document: null } }), /krever at leveransen har et vedlegg/)
    assert.ok(await run({ operation: 'create', data: { documentationStatus: 'documented', document: 12 } }))
    assert.ok(await run({ operation: 'create', data: { documentationStatus: 'reported', document: null } }))
  })

  it('refuses switching an undocumented delivery to «documented» on update', async () => {
    const originalDoc = { id: 1, documentationStatus: 'reported', document: null, submittedValues: { quantity: 1 } }
    await assert.rejects(async () => run({ operation: 'update', originalDoc, data: { documentationStatus: 'documented' } }), /vedlegg/)
    const out = (await run({ operation: 'update', originalDoc: { ...originalDoc, document: 5 }, data: { documentationStatus: 'documented', submittedValues: { quantity: 999 } } })) as Record<string, unknown>
    assert.deepEqual(out.submittedValues, { quantity: 1 }, 'originals stay frozen')
  })
})
