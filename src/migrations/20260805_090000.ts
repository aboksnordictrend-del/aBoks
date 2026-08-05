import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Meta Conversions API: the six columns behind the `meta` group on orders.
//
// Purely additive and idempotent. Six new nullable columns on one existing table — no DROP,
// DELETE, TRUNCATE or UPDATE, no change to any existing column, and not one existing row is
// read or rewritten. Every order that already exists stays valid exactly as it is, with all
// six columns NULL, which the send flow reads as "no attribution captured, nothing sent yet".
//
// Column names are the ones Payload's Postgres adapter derives from a group: the group name
// `meta` prefixes each field, snake-cased — `clientIpAddress` → "meta_client_ip_address".
//
//   meta_fbp / meta_fbc                  Meta's browser-id and click-id cookies, captured in
//                                        the checkout server action (the customer's own
//                                        request) because the push webhook's cookies belong
//                                        to api.kustom.co, not to the buyer.
//   meta_client_ip_address               The buyer's IP, from Vercel's trusted header. One
//                                        address, never the proxy chain.
//   meta_client_user_agent               The buyer's user agent.
//   meta_purchase_sent_at                The single-send claim. Stamped by
//                                        `UPDATE … WHERE meta_purchase_sent_at IS NULL`
//                                        before the Graph call and cleared again if it fails,
//                                        so two overlapping webhook deliveries cannot both
//                                        send and a failure stays retryable.
//   meta_purchase_event_id               The receipt, written only after Meta accepted the
//                                        event: `purchase_<kustomOrderId>`.
//
// No index. The claim is always by primary key (`WHERE "id" = …`), and nothing queries orders
// by any of these values.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "meta_fbp" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "meta_fbc" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "meta_client_ip_address" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "meta_client_user_agent" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "meta_purchase_sent_at" timestamp(3) with time zone;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "meta_purchase_event_id" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Safe to drop: these columns hold marketing attribution and a send receipt, none of which
  // is business data. Dropping them loses the record of which orders were reported to Meta —
  // the orders themselves, their money and their customers are untouched.
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "meta_fbp";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "meta_fbc";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "meta_client_ip_address";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "meta_client_user_agent";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "meta_purchase_sent_at";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "meta_purchase_event_id";
  `)
}
