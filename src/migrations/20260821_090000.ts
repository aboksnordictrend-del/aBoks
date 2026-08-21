import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Forsendelse: the carrier and the consignment number an order was shipped with.
//
// Purely additive and idempotent. One new enum type and two nullable columns on `orders` —
// no DROP, no DELETE, no TRUNCATE, no backfill, and not one existing row is read or
// rewritten. Every order that predates this section keeps both columns NULL, which is the
// truthful value: nobody recorded a carrier for them.
//
// Nullable rather than NOT NULL with a default. A default would invent a carrier for
// historical orders, and NOT NULL would make an old `shipped` order unsaveable. The
// requirement lives where it belongs instead — in `validateShipment`, which enforces it on
// exactly one event, the transition of an order into «Sendt» (see @/lib/orders/shipment).
//
// `enum_orders_shipping_carrier` is the type name Payload's Postgres adapter derives for a
// radio field named `shippingCarrier` on the `orders` collection, matching the existing
// `enum_orders_status` and `enum_orders_payment_fee_source`. Its values are the storage keys
// from SHIPPING_CARRIERS — adding a fourth carrier later means ALTER TYPE … ADD VALUE, not a
// rewrite of this file.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_shipping_carrier" AS ENUM('postnord', 'posten', 'helthjem');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "shipping_carrier" "enum_orders_shipping_carrier",
      ADD COLUMN IF NOT EXISTS "tracking_number" varchar;
  `)
}

// Drops exactly what this migration added. The only data lost is the carrier and consignment
// number of orders shipped after it was applied; no other order column is touched.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "shipping_carrier",
      DROP COLUMN IF EXISTS "tracking_number";

    DROP TYPE IF EXISTS "public"."enum_orders_shipping_carrier";
  `)
}
