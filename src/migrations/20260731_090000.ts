import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// TikTok Ads sync: one new value on the marketing_expenses `source` enum, plus the storage
// table for the `tiktok-connection` global. Purely additive and idempotent — no DROP/DELETE/
// TRUNCATE, no new column on an existing table, no change to any existing row value, and no
// change to the Meta Ads, Google Ads or Pinterest Ads data path.
//
// `channel` needs nothing: 'tiktok' has been a member of
// enum_marketing_expenses_channel since 20260718_150000, which created the type with the full
// channel list. Only `source` is missing a value, exactly as it was for Google Ads
// (20260723_090000) and Pinterest Ads (20260730_090000).
//
// The tiktok_connection table is the one unavoidable addition. The OAuth flow produces an
// access token at runtime and a serverless function cannot write an env var, so the token has
// to live somewhere durable; a Payload global reuses the existing storage model rather than
// introducing a bespoke credential system. The token column holds AES-256-GCM ciphertext, not
// a plaintext token — see src/lib/tiktok/tokenStore.ts.
//
// Nothing else is needed:
//  - the upsert key reuses the existing `external_key` column and its UNIQUE index from
//    20260722_090000 (`tiktok:{advertiserId}:{YYYY-MM-DD}`), which is what makes
//    (source, external_account_id, external_date) unique by construction for TikTok exactly
//    as it already is for Meta, Google Ads and Pinterest Ads;
//  - there is no TikTok Ads MVA setting to store: TikTok invoices Norwegian businesses under
//    reverse charge, so imported rows are written with vatRate 0 and counted in full.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ALTER TYPE … ADD VALUE is allowed inside a transaction on PostgreSQL 12+ (Neon runs 16)
  // as long as the new value is not *used* in the same transaction — it is not.
  await db.execute(sql`
    ALTER TYPE "public"."enum_marketing_expenses_source" ADD VALUE IF NOT EXISTS 'tiktok-ads';
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "tiktok_connection" (
      "id" serial PRIMARY KEY NOT NULL,
      "access_token_encrypted" varchar,
      "advertiser_id" varchar,
      "advertiser_name" varchar,
      "currency" varchar,
      "timezone" varchar,
      "connected_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The enum value is intentionally left in place: PostgreSQL cannot remove a value from an
  // enum type, and dropping/recreating the type would rewrite the whole marketing_expenses
  // table. Leaving 'tiktok-ads' in the enum is harmless — nothing references it once the rows
  // are gone.
  //
  // The connection table is dropped because this migration is what created it, and it holds
  // no business data — only an authorization that is re-obtained by reconnecting. No
  // marketing_expenses row is touched.
  await db.execute(sql`
    DROP TABLE IF EXISTS "tiktok_connection";
  `)
}
