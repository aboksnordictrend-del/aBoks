import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Review system: three new collections — reviews, review_invitations, review_photos — plus
// the reviews_rels join table (for the photos upload relationship) and the admin
// locked-documents relationships. Purely additive and idempotent: two new enum types, four
// new tables, new columns on payload_locked_documents_rels, and their indexes/foreign keys.
// No DROP/DELETE/TRUNCATE, no changes to existing rows, and nothing touching the order,
// checkout, analytics or email paths.
//
// The DDL shape mirrors what `payload migrate:create` produces for these collections; it is
// hand-written (as the other post-baseline migrations here are) because the auto-generated
// diff re-emits already-applied columns from earlier hand-written migrations.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── Enums ──────────────────────────────────────────────────────────────
    DO $$ BEGIN
      CREATE TYPE "public"."enum_reviews_status" AS ENUM('pending', 'approved', 'rejected', 'hidden');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_review_invitations_status" AS ENUM('active', 'used', 'expired', 'revoked');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- ── review_photos (upload collection) ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS "review_photos" (
      "id" serial PRIMARY KEY NOT NULL,
      "alt" varchar,
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

    -- ── reviews ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "reviews" (
      "id" serial PRIMARY KEY NOT NULL,
      "rating" numeric NOT NULL,
      "status" "enum_reviews_status" DEFAULT 'pending' NOT NULL,
      "verified_purchase" boolean DEFAULT false,
      "title" varchar,
      "text" varchar NOT NULL,
      "customer_name" varchar NOT NULL,
      "customer_city" varchar,
      -- FK columns are nullable at the DB level (ON DELETE set null); requiredness is
      -- enforced by Payload at the application layer, as with the other collections here.
      "product_id" integer,
      "variant_name" varchar,
      "product_snapshot_title" varchar,
      "product_snapshot_variant_name" varchar,
      "product_snapshot_color" varchar,
      "consent_to_publish_name" boolean DEFAULT false,
      "consent_to_publish_photos" boolean DEFAULT false,
      "moderation_note" varchar,
      "order_id" integer,
      "customer_id" integer,
      "invitation_id" integer,
      "submitted_at" timestamp(3) with time zone,
      "approved_at" timestamp(3) with time zone,
      "helpful_count" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ── reviews_rels (photos upload join) ──────────────────────────────────
    CREATE TABLE IF NOT EXISTS "reviews_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "review_photos_id" integer
    );

    -- ── review_invitations ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "review_invitations" (
      "id" serial PRIMARY KEY NOT NULL,
      "email" varchar NOT NULL,
      "order_id" integer,
      "customer_id" integer,
      "review_id" integer,
      "status" "enum_review_invitations_status" DEFAULT 'active' NOT NULL,
      "token_hash" varchar NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "used_at" timestamp(3) with time zone,
      "sent_at" timestamp(3) with time zone,
      "resend_count" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- ── Admin document-locking relationships ───────────────────────────────
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "reviews_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "review_invitations_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "review_photos_id" integer;

    -- ── Indexes ────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS "review_photos_updated_at_idx" ON "review_photos" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "review_photos_created_at_idx" ON "review_photos" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "review_photos_filename_idx" ON "review_photos" USING btree ("filename");

    CREATE INDEX IF NOT EXISTS "reviews_product_idx" ON "reviews" USING btree ("product_id");
    CREATE INDEX IF NOT EXISTS "reviews_order_idx" ON "reviews" USING btree ("order_id");
    CREATE INDEX IF NOT EXISTS "reviews_customer_idx" ON "reviews" USING btree ("customer_id");
    CREATE INDEX IF NOT EXISTS "reviews_invitation_idx" ON "reviews" USING btree ("invitation_id");
    CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "reviews_submitted_at_idx" ON "reviews" USING btree ("submitted_at");
    CREATE INDEX IF NOT EXISTS "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "reviews_created_at_idx" ON "reviews" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "reviews_rels_order_idx" ON "reviews_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "reviews_rels_parent_idx" ON "reviews_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "reviews_rels_path_idx" ON "reviews_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "reviews_rels_review_photos_id_idx" ON "reviews_rels" USING btree ("review_photos_id");

    CREATE UNIQUE INDEX IF NOT EXISTS "review_invitations_token_hash_idx" ON "review_invitations" USING btree ("token_hash");
    CREATE INDEX IF NOT EXISTS "review_invitations_order_idx" ON "review_invitations" USING btree ("order_id");
    CREATE INDEX IF NOT EXISTS "review_invitations_customer_idx" ON "review_invitations" USING btree ("customer_id");
    CREATE INDEX IF NOT EXISTS "review_invitations_review_idx" ON "review_invitations" USING btree ("review_id");
    CREATE INDEX IF NOT EXISTS "review_invitations_status_idx" ON "review_invitations" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "review_invitations_expires_at_idx" ON "review_invitations" USING btree ("expires_at");
    CREATE INDEX IF NOT EXISTS "review_invitations_updated_at_idx" ON "review_invitations" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "review_invitations_created_at_idx" ON "review_invitations" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_review_invitations_id_idx" ON "payload_locked_documents_rels" USING btree ("review_invitations_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_review_photos_id_idx" ON "payload_locked_documents_rels" USING btree ("review_photos_id");

    -- ── Foreign keys (added after all tables exist; circular reviews ⇄ invitations) ──
    DO $$ BEGIN
      ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_customers_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "reviews" ADD CONSTRAINT "reviews_invitation_id_review_invitations_id_fk"
        FOREIGN KEY ("invitation_id") REFERENCES "public"."review_invitations"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "reviews_rels" ADD CONSTRAINT "reviews_rels_review_photos_fk"
        FOREIGN KEY ("review_photos_id") REFERENCES "public"."review_photos"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_order_id_orders_id_fk"
        FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_customer_id_customers_id_fk"
        FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "review_invitations" ADD CONSTRAINT "review_invitations_review_id_reviews_id_fk"
        FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk"
        FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_invitations_fk"
        FOREIGN KEY ("review_invitations_id") REFERENCES "public"."review_invitations"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_photos_fk"
        FOREIGN KEY ("review_photos_id") REFERENCES "public"."review_photos"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reviews_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_review_invitations_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_review_photos_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_reviews_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_review_invitations_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_review_photos_id_idx";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "reviews_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "review_invitations_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "review_photos_id";

    DROP TABLE IF EXISTS "reviews_rels" CASCADE;
    DROP TABLE IF EXISTS "review_invitations" CASCADE;
    DROP TABLE IF EXISTS "reviews" CASCADE;
    DROP TABLE IF EXISTS "review_photos" CASCADE;

    DROP TYPE IF EXISTS "public"."enum_reviews_status";
    DROP TYPE IF EXISTS "public"."enum_review_invitations_status";
  `)
}
