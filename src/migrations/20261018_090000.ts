import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partner programme correction: the two optional agreements become two checkboxes.
//
// The first release (20261016_090000) stored five «samarbeidsformer» in one multi-select,
// `partners_partnership_types`. Under the established programme the three standard earning
// methods — Promokode, Bedriftssalg, Forhandlersalg — belong to every partner and are not
// selected, and only Dropshipping and Forhandlerinnkjøp are optional. This adds one boolean per
// optional agreement and carries each partner's existing selection over.
//
// Additive and data-preserving. Two new columns and two indexes on `partners`, plus a data step
// that writes ONLY those two new columns. Nothing is dropped, deleted or truncated:
//   • `partners_partnership_types`, its enum and every row in it stay exactly as they are;
//   • `business_sale_commission_percent` / `retailer_referral_commission_percent` keep their
//     values (the fields are hidden and frozen in the admin, not removed);
//   • `dropshipping_discount_percent` / `wholesale_discount_percent` are untouched — they are the
//     discount fields the checkboxes now govern;
//   • no other table is touched: promo codes, usages, payouts and orders are unchanged.
//
// ── Order of operations, and why it is idempotent ──
//
// 1. Add each column NULLABLE and WITHOUT a default, so every existing partner starts as NULL —
//    "not yet migrated" — rather than a `false` that would be indistinguishable from an admin's
//    later choice.
// 2. Fill only the NULL rows from the legacy selection: `true` when the partner had the model
//    selected, `false` otherwise.
// 3. Only then set `DEFAULT false`, the default Payload generates for the checkbox.
//
// A second run finds no NULL rows and changes nothing; it can never overwrite a checkbox an admin
// has since changed. Runs after 20261016_090000 and 20261017_090000, which created everything it
// reads; the DDL mirrors Payload's generated `rawTables` for the two checkbox fields.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "dropshipping_enabled" boolean;
    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "wholesale_enabled" boolean;

    UPDATE "partners" p
      SET "dropshipping_enabled" = EXISTS (
        SELECT 1 FROM "partners_partnership_types" t
        WHERE t."parent_id" = p."id" AND t."value" = 'dropshipping'
      )
      WHERE p."dropshipping_enabled" IS NULL;

    UPDATE "partners" p
      SET "wholesale_enabled" = EXISTS (
        SELECT 1 FROM "partners_partnership_types" t
        WHERE t."parent_id" = p."id" AND t."value" = 'wholesale'
      )
      WHERE p."wholesale_enabled" IS NULL;

    ALTER TABLE "partners" ALTER COLUMN "dropshipping_enabled" SET DEFAULT false;
    ALTER TABLE "partners" ALTER COLUMN "wholesale_enabled" SET DEFAULT false;

    CREATE INDEX IF NOT EXISTS "partners_dropshipping_enabled_idx" ON "partners" USING btree ("dropshipping_enabled");
    CREATE INDEX IF NOT EXISTS "partners_wholesale_enabled_idx" ON "partners" USING btree ("wholesale_enabled");
  `)
}

// Removes only the two checkbox columns and their indexes. The legacy selection in
// `partners_partnership_types` was never modified, so nothing is lost that `up()` cannot restore —
// except checkbox changes an admin made after the migration ran.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "partners_wholesale_enabled_idx";
    DROP INDEX IF EXISTS "partners_dropshipping_enabled_idx";
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "wholesale_enabled";
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "dropshipping_enabled";
  `)
}
