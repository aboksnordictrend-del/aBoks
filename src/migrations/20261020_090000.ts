import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partner postal address: five optional text columns on `partners`, for both partner types.
//
// Additive only. No UPDATE, DROP, DELETE or TRUNCATE in `up()`, and no other table is touched.
//
// ── Existing partners keep an empty address ──
//
// `country` has the default «Norge», but only for partners created from now on. Adding a column
// WITH a default would make Postgres fill that default into every existing row, so the column is
// added first without one and the default is set afterwards: existing partners keep NULL in all
// five columns. Nothing is overwritten — there was no address before this migration.
//
// Runs after 20261016_090000, 20261017_090000, 20261018_090000 and 20261019_090000. The DDL
// mirrors Payload's generated `rawTables` for the five fields (no indexes are generated).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "address_line1" varchar;
    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "address_line2" varchar;
    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "postal_code" varchar;
    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "city" varchar;
    ALTER TABLE "partners" ADD COLUMN IF NOT EXISTS "country" varchar;

    ALTER TABLE "partners" ALTER COLUMN "country" SET DEFAULT 'Norge';
  `)
}

// Removes only the five address columns, and with them any address entered after the migration.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "country";
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "city";
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "postal_code";
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "address_line2";
    ALTER TABLE "partners" DROP COLUMN IF EXISTS "address_line1";
  `)
}
