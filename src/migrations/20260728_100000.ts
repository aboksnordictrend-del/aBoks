import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partner payment details on promo_codes: three nullable text columns recorded for the
// administrator's reference when making a manual transfer.
//
// Purely additive and idempotent. Three new NULLABLE varchar columns on one existing table —
// no enum, no table, no index, no foreign key, no constraint. There is no DROP, DELETE,
// TRUNCATE, RENAME or UPDATE: not one existing row is read or rewritten, and every existing
// promo code stays valid exactly as it is with NULL in all three.
//
// No backfill, by design: these values only exist once an administrator types them.
//
// Nothing reads these columns. They are deliberately absent from the commission calculation,
// the partner statistics, the payout endpoint, the payout snapshot and the partner e-mail.
//
// Column names and types were read back off the adapter's generated `rawTables` (with the
// database connection disabled) rather than guessed, as with the other migrations here.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_bank_account" varchar;
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_account_owner" varchar;
    ALTER TABLE "promo_codes" ADD COLUMN IF NOT EXISTS "partner_organization_number" varchar;
  `)
}

// Drops only the three columns this migration added. Any payment details an administrator
// has typed are discarded with them — they cannot be reconstructed from anywhere else.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_bank_account";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_account_owner";
    ALTER TABLE "promo_codes" DROP COLUMN IF EXISTS "partner_organization_number";
  `)
}
