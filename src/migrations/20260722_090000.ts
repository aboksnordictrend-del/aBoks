import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Meta Ads sync: technical upsert fields on marketing_expenses + a marketing MVA rate on
// economy_settings. Purely additive and idempotent — a new enum, six new columns, one
// UNIQUE index, and one economy-settings column. No DROP/DELETE/TRUNCATE and no changes to
// existing row values beyond the DEFAULTs Postgres backfills for the new columns.
//
// `source` is added with DEFAULT 'manual', so every pre-existing marketing_expenses row is
// safely classified as a manual entry. `external_key` is UNIQUE; NULLs (all manual rows)
// are allowed to repeat under a Postgres unique index, so only Meta rows are constrained.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_marketing_expenses_source" AS ENUM('manual', 'meta-api');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "marketing_expenses" ADD COLUMN IF NOT EXISTS "source" "enum_marketing_expenses_source" DEFAULT 'manual';
    ALTER TABLE "marketing_expenses" ADD COLUMN IF NOT EXISTS "external_key" varchar;
    ALTER TABLE "marketing_expenses" ADD COLUMN IF NOT EXISTS "external_account_id" varchar;
    ALTER TABLE "marketing_expenses" ADD COLUMN IF NOT EXISTS "external_date" varchar;
    ALTER TABLE "marketing_expenses" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp(3) with time zone;
    ALTER TABLE "marketing_expenses" ADD COLUMN IF NOT EXISTS "sync_metadata" jsonb;

    -- Backfill any legacy NULLs (rows created before the column DEFAULT existed).
    UPDATE "marketing_expenses" SET "source" = 'manual' WHERE "source" IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS "marketing_expenses_external_key_idx"
      ON "marketing_expenses" USING btree ("external_key");

    ALTER TABLE "economy_settings" ADD COLUMN IF NOT EXISTS "meta_ads_vat_rate" numeric DEFAULT 25;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "economy_settings" DROP COLUMN IF EXISTS "meta_ads_vat_rate";

    DROP INDEX IF EXISTS "marketing_expenses_external_key_idx";

    ALTER TABLE "marketing_expenses" DROP COLUMN IF EXISTS "sync_metadata";
    ALTER TABLE "marketing_expenses" DROP COLUMN IF EXISTS "last_synced_at";
    ALTER TABLE "marketing_expenses" DROP COLUMN IF EXISTS "external_date";
    ALTER TABLE "marketing_expenses" DROP COLUMN IF EXISTS "external_account_id";
    ALTER TABLE "marketing_expenses" DROP COLUMN IF EXISTS "external_key";
    ALTER TABLE "marketing_expenses" DROP COLUMN IF EXISTS "source";

    DROP TYPE IF EXISTS "public"."enum_marketing_expenses_source";
  `)
}
