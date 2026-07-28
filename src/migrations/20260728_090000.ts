import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partner commissions and payouts (Stages 2–4), schema only: the partner settings on
// promo_codes, the financial/commission snapshot on promo_code_usages, and the new
// partner_payouts collection with its enum, indexes, foreign keys and admin lock relation.
//
// Purely additive and idempotent. Three new enum types, one new table, fifteen new NULLABLE
// columns on two existing tables, one new column on payload_locked_documents_rels, plus
// indexes and foreign keys. There is no DROP, DELETE, TRUNCATE or UPDATE anywhere in `up()`:
// not one existing row is read or rewritten.
//
// Deliberately NO backfill. Every promo code keeps `is_partner_code` NULL (which the code
// reads as "ordinary" — the check is `=== true` throughout), and every pre-existing
// promo_code_usages row keeps NULL in all eight snapshot columns. Those amounts could only be
// guessed, so they are left unknown and excluded from money totals while still counting as
// uses. `discount_amount` is untouched and remains the single discount column; no second one
// is introduced.
//
// The DDL mirrors what Payload's own schema builder produces for these collections. Column
// names, SQL types, NOT NULLs and all three enum names were read back off the adapter's
// generated `rawTables` (with the database connection disabled) rather than guessed; it is
// hand-written, as every post-baseline migration here is, because the auto-generated diff
// re-emits already-applied columns from those earlier hand-written migrations.
//
// ── One deliberate deviation from the generated schema ──
//
// `partner_payouts.promo_code_id` is created ON DELETE **restrict**, not the `set null` that
// @payloadcms/drizzle emits for every simple relationship (traverseFields.js — the action is
// hard-coded and does not vary with `required`). Payload also makes the column NOT NULL
// because the field is required, so the generated pair is self-contradictory: deleting a promo
// code would attempt to write NULL into a NOT NULL column and fail with a raw 23502
// not_null_violation. `restrict` expresses the same intent correctly — a promo code with
// payout history cannot be deleted, and the attempt fails with a 23503 foreign_key_violation
// that says exactly why. A payout is an accounting record of money that actually left the
// account; it must never be orphaned or silently deleted along with a promo code.
//
// ── On indexes ──
//
// Only the indexes Payload itself generates are created. In particular there is deliberately
// no index on `promo_code_usages.is_partner_usage`: the balance query filters
// `promo_code_id = ? AND is_partner_usage = true`, and the existing selective
// `promo_code_usages_promo_code_idx` already serves it — a second index on a two-valued
// boolean would add write cost for no useful selectivity, and any index Payload does not
// generate becomes permanent schema drift.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Enums ──────────────────────────────────────────────────────────────
    -- Payload scopes select enums per table, so the two commission-base columns get two
    -- distinct types with identical values. They are NOT merged into one shared type.
    DO $$ BEGIN
      CREATE TYPE "public"."enum_promo_codes_commission_base" AS ENUM('orderAfterDiscount', 'orderBeforeDiscount');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_promo_code_usages_commission_base_snapshot" AS ENUM('orderAfterDiscount', 'orderBeforeDiscount');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_partner_payouts_payment_method" AS ENUM('bankTransfer', 'vipps', 'other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- ── promo_codes: partner settings ──────────────────────────────────────
    -- All nullable, no defaults written to existing rows. partner_name and commission_rate
    -- are required only when the code is a partner code, and that is conditional, so it is
    -- enforced by the collection validators — never as a database NOT NULL, which would
    -- invalidate every existing ordinary code.
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "is_partner_code" boolean;
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_name" varchar;
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_email" varchar;
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_phone" varchar;
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "commission_rate" numeric;
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "commission_base" "enum_promo_codes_commission_base";
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_note" varchar;

    -- ── promo_code_usages: financial + commission snapshot ─────────────────
    -- All nullable so every existing row stays valid exactly as it is. discount_amount is
    -- NOT touched: it already holds the verified discount and is reused, not duplicated.
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "order_amount_before_discount" numeric;
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "order_amount_after_discount" numeric;
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "shipping_amount" numeric;
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "is_partner_usage" boolean;
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "partner_name_snapshot" varchar;
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "commission_rate_snapshot" numeric;
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "commission_base_snapshot" "enum_promo_code_usages_commission_base_snapshot";
    ALTER TABLE "promo_code_usages" ADD COLUMN IF NOT EXISTS "commission_amount" numeric;

    -- ── partner_payouts ────────────────────────────────────────────────────
    -- Rows are only ever written by POST /api/partner-payouts/register; the collection's own
    -- create access is closed. The NOT NULLs mirror the required fields on that collection.
    CREATE TABLE IF NOT EXISTS "partner_payouts" (
      "id" serial PRIMARY KEY NOT NULL,
      "promo_code_id" integer NOT NULL,
      "partner_name_snapshot" varchar NOT NULL,
      "amount" numeric NOT NULL,
      "payout_date" timestamp(3) with time zone NOT NULL,
      "payment_method" "enum_partner_payouts_payment_method" NOT NULL,
      "reference" varchar,
      "note" varchar,
      "created_by_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ── Admin document-locking relationship ────────────────────────────────
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "partner_payouts_id" integer;

    -- ── Indexes ────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS "partner_payouts_promo_code_idx" ON "partner_payouts" USING btree ("promo_code_id");
    CREATE INDEX IF NOT EXISTS "partner_payouts_partner_name_snapshot_idx" ON "partner_payouts" USING btree ("partner_name_snapshot");
    CREATE INDEX IF NOT EXISTS "partner_payouts_payout_date_idx" ON "partner_payouts" USING btree ("payout_date");
    CREATE INDEX IF NOT EXISTS "partner_payouts_payment_method_idx" ON "partner_payouts" USING btree ("payment_method");
    CREATE INDEX IF NOT EXISTS "partner_payouts_created_by_idx" ON "partner_payouts" USING btree ("created_by_id");
    CREATE INDEX IF NOT EXISTS "partner_payouts_updated_at_idx" ON "partner_payouts" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "partner_payouts_created_at_idx" ON "partner_payouts" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_partner_payouts_id_idx" ON "payload_locked_documents_rels" USING btree ("partner_payouts_id");

    -- ── Foreign keys ───────────────────────────────────────────────────────
    -- RESTRICT, not the generated "set null" — see the deviation note in the file header.
    DO $$ BEGIN
      ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_promo_code_id_promo_codes_id_fk"
        FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE restrict ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- Removing a colleague's login must never remove the record that money was paid.
    DO $$ BEGIN
      ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_created_by_id_users_id_fk"
        FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partner_payouts_fk"
        FOREIGN KEY ("partner_payouts_id") REFERENCES "public"."partner_payouts"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

// Removes only what `up()` added, in dependency order: the lock relation first, then the
// payouts table with its own constraints, then the added columns, then the enum types (which
// can only be dropped once no column still references them).
//
// Note that dropping the promo_code_usages columns discards any commission snapshot written
// since the migration ran — that data cannot be reconstructed. This is a development-time
// escape hatch, not something to run against a database that has recorded real commission.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_partner_payouts_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_partner_payouts_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "partner_payouts_id";

    -- Drops the table's indexes and foreign keys with it.
    DROP TABLE IF EXISTS "partner_payouts" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_partner_payouts_payment_method";

    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "order_amount_before_discount";
    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "order_amount_after_discount";
    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "shipping_amount";
    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "is_partner_usage";
    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "partner_name_snapshot";
    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "commission_rate_snapshot";
    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "commission_base_snapshot";
    ALTER TABLE "promo_code_usages" DROP COLUMN IF EXISTS "commission_amount";

    DROP TYPE IF EXISTS "public"."enum_promo_code_usages_commission_base_snapshot";

    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "is_partner_code";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_name";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_email";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_phone";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "commission_rate";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "commission_base";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_note";

    DROP TYPE IF EXISTS "public"."enum_promo_codes_commission_base";
  `)
}
