import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds product_variants.display_name (Visningsnavn) and backfills it for existing rows
// as "<product title> – <color name>". Additive + idempotent: the column is added with
// IF NOT EXISTS and the backfill only fills rows where display_name is still empty, so
// re-running changes nothing. No other columns are read or written.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "display_name" varchar;

    UPDATE "product_variants" v
    SET "display_name" = p."title" || ' – ' || v."name"
    FROM "products" p
    WHERE v."product_id" = p."id"
      AND (v."display_name" IS NULL OR v."display_name" = '');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "display_name";
  `)
}
