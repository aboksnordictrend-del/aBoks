import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds the `section` select field to products, which splits the catalogue into
// /produkter and /tilbehor. Every existing row is backfilled to 'products' before the
// column is made NOT NULL, so no product, variant, image, price or stock is touched.
// IF NOT EXISTS / IF EXISTS so the migration is safe to replay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_section" AS ENUM('products', 'accessories');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "section" "enum_products_section" DEFAULT 'products';

    UPDATE "products" SET "section" = 'products' WHERE "section" IS NULL;

    ALTER TABLE "products" ALTER COLUMN "section" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "section";
    DROP TYPE IF EXISTS "public"."enum_products_section";
  `)
}
