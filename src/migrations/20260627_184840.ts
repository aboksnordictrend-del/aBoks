import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_price" numeric;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_start_date" timestamp(3) with time zone;
    ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sale_end_date" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sale_price";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sale_start_date";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "sale_end_date";
  `)
}
