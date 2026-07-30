import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Pinterest Ads sync: two new values on existing marketing_expenses enums — 'pinterest' on
// `channel` and 'pinterest-ads' on `source`. Purely additive and idempotent — no DROP/DELETE/
// TRUNCATE, no new table, no new column, no new index, no change to any existing row value,
// and no change to the Meta Ads or Google Ads data path.
//
// Both are unavoidable: `channel` and `source` are PostgreSQL enum types, so an INSERT with a
// value outside the type is rejected by the database. This is the same shape of change
// 20260723_090000 made for Google Ads.
//
// Nothing else is needed:
//  - the upsert key reuses the existing `external_key` column and its UNIQUE index from
//    20260722_090000 (`pinterest:{adAccountId}:{YYYY-MM-DD}`), which is what makes
//    (source, external_account_id, external_date) unique by construction for Pinterest
//    exactly as it already is for Meta and Google Ads;
//  - there is no Pinterest Ads MVA setting to store: Pinterest invoices Norwegian businesses
//    under reverse charge, so imported rows are written with vatRate 0 and counted in full.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ALTER TYPE … ADD VALUE is allowed inside a transaction on PostgreSQL 12+ (Neon runs 16)
  // as long as the new value is not *used* in the same transaction — it is not.
  await db.execute(sql`
    ALTER TYPE "public"."enum_marketing_expenses_channel" ADD VALUE IF NOT EXISTS 'pinterest';
  `)
  await db.execute(sql`
    ALTER TYPE "public"."enum_marketing_expenses_source" ADD VALUE IF NOT EXISTS 'pinterest-ads';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Intentionally a no-op. PostgreSQL cannot remove a value from an enum type, and
  // dropping/recreating the types would rewrite the whole marketing_expenses table. Leaving
  // the two values in the enums is harmless — nothing references them once the rows are gone —
  // so `down` stays strictly non-destructive.
}
