import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partner links (Phases 2–3), schema only: a nullable `partner_id` on promo_codes and on
// partner_payouts, each with the index and foreign key Payload generates for it.
//
// Purely additive and idempotent. Two new NULLABLE columns, two indexes, two foreign keys.
// There is no DROP, DELETE, TRUNCATE or UPDATE anywhere in `up()`: not one existing row is read
// or rewritten. Every promo code starts unlinked and every existing payout keeps `partner_id`
// NULL — they go on working exactly as before, through `partner_name` / `partner_name_snapshot`
// and the per-code balance. The `partners.promoCodes` / `partners.payouts` admin lists are join
// fields and have no column.
//
// Deliberately NO data step. Copying the existing per-code partner details into `partners` rows
// and linking them is a separate, reviewable step (Phase 4); production had no partner codes
// and no payouts when this was written.
//
// The DDL mirrors Payload's generated `rawTables` for these two relationship fields (read back
// with the database connection disabled), including the `set null` delete action. That is
// correct here, unlike `partner_payouts.promo_code_id` in 20260728_090000: these columns are
// nullable, so `set null` is coherent. Deleting a partner that still has codes or payouts is
// refused one level up, by the `partners` collection's beforeDelete hook.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Columns ────────────────────────────────────────────────────────────
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_id" integer;
    ALTER TABLE "partner_payouts" ADD COLUMN IF NOT EXISTS "partner_id" integer;

    -- ── Indexes ────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS "promo_codes_partner_idx" ON "promo_codes" USING btree ("partner_id");
    CREATE INDEX IF NOT EXISTS "partner_payouts_partner_idx" ON "partner_payouts" USING btree ("partner_id");

    -- ── Foreign keys ───────────────────────────────────────────────────────
    DO $$ BEGIN
      ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_partner_id_partners_id_fk"
        FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_partner_id_partners_id_fk"
        FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

// Removes only what `up()` added. Dropping the columns discards which partner each code and
// payout was linked to; the codes, payouts, names and balances themselves are untouched.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "partner_payouts" DROP CONSTRAINT IF EXISTS "partner_payouts_partner_id_partners_id_fk";
    DROP INDEX IF EXISTS "partner_payouts_partner_idx";
    ALTER TABLE "partner_payouts" DROP COLUMN IF EXISTS "partner_id";

    ALTER TABLE "promo_codes" DROP CONSTRAINT IF EXISTS "promo_codes_partner_id_partners_id_fk";
    DROP INDEX IF EXISTS "promo_codes_partner_idx";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_id";
  `)
}
