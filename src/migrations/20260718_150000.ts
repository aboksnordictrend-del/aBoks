import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Stage 4: economy + marketing module. Purely additive and idempotent — new enum types,
// two new tables (marketing_expenses collection, economy_settings global), one new Orders
// column (payment_fee_source) and the admin locked-documents relationship for the new
// collection. No DROP/DELETE/TRUNCATE, no changes to existing rows, no backfill.
//
// The DDL shape mirrors what `payload migrate:create` produced; the auto-generated file
// itself was NOT used because it diffed against a schema baseline and re-emitted many
// already-applied Stage 1–3 columns (cost_price, section, display_name, …). Only the new
// Stage 4 objects are created here, each guarded so the migration is safe to replay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_payment_fee_source" AS ENUM('auto', 'manual');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_marketing_expenses_channel" AS ENUM('meta', 'google', 'tiktok', 'snapchat', 'influencer', 'annet');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_economy_settings_calculate_from" AS ENUM('orderTotalInclShipping', 'productTotalOnly');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_economy_settings_rounding_policy" AS ENUM('round2', 'none');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "marketing_expenses" (
      "id" serial PRIMARY KEY NOT NULL,
      "date" timestamp(3) with time zone NOT NULL,
      "channel" "enum_marketing_expenses_channel" NOT NULL,
      "amount" numeric NOT NULL,
      "vat_rate" numeric DEFAULT 25,
      "amount_ex_vat" numeric,
      "description" varchar,
      "external_reference" varchar,
      "period_from" timestamp(3) with time zone,
      "period_to" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "economy_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "kustom_enabled" boolean DEFAULT false,
      "payment_provider" varchar DEFAULT 'Kustom',
      "fixed_fee" numeric DEFAULT 0,
      "percentage_fee" numeric DEFAULT 0,
      "fee_vat_rate" numeric DEFAULT 25,
      "calculate_from" "enum_economy_settings_calculate_from" DEFAULT 'orderTotalInclShipping',
      "apply_default_shipping_cost" boolean DEFAULT false,
      "default_shipping_cost" numeric,
      "free_shipping_still_has_cost" boolean DEFAULT true,
      "marketing_amounts_include_vat" boolean DEFAULT true,
      "rounding_policy" "enum_economy_settings_rounding_policy" DEFAULT 'round2',
      "currency" varchar DEFAULT 'NOK',
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );

    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_fee_source" "enum_orders_payment_fee_source";

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "marketing_expenses_id" integer;

    CREATE INDEX IF NOT EXISTS "marketing_expenses_updated_at_idx" ON "marketing_expenses" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "marketing_expenses_created_at_idx" ON "marketing_expenses" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_marketing_expenses_id_idx" ON "payload_locked_documents_rels" USING btree ("marketing_expenses_id");

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_marketing_expenses_fk"
        FOREIGN KEY ("marketing_expenses_id") REFERENCES "public"."marketing_expenses"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_marketing_expenses_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_marketing_expenses_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "marketing_expenses_id";

    ALTER TABLE "orders" DROP COLUMN IF EXISTS "payment_fee_source";

    DROP TABLE IF EXISTS "marketing_expenses" CASCADE;
    DROP TABLE IF EXISTS "economy_settings" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_orders_payment_fee_source";
    DROP TYPE IF EXISTS "public"."enum_marketing_expenses_channel";
    DROP TYPE IF EXISTS "public"."enum_economy_settings_calculate_from";
    DROP TYPE IF EXISTS "public"."enum_economy_settings_rounding_policy";
  `)
}
