import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Promo-code system, schema only: two new collections (promo_codes + its products join
// table, promo_code_usages), the order-level discount snapshot on orders, the per-line
// discount share on orders_items, and the admin locked-documents relationships.
//
// Purely additive and idempotent. Three new enum types, three new tables, eleven new
// nullable columns on existing tables, plus indexes and foreign keys. No DROP, DELETE,
// TRUNCATE or UPDATE — not one existing row is read or rewritten, and every new column is
// nullable, so every existing order stays valid exactly as it is.
//
// The DDL mirrors what Payload's own schema builder produces for these collections (column
// names, types, NOT NULLs and defaults were read back off `payload.db.tables` rather than
// guessed); it is hand-written, as the other post-baseline migrations here are, because the
// auto-generated diff re-emits already-applied columns from those earlier migrations.
//
// Two UNIQUE indexes on promo_code_usages carry real business rules and are the reason this
// is enforced in Postgres rather than in application code:
//   • order_key       `order:<promoCodeId>:<orderId>`      — a replayed Kustom webhook can
//                                                            never register the same code
//                                                            twice for one order.
//   • uniqueness_key  `global:<id>` / `email:<id>:<email>` — a one-time code cannot produce
//                                                            two paid usages, and a
//                                                            once-per-customer code cannot
//                                                            produce two for one address.
// Both are nullable, and Postgres allows repeated NULLs under a unique index, so unlimited
// and limited-count codes are simply not constrained by uniqueness_key.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Enums ──────────────────────────────────────────────────────────────
    DO $$ BEGIN
      CREATE TYPE "public"."enum_promo_codes_discount_type" AS ENUM('percentage', 'fixed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_promo_codes_usage_mode" AS ENUM('unlimited', 'single_use_global', 'once_per_customer', 'limited');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_discount_discount_type" AS ENUM('percentage', 'fixed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- ── promo_codes ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "promo_codes" (
      "id" serial PRIMARY KEY NOT NULL,
      "code" varchar NOT NULL,
      "active" boolean DEFAULT true,
      "name" varchar,
      "discount_type" "enum_promo_codes_discount_type" DEFAULT 'percentage' NOT NULL,
      "discount_value" numeric NOT NULL,
      "usage_mode" "enum_promo_codes_usage_mode" DEFAULT 'unlimited' NOT NULL,
      "max_uses" numeric,
      "starts_at" timestamp(3) with time zone,
      "expires_at" timestamp(3) with time zone,
      "minimum_order_amount" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ── promo_codes_rels (applicableProducts join) ─────────────────────────
    CREATE TABLE IF NOT EXISTS "promo_codes_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );

    -- ── promo_code_usages ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "promo_code_usages" (
      "id" serial PRIMARY KEY NOT NULL,
      -- FK columns are nullable at the DB level (ON DELETE set null): deleting a promo code
      -- or an order must not delete the historical record of a paid usage.
      "promo_code_id" integer,
      "order_id" integer,
      "order_number" varchar,
      "email" varchar,
      "discount_amount" numeric,
      "currency" varchar DEFAULT 'NOK',
      "used_at" timestamp(3) with time zone,
      "kustom_order_id" varchar,
      "order_key" varchar,
      "uniqueness_key" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ── orders: discount snapshot (all nullable → existing orders unaffected) ──
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_promo_code_id" integer;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_code" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_discount_type" "enum_orders_discount_discount_type";
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_discount_value" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_discount_amount" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_subtotal_before_discount" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_subtotal_after_discount" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_total_before_discount" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_total_after_discount" numeric;

    -- ── orders_items: this line's share of the order discount ──────────────
    ALTER TABLE "orders_items" ADD COLUMN IF NOT EXISTS "discount_amount" numeric;

    -- ── Admin document-locking relationships ───────────────────────────────
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "promo_codes_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "promo_code_usages_id" integer;

    -- ── Indexes ────────────────────────────────────────────────────────────
    -- Codes are stored uppercase (normalised in a beforeValidate field hook), so a plain
    -- unique index is what makes "welcome10" and "WELCOME10" the same code.
    CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code_idx" ON "promo_codes" USING btree ("code");
    CREATE INDEX IF NOT EXISTS "promo_codes_updated_at_idx" ON "promo_codes" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "promo_codes_created_at_idx" ON "promo_codes" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "promo_codes_rels_order_idx" ON "promo_codes_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "promo_codes_rels_parent_idx" ON "promo_codes_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "promo_codes_rels_path_idx" ON "promo_codes_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "promo_codes_rels_products_id_idx" ON "promo_codes_rels" USING btree ("products_id");

    CREATE INDEX IF NOT EXISTS "promo_code_usages_promo_code_idx" ON "promo_code_usages" USING btree ("promo_code_id");
    CREATE INDEX IF NOT EXISTS "promo_code_usages_order_idx" ON "promo_code_usages" USING btree ("order_id");
    CREATE INDEX IF NOT EXISTS "promo_code_usages_order_number_idx" ON "promo_code_usages" USING btree ("order_number");
    CREATE INDEX IF NOT EXISTS "promo_code_usages_email_idx" ON "promo_code_usages" USING btree ("email");
    CREATE INDEX IF NOT EXISTS "promo_code_usages_used_at_idx" ON "promo_code_usages" USING btree ("used_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "promo_code_usages_order_key_idx" ON "promo_code_usages" USING btree ("order_key");
    CREATE UNIQUE INDEX IF NOT EXISTS "promo_code_usages_uniqueness_key_idx" ON "promo_code_usages" USING btree ("uniqueness_key");
    CREATE INDEX IF NOT EXISTS "promo_code_usages_updated_at_idx" ON "promo_code_usages" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "promo_code_usages_created_at_idx" ON "promo_code_usages" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "orders_discount_promo_code_idx" ON "orders" USING btree ("discount_promo_code_id");

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_promo_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("promo_codes_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_promo_code_usages_id_idx" ON "payload_locked_documents_rels" USING btree ("promo_code_usages_id");

    -- ── Foreign keys ───────────────────────────────────────────────────────
    DO $$ BEGIN
      ALTER TABLE "promo_codes_rels" ADD CONSTRAINT "promo_codes_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "promo_codes_rels" ADD CONSTRAINT "promo_codes_rels_products_fk"
        FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_promo_code_id_promo_codes_id_fk"
        FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_order_id_orders_id_fk"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_promo_code_id_promo_codes_id_fk"
        FOREIGN KEY ("discount_promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promo_codes_fk"
        FOREIGN KEY ("promo_codes_id") REFERENCES "public"."promo_codes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promo_code_usages_fk"
        FOREIGN KEY ("promo_code_usages_id") REFERENCES "public"."promo_code_usages"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_promo_codes_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_promo_code_usages_fk";
    ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_discount_promo_code_id_promo_codes_id_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_promo_codes_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_promo_code_usages_id_idx";
    DROP INDEX IF EXISTS "orders_discount_promo_code_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "promo_codes_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "promo_code_usages_id";

    ALTER TABLE "orders_items" DROP COLUMN IF EXISTS "discount_amount";

    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_promo_code_id";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_code";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_discount_type";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_discount_value";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_discount_amount";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_subtotal_before_discount";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_subtotal_after_discount";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_total_before_discount";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_total_after_discount";

    DROP TABLE IF EXISTS "promo_code_usages" CASCADE;
    DROP TABLE IF EXISTS "promo_codes_rels" CASCADE;
    DROP TABLE IF EXISTS "promo_codes" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_orders_discount_discount_type";
    DROP TYPE IF EXISTS "public"."enum_promo_codes_usage_mode";
    DROP TYPE IF EXISTS "public"."enum_promo_codes_discount_type";
  `)
}
