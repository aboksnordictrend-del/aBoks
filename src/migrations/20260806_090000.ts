import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Cart recommendations: the join table behind `products.cartRecommendations`.
//
// Purely additive and idempotent. One new table plus its indexes and foreign keys — no DROP,
// DELETE, TRUNCATE or UPDATE, no change to any existing table or column, and not one existing
// row is read or rewritten. Every product that already exists stays valid exactly as it is,
// with no rows in the new table, which the cart reads as "no recommendations configured".
//
// `products_rels` is the shape Payload's Postgres adapter derives from a `hasMany`
// relationship on the `products` collection. Table and column names are not ours to choose —
// they are what the adapter queries at runtime:
//
//   parent_id     the product the recommendations were configured on (→ products.id)
//   products_id   the recommended product (→ products.id; self-referencing, because Tilbehør
//                 is not a separate collection — accessories are products with
//                 section = 'accessories')
//   path          the field name, always 'cartRecommendations' here. One _rels table serves
//                 every hasMany relationship on the collection, so `path` is what keeps them
//                 apart; a second such field later reuses this table without a migration.
//   "order"       the admin's chosen position, 0-based. This is what makes the ordering in
//                 the Payload picker the ordering the customer sees in the cart.
//
// Both foreign keys cascade on delete, matching every other _rels table in this schema: a
// deleted product takes its own recommendation rows with it AND disappears from every other
// product's list, so the cart can never be handed a dangling id.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "products_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );

    CREATE INDEX IF NOT EXISTS "products_rels_order_idx" ON "products_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "products_rels_path_idx" ON "products_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "products_rels_products_id_idx" ON "products_rels" USING btree ("products_id");

    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_products_fk"
        FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

// Drops the table this migration created, and nothing else. The only data lost is the
// recommendation picks themselves — no product, order or media row is touched.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "products_rels" CASCADE;
  `)
}
