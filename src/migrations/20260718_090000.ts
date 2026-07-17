import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Cost-system refactor — Phase A (additive + safe data transfer, idempotent).
//
//  1. Create the `products_cost_items` array table (mirrors Payload's array-table shape,
//     cf. products_details). No IF-NOT-EXISTS gaps: safe to replay.
//  2. Transfer any existing Products.cost_price (> 0) with no cost items into a single
//     "Migrert kostpris" row, so no configured cost is lost.
//  3. Transfer variant cost only when it is unambiguous: a product with no cost_price and
//     no cost items whose variants ALL share one non-null cost_price. Divergent products
//     are left untouched and logged for manual review — never averaged or guessed.
//  4. Keep products.cost_price in sync with the transferred item(s).
//
// Not touched: product_variants.cost_price COLUMN stays (unused) — dropped later in a
// separate Phase B cleanup migration after production verification. Orders are never
// changed. No DROP / DELETE / TRUNCATE here.
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // 1. Array table for costItems
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "products_cost_items" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "amount" numeric NOT NULL
    );
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_cost_items_parent_id_fk'
      ) THEN
        ALTER TABLE "products_cost_items"
          ADD CONSTRAINT "products_cost_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS "products_cost_items_order_idx" ON "products_cost_items" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "products_cost_items_parent_id_idx" ON "products_cost_items" USING btree ("_parent_id");
  `)

  // 2. Transfer existing Products.cost_price → "Migrert kostpris" (idempotent)
  await db.execute(sql`
    INSERT INTO "products_cost_items" ("_order", "_parent_id", "id", "name", "amount")
    SELECT 1, p."id", gen_random_uuid()::varchar, 'Migrert kostpris', p."cost_price"
    FROM "products" p
    WHERE p."cost_price" IS NOT NULL AND p."cost_price" > 0
      AND NOT EXISTS (SELECT 1 FROM "products_cost_items" ci WHERE ci."_parent_id" = p."id");
  `)

  // 3. Transfer uniform, non-null variant cost for products that have none of their own
  await db.execute(sql`
    WITH per_product AS (
      SELECT "product_id" AS pid,
             COUNT(*) AS n,
             COUNT("cost_price") AS n_nonnull,
             COUNT(DISTINCT "cost_price") AS n_distinct,
             MIN("cost_price") AS amount
      FROM "product_variants"
      GROUP BY "product_id"
    ),
    uniform AS (
      SELECT pid, amount FROM per_product
      WHERE n > 0 AND n_nonnull = n AND n_distinct = 1 AND amount > 0
    )
    INSERT INTO "products_cost_items" ("_order", "_parent_id", "id", "name", "amount")
    SELECT 1, u.pid, gen_random_uuid()::varchar, 'Migrert kostpris', u.amount
    FROM uniform u
    JOIN "products" p ON p."id" = u.pid
    WHERE (p."cost_price" IS NULL OR p."cost_price" = 0)
      AND NOT EXISTS (SELECT 1 FROM "products_cost_items" ci WHERE ci."_parent_id" = u.pid);
  `)

  // 4. Keep products.cost_price = SUM(costItems.amount)
  await db.execute(sql`
    UPDATE "products" p
    SET "cost_price" = s.total
    FROM (SELECT "_parent_id" AS pid, SUM("amount") AS total FROM "products_cost_items" GROUP BY "_parent_id") s
    WHERE s.pid = p."id" AND (p."cost_price" IS DISTINCT FROM s.total);
  `)

  // Report divergent variant costs (not migrated) for manual review
  const divergent = await db.execute(sql`
    SELECT "product_id" AS pid, array_agg(DISTINCT "cost_price") AS costs
    FROM "product_variants"
    WHERE "cost_price" IS NOT NULL
    GROUP BY "product_id"
    HAVING COUNT(DISTINCT "cost_price") > 1
  `)
  const rows = (divergent.rows ?? []) as Array<Record<string, unknown>>
  if (rows.length > 0) {
    for (const r of rows) {
      payload.logger.warn(
        `[migration 20260718_090000] product ${String(r.pid)} has divergent variant cost_price ${JSON.stringify(r.costs)} — NOT migrated, set Kostnadsberegning manually.`,
      )
    }
  } else {
    payload.logger.info('[migration 20260718_090000] no divergent variant cost_price found.')
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverses only the additive schema. products.cost_price keeps its value; the leftover
  // product_variants.cost_price column is untouched.
  await db.execute(sql`DROP TABLE IF EXISTS "products_cost_items" CASCADE;`)
}
