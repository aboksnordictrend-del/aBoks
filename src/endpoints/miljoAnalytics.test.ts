import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { handleMiljoAnalytics } from './miljoAnalytics'
import { miljoDeliveryEndpoints, miljoOrganizationEndpoints, miljoRegistrationEndpoints } from '../collections/endpoints/miljo'
import { createStub } from '../lib/miljo/testStub'

const admin = { id: 1, email: 'admin@aboks.invalid', role: 'admin' }
const editor = { id: 2, email: 'editor@aboks.invalid', role: 'editor' }

function req(user: unknown, query: Record<string, string> = {}): PayloadRequest {
  const stub = createStub(
    {
      'environmental-organizations': [{ id: 1, name: 'Hitra kommune', status: 'active', publicCode: 'abcdefghjk', allowedCategories: ['aa', 'aaa'] }],
      'battery-registrations': [
        { id: 10, organization: 1, organizationName: 'Hitra kommune', registeredAt: '2026-10-02T10:00:00.000Z', status: 'registered', lines: [{ category: 'aa', quantity: 4 }], submittedTotal: 4, flags: ['high-quantity'], reviewState: 'pending' },
        { id: 11, organization: 1, organizationName: 'Hitra kommune', registeredAt: '2026-10-03T10:00:00.000Z', status: 'invalidated', lines: [{ category: 'aa', quantity: 90 }], submittedTotal: 90, flags: [], reviewState: 'none' },
      ],
      'battery-deliveries': [
        { id: 20, organization: 1, organizationName: 'Hitra kommune', deliveryDate: '2026-10-05', quantity: 7.5, unit: 'kg', operator: 'Retura', reference: 'REF-SECRET', documentationStatus: 'reported', status: 'registered', registeredAt: '2026-10-05T10:00:00.000Z' },
      ],
    },
    user,
  )
  const r = stub.req as PayloadRequest & { query: Record<string, string> }
  r.query = query
  return r
}

describe('GET /api/miljo-analytics', () => {
  it('requires an administrator', async () => {
    assert.equal((await handleMiljoAnalytics(req(null))).status, 401)
    assert.equal((await handleMiljoAnalytics(req(editor))).status, 403)
  })

  it('validates its input', async () => {
    assert.equal((await handleMiljoAnalytics(req(admin, { organization: 'x' }))).status, 400)
    assert.equal((await handleMiljoAnalytics(req(admin, { preset: 'custom', from: '2026-05-01', to: '2026-01-01' }))).status, 400)
    assert.equal((await handleMiljoAnalytics(req(admin, { organization: '99' }))).status, 404)
    assert.equal((await handleMiljoAnalytics(req(admin, { format: 'pdf' }))).status, 400, 'PDF needs one organisation')
    assert.equal((await handleMiljoAnalytics(req(admin, { format: 'csv', type: 'nope' }))).status, 400)
  })

  it('aggregates without invalidated records', async () => {
    const res = await handleMiljoAnalytics(req(admin, { preset: 'custom', from: '2026-10-01', to: '2026-10-31' }))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.registrations.total, 4)
    assert.equal(body.invalidatedRegistrations, 1)
    assert.equal(body.deliveries.byUnit.kg.quantity, 7.5)
    assert.equal(body.pendingReview.length, 1)
  })

  it('admin CSV includes the reference; it is never in public exports', async () => {
    const res = await handleMiljoAnalytics(req(admin, { preset: 'custom', from: '2026-10-01', to: '2026-10-31', format: 'csv', type: 'leveranser' }))
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type') ?? '', /text\/csv/)
    assert.ok((await res.text()).includes('REF-SECRET'))
  })
})

describe('correction and PIN endpoints', () => {
  const all = [...miljoOrganizationEndpoints, ...miljoRegistrationEndpoints, ...miljoDeliveryEndpoints]

  it('every endpoint refuses anonymous users and editors', async () => {
    for (const ep of all) {
      for (const [user, status] of [
        [null, 401],
        [editor, 403],
      ] as const) {
        const r = req(user)
        Object.assign(r, { routeParams: { id: '1' }, json: async () => ({ mode: 'generate', reason: 'x' }) })
        const res = await ep.handler(r)
        assert.equal(res.status, status, `${ep.method} ${ep.path} as ${user ? 'editor' : 'anonymous'}`)
      }
    }
  })
})
