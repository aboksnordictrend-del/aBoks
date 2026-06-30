import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The orders table was created from an initial schema that pre-dated the
// kustom_order_id field and the email-sentinel timestamps. None of the
// existing migrations added these columns, so production is missing them.
// Using IF NOT EXISTS / IF EXISTS so the migration is safe to replay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "kustom_order_id" varchar,
      ADD COLUMN IF NOT EXISTS "confirmation_email_sent_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "admin_email_sent_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "shipped_email_sent_at" timestamp(3) with time zone;

    CREATE INDEX IF NOT EXISTS "orders_kustom_order_id_idx"
      ON "orders" USING btree ("kustom_order_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_kustom_order_id_idx";

    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "kustom_order_id",
      DROP COLUMN IF EXISTS "confirmation_email_sent_at",
      DROP COLUMN IF EXISTS "admin_email_sent_at",
      DROP COLUMN IF EXISTS "shipped_email_sent_at";
  `)
}
