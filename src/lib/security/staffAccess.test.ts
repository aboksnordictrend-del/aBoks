import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { CollectionConfig, Endpoint, GlobalConfig, PayloadRequest } from 'payload'
import { isAdminUser, isStaffUser } from './staffAccess'
import { BatteryDeliveries } from '@/collections/BatteryDeliveries'
import { BatteryDeliveryDocuments } from '@/collections/BatteryDeliveryDocuments'
import { BatteryRegistrations } from '@/collections/BatteryRegistrations'
import { Customers } from '@/collections/Customers'
import { EnvironmentalOrganizations } from '@/collections/EnvironmentalOrganizations'
import { MarketingExpenses } from '@/collections/MarketingExpenses'
import { Media } from '@/collections/Media'
import { BatteryDeliveryAudit, BatteryRegistrationAudit } from '@/collections/MiljoAudit'
import { Orders } from '@/collections/Orders'
import { PartnerPayouts } from '@/collections/PartnerPayouts'
import { Partners } from '@/collections/Partners'
import { PilotEvaluations } from '@/collections/PilotEvaluations'
import { PilotProjects } from '@/collections/PilotProjects'
import { ProductVariants } from '@/collections/ProductVariants'
import { Products } from '@/collections/Products'
import { PromoCodeUsages } from '@/collections/PromoCodeUsages'
import { PromoCodes } from '@/collections/PromoCodes'
import { ReferralCommissionAdjustments } from '@/collections/ReferralCommissionAdjustments'
import { ReferralSales } from '@/collections/ReferralSales'
import { ReferredCustomers } from '@/collections/ReferredCustomers'
import { ReviewInvitations } from '@/collections/ReviewInvitations'
import { ReviewPhotos } from '@/collections/ReviewPhotos'
import { Reviews } from '@/collections/Reviews'
import { Users } from '@/collections/Users'
import { BusinessCustomers } from '@/collections/BusinessCustomers'
import { MiljoAccounts } from '@/collections/MiljoAccounts'
import { EconomySettings } from '@/globals/EconomySettings'
import { PinterestConnection } from '@/globals/PinterestConnection'
import { TikTokConnection } from '@/globals/TikTokConnection'
import { analyticsEndpoint } from '@/endpoints/analytics'
import { googleExpensesEndpoint } from '@/endpoints/googleExpenses'
import { googleStatusEndpoint } from '@/endpoints/googleStatus'
import { googleSyncEndpoint } from '@/endpoints/googleSync'
import { marketingChannelsEndpoint } from '@/endpoints/marketingChannels'
import { metaExpensesEndpoint } from '@/endpoints/metaExpenses'
import { metaSyncEndpoint } from '@/endpoints/metaSync'
import { miljoAnalyticsEndpoint } from '@/endpoints/miljoAnalytics'
import { pilotAnalyticsEndpoint } from '@/endpoints/pilotAnalytics'
import { pinterestExpensesEndpoint } from '@/endpoints/pinterestExpenses'
import { pinterestExportEndpoint, pinterestExportPreviewEndpoint } from '@/endpoints/pinterestExport'
import { pinterestOAuthStartEndpoint } from '@/endpoints/pinterestOAuthStart'
import { pinterestStatusEndpoint } from '@/endpoints/pinterestStatus'
import { pinterestSyncEndpoint } from '@/endpoints/pinterestSync'
import { blobImagesRevalidateEndpoint } from '@/endpoints/revalidateBlobImages'
import { tiktokAdvertisersEndpoint } from '@/endpoints/tiktokAdvertisers'
import { tiktokConnectEndpoint } from '@/endpoints/tiktokConnect'
import { tiktokExpensesEndpoint } from '@/endpoints/tiktokExpenses'
import { tiktokStatusEndpoint } from '@/endpoints/tiktokStatus'
import { tiktokSyncEndpoint } from '@/endpoints/tiktokSync'

/**
 * Stage 0 security boundary: only `users`-collection staff reach internal data.
 *
 * `FOREIGN` stands for an account from any other auth collection — e.g. a future Miljøregistrering
 * organisation account — and is given `role: 'admin'` on purpose: a field that happens to share the
 * name must never be mistaken for staff authority.
 */

