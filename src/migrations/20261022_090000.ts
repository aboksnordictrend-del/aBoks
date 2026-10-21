import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Product lines and cost on manual referral sales («Henvisningssalg» → «Varer og kostnader»).
//
// ── What this creates ──
//
//   • referral_sales_items (+ _referral_sales_v_version_items for versions) — the sale's product
//     lines: product, variant, quantity, and the unit cost / line cost snapshotted from the
//     product's «Total kostpris».
//   • referral_sales.product_cost, referral_sales.actual_shipping_cost (+ the two version columns).
//
// ── Additive only ──
//
// Every new column is NULLABLE with no default, so every existing sale keeps NULL = «not known»
// and its Partnersalg profit stays unavailable until an administrator supplies the lines. No
// UPDATE runs: commission, base, status and every other stored figure are exactly as they were.
// No DROP, DELETE, RENAME or TRUNCATE in up(). No other table is touched.
//
// ── How the DDL was produced ──
//
// drizzle-kit's own output for the difference between Payload's schema for this config and the
// same config at the previous commit (two `generateDrizzleJson` snapshots, not a diff against a
// live database). One deliberate change: the two `product_id` foreign keys are RESTRICT instead of
// the SET NULL drizzle emits, because the column is NOT NULL — SET NULL would fail with a raw 23502
// on product deletion. A product that appears on a registered sale therefore cannot be deleted
// (unpublish it instead), the same rule as referral_sales.referred_customer_id in 20261021.
//
// Runs after 20261021_090000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "referral_sales_items" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"product_id" integer NOT NULL,
    	"variant_id" integer,
    	"quantity" numeric NOT NULL,
    	"unit_cost" numeric,
    	"line_cost" numeric
    );

    CREATE TABLE "_referral_sales_v_version_items" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" serial PRIMARY KEY NOT NULL,
    	"product_id" integer NOT NULL,
    	"variant_id" integer,
    	"quantity" numeric NOT NULL,
    	"unit_cost" numeric,
    	"line_cost" numeric,
    	"_uuid" varchar
    );

    ALTER TABLE "referral_sales" ADD COLUMN "product_cost" numeric;
    ALTER TABLE "referral_sales" ADD COLUMN "actual_shipping_cost" numeric;
    ALTER TABLE "_referral_sales_v" ADD COLUMN "version_product_cost" numeric;
    ALTER TABLE "_referral_sales_v" ADD COLUMN "version_actual_shipping_cost" numeric;
    ALTER TABLE "referral_sales_items" ADD CONSTRAINT "referral_sales_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "referral_sales_items" ADD CONSTRAINT "referral_sales_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_sales_items" ADD CONSTRAINT "referral_sales_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."referral_sales"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "_referral_sales_v_version_items" ADD CONSTRAINT "_referral_sales_v_version_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "_referral_sales_v_version_items" ADD CONSTRAINT "_referral_sales_v_version_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v_version_items" ADD CONSTRAINT "_referral_sales_v_version_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_referral_sales_v"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "referral_sales_items_order_idx" ON "referral_sales_items" USING btree ("_order");
    CREATE INDEX "referral_sales_items_parent_id_idx" ON "referral_sales_items" USING btree ("_parent_id");
    CREATE INDEX "referral_sales_items_product_idx" ON "referral_sales_items" USING btree ("product_id");
    CREATE INDEX "referral_sales_items_variant_idx" ON "referral_sales_items" USING btree ("variant_id");
    CREATE INDEX "_referral_sales_v_version_items_order_idx" ON "_referral_sales_v_version_items" USING btree ("_order");
    CREATE INDEX "_referral_sales_v_version_items_parent_id_idx" ON "_referral_sales_v_version_items" USING btree ("_parent_id");
    CREATE INDEX "_referral_sales_v_version_items_product_idx" ON "_referral_sales_v_version_items" USING btree ("product_id");
    CREATE INDEX "_referral_sales_v_version_items_variant_idx" ON "_referral_sales_v_version_items" USING btree ("variant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM "referral_sales_items") +
      (SELECT count(*) FROM "referral_sales" WHERE "product_cost" IS NOT NULL OR "actual_shipping_cost" IS NOT NULL) AS "rows"
  `)) as unknown as { rows?: { rows: string | number }[] }
  const rows = Number(result.rows?.[0]?.rows ?? 0)
  if (rows > 0) {
    throw new Error(
      `Refusing to roll back 20261022_090000: ${rows} referral sale line(s) or cost value(s) exist. Export and remove them deliberately first.`,
    )
  }

  await db.execute(sql`
    DROP TABLE IF EXISTS "_referral_sales_v_version_items" CASCADE;
    DROP TABLE IF EXISTS "referral_sales_items" CASCADE;
    ALTER TABLE "_referral_sales_v" DROP COLUMN IF EXISTS "version_actual_shipping_cost";
    ALTER TABLE "_referral_sales_v" DROP COLUMN IF EXISTS "version_product_cost";
    ALTER TABLE "referral_sales" DROP COLUMN IF EXISTS "actual_shipping_cost";
    ALTER TABLE "referral_sales" DROP COLUMN IF EXISTS "product_cost";
  `)
}
