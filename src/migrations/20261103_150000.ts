import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// aBoks Miljøregistrering, Stage 2.1 — Orders ↔ Bedriftskunder: ONE authoritative link.
//
// ── What this does ──
//
//   • orders.business_customer_id (nullable): the order's business customer. A single column, so
//     an order can belong to at most one company by construction; the business customer lists its
//     orders through a read-only Payload join on this column.
//   • Copies the Stage 1 links: every `business_customers_rels` row with path 'eligibleOrders'
//     becomes the order's business_customer_id. Stage 1's partial unique index guarantees at most
//     one such row per order, so the copy is unambiguous. Only orders that HAD a link are touched,
//     and only this new column (not updated_at or anything else). Orders without a link are left
//     exactly as they are.
//
// ── What this deliberately does NOT do ──
//
// drizzle-kit's diff (two `generateDrizzleJson` snapshots, no database involved) also emits
// `DROP TABLE "business_customers_rels" CASCADE`, because the config no longer has the writable
// `eligibleOrders` list. That drop is left out: the table stays as an untouched copy of the Stage 1
// links — Payload no longer reads or writes it — so this migration loses nothing and down() can
// restore the Stage 1 shape exactly. Dropping it is a separate, later cleanup migration once the
// new link has been verified in production.
//
// The only other change to drizzle's output: the foreign key is RESTRICT instead of SET NULL. An
// order's link is history; deleting a business customer must never clear it silently. The
// collection hook refuses that delete with a Norwegian message first.
//
// Runs after 20261103_090000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN "business_customer_id" integer;
    ALTER TABLE "orders" ADD CONSTRAINT "orders_business_customer_id_business_customers_id_fk" FOREIGN KEY ("business_customer_id") REFERENCES "public"."business_customers"("id") ON DELETE restrict ON UPDATE no action;
    CREATE INDEX "orders_business_customer_idx" ON "orders" USING btree ("business_customer_id");
    UPDATE "orders" AS o
       SET "business_customer_id" = r."parent_id"
      FROM "business_customers_rels" AS r
     WHERE r."path" = 'eligibleOrders'
       AND r."orders_id" = o."id"
       AND o."business_customer_id" IS NULL;
  `)
}

// Lossless: the links that exist now (including any made or removed since up()) are written back
// to business_customers_rels in the Stage 1 shape before the column is dropped.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const exists = await db.execute(sql`SELECT to_regclass('public.business_customers_rels') IS NOT NULL AS present;`)
  const present = Boolean((exists.rows?.[0] as { present?: boolean } | undefined)?.present)
  if (!present) {
    throw new Error('20261103_150000 down: business_customers_rels is missing — cannot restore the Stage 1 links. Nothing was changed.')
  }
  await db.execute(sql`
    DELETE FROM "business_customers_rels" WHERE "path" = 'eligibleOrders';
    INSERT INTO "business_customers_rels" ("order", "parent_id", "path", "orders_id")
      SELECT row_number() OVER (PARTITION BY "business_customer_id" ORDER BY "id"), "business_customer_id", 'eligibleOrders', "id"
        FROM "orders"
       WHERE "business_customer_id" IS NOT NULL;
    ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_business_customer_id_business_customers_id_fk";
    DROP INDEX IF EXISTS "orders_business_customer_idx";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "business_customer_id";
  `)
}