const ADMIN = { collection: 'users', id: 1, role: 'admin' }
const EDITOR = { collection: 'users', id: 2, role: 'editor' }
const FOREIGN = { collection: 'miljo-accounts', id: 1, role: 'admin' }
const NO_ROLE = { collection: 'users', id: 3 }

type AccessFn = (args: { req: { user: unknown } }) => unknown
const run = (fn: unknown, user: unknown) => (fn as AccessFn)({ req: { user } })

describe('isStaffUser / isAdminUser', () => {
  it('accepts users-collection admins and editors as staff; only admins as admin', () => {
    assert.equal(isStaffUser(ADMIN), true)
    assert.equal(isStaffUser(EDITOR), true)
    assert.equal(isAdminUser(ADMIN), true)
    assert.equal(isAdminUser(EDITOR), false)
  })

  it('refuses anonymous, other auth collections, missing collection and missing or unknown roles', () => {
    for (const user of [null, undefined, FOREIGN, { id: 1, role: 'admin' }, NO_ROLE, { collection: 'users', role: 'owner' }, 'admin', 1]) {
      assert.equal(isStaffUser(user), false, JSON.stringify(user))
      assert.equal(isAdminUser(user), false, JSON.stringify(user))
    }
  })
})

/* ---------------------------- collection matrix ---------------------------- */

/** Who an operation is open to. `public` = everyone; `staff` = admin + editor; `closed` = nobody. */
type Rule = 'public' | 'staff' | 'admin' | 'closed'
type Ops = Partial<Record<'admin' | 'read' | 'create' | 'update' | 'delete' | 'unlock', Rule>>

const EXPECTED: [CollectionConfig | GlobalConfig, Ops][] = [
  // Shop
  [Orders, { read: 'staff', create: 'staff', update: 'staff', delete: 'staff' }],
  [Customers, { read: 'staff', create: 'staff', update: 'staff', delete: 'staff' }],
  // Products read is a filter for non-staff — see below.
  [Products, { create: 'staff', update: 'staff', delete: 'staff' }],
  [ProductVariants, { read: 'public', create: 'staff', update: 'staff', delete: 'staff' }],
  [Media, { read: 'public', create: 'staff', update: 'staff', delete: 'staff' }],
  // Users update narrows editors to their own account — see Users.test.ts.
  [Users, { admin: 'staff', read: 'staff', create: 'admin', delete: 'admin', unlock: 'staff' }],
  // Partner programme
  [Partners, { read: 'staff', create: 'staff', update: 'staff', delete: 'admin' }],
  [PartnerPayouts, { read: 'staff', create: 'closed', update: 'staff', delete: 'admin' }],
  [PromoCodes, { read: 'staff', create: 'staff', update: 'staff', delete: 'staff' }],
  [PromoCodeUsages, { read: 'staff', create: 'closed', update: 'closed', delete: 'staff' }],
  [ReferredCustomers, { read: 'staff', create: 'staff', update: 'staff', delete: 'admin' }],
  [ReferralSales, { read: 'staff', create: 'staff', update: 'staff', delete: 'admin' }],
  [ReferralCommissionAdjustments, { read: 'staff', create: 'closed', update: 'staff', delete: 'closed' }],
  // Reviews (read is a filter — see below)
  [Reviews, { create: 'staff', update: 'staff', delete: 'staff' }],
  [ReviewInvitations, { read: 'staff', create: 'staff', update: 'staff', delete: 'staff' }],
  [ReviewPhotos, { read: 'staff', create: 'staff', update: 'staff', delete: 'staff' }],
  // Miljøregistrering — admin-only, unchanged
  [EnvironmentalOrganizations, { read: 'admin', create: 'admin', update: 'admin', delete: 'admin' }],
  [BatteryRegistrations, { read: 'admin', create: 'closed', update: 'closed', delete: 'closed' }],
  [BatteryDeliveries, { read: 'admin', create: 'closed', update: 'closed', delete: 'closed' }],
  [BatteryDeliveryDocuments, { read: 'admin', create: 'closed', update: 'closed', delete: 'closed' }],
  [BatteryRegistrationAudit, { read: 'admin', create: 'closed', update: 'closed', delete: 'closed' }],
  [BatteryDeliveryAudit, { read: 'admin', create: 'closed', update: 'closed', delete: 'closed' }],
  // Pilot, marketing, settings
  [PilotProjects, { read: 'admin', create: 'admin', update: 'admin', delete: 'admin' }],
  [PilotEvaluations, { read: 'admin', create: 'closed', update: 'closed', delete: 'admin' }],
  [MarketingExpenses, { read: 'admin', create: 'admin', update: 'admin', delete: 'admin' }],
  [EconomySettings, { read: 'admin', update: 'admin' }],
  [PinterestConnection, { read: 'admin', update: 'admin' }],
  [TikTokConnection, { read: 'admin', update: 'admin' }],
  // Miljøregistrering business customers and their login (Stage 1). Read is a filter for an
  // authenticated Miljø account — see below and MiljoBusiness.rest.test.ts.
  [BusinessCustomers, { create: 'admin', update: 'admin', delete: 'admin' }],
  [MiljoAccounts, { admin: 'closed', create: 'admin', update: 'admin', delete: 'admin', unlock: 'admin' }],
]

