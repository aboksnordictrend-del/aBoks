import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds the shipping-email outcome columns used by the idempotent send flow:
// the message id of a successful send, and the error text of a failed one.
// IF NOT EXISTS / IF EXISTS so the migration is safe to replay.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "shipped_email_message_id" varchar,
      ADD COLUMN IF NOT EXISTS "shipped_email_error" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "shipped_email_message_id",
      DROP COLUMN IF EXISTS "shipped_email_error";
  `)
}
