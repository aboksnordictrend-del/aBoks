import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partner type: «Vanlig partner» (`regular`) or «Nettbutikk / Forhandler» (`retailer`).
//
// Additive only. One enum type, one NULLABLE column on `partners` with NO default, and its index.
// No UPDATE, DROP, DELETE or TRUNCATE: not a single existing row is read or rewritten.
//
// ── Existing partners are deliberately left unclassified ──
//
// Every partner created before this migration keeps `partner_type` NULL. Nothing guesses a type:
// a partner with promo codes is not necessarily «regular», and one with a ticked retailer
// agreement is not necessarily an online store. An administrator classifies each one, once, in
// the admin — the collection requires a type on save and makes it immutable afterwards
// (`src/collections/hooks/partnerType.ts`). Until then the record stays readable, and its promo
// codes, payouts and stored agreement settings are untouched.
//
// That is also why the column is nullable although the field is required on save: a NOT NULL
// column would need a default, which would classify every existing partner silently.
//
// Everything else is preserved as it is: `dropshipping_enabled` / `wholesale_enabled` and their
// percentages, the legacy `partners_partnership_types` table and rate columns, and every
// promo-code and payout link. Runs after 20261016_090000, 20261017_090000 and 20261018_090000.
// The DDL mirrors Payload's generated `rawTables` for the field.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_partners_partner_type" AS ENUM('regular', 'retailer');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "partner_type" "enum_partners_partner_type";

    CREATE INDEX IF NOT EXISTS "partners_partner_type_idx" ON "partners" USING btree ("partner_type");
  `)
}

// Removes only what `up()` added. Classifications made after the migration ran are lost; nothing
// else is affected.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "partners_partner_type_idx";
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "partner_type";
    DROP TYPE IF EXISTS "public"."enum_partners_partner_type";
  `)
}
