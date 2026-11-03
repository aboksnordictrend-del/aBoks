import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// aBoks Miljøregistrering, Stage 1 — business customers and their Miljø login accounts.
//
// ── What this creates ──
//
//   • business_customers: one row per company (unique organization_number, 9 digits), contact
//     e-mail + verification time, status, activation time, and an optional link to ONE
//     environmental organisation (unique environmental_organization_id).
//   • business_customers_rels: the eligible AB- orders (path 'eligibleOrders'). A partial unique
//     index on orders_id for that path means one order can make only one company eligible.
//   • miljo_accounts (+ _sessions): a Payload auth collection — e-mail, hash/salt, login attempts,
//     lock, reset token — with ONE account per business customer (unique business_customer_id).
//   • payload_locked_documents_rels / payload_preferences_rels: three nullable columns for the new
//     collections, as Payload expects for every collection and every auth collection.
//
// ── Additive only ──
//
// New tables, two new enums and three new NULLABLE columns. No UPDATE, DROP, DELETE, RENAME or
// TRUNCATE in up(). No existing table's data is touched; orders, customers and
// environmental_organizations get no new column (the links live on the new tables).
//
// ── How the DDL was produced ──
//
// drizzle-kit's own output for the difference between Payload's schema for this config and the
// same config at the previous commit (two `generateDrizzleJson` snapshots, no database involved) —
// the same method as 20261031_120000. Deliberate changes:
//   • miljo_accounts.business_customer_id is NOT NULL, so its foreign key is RESTRICT instead of
//     the SET NULL drizzle emits (which would fail with a raw 23502). The collection hook already
//     refuses deleting a business customer that has an account, with a Norwegian message.
//   • The partial unique index business_customers_rels_eligible_orders_unique (see above).
//
// Runs after 20261031_150000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_business_customers_status" AS ENUM('pending', 'active', 'suspended');
    CREATE TYPE "public"."enum_miljo_accounts_status" AS ENUM('invited', 'active', 'disabled');
    CREATE TABLE "business_customers" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"name" varchar NOT NULL,
    	"organization_number" varchar NOT NULL,
    	"status" "enum_business_customers_status" DEFAULT 'pending' NOT NULL,
    	"activated_at" timestamp(3) with time zone,
    	"contact_name" varchar,
    	"contact_email" varchar NOT NULL,
    	"contact_email_verified_at" timestamp(3) with time zone,
    	"environmental_organization_id" integer,
    	"internal_note" varchar,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "business_customers_rels" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"order" integer,
    	"parent_id" integer NOT NULL,
    	"path" varchar NOT NULL,
    	"orders_id" integer
    );

    CREATE TABLE "miljo_accounts_sessions" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"created_at" timestamp(3) with time zone,
    	"expires_at" timestamp(3) with time zone NOT NULL
    );

    CREATE TABLE "miljo_accounts" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"business_customer_id" integer NOT NULL,
    	"status" "enum_miljo_accounts_status" DEFAULT 'invited' NOT NULL,
    	"email_verified_at" timestamp(3) with time zone,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"email" varchar NOT NULL,
    	"reset_password_token" varchar,
    	"reset_password_expiration" timestamp(3) with time zone,
    	"salt" varchar,
    	"hash" varchar,
    	"login_attempts" numeric DEFAULT 0,
    	"lock_until" timestamp(3) with time zone
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "business_customers_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "miljo_accounts_id" integer;
    ALTER TABLE "payload_preferences_rels" ADD COLUMN "miljo_accounts_id" integer;
    ALTER TABLE "business_customers" ADD CONSTRAINT "business_customers_environmental_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("environmental_organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "business_customers_rels" ADD CONSTRAINT "business_customers_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."business_customers"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "business_customers_rels" ADD CONSTRAINT "business_customers_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "miljo_accounts_sessions" ADD CONSTRAINT "miljo_accounts_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."miljo_accounts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "miljo_accounts" ADD CONSTRAINT "miljo_accounts_business_customer_id_business_customers_id_fk" FOREIGN KEY ("business_customer_id") REFERENCES "public"."business_customers"("id") ON DELETE restrict ON UPDATE no action;
    CREATE INDEX "business_customers_name_idx" ON "business_customers" USING btree ("name");
    CREATE UNIQUE INDEX "business_customers_organization_number_idx" ON "business_customers" USING btree ("organization_number");
    CREATE INDEX "business_customers_status_idx" ON "business_customers" USING btree ("status");
    CREATE INDEX "business_customers_contact_email_idx" ON "business_customers" USING btree ("contact_email");
    CREATE UNIQUE INDEX "business_customers_environmental_organization_idx" ON "business_customers" USING btree ("environmental_organization_id");
    CREATE INDEX "business_customers_updated_at_idx" ON "business_customers" USING btree ("updated_at");
    CREATE INDEX "business_customers_created_at_idx" ON "business_customers" USING btree ("created_at");
    CREATE INDEX "business_customers_rels_order_idx" ON "business_customers_rels" USING btree ("order");
    CREATE INDEX "business_customers_rels_parent_idx" ON "business_customers_rels" USING btree ("parent_id");
    CREATE INDEX "business_customers_rels_path_idx" ON "business_customers_rels" USING btree ("path");
    CREATE INDEX "business_customers_rels_orders_id_idx" ON "business_customers_rels" USING btree ("orders_id");
    CREATE UNIQUE INDEX "business_customers_rels_eligible_orders_unique" ON "business_customers_rels" USING btree ("orders_id") WHERE "path" = 'eligibleOrders';
    CREATE INDEX "miljo_accounts_sessions_order_idx" ON "miljo_accounts_sessions" USING btree ("_order");
    CREATE INDEX "miljo_accounts_sessions_parent_id_idx" ON "miljo_accounts_sessions" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "miljo_accounts_business_customer_idx" ON "miljo_accounts" USING btree ("business_customer_id");
    CREATE INDEX "miljo_accounts_status_idx" ON "miljo_accounts" USING btree ("status");
    CREATE INDEX "miljo_accounts_updated_at_idx" ON "miljo_accounts" USING btree ("updated_at");
    CREATE INDEX "miljo_accounts_created_at_idx" ON "miljo_accounts" USING btree ("created_at");
    CREATE UNIQUE INDEX "miljo_accounts_email_idx" ON "miljo_accounts" USING btree ("email");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_business_customers_fk" FOREIGN KEY ("business_customers_id") REFERENCES "public"."business_customers"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_miljo_accounts_fk" FOREIGN KEY ("miljo_accounts_id") REFERENCES "public"."miljo_accounts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_miljo_accounts_fk" FOREIGN KEY ("miljo_accounts_id") REFERENCES "public"."miljo_accounts"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_business_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("business_customers_id");
    CREATE INDEX "payload_locked_documents_rels_miljo_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("miljo_accounts_id");
    CREATE INDEX "payload_preferences_rels_miljo_accounts_id_idx" ON "payload_preferences_rels" USING btree ("miljo_accounts_id");
  `)
}

// Refuses to drop business data: a rollback with customers or accounts present must be a
// deliberate decision (export them first), not a side effect.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const used = await db.execute(sql`
    SELECT (SELECT count(*) FROM "business_customers")::int + (SELECT count(*) FROM "miljo_accounts")::int AS n;
  `)
  const n = Number((used.rows?.[0] as { n?: number } | undefined)?.n ?? 0)
  if (n > 0) {
    throw new Error(`20261103_090000 down: ${n} business customer / Miljø account row(s) exist. Export and remove them deliberately first.`)
  }
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_business_customers_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_miljo_accounts_fk";
    ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT IF EXISTS "payload_preferences_rels_miljo_accounts_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_business_customers_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_miljo_accounts_id_idx";
    DROP INDEX IF EXISTS "payload_preferences_rels_miljo_accounts_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "business_customers_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "miljo_accounts_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "miljo_accounts_id";
    DROP TABLE IF EXISTS "miljo_accounts_sessions" CASCADE;
    DROP TABLE IF EXISTS "miljo_accounts" CASCADE;
    DROP TABLE IF EXISTS "business_customers_rels" CASCADE;
    DROP TABLE IF EXISTS "business_customers" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_miljo_accounts_status";
    DROP TYPE IF EXISTS "public"."enum_business_customers_status";
  `)
}