const allows = (rule: Rule, who: 'anon' | 'admin' | 'editor' | 'foreign' | 'noRole') => {
  if (rule === 'public') return true
  if (rule === 'closed') return false
  if (rule === 'admin') return who === 'admin'
  return who === 'admin' || who === 'editor'
}

const PRINCIPALS = { anon: null, admin: ADMIN, editor: EDITOR, foreign: FOREIGN, noRole: NO_ROLE } as const

describe('collection and global access — staff boundary', () => {
  for (const [config, ops] of EXPECTED) {
    for (const [op, rule] of Object.entries(ops) as [keyof Ops, Rule][]) {
      it(`${config.slug}.${op} is ${rule}`, () => {
        const fn = (config.access as Record<string, unknown> | undefined)?.[op]
        assert.equal(typeof fn, 'function', `${config.slug}.${op} must be explicit, not Payload's any-login default`)
        for (const [who, user] of Object.entries(PRINCIPALS) as [keyof typeof PRINCIPALS, unknown][]) {
          assert.equal(run(fn, user), allows(rule, who), `${config.slug}.${op} for ${who}`)
        }
      })
    }
  }

  it('anonymous visitors cannot create orders or customers through the REST API', () => {
    assert.equal(run(Orders.access!.create, null), false)
    assert.equal(run(Customers.access!.create, null), false)
  })

  it('business customers and Miljø accounts: admins read all; editors, the public and staff-looking foreigners nothing', async () => {
    // Async rules: a Miljø account's business customer is checked in the database per request.
    for (const read of [BusinessCustomers.access!.read, MiljoAccounts.access!.read]) {
      assert.equal(await run(read, ADMIN), true)
      for (const user of [EDITOR, null, FOREIGN, NO_ROLE]) assert.equal(await run(read, user), false, JSON.stringify(user))
    }
  })

  it('reviews: staff read everything; the public and a foreign account only approved reviews', () => {
    const read = Reviews.access!.read
    const approvedOnly = { status: { equals: 'approved' } }
    assert.equal(run(read, ADMIN), true)
    assert.equal(run(read, EDITOR), true)
    assert.deepEqual(run(read, null), approvedOnly)
    assert.deepEqual(run(read, FOREIGN), approvedOnly)
  })

  it('products: staff read everything; the public and a foreign account only published products', () => {
    const read = Products.access!.read
    const publishedOnly = { published: { equals: true } }
    assert.equal(run(read, ADMIN), true)
    assert.equal(run(read, EDITOR), true)
    assert.deepEqual(run(read, null), publishedOnly)
    assert.deepEqual(run(read, FOREIGN), publishedOnly)
  })

  it('order Meta attribution (IP, user agent) is readable by staff only', () => {
    const meta = Orders.fields.find((f) => (f as { name?: string }).name === 'meta') as { access?: { read?: unknown } }
    assert.equal(run(meta.access?.read, ADMIN), true)
    assert.equal(run(meta.access?.read, FOREIGN), false)
    assert.equal(run(meta.access?.read, null), false)
  })
})

/* ------------------------- trusted server-side writes ------------------------- */

/**
 * Orders, customers and stock are now closed to anonymous REST writes. The storefront keeps
 * working because these server-side paths write through the Local API, whose `overrideAccess`
 * defaults to true (payload 3.x `collections/operations/local/*`). Passing `overrideAccess: false`
 * — or calling the REST API — from any of them would break checkout, so this pins the contract.
 */
