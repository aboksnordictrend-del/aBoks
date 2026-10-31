import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// aBoks Miljøregistrering — organisations, employee battery registrations, actual deliveries,
// delivery documents and the two append-only audit logs.
//
// ── What this creates ──
//
//   • environmental_organizations (+ _allowed_categories, _code_history): one permanent public
//     code per organisation (unique), registration policy, PIN hash and the atomic PIN attempt
//     counter (pin_attempt_count / pin_attempt_window_start, see src/lib/miljo/pinAttempts.ts).
//   • battery_registrations (+ _lines, _submitted_lines, _flags): self-reported counts. Unique
//     submission_key (idempotent submit); compound index (organization_id, registered_at).
//   • battery_deliveries: actual deliveries in their original unit (kg | stk). Unique
//     submission_key; compound index (organization_id, delivery_date).
//   • battery_delivery_documents: upload collection for receipts.
//   • battery_registration_audit / battery_delivery_audit: append-only change history.
//   • payload_locked_documents_rels: six nullable document-locking columns.
//
// ── Additive only ──
//
// New tables, new enums and six new NULLABLE columns on payload_locked_documents_rels. No UPDATE,
// DROP, DELETE, RENAME or TRUNCATE in up(). No existing table's data is touched.
//
// ── How the DDL was produced ──
//
// drizzle-kit's own output for the difference between Payload's schema for this config and the
// same config at the previous commit (two `generateDrizzleJson` snapshots, no database involved) —
// the same method as 20261022_150000. Deliberate change: the four NOT NULL foreign keys
// (registrations/deliveries → organisation, audit rows → their registration/delivery) are RESTRICT
// instead of the SET NULL drizzle emits, which would fail with a raw 23502. History therefore
// cannot be orphaned at the database level either; the collection hooks already refuse these
// deletes with a Norwegian message (deactivate / invalidate instead).
//
// Runs after 20261028_090000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_environmental_organizations_allowed_categories" AS ENUM('aa', 'aaa', 'other');
    CREATE TYPE "public"."enum_environmental_organizations_organization_type" AS ENUM('kommune', 'skole', 'bedrift', 'annet');
    CREATE TYPE "public"."enum_environmental_organizations_status" AS ENUM('active', 'inactive');
    CREATE TYPE "public"."enum_battery_registrations_lines_category" AS ENUM('aa', 'aaa', 'other');
    CREATE TYPE "public"."enum_battery_registrations_submitted_lines_category" AS ENUM('aa', 'aaa', 'other');
    CREATE TYPE "public"."enum_battery_registrations_flags" AS ENUM('high-quantity', 'burst', 'possible-duplicate');
    CREATE TYPE "public"."enum_battery_registrations_status" AS ENUM('registered', 'corrected', 'invalidated');
    CREATE TYPE "public"."enum_battery_registrations_review_state" AS ENUM('none', 'pending', 'reviewed');
    CREATE TYPE "public"."enum_battery_registrations_method" AS ENUM('manual', 'barcode');
    CREATE TYPE "public"."enum_battery_registrations_source" AS ENUM('qr-form');
    CREATE TYPE "public"."enum_battery_deliveries_unit" AS ENUM('kg', 'stk');
    CREATE TYPE "public"."enum_battery_deliveries_documentation_status" AS ENUM('reported', 'documented');
    CREATE TYPE "public"."enum_battery_deliveries_status" AS ENUM('registered', 'corrected', 'invalidated');
    CREATE TYPE "public"."enum_battery_deliveries_source" AS ENUM('pin-form');
    CREATE TYPE "public"."enum_battery_registration_audit_action" AS ENUM('create', 'correct', 'invalidate', 'restore', 'review');
    CREATE TYPE "public"."enum_battery_delivery_audit_action" AS ENUM('create', 'correct', 'invalidate', 'restore', 'review');
    CREATE TABLE "environmental_organizations_allowed_categories" (
    	"order" integer NOT NULL,
    	"parent_id" integer NOT NULL,
    	"value" "enum_environmental_organizations_allowed_categories",
    	"id" serial PRIMARY KEY NOT NULL
    );

    CREATE TABLE "environmental_organizations_code_history" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"code" varchar,
    	"retired_at" timestamp(3) with time zone,
    	"reason" varchar
    );

    CREATE TABLE "environmental_organizations" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"name" varchar NOT NULL,
    	"organization_type" "enum_environmental_organizations_organization_type",
    	"organization_number" varchar,
    	"contact_person" varchar,
    	"contact_email" varchar,
    	"address" varchar,
    	"container_count" numeric,
    	"start_date" timestamp(3) with time zone,
    	"internal_notes" varchar,
    	"other_category_label" varchar,
    	"other_category_description" varchar,
    	"max_per_category" numeric DEFAULT 200,
    	"max_per_submission" numeric DEFAULT 500,
    	"confirm_above" numeric DEFAULT 50,
    	"daily_flag_threshold" numeric DEFAULT 1000,
    	"status" "enum_environmental_organizations_status" DEFAULT 'active' NOT NULL,
    	"public_code" varchar,
    	"pin_hash" varchar,
    	"pin_set_at" timestamp(3) with time zone,
    	"pin_attempt_count" numeric DEFAULT 0,
    	"pin_attempt_window_start" timestamp(3) with time zone,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "battery_registrations_lines" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"category" "enum_battery_registrations_lines_category" NOT NULL,
    	"quantity" numeric NOT NULL
    );

    CREATE TABLE "battery_registrations_submitted_lines" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"category" "enum_battery_registrations_submitted_lines_category" NOT NULL,
    	"quantity" numeric NOT NULL
    );

    CREATE TABLE "battery_registrations_flags" (
    	"order" integer NOT NULL,
    	"parent_id" integer NOT NULL,
    	"value" "enum_battery_registrations_flags",
    	"id" serial PRIMARY KEY NOT NULL
    );

    CREATE TABLE "battery_registrations" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"organization_id" integer NOT NULL,
    	"organization_name" varchar,
    	"total_quantity" numeric,
    	"submitted_total" numeric,
    	"status" "enum_battery_registrations_status" DEFAULT 'registered' NOT NULL,
    	"review_state" "enum_battery_registrations_review_state" DEFAULT 'none',
    	"registered_at" timestamp(3) with time zone NOT NULL,
    	"method" "enum_battery_registrations_method" DEFAULT 'manual',
    	"source" "enum_battery_registrations_source" DEFAULT 'qr-form',
    	"submission_key" varchar,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "battery_deliveries" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"organization_id" integer NOT NULL,
    	"organization_name" varchar,
    	"delivery_date" varchar NOT NULL,
    	"quantity" numeric NOT NULL,
    	"unit" "enum_battery_deliveries_unit" NOT NULL,
    	"operator" varchar NOT NULL,
    	"reference" varchar,
    	"document_id" integer,
    	"submitted_values" jsonb,
    	"documentation_status" "enum_battery_deliveries_documentation_status" DEFAULT 'reported' NOT NULL,
    	"status" "enum_battery_deliveries_status" DEFAULT 'registered' NOT NULL,
    	"registered_at" timestamp(3) with time zone NOT NULL,
    	"source" "enum_battery_deliveries_source" DEFAULT 'pin-form',
    	"submission_key" varchar,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "battery_delivery_documents" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"organization_id" integer,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"url" varchar,
    	"thumbnail_u_r_l" varchar,
    	"filename" varchar,
    	"mime_type" varchar,
    	"filesize" numeric,
    	"width" numeric,
    	"height" numeric,
    	"focal_x" numeric,
    	"focal_y" numeric
    );

    CREATE TABLE "battery_registration_audit" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"registration_id" integer NOT NULL,
    	"organization_id" integer,
    	"action" "enum_battery_registration_audit_action" NOT NULL,
    	"performed_at" timestamp(3) with time zone NOT NULL,
    	"performed_by_id" integer,
    	"performed_by_label" varchar,
    	"reason" varchar,
    	"before" jsonb,
    	"after" jsonb,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "battery_delivery_audit" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"delivery_id" integer NOT NULL,
    	"organization_id" integer,
    	"action" "enum_battery_delivery_audit_action" NOT NULL,
    	"performed_at" timestamp(3) with time zone NOT NULL,
    	"performed_by_id" integer,
    	"performed_by_label" varchar,
    	"reason" varchar,
    	"before" jsonb,
    	"after" jsonb,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "environmental_organizations_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "battery_registrations_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "battery_deliveries_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "battery_delivery_documents_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "battery_registration_audit_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "battery_delivery_audit_id" integer;
    ALTER TABLE "environmental_organizations_allowed_categories" ADD CONSTRAINT "environmental_organizations_allowed_categories_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "environmental_organizations_code_history" ADD CONSTRAINT "environmental_organizations_code_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "battery_registrations_lines" ADD CONSTRAINT "battery_registrations_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."battery_registrations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "battery_registrations_submitted_lines" ADD CONSTRAINT "battery_registrations_submitted_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."battery_registrations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "battery_registrations_flags" ADD CONSTRAINT "battery_registrations_flags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."battery_registrations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "battery_registrations" ADD CONSTRAINT "battery_registrations_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "battery_deliveries" ADD CONSTRAINT "battery_deliveries_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "battery_deliveries" ADD CONSTRAINT "battery_deliveries_document_id_battery_delivery_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."battery_delivery_documents"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "battery_delivery_documents" ADD CONSTRAINT "battery_delivery_documents_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "battery_registration_audit" ADD CONSTRAINT "battery_registration_audit_registration_id_battery_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."battery_registrations"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "battery_registration_audit" ADD CONSTRAINT "battery_registration_audit_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "battery_registration_audit" ADD CONSTRAINT "battery_registration_audit_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "battery_delivery_audit" ADD CONSTRAINT "battery_delivery_audit_delivery_id_battery_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."battery_deliveries"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "battery_delivery_audit" ADD CONSTRAINT "battery_delivery_audit_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "battery_delivery_audit" ADD CONSTRAINT "battery_delivery_audit_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "environmental_organizations_allowed_categories_order_idx" ON "environmental_organizations_allowed_categories" USING btree ("order");
    CREATE INDEX "environmental_organizations_allowed_categories_parent_idx" ON "environmental_organizations_allowed_categories" USING btree ("parent_id");
    CREATE INDEX "environmental_organizations_code_history_order_idx" ON "environmental_organizations_code_history" USING btree ("_order");
    CREATE INDEX "environmental_organizations_code_history_parent_id_idx" ON "environmental_organizations_code_history" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "environmental_organizations_public_code_idx" ON "environmental_organizations" USING btree ("public_code");
    CREATE INDEX "environmental_organizations_updated_at_idx" ON "environmental_organizations" USING btree ("updated_at");
    CREATE INDEX "environmental_organizations_created_at_idx" ON "environmental_organizations" USING btree ("created_at");
    CREATE INDEX "battery_registrations_lines_order_idx" ON "battery_registrations_lines" USING btree ("_order");
    CREATE INDEX "battery_registrations_lines_parent_id_idx" ON "battery_registrations_lines" USING btree ("_parent_id");
    CREATE INDEX "battery_registrations_submitted_lines_order_idx" ON "battery_registrations_submitted_lines" USING btree ("_order");
    CREATE INDEX "battery_registrations_submitted_lines_parent_id_idx" ON "battery_registrations_submitted_lines" USING btree ("_parent_id");
    CREATE INDEX "battery_registrations_flags_order_idx" ON "battery_registrations_flags" USING btree ("order");
    CREATE INDEX "battery_registrations_flags_parent_idx" ON "battery_registrations_flags" USING btree ("parent_id");
    CREATE INDEX "battery_registrations_organization_idx" ON "battery_registrations" USING btree ("organization_id");
    CREATE INDEX "battery_registrations_status_idx" ON "battery_registrations" USING btree ("status");
    CREATE INDEX "battery_registrations_review_state_idx" ON "battery_registrations" USING btree ("review_state");
    CREATE INDEX "battery_registrations_registered_at_idx" ON "battery_registrations" USING btree ("registered_at");
    CREATE UNIQUE INDEX "battery_registrations_submission_key_idx" ON "battery_registrations" USING btree ("submission_key");
    CREATE INDEX "battery_registrations_updated_at_idx" ON "battery_registrations" USING btree ("updated_at");
    CREATE INDEX "battery_registrations_created_at_idx" ON "battery_registrations" USING btree ("created_at");
    CREATE INDEX "organization_registeredAt_idx" ON "battery_registrations" USING btree ("organization_id","registered_at");
    CREATE INDEX "battery_deliveries_organization_idx" ON "battery_deliveries" USING btree ("organization_id");
    CREATE INDEX "battery_deliveries_delivery_date_idx" ON "battery_deliveries" USING btree ("delivery_date");
    CREATE INDEX "battery_deliveries_document_idx" ON "battery_deliveries" USING btree ("document_id");
    CREATE INDEX "battery_deliveries_status_idx" ON "battery_deliveries" USING btree ("status");
    CREATE UNIQUE INDEX "battery_deliveries_submission_key_idx" ON "battery_deliveries" USING btree ("submission_key");
    CREATE INDEX "battery_deliveries_updated_at_idx" ON "battery_deliveries" USING btree ("updated_at");
    CREATE INDEX "battery_deliveries_created_at_idx" ON "battery_deliveries" USING btree ("created_at");
    CREATE INDEX "organization_deliveryDate_idx" ON "battery_deliveries" USING btree ("organization_id","delivery_date");
    CREATE INDEX "battery_delivery_documents_organization_idx" ON "battery_delivery_documents" USING btree ("organization_id");
    CREATE INDEX "battery_delivery_documents_updated_at_idx" ON "battery_delivery_documents" USING btree ("updated_at");
    CREATE INDEX "battery_delivery_documents_created_at_idx" ON "battery_delivery_documents" USING btree ("created_at");
    CREATE UNIQUE INDEX "battery_delivery_documents_filename_idx" ON "battery_delivery_documents" USING btree ("filename");
    CREATE INDEX "battery_registration_audit_registration_idx" ON "battery_registration_audit" USING btree ("registration_id");
    CREATE INDEX "battery_registration_audit_organization_idx" ON "battery_registration_audit" USING btree ("organization_id");
    CREATE INDEX "battery_registration_audit_performed_at_idx" ON "battery_registration_audit" USING btree ("performed_at");
    CREATE INDEX "battery_registration_audit_performed_by_idx" ON "battery_registration_audit" USING btree ("performed_by_id");
    CREATE INDEX "battery_registration_audit_updated_at_idx" ON "battery_registration_audit" USING btree ("updated_at");
    CREATE INDEX "battery_registration_audit_created_at_idx" ON "battery_registration_audit" USING btree ("created_at");
    CREATE INDEX "battery_delivery_audit_delivery_idx" ON "battery_delivery_audit" USING btree ("delivery_id");
    CREATE INDEX "battery_delivery_audit_organization_idx" ON "battery_delivery_audit" USING btree ("organization_id");
    CREATE INDEX "battery_delivery_audit_performed_at_idx" ON "battery_delivery_audit" USING btree ("performed_at");
    CREATE INDEX "battery_delivery_audit_performed_by_idx" ON "battery_delivery_audit" USING btree ("performed_by_id");
    CREATE INDEX "battery_delivery_audit_updated_at_idx" ON "battery_delivery_audit" USING btree ("updated_at");
    CREATE INDEX "battery_delivery_audit_created_at_idx" ON "battery_delivery_audit" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_environmental_organizations_fk" FOREIGN KEY ("environmental_organizations_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_battery_registrations_fk" FOREIGN KEY ("battery_registrations_id") REFERENCES "public"."battery_registrations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_battery_deliveries_fk" FOREIGN KEY ("battery_deliveries_id") REFERENCES "public"."battery_deliveries"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_battery_delivery_documents_fk" FOREIGN KEY ("battery_delivery_documents_id") REFERENCES "public"."battery_delivery_documents"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_battery_registration_audit_fk" FOREIGN KEY ("battery_registration_audit_id") REFERENCES "public"."battery_registration_audit"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_battery_delivery_audit_fk" FOREIGN KEY ("battery_delivery_audit_id") REFERENCES "public"."battery_delivery_audit"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_environmental_organization_idx" ON "payload_locked_documents_rels" USING btree ("environmental_organizations_id");
    CREATE INDEX "payload_locked_documents_rels_battery_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("battery_registrations_id");
    CREATE INDEX "payload_locked_documents_rels_battery_deliveries_id_idx" ON "payload_locked_documents_rels" USING btree ("battery_deliveries_id");
    CREATE INDEX "payload_locked_documents_rels_battery_delivery_documents_idx" ON "payload_locked_documents_rels" USING btree ("battery_delivery_documents_id");
    CREATE INDEX "payload_locked_documents_rels_battery_registration_audit_idx" ON "payload_locked_documents_rels" USING btree ("battery_registration_audit_id");
    CREATE INDEX "payload_locked_documents_rels_battery_delivery_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("battery_delivery_audit_id");
  `)
}

// Refuses while any Miljøregistrering organisation exists, rather than dropping real history.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const used = await db.execute(sql`
    SELECT count(*)::int AS n FROM "environmental_organizations";
  `)
  const n = Number((used.rows?.[0] as { n?: number } | undefined)?.n ?? 0)
  if (n > 0) {
    throw new Error(`20261031_120000 down: ${n} organisation(s) exist in Miljøregistrering. Remove them deliberately first.`)
  }
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_environmental_organizations_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_battery_registrations_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_battery_deliveries_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_battery_delivery_documents_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_battery_registration_audit_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_battery_delivery_audit_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_environmental_organization_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_battery_registrations_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_battery_deliveries_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_battery_delivery_documents_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_battery_registration_audit_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_battery_delivery_audit_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "environmental_organizations_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "battery_registrations_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "battery_deliveries_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "battery_delivery_documents_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "battery_registration_audit_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "battery_delivery_audit_id";
    DROP TABLE IF EXISTS "battery_delivery_audit" CASCADE;
    DROP TABLE IF EXISTS "battery_registration_audit" CASCADE;
    DROP TABLE IF EXISTS "battery_deliveries" CASCADE;
    DROP TABLE IF EXISTS "battery_delivery_documents" CASCADE;
    DROP TABLE IF EXISTS "battery_registrations_flags" CASCADE;
    DROP TABLE IF EXISTS "battery_registrations_submitted_lines" CASCADE;
    DROP TABLE IF EXISTS "battery_registrations_lines" CASCADE;
    DROP TABLE IF EXISTS "battery_registrations" CASCADE;
    DROP TABLE IF EXISTS "environmental_organizations_code_history" CASCADE;
    DROP TABLE IF EXISTS "environmental_organizations_allowed_categories" CASCADE;
    DROP TABLE IF EXISTS "environmental_organizations" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_environmental_organizations_allowed_categories";
    DROP TYPE IF EXISTS "public"."enum_environmental_organizations_organization_type";
    DROP TYPE IF EXISTS "public"."enum_environmental_organizations_status";
    DROP TYPE IF EXISTS "public"."enum_battery_registrations_lines_category";
    DROP TYPE IF EXISTS "public"."enum_battery_registrations_submitted_lines_category";
    DROP TYPE IF EXISTS "public"."enum_battery_registrations_flags";
    DROP TYPE IF EXISTS "public"."enum_battery_registrations_status";
    DROP TYPE IF EXISTS "public"."enum_battery_registrations_review_state";
    DROP TYPE IF EXISTS "public"."enum_battery_registrations_method";
    DROP TYPE IF EXISTS "public"."enum_battery_registrations_source";
    DROP TYPE IF EXISTS "public"."enum_battery_deliveries_unit";
    DROP TYPE IF EXISTS "public"."enum_battery_deliveries_documentation_status";
    DROP TYPE IF EXISTS "public"."enum_battery_deliveries_status";
    DROP TYPE IF EXISTS "public"."enum_battery_deliveries_source";
    DROP TYPE IF EXISTS "public"."enum_battery_registration_audit_action";
    DROP TYPE IF EXISTS "public"."enum_battery_delivery_audit_action";
  `)
}
