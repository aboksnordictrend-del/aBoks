import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Pinterest OAuth 2.0: the storage table for the `pinterest-connection` global.
//
// Purely additive and idempotent — no DROP/DELETE/TRUNCATE, no change to any existing table, no
// change to any existing row. **No marketing_expenses row is touched**: the imported Pinterest
// Ads spend is business data and is entirely independent of how the integration authenticates.
// Nothing in the Meta Ads, Google Ads or TikTok Ads path is affected either.
//
// Why a table at all: the OAuth flow produces tokens at runtime and a Vercel serverless function
// cannot write an env var, so something durable has to hold them — and continuous refresh means
// the refresh token is *replaced* on every renewal, so it cannot live in configuration. A
// Payload global reuses the existing storage model rather than introducing a bespoke credential
// system, exactly as tiktok_connection did in 20260731_090000.
//
// Column names are the ones Payload's Postgres adapter derives from the field names via
// toSnakeCase. That is why `lastOAuthError` becomes "last_o_auth_error" — the consecutive
// capitals in "OAuth" each begin a word. It looks like a typo and is not one; renaming it would
// detach the column from the field.
//
// Both token columns hold AES-256-GCM ciphertext, never a plaintext token — see
// src/lib/pinterest/oauth/store.ts. `token_version` is the compare-and-swap guard that stops two
// concurrent syncs from rotating with the same refresh token, and `refresh_lock_expires_at` is
// the self-expiring mutual-exclusion lock around a refresh.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pinterest_connection_connection_status" AS ENUM('disconnected', 'connected', 'reauthorization_required');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "pinterest_connection" (
      "id" serial PRIMARY KEY NOT NULL,
      "access_token_encrypted" varchar,
      "refresh_token_encrypted" varchar,
      "access_token_expires_at" timestamp(3) with time zone,
      "refresh_token_expires_at" timestamp(3) with time zone,
      "scope" varchar,
      "token_type" varchar,
      "connected_at" timestamp(3) with time zone,
      "last_refreshed_at" timestamp(3) with time zone,
      "connection_status" "enum_pinterest_connection_connection_status",
      "last_o_auth_error" varchar,
      "token_version" numeric DEFAULT 0,
      "refresh_lock_expires_at" timestamp(3) with time zone,
      "connection_version" numeric,
      "pending_state_hash" varchar,
      "pending_state_expires_at" timestamp(3) with time zone,
      "pending_state_user_id" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The table is dropped because this migration is what created it, and it holds no business
  // data — only an authorization that is re-obtained by reconnecting. The enum type is left in
  // place; it is harmless once nothing references it, and dropping a type another object might
  // still use is the riskier of the two options. No marketing_expenses row is touched.
  await db.execute(sql`
    DROP TABLE IF EXISTS "pinterest_connection";
  `)
}