describe('checkout, Kustom webhook and customer sync write through the Local API', () => {
  const TRUSTED_WRITERS = [
    'src/lib/promo/checkoutFlow.ts', // pending order at checkout start
    'src/app/api/kustom/webhook/route.ts', // confirmed order after payment
    'src/lib/customers.ts', // customer create / link
    'src/lib/orders/stockDeduction.ts', // variant / product stock
  ]

  for (const file of TRUSTED_WRITERS) {
    it(`${file} never opts into access control and never calls the REST API`, () => {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8')
      assert.doesNotMatch(src, /overrideAccess:\s*false/)
      assert.doesNotMatch(src, /\/api\/(orders|customers|products|product-variants)\b/)
    })
  }

  it('Payload’s Local API create/update default to overrideAccess = true', () => {
    for (const op of ['create', 'update']) {
      const src = readFileSync(resolve(process.cwd(), `node_modules/payload/dist/collections/operations/local/${op}.js`), 'utf8')
      assert.match(src, /overrideAccess = true/, op)
    }
  })
})

/* ------------------------------ no seed route ------------------------------ */

describe('no public bootstrap route and no hard-coded credentials', () => {
  it('the unauthenticated /api/seed route is gone', () => {
    assert.equal(existsSync(resolve(process.cwd(), 'src/app/api/seed')), false)
  })

  it('no source file assigns a literal password', () => {
    const literalPassword = /password\s*:\s*['"`][^'"`]+['"`]/
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && entry.name !== 'payload-types.ts') {
          if (literalPassword.test(readFileSync(path, 'utf8'))) offenders.push(path)
        }
      }
    }
    walk(resolve(process.cwd(), 'src'))
    assert.deepEqual(offenders, [])
  })
})

/* ------------------------------- endpoints ------------------------------- */

/**
 * Every registered staff endpoint, called as an account from another auth collection. The payload
 * is a proxy that fails on any use, so the test also proves the guard runs before any database
 * access. The two OAuth callbacks are deliberately absent: they authorise through the signed state
 * (and re-load the named administrator from `users`), and have their own test suites.
 */
const ENDPOINTS: [string, Endpoint][] = [
  ...[
    analyticsEndpoint,
    pilotAnalyticsEndpoint,
    miljoAnalyticsEndpoint,
    blobImagesRevalidateEndpoint,
    metaSyncEndpoint,
    marketingChannelsEndpoint,
    metaExpensesEndpoint,
    googleSyncEndpoint,
    googleExpensesEndpoint,
    googleStatusEndpoint,
    pinterestSyncEndpoint,
    pinterestExpensesEndpoint,
    pinterestStatusEndpoint,
    pinterestOAuthStartEndpoint,
    pinterestExportEndpoint,
    pinterestExportPreviewEndpoint,
    tiktokConnectEndpoint,
    tiktokAdvertisersEndpoint,
    tiktokStatusEndpoint,
    tiktokExpensesEndpoint,
    tiktokSyncEndpoint,
  ].map((e): [string, Endpoint] => [`/api${e.path}`, e]),
  ...[Orders, PartnerPayouts, PilotProjects, EnvironmentalOrganizations, BatteryRegistrations, BatteryDeliveries].flatMap((c) =>
    (c.endpoints || []).map((e): [string, Endpoint] => [`/api/${c.slug}${e.path}`, e]),
  ),
]

function foreignRequest(user: unknown): PayloadRequest {
  const untouchable = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined
        throw new Error(`payload.${String(prop)} used before the access check`)
      },
    },
  )
  return {
    user,
    payload: untouchable,
    routeParams: { id: '1' },
    url: 'http://localhost/api/x',
    searchParams: new URLSearchParams(),
    headers: new Headers(),
    json: async () => ({}),
  } as unknown as PayloadRequest
}

describe('custom endpoints — staff boundary', () => {
  it('covers a meaningful set of endpoints', () => {
    assert.ok(ENDPOINTS.length >= 35, `only ${ENDPOINTS.length} endpoints collected`)
  })

  for (const [route, endpoint] of ENDPOINTS) {
    it(`${endpoint.method.toUpperCase()} ${route} refuses anonymous and foreign-collection users`, async () => {
      for (const user of [null, FOREIGN, NO_ROLE]) {
        const res = await endpoint.handler(foreignRequest(user))
        assert.equal(res.status, 401, `${route} for ${JSON.stringify(user)}`)
      }
    })
  }
})
