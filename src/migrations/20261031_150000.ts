import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Miljøregistrering — encrypted copy of the delivery PIN for the admin «Vis PIN».
//
// Adds one NULLABLE column, environmental_organizations.pin_encrypted (AES-256-GCM envelope, see
// src/lib/miljo/pinVault.ts). The key is NOT in the database. Existing rows keep NULL: their PINs
// exist only as a hash, cannot be recovered, and show «PIN kan ikke vises — opprett ny PIN» until
// an administrator sets a new one. PIN verification still uses pin_hash only.
//
// Additive only: no UPDATE, DROP, DELETE, RENAME or TRUNCATE in up(). The DDL is drizzle-kit's
// output for the schema difference (two `generateDrizzleJson` snapshots, no database involved).
//
// Runs after 20261031_120000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "environmental_organizations" ADD COLUMN IF NOT EXISTS "pin_encrypted" varchar;
  `)
}

// Dropping the column only removes the revealable copies; every PIN keeps working via its hash.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "environmental_organizations" DROP COLUMN IF EXISTS "pin_encrypted";
  `)
}
