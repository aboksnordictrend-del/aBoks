import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Product-level stock: `products.stock`, the «Lagerbeholdning» of a product that has no
// Product Variants (an accessory such as a battery multipack).
//
// Purely additive and idempotent. One nullable column on one existing table — no DROP, no
// DELETE, no TRUNCATE, and not one existing row is read, rewritten or backfilled. Every
// aBoks product that has variants keeps its stock exactly where it already is, on
// `product_variants.inventory`, and this column stays NULL for it forever: the rule in
// @/lib/stock is that a product with variants never reads its own `stock`.
//
// NULL rather than a default of 0. Payload's field default (0) applies when a document is
// written through the CMS; leaving the column nullable means this migration does not touch
// a single existing row, and @/lib/stock reads NULL as 0 anyway ("nothing to sell"), which
// is the only safe reading of a stock figure nobody has entered yet.
//
// `numeric` is the type Payload's Postgres adapter uses for a `number` field, matching
// `product_variants.inventory`. The whole-number and non-negative rules are enforced by the
// field's own validation rather than by a CHECK constraint, so an admin correcting a value
// gets a Norwegian message instead of a database error.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stock" numeric;
  `)
}

// Drops the column this migration added, and nothing else. The only data lost is the stock
// figures of variant-less products; no variant inventory, order or product row is touched.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "stock";
  `)
}
