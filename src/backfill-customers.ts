/**
 * One-off backfill: give every existing order a Customer.
 *
 * Walks the orders that have no `customer` link, takes the buyer data from the order's
 * own `customerInfo` group, finds-or-creates the matching Customer and links them.
 * Reuses the exact same sync used by the Kustom webhook, so it cannot diverge from it
 * and cannot produce duplicates.
 *
 * Run manually only — never wired into build or production start:
 *   npm run backfill:customers              (dry run — reports, writes nothing)
 *   npm run backfill:customers -- --apply   (writes)
 */
// @next/env is CommonJS: under ESM only the default export survives the interop,
// so the named import has to be destructured off it.
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

// Must run before anything imports payload.config: the config reads DATABASE_URI at
// module scope, and a standalone tsx process — unlike `next dev` — loads no .env file
// on its own. Without this, Payload falls back to localhost:5432 and gets ECONNREFUSED.
loadEnvConfig(process.cwd())

if (!process.env.DATABASE_URI) {
  console.error(
    'DATABASE_URI is not set. Add it to .env.local (or .env) before running the backfill.',
  )
  process.exit(1)
}

// Dynamic, so they are evaluated after loadEnvConfig above.
const { getPayload } = await import('payload')
const { default: configPromise } = await import('../payload.config')
const { normalizeEmail, syncCustomerForOrder } = await import('./lib/customers')

async function backfillCustomers() {
  const apply = process.argv.includes('--apply')
  const dryRun = !apply

  const payload = await getPayload({ config: configPromise })

  console.log(
    dryRun
      ? '🔍 Backfill customers — DRY RUN (no writes). Re-run with --apply to commit.'
      : '✍️  Backfill customers — APPLYING changes.',
  )

  const { docs: orders } = await payload.find({
    collection: 'orders',
    where: { customer: { exists: false } },
    limit: 1000,
    depth: 0,
    sort: 'createdAt',
    overrideAccess: true,
  })

  console.log(`Found ${orders.length} order(s) without a customer link.`)

  const stats = { linked: 0, skipped: 0, failed: 0 }

  for (const order of orders) {
    const email = normalizeEmail(order.customerInfo?.email)

    if (!email) {
      stats.skipped++
      console.log(`⏭️  ${order.orderNumber}: no customer email on the order — skipping`)
      continue
    }

    try {
      const result = await syncCustomerForOrder(payload, order, { dryRun })
      if (result) {
        stats.linked++
        console.log(`✅ ${order.orderNumber}: customer ${result.action} (${email})`)
      } else {
        stats.skipped++
      }
    } catch (err) {
      stats.failed++
      console.error(
        `❌ ${order.orderNumber}: sync failed — ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  console.log(
    `\nDone. linked=${stats.linked} skipped=${stats.skipped} failed=${stats.failed}${
      dryRun ? ' (dry run — nothing was written)' : ''
    }`,
  )

  process.exit(stats.failed > 0 ? 1 : 0)
}

backfillCustomers().catch((err) => {
  console.error('Backfill crashed:', err)
  process.exit(1)
})
