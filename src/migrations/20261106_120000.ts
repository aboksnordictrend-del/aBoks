import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// aBoks Miljøregistrering, Stage 2.6 — administrator approval of self-registrations.
//
// ── What this changes ──
//
//   • enum_miljo_registrations_status gains 'awaiting_approval' and 'rejected'. Every existing row
//     keeps its value: a 'confirmed' registration stays activated, so no organisation loses access,
//     and a 'pending' one now needs an administrator's approval after its e-mail is confirmed.
//   • miljo_registrations gets nullable columns only: the order's e-mail (snapshot), the security
//     notice's timestamp, and the decision (who, when, how the connection was checked, notes).
//   • The partial unique index «one pending registration per order» becomes «one OPEN registration
//     per order» (pending or awaiting approval). It cannot fail on existing data: no row has the new
//     status yet, so it covers exactly the rows the old index did.
//   • miljo_registration_audit: append-only history of each registration, the same shape as
//     battery_registration_audit.
//   • payload_locked_documents_rels: one nullable column for the new collection.
//
// No account, business customer, organisation or order is read or written.
//
// ── Why the enum is rebuilt instead of `ALTER TYPE … ADD VALUE` ──
//
// Payload runs each migration in one transaction, and a value added with ADD VALUE cannot be used
// in the transaction that added it — which the new partial index needs. Going through varchar
// keeps everything in one all-or-nothing transaction. The cast reads every row's existing value and
// fails the whole migration, changing nothing, if a value were ever unknown. The table is small.
//
// Runs after 20261104_120000.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "miljo_registrations_one_pending_per_order";
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" TYPE varchar USING "status"::varchar;
    DROP TYPE "public"."enum_miljo_registrations_status";
    CREATE TYPE "public"."enum_miljo_registrations_status" AS ENUM('pending', 'awaiting_approval', 'confirmed', 'rejected', 'superseded');
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" TYPE "public"."enum_miljo_registrations_status" USING "status"::"public"."enum_miljo_registrations_status";
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" SET DEFAULT 'pending';
    CREATE UNIQUE INDEX "miljo_registrations_one_open_per_order" ON "miljo_registrations" USING btree ("order_id") WHERE "status" IN ('pending', 'awaiting_approval');

    CREATE TYPE "public"."enum_miljo_registrations_verification_method" AS ENUM('phone', 'company-email', 'document', 'known-customer', 'other');
    ALTER TABLE "miljo_registrations" ADD COLUMN "order_email" varchar;
    ALTER TABLE "miljo_registrations" ADD COLUMN "order_notice_sent_at" timestamp(3) with time zone;
    ALTER TABLE "miljo_registrations" ADD COLUMN "decided_at" timestamp(3) with time zone;
    ALTER TABLE "miljo_registrations" ADD COLUMN "decided_by_id" integer;
    ALTER TABLE "miljo_registrations" ADD COLUMN "decided_by_label" varchar;
    ALTER TABLE "miljo_registrations" ADD COLUMN "verification_method" "public"."enum_miljo_registrations_verification_method";
    ALTER TABLE "miljo_registrations" ADD COLUMN "decision_email_sent_at" timestamp(3) with time zone;
    ALTER TABLE "miljo_registrations" ADD COLUMN "decision_note" varchar;
    ALTER TABLE "miljo_registrations" ADD COLUMN "internal_notes" varchar;
    ALTER TABLE "miljo_registrations" ADD CONSTRAINT "miljo_registrations_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "miljo_registrations_decided_by_idx" ON "miljo_registrations" USING btree ("decided_by_id");

    CREATE TYPE "public"."enum_miljo_registration_audit_action" AS ENUM('submitted', 'email-verified', 'approved', 'rejected', 'activated', 'superseded', 'note-updated');
    CREATE TABLE "miljo_registration_audit" (
    	"id" serial PRIMARY KEY NOT NULL,
    	"registration_id" integer NOT NULL,
    	"organization_id" integer,
    	"action" "public"."enum_miljo_registration_audit_action" NOT NULL,
    	"performed_at" timestamp(3) with time zone NOT NULL,
    	"performed_by_id" integer,
    	"performed_by_label" varchar,
    	"reason" varchar,
    	"before" jsonb,
    	"after" jsonb,
    	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "miljo_registration_audit" ADD CONSTRAINT "miljo_registration_audit_registration_id_miljo_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."miljo_registrations"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "miljo_registration_audit" ADD CONSTRAINT "miljo_registration_audit_organization_id_environmental_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."environmental_organizations"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "miljo_registration_audit" ADD CONSTRAINT "miljo_registration_audit_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "miljo_registration_audit_registration_idx" ON "miljo_registration_audit" USING btree ("registration_id");
    CREATE INDEX "miljo_registration_audit_organization_idx" ON "miljo_registration_audit" USING btree ("organization_id");
    CREATE INDEX "miljo_registration_audit_performed_at_idx" ON "miljo_registration_audit" USING btree ("performed_at");
    CREATE INDEX "miljo_registration_audit_performed_by_idx" ON "miljo_registration_audit" USING btree ("performed_by_id");
    CREATE INDEX "miljo_registration_audit_updated_at_idx" ON "miljo_registration_audit" USING btree ("updated_at");
    CREATE INDEX "miljo_registration_audit_created_at_idx" ON "miljo_registration_audit" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "miljo_registration_audit_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_miljo_registration_audit_fk" FOREIGN KEY ("miljo_registration_audit_id") REFERENCES "public"."miljo_registration_audit"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_miljo_registration_audit_id_idx" ON "payload_locked_documents_rels" USING btree ("miljo_registration_audit_id");
  `)
}

// Refuses while the approval flow has been used: those rows are the record of who was approved or
// refused, and the old schema cannot hold them. They must be dealt with deliberately, not by a rollback.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const used = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM "miljo_registrations" WHERE "status" IN ('awaiting_approval', 'rejected') OR "decided_at" IS NOT NULL) AS decided,
      (SELECT count(*)::int FROM "miljo_registration_audit") AS history;
  `)
  const row = (used.rows?.[0] ?? {}) as { decided?: number; history?: number }
  if (Number(row.decided ?? 0) > 0 || Number(row.history ?? 0) > 0) {
    throw new Error(`20261106_120000 down: ${Number(row.decided ?? 0)} decided registration(s) and ${Number(row.history ?? 0)} history row(s) exist. Export and remove them deliberately first.`)
  }
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_miljo_registration_audit_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_miljo_registration_audit_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "miljo_registration_audit_id";
    DROP TABLE IF EXISTS "miljo_registration_audit" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_miljo_registration_audit_action";

    ALTER TABLE "miljo_registrations" DROP CONSTRAINT IF EXISTS "miljo_registrations_decided_by_id_users_id_fk";
    DROP INDEX IF EXISTS "miljo_registrations_decided_by_idx";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "internal_notes";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "decision_note";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "decision_email_sent_at";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "verification_method";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "decided_by_label";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "decided_by_id";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "decided_at";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "order_notice_sent_at";
    ALTER TABLE "miljo_registrations" DROP COLUMN IF EXISTS "order_email";
    DROP TYPE IF EXISTS "public"."enum_miljo_registrations_verification_method";

    DROP INDEX IF EXISTS "miljo_registrations_one_open_per_order";
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" TYPE varchar USING "status"::varchar;
    DROP TYPE "public"."enum_miljo_registrations_status";
    CREATE TYPE "public"."enum_miljo_registrations_status" AS ENUM('pending', 'confirmed', 'superseded');
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" TYPE "public"."enum_miljo_registrations_status" USING "status"::"public"."enum_miljo_registrations_status";
    ALTER TABLE "miljo_registrations" ALTER COLUMN "status" SET DEFAULT 'pending';
    CREATE UNIQUE INDEX "miljo_registrations_one_pending_per_order" ON "miljo_registrations" USING btree ("order_id") WHERE "status" = 'pending';
  `)
}
