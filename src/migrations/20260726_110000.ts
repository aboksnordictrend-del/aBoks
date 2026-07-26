import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds orders_items.display_name — the finished product name for an order line, snapshotted
// at purchase ("aBoks Vegg – Mørk blå").
//
// Until now an order line stored only the colour ("Mørk blå") plus a variant reference, and
// every customer-facing renderer (e-mail, PDF receipt) prefixed the literal "aBoks" to it.
// With aBoks Vegg / Mini / Nano in the catalogue that literal is simply wrong: the admin
// panel showed "aBoks Vegg – Mørk blå" while the customer's e-mail said "aBoks – Mørk blå".
//
// The backfill takes the name from the variant the line already points at, which is the
// exact string the admin panel shows, so existing orders — including any e-mail resent
// later — start printing the same name the admin sees. Lines whose variant is gone (or that
// never had one) are left NULL and keep falling back to the stored colour name; they are
// never given an invented product name.
//
// Additive and idempotent: IF NOT EXISTS on the column, and the backfill only touches rows
// where display_name is still empty.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items" ADD COLUMN IF NOT EXISTS "display_name" varchar;

    UPDATE "orders_items" oi
    SET "display_name" = pv."display_name"
    FROM "product_variants" pv
    WHERE oi."variant_id" = pv."id"
      AND (oi."display_name" IS NULL OR oi."display_name" = '')
      AND pv."display_name" IS NOT NULL
      AND pv."display_name" <> '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items" DROP COLUMN IF EXISTS "display_name";
  `)
}
