import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Stage 2 analytics fields. Purely additive: every column is nullable and added with
// IF NOT EXISTS, so the migration is safe to replay and never touches existing data.
//   products / product_variants : cost_price (Kostpris, ex-VAT)
//   orders                      : actual_shipping_cost, payment_fee, extra_costs, paid_at
//   orders_items                : unit_cost, vat_rate, line_cost, line_profit (historical snapshot)
// No DROP / DELETE / TRUNCATE, no type changes, no backfill. All existing rows keep
// these columns as NULL until a new order is created or an admin fills them in.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cost_price" numeric;
    ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "cost_price" numeric;

    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "actual_shipping_cost" numeric,
      ADD COLUMN IF NOT EXISTS "payment_fee" numeric,
      ADD COLUMN IF NOT EXISTS "extra_costs" numeric,
      ADD COLUMN IF NOT EXISTS "paid_at" timestamp(3) with time zone;

    ALTER TABLE "orders_items"
      ADD COLUMN IF NOT EXISTS "unit_cost" numeric,
      ADD COLUMN IF NOT EXISTS "vat_rate" numeric,
      ADD COLUMN IF NOT EXISTS "line_cost" numeric,
      ADD COLUMN IF NOT EXISTS "line_profit" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items"
      DROP COLUMN IF EXISTS "unit_cost",
      DROP COLUMN IF EXISTS "vat_rate",
      DROP COLUMN IF EXISTS "line_cost",
      DROP COLUMN IF EXISTS "line_profit";

    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "actual_shipping_cost",
      DROP COLUMN IF EXISTS "payment_fee",
      DROP COLUMN IF EXISTS "extra_costs",
      DROP COLUMN IF EXISTS "paid_at";

    ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "cost_price";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "cost_price";
  `)
}
