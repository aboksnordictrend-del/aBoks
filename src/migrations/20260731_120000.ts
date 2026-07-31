import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// TikTok Ads: three new columns on the tiktok_connection global. Purely additive and
// idempotent — no DROP/DELETE/TRUNCATE, no enum change, no new table, no change to any
// marketing_expenses row, and no change to the Meta Ads, Google Ads or Pinterest Ads path.
//
// Why they exist:
//  - `connection_version` records the authorization contract a stored token was minted under.
//    A connection whose version is not the current one is ignored by the token store, which
//    is what forces a fresh "Koble til" after the flow changed. Existing rows have NULL and
//    are therefore treated as stale — deliberately: a token from the previous flow must not
//    be carried over.
//  - `metadata_available` records whether `GET /advertiser/info/` could be read. It requires
//    the Ad Account Management scope, which a Reporting-only app does not have; the spend
//    import does not need it, so it is best-effort and this flag says whether it succeeded.
//  - `reporting_ok` records the one-day report probe run at connect time, so the admin card
//    can distinguish "authorized but reporting refused" from a healthy connection.
//
// No credential is added or moved: the access token stays in `access_token_encrypted`
// (AES-256-GCM), exactly as 20260731_090000 created it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tiktok_connection" ADD COLUMN IF NOT EXISTS "connection_version" numeric;
    ALTER TABLE "tiktok_connection" ADD COLUMN IF NOT EXISTS "metadata_available" boolean;
    ALTER TABLE "tiktok_connection" ADD COLUMN IF NOT EXISTS "reporting_ok" boolean;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Only the columns this migration added are removed. The table itself, and the stored
  // authorization in it, are left alone — dropping those is 20260731_090000's concern.
  await db.execute(sql`
    ALTER TABLE "tiktok_connection" DROP COLUMN IF EXISTS "reporting_ok";
    ALTER TABLE "tiktok_connection" DROP COLUMN IF EXISTS "metadata_available";
    ALTER TABLE "tiktok_connection" DROP COLUMN IF EXISTS "connection_version";
  `)
}
