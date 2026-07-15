import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds the `display_name` column to customers, which becomes admin.useAsTitle so that
// relationship fields (Orders → Kunde) and the Orders list show the customer's name
// instead of their email. Every existing row is backfilled here: "Fornavn Etternavn"
// trimmed, or the email when no name is stored. New/updated customers get the same value
// from the collection's beforeChange hook. Nothing else on the customer is touched.
// IF NOT EXISTS / IF EXISTS so the migration is safe to replay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "customers"
      ADD COLUMN IF NOT EXISTS "display_name" varchar;

    UPDATE "customers"
      SET "display_name" = NULLIF(TRIM(CONCAT_WS(' ', "first_name", "last_name")), '');

    UPDATE "customers"
      SET "display_name" = "email"
      WHERE "display_name" IS NULL OR "display_name" = '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "customers" DROP COLUMN IF EXISTS "display_name";
  `)
}
