import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Partners register (Phase 1), schema only: the new `partners` collection, its multi-select
// `partnershipTypes` table, three enum types and the admin document-lock relation.
//
// Purely additive and idempotent. Three new enum types, two new tables, one new nullable column
// on payload_locked_documents_rels, plus indexes and foreign keys. There is no DROP, DELETE,
// TRUNCATE or UPDATE anywhere in `up()`, and no existing table other than
// payload_locked_documents_rels is touched at all: promo_codes, promo_code_usages,
// partner_payouts and orders are exactly as they were.
//
// Deliberately NO data step. Linking promo codes and payouts to a partner — the nullable
// `partner_id` columns and the copy of the existing promo-code partner details into partner
// rows — belongs to the next phase, together with the fields that read those columns. Adding
// the columns here, without their fields, would be schema the application does not know about.
//
// The DDL mirrors what Payload's own schema builder produces for `src/collections/Partners.ts`.
// Column names, SQL types, NOT NULLs, defaults, index names and all three enum names were read
// back off the adapter's generated `rawTables` (with the database connection disabled) rather
// than guessed; it is hand-written, as every post-baseline migration here is, because the
// auto-generated diff re-emits already-applied columns from earlier hand-written migrations.
//
// The numeric defaults (25 / 15 / 20 / 35) are the programme terms from
// `@/lib/partner/partnerships`. They only pre-fill a NEW partner row; no existing row exists.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Enums ──────────────────────────────────────────────────────────────
    DO $$ BEGIN
      CREATE TYPE "public"."enum_partners_partnership_types" AS ENUM('promoCode', 'businessSale', 'retailerReferral', 'dropshipping', 'wholesale');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_partners_status" AS ENUM('active', 'paused', 'ended');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_partners_entity_type" AS ENUM('person', 'company');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- ── partners ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "partners" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "status" "enum_partners_status" DEFAULT 'active' NOT NULL,
      "entity_type" "enum_partners_entity_type",
      "organization_number" varchar,
      "contact_person" varchar,
      "email" varchar,
      "phone" varchar,
      "bank_account" varchar,
      "account_owner" varchar,
      "business_sale_commission_percent" numeric DEFAULT 25,
      "retailer_referral_commission_percent" numeric DEFAULT 15,
      "dropshipping_discount_percent" numeric DEFAULT 20,
      "wholesale_discount_percent" numeric DEFAULT 35,
      "agreement_date" timestamp(3) with time zone,
      "internal_note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ── partners.partnershipTypes (hasMany select) ─────────────────────────
    CREATE TABLE IF NOT EXISTS "partners_partnership_types" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_partners_partnership_types",
      "id" serial PRIMARY KEY NOT NULL
    );

    -- ── Admin document-locking relationship ────────────────────────────────
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "partners_id" integer;

    -- ── Indexes ────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS "partners_name_idx" ON "partners" USING btree ("name");
    CREATE INDEX IF NOT EXISTS "partners_status_idx" ON "partners" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "partners_email_idx" ON "partners" USING btree ("email");
    CREATE INDEX IF NOT EXISTS "partners_updated_at_idx" ON "partners" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "partners_created_at_idx" ON "partners" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "partners_partnership_types_order_idx" ON "partners_partnership_types" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "partners_partnership_types_parent_idx" ON "partners_partnership_types" USING btree ("parent_id");

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_partners_id_idx" ON "payload_locked_documents_rels" USING btree ("partners_id");

    -- ── Foreign keys ───────────────────────────────────────────────────────
    DO $$ BEGIN
      ALTER TABLE "partners_partnership_types" ADD CONSTRAINT "partners_partnership_types_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk"
        FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

// Removes only what `up()` added, in dependency order: the lock relation first, then the two
// tables, then the enum types (which can only be dropped once no column references them).
//
// Dropping `partners` discards every partner registered since the migration ran. Nothing else
// references it in this phase, so no other data is affected — but it is a development-time
// escape hatch, not something to run once real partners have been entered.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_partners_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_partners_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "partners_id";

    -- Drops each table's own indexes and foreign keys with it.
    DROP TABLE IF EXISTS "partners_partnership_types" CASCADE;
    DROP TABLE IF EXISTS "partners" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_partners_partnership_types";
    DROP TYPE IF EXISTS "public"."enum_partners_status";
    DROP TYPE IF EXISTS "public"."enum_partners_entity_type";
  `)
}
