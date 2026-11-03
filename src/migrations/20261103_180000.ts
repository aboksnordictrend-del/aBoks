import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// aBoks Miljøregistrering, Stage 2.2a — self-registration of companies.
//
// ── What this creates ──
//
//   • miljo_registrations: one row per submitted self-registration, from the verified purchase until
//     the e-mail link is used — the order, the company (number + official name from Enhetsregisteret),
//     contact person, login e-mail, and the secrets needed to finish, stored ONLY as hashes (a
//     Payload-compatible password hash, SHA-256 of the confirmation token and of the resend key, both
//     unique). A partial unique index allows at most one «pending» registration per order.
//   • miljo_rate_limits: database-backed rate limiting for registration (and, in Stage 2.2b, sign-in
//     and password reset), shared by every serverless instance. Keys are SHA-256 hashes — no IP
//     address or e-mail is stored. Not a Payload collection; written only by @/lib/security/dbRateLimit.
//   • payload_locked_documents_rels: one nullable column for the new collection.
//
// ── Additive only ──
//
// One new collection table, one helper table, one enum, one nullable column. No UPDATE, DROP,
// DELETE, RENAME or TRUNCATE in up(); no existing row is read or written.
//
// ── How the DDL was produced ──
//
// drizzle-kit's output for the schema difference (two `generateDrizzleJson` snapshots, no database
// involved), with three deliberate additions:
//   • miljo_registrations.order_id is NOT NULL, so its foreign key is RESTRICT instead of the SET NULL
//     drizzle emits (which would fail with a raw 23502);
//   • the partial unique index miljo_registrations_one_pending_per_order;
//   • the miljo_rate_limits table, which no collection describes.
//
// Runs after 20261103_150000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_miljo_registrations_status" AS ENUM('pending', 'confirmed', 'superseded');
    CREATE TABLE "miljo_registrations" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"status" "enum_miljo_registrations_status" DEFAULT 'pending' NOT NULL,
    	"order_id" integer NOT NULL,
    	"order_number" varchar,
    	"organization_number" varchar NOT NULL,
    	"official_name" varchar NOT NULL,
    	"contact_name" varchar NOT NULL,
    	"login_email" varchar NOT NULL,
    	"token_expires_at" timestamp(3) with time zone,
    	"send_count" numeric DEFAULT 0,
    	"last_sent_at" timestamp(3) with time zone,
    	"confirmed_at" timestamp(3) with time zone,
    	"business_customer_id" integer,
    	"account_id" integer,
    	"environmental_organization_id" integer,
    	"password_salt" varchar,
    	"password_hash" varchar,
    	"token_hash" varchar,
    	"resend_key_hash" varchar,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "miljo_registrations_id" integer;
    ALTER TABLE "miljo_registrations" ADD CONSTRAINT "miljo_registrations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "miljo_registrations" ADD CONSTRAINT "miljo_registrations_business_customer_id_business_customers_id_fk" FOREIGN KEY ("business_customer_id") REFERENCES "public"."business_customers"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "miljo_registrations" ADD CONSTRAINT "miljo_registrations_account_id_miljo_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."miljo_accounts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "miljo_registrations" ADD CONSTRAINT "miljo_registrations_environmental_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("environmental_organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "miljo_registrations_status_idx" ON "miljo_registrations" USING btree ("status");
    CREATE INDEX "miljo_registrations_order_idx" ON "miljo_registrations" USING btree ("order_id");
    CREATE UNIQUE INDEX "miljo_registrations_one_pending_per_order" ON "miljo_registrations" USING btree ("order_id") WHERE "status" = 'pending';
    CREATE INDEX "miljo_registrations_organization_number_idx" ON "miljo_registrations" USING btree ("organization_number");
    CREATE INDEX "miljo_registrations_login_email_idx" ON "miljo_registrations" USING btree ("login_email");
    CREATE INDEX "miljo_registrations_business_customer_idx" ON "miljo_registrations" USING btree ("business_customer_id");
    CREATE INDEX "miljo_registrations_account_idx" ON "miljo_registrations" USING btree ("account_id");
    CREATE INDEX "miljo_registrations_environmental_organization_idx" ON "miljo_registrations" USING btree ("environmental_organization_id");
    CREATE UNIQUE INDEX "miljo_registrations_token_hash_idx" ON "miljo_registrations" USING btree ("token_hash");
    CREATE UNIQUE INDEX "miljo_registrations_resend_key_hash_idx" ON "miljo_registrations" USING btree ("resend_key_hash");
    CREATE INDEX "miljo_registrations_updated_at_idx" ON "miljo_registrations" USING btree ("updated_at");
    CREATE INDEX "miljo_registrations_created_at_idx" ON "miljo_registrations" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_miljo_registrations_fk" FOREIGN KEY ("miljo_registrations_id") REFERENCES "public"."miljo_registrations"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_miljo_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("miljo_registrations_id");
    CREATE TABLE "miljo_rate_limits" (
    	"key" varchar(64) PRIMARY KEY NOT NULL,
    	"window_start" timestamp(3) with time zone NOT NULL,
    	"count" integer NOT NULL
    );
    CREATE INDEX "miljo_rate_limits_window_start_idx" ON "miljo_rate_limits" USING btree ("window_start");
  `)
}

// Refuses to drop registrations: they are the record of how each company was activated.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const used = await db.execute(sql`SELECT count(*)::int AS n FROM "miljo_registrations";`)
  const n = Number((used.rows?.[0] as { n?: number } | undefined)?.n ?? 0)
  if (n > 0) {
    throw new Error(`20261103_180000 down: ${n} self-registration row(s) exist. Export and remove them deliberately first.`)
  }
  await db.execute(sql`
    DROP TABLE IF EXISTS "miljo_rate_limits";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_miljo_registrations_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_miljo_registrations_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "miljo_registrations_id";
    DROP TABLE IF EXISTS "miljo_registrations" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_miljo_registrations_status";
  `)
}
