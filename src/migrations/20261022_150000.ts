import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Pilot projects and product evaluations («Pilotprosjekter» / «Pilotevalueringer»).
//
// ── What this creates ──
//
//   • pilot_projects (+ _questions, _questions_options, _slug_history, _rels for the model
//     relationship) and their five enums.
//   • pilot_evaluations (+ _answers). Answers and the questionnaire snapshot are jsonb.
//   • payload_locked_documents_rels.pilot_projects_id / .pilot_evaluations_id — Payload's
//     document-locking columns every collection gets.
//
// ── Additive only ──
//
// New tables, new enums and two new NULLABLE columns on payload_locked_documents_rels. No UPDATE,
// DROP, DELETE, RENAME or TRUNCATE in up(). No existing table's data is touched.
//
// ── How the DDL was produced ──
//
// drizzle-kit's own output for the difference between Payload's schema for this config and the
// same config at the previous commit (two `generateDrizzleJson` snapshots, not a diff against a
// live database) — the same method as 20261022_090000. One deliberate change: the
// pilot_evaluations.project_id foreign key is RESTRICT instead of the SET NULL drizzle emits,
// because the column is NOT NULL (SET NULL would fail with a raw 23502). A project with
// evaluations therefore cannot be deleted at the database level either — the collection's
// beforeDelete hook already refuses with a Norwegian message (archive instead).
//
// Runs after 20261022_090000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_pilot_projects_questions_type" AS ENUM('shortText', 'longText', 'singleChoice', 'multipleChoice', 'rating', 'yesNo', 'dropdown');
    CREATE TYPE "public"."enum_pilot_projects_questions_stat_key" AS ENUM('location', 'model', 'frequency', 'usability', 'usefulness', 'organization', 'continue', 'improvements', 'comments', 'room');
    CREATE TYPE "public"."enum_pilot_projects_questions_options_source" AS ENUM('manual', 'projectModels');
    CREATE TYPE "public"."enum_pilot_projects_organization_type" AS ENUM('kommune', 'skole', 'bedrift', 'annet');
    CREATE TYPE "public"."enum_pilot_projects_status" AS ENUM('draft', 'active', 'completed', 'archived');
    CREATE TABLE "pilot_projects_questions_options" (
    	"_order" integer NOT NULL,
    	"_parent_id" varchar NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"label" varchar,
    	"is_positive" boolean DEFAULT false,
    	"exclude_from_averages" boolean DEFAULT false
    );

    CREATE TABLE "pilot_projects_questions" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"label" varchar NOT NULL,
    	"type" "enum_pilot_projects_questions_type" DEFAULT 'shortText' NOT NULL,
    	"required" boolean DEFAULT false,
    	"enabled" boolean DEFAULT true,
    	"stat_key" "enum_pilot_projects_questions_stat_key",
    	"placeholder" varchar,
    	"help_text" varchar,
    	"scale_min_label" varchar,
    	"scale_max_label" varchar,
    	"options_source" "enum_pilot_projects_questions_options_source" DEFAULT 'manual',
    	"question_id" varchar
    );

    CREATE TABLE "pilot_projects_slug_history" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"slug" varchar NOT NULL,
    	"changed_at" timestamp(3) with time zone
    );

    CREATE TABLE "pilot_projects" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"name" varchar NOT NULL,
    	"slug" varchar,
    	"organization" varchar NOT NULL,
    	"organization_type" "enum_pilot_projects_organization_type" DEFAULT 'kommune' NOT NULL,
    	"contact_person" varchar,
    	"contact_email" varchar,
    	"start_date" timestamp(3) with time zone,
    	"end_date" timestamp(3) with time zone,
    	"description" varchar,
    	"internal_notes" varchar,
    	"intro" varchar DEFAULT 'Takk for at du tester aBoks! Dine tilbakemeldinger hjelper oss med å forbedre produktene våre. Undersøkelsen er anonym og tar omtrent 2–3 minutter.',
    	"closing_message" varchar DEFAULT 'Tusen takk for tilbakemeldingen! Din evaluering er registrert.',
    	"status" "enum_pilot_projects_status" DEFAULT 'draft' NOT NULL,
    	"questionnaire_version" numeric DEFAULT 1,
    	"questionnaire_fingerprint" varchar,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "pilot_projects_rels" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"order" integer,
    	"parent_id" integer NOT NULL,
    	"path" varchar NOT NULL,
    	"products_id" integer
    );

    CREATE TABLE "pilot_evaluations_answers" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"question_id" varchar NOT NULL,
    	"question_type" varchar,
    	"question_label" varchar,
    	"display_value" varchar,
    	"value" jsonb
    );

    CREATE TABLE "pilot_evaluations" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"project_id" integer NOT NULL,
    	"project_name" varchar,
    	"organization" varchar,
    	"model_id" integer,
    	"model_label" varchar,
    	"questionnaire_snapshot" jsonb,
    	"submitted_at" timestamp(3) with time zone NOT NULL,
    	"questionnaire_version" numeric,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pilot_projects_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pilot_evaluations_id" integer;
    ALTER TABLE "pilot_projects_questions_options" ADD CONSTRAINT "pilot_projects_questions_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pilot_projects_questions"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pilot_projects_questions" ADD CONSTRAINT "pilot_projects_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pilot_projects"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pilot_projects_slug_history" ADD CONSTRAINT "pilot_projects_slug_history_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pilot_projects"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pilot_projects_rels" ADD CONSTRAINT "pilot_projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pilot_projects"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pilot_projects_rels" ADD CONSTRAINT "pilot_projects_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pilot_evaluations_answers" ADD CONSTRAINT "pilot_evaluations_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pilot_evaluations"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "pilot_evaluations" ADD CONSTRAINT "pilot_evaluations_project_id_pilot_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."pilot_projects"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "pilot_evaluations" ADD CONSTRAINT "pilot_evaluations_model_id_products_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "pilot_projects_questions_options_order_idx" ON "pilot_projects_questions_options" USING btree ("_order");
    CREATE INDEX "pilot_projects_questions_options_parent_id_idx" ON "pilot_projects_questions_options" USING btree ("_parent_id");
    CREATE INDEX "pilot_projects_questions_order_idx" ON "pilot_projects_questions" USING btree ("_order");
    CREATE INDEX "pilot_projects_questions_parent_id_idx" ON "pilot_projects_questions" USING btree ("_parent_id");
    CREATE INDEX "pilot_projects_slug_history_order_idx" ON "pilot_projects_slug_history" USING btree ("_order");
    CREATE INDEX "pilot_projects_slug_history_parent_id_idx" ON "pilot_projects_slug_history" USING btree ("_parent_id");
    CREATE UNIQUE INDEX "pilot_projects_slug_idx" ON "pilot_projects" USING btree ("slug");
    CREATE INDEX "pilot_projects_updated_at_idx" ON "pilot_projects" USING btree ("updated_at");
    CREATE INDEX "pilot_projects_created_at_idx" ON "pilot_projects" USING btree ("created_at");
    CREATE INDEX "pilot_projects_rels_order_idx" ON "pilot_projects_rels" USING btree ("order");
    CREATE INDEX "pilot_projects_rels_parent_idx" ON "pilot_projects_rels" USING btree ("parent_id");
    CREATE INDEX "pilot_projects_rels_path_idx" ON "pilot_projects_rels" USING btree ("path");
    CREATE INDEX "pilot_projects_rels_products_id_idx" ON "pilot_projects_rels" USING btree ("products_id");
    CREATE INDEX "pilot_evaluations_answers_order_idx" ON "pilot_evaluations_answers" USING btree ("_order");
    CREATE INDEX "pilot_evaluations_answers_parent_id_idx" ON "pilot_evaluations_answers" USING btree ("_parent_id");
    CREATE INDEX "pilot_evaluations_project_idx" ON "pilot_evaluations" USING btree ("project_id");
    CREATE INDEX "pilot_evaluations_model_idx" ON "pilot_evaluations" USING btree ("model_id");
    CREATE INDEX "pilot_evaluations_submitted_at_idx" ON "pilot_evaluations" USING btree ("submitted_at");
    CREATE INDEX "pilot_evaluations_updated_at_idx" ON "pilot_evaluations" USING btree ("updated_at");
    CREATE INDEX "pilot_evaluations_created_at_idx" ON "pilot_evaluations" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pilot_projects_fk" FOREIGN KEY ("pilot_projects_id") REFERENCES "public"."pilot_projects"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pilot_evaluations_fk" FOREIGN KEY ("pilot_evaluations_id") REFERENCES "public"."pilot_evaluations"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_pilot_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("pilot_projects_id");
    CREATE INDEX "payload_locked_documents_rels_pilot_evaluations_id_idx" ON "payload_locked_documents_rels" USING btree ("pilot_evaluations_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = (await db.execute(sql`
    SELECT (SELECT count(*) FROM "pilot_evaluations") + (SELECT count(*) FROM "pilot_projects") AS "rows"
  `)) as unknown as { rows?: { rows: string | number }[] }
  const rows = Number(result.rows?.[0]?.rows ?? 0)
  if (rows > 0) {
    throw new Error(
      `Refusing to roll back 20261022_150000: ${rows} pilot project(s) or evaluation(s) exist. Export and remove them deliberately first.`,
    )
  }

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pilot_projects_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_pilot_evaluations_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_pilot_projects_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_pilot_evaluations_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "pilot_projects_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "pilot_evaluations_id";
    DROP TABLE IF EXISTS "pilot_evaluations_answers" CASCADE;
    DROP TABLE IF EXISTS "pilot_evaluations" CASCADE;
    DROP TABLE IF EXISTS "pilot_projects_questions_options" CASCADE;
    DROP TABLE IF EXISTS "pilot_projects_questions" CASCADE;
    DROP TABLE IF EXISTS "pilot_projects_slug_history" CASCADE;
    DROP TABLE IF EXISTS "pilot_projects_rels" CASCADE;
    DROP TABLE IF EXISTS "pilot_projects" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_pilot_projects_questions_type";
    DROP TYPE IF EXISTS "public"."enum_pilot_projects_questions_stat_key";
    DROP TYPE IF EXISTS "public"."enum_pilot_projects_questions_options_source";
    DROP TYPE IF EXISTS "public"."enum_pilot_projects_organization_type";
    DROP TYPE IF EXISTS "public"."enum_pilot_projects_status";
  `)
}
