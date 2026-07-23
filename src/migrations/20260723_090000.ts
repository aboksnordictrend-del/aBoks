import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Google Ads sync: one new value on the marketing_expenses `source` enum. Purely additive
// and idempotent — no DROP/DELETE/TRUNCATE, no new column, no change to any existing row
// value, and no change to the Meta Ads data path.
//
// Nothing else is needed:
//  - the upsert key reuses the existing `external_key` column and its UNIQUE index from
//    20260722_090000 (`google:{customerId}:{YYYY-MM-DD}`), which is what makes
//    (source, external_account_id, external_date) unique by construction for Google exactly
//    as it already is for Meta;
//  - there is no Google Ads MVA setting to store: Google bills Norwegian businesses under
//    reverse charge, so imported rows are written with vatRate 0 and counted in full.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ALTER TYPE … ADD VALUE is allowed inside a transaction on PostgreSQL 12+ (Neon runs 16)
  // as long as the new value is not *used* in the same transaction — it is not.
  await db.execute(sql`
    ALTER TYPE "public"."enum_marketing_expenses_source" ADD VALUE IF NOT EXISTS 'google-ads';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Intentionally a no-op. PostgreSQL cannot remove a value from an enum type, and
  // dropping/recreating the type would rewrite the whole marketing_expenses table. Leaving
  // 'google-ads' in the enum is harmless — nothing references it once the rows are gone —
  // so `down` stays strictly non-destructive.
}
