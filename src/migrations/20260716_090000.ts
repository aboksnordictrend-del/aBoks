import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds the receipt-email sentinels to `orders`, mirroring the existing shipped-email
// columns. All three are nullable and added with IF NOT EXISTS, so the migration is
// additive and safe to replay:
//   • receipt_email_sent_at    — idempotency sentinel for the "levert" receipt email
//   • receipt_email_message_id — SMTP message id of a successful send (diagnostics)
//   • receipt_email_error      — last send/PDF error (diagnostics)
// No data is modified, dropped or truncated.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "receipt_email_sent_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "receipt_email_message_id" varchar,
      ADD COLUMN IF NOT EXISTS "receipt_email_error" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "receipt_email_sent_at",
      DROP COLUMN IF EXISTS "receipt_email_message_id",
      DROP COLUMN IF EXISTS "receipt_email_error";
  `)
}
