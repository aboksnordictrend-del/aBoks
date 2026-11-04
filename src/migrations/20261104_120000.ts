import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// aBoks Miljøregistrering, Stage 2.5 — administrator-managed organisation accounts.
//
// ── What this changes ──
//
//   • business_customers.access_basis ('purchase' | 'agreement', NOT NULL DEFAULT 'purchase'):
//     «Avtale med aBoks» lets a customer without a web order (municipality, pilot) use Min side.
//     Every existing row gets 'purchase' — exactly today's rule, so no access changes.
//   • miljo_accounts: full_name, provisioning (DEFAULT 'self-registration' — every existing account
//     was self-registered or created by an administrator in Stage 1), must_change_password
//     (DEFAULT false), invited_at, invite_expires_at, invite_token_hash (unique; SHA-256 only).
//   • miljo_accounts.business_customer_id: the UNIQUE index becomes a plain index, so the data
//     model allows several accounts per business customer later. Self-registration's guarantee —
//     one account per company even under concurrent activations — is kept by a PARTIAL unique index
//     on self-registered accounts (not expressible in the Payload config, like
//     miljo_registrations_one_pending_per_order).
//
// ── Additive and safe ──
//
// New nullable or defaulted columns, two enums, index changes. No UPDATE, DELETE, RENAME or
// TRUNCATE; no existing value changes. The partial index cannot fail on existing data: the old
// unique index already guaranteed one account per business customer.
//
// ── How the DDL was produced ──
//
// drizzle-kit's `generateMigration` over two `generateDrizzleJson` snapshots of the Payload schema
// (master vs. this branch, built with `disableDBConnect` — no database involved), plus the partial
// unique index.
//
// Runs after 20261103_180000.

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_business_customers_access_basis" AS ENUM('purchase', 'agreement');
    CREATE TYPE "public"."enum_miljo_accounts_provisioning" AS ENUM('self-registration', 'admin-password', 'admin-invitation');
    DROP INDEX "miljo_accounts_business_customer_idx";
    ALTER TABLE "business_customers" ADD COLUMN "access_basis" "enum_business_customers_access_basis" DEFAULT 'purchase' NOT NULL;
    ALTER TABLE "miljo_accounts" ADD COLUMN "full_name" varchar;
    ALTER TABLE "miljo_accounts" ADD COLUMN "provisioning" "enum_miljo_accounts_provisioning" DEFAULT 'self-registration';
    ALTER TABLE "miljo_accounts" ADD COLUMN "must_change_password" boolean DEFAULT false;
    ALTER TABLE "miljo_accounts" ADD COLUMN "invited_at" timestamp(3) with time zone;
    ALTER TABLE "miljo_accounts" ADD COLUMN "invite_expires_at" timestamp(3) with time zone;
    ALTER TABLE "miljo_accounts" ADD COLUMN "invite_token_hash" varchar;
    CREATE UNIQUE INDEX "miljo_accounts_invite_token_hash_idx" ON "miljo_accounts" USING btree ("invite_token_hash");
    CREATE INDEX "miljo_accounts_business_customer_idx" ON "miljo_accounts" USING btree ("business_customer_id");
    CREATE UNIQUE INDEX "miljo_accounts_one_self_registered_per_customer" ON "miljo_accounts" USING btree ("business_customer_id") WHERE "provisioning" = 'self-registration';
  `)
}

// Refuses to restore the one-account-per-customer index while a customer has several accounts:
// those accounts are real logins and must be removed deliberately, not by a rollback.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const shared = await db.execute(sql`
    SELECT count(*)::int AS n FROM (
      SELECT "business_customer_id" FROM "miljo_accounts" GROUP BY "business_customer_id" HAVING count(*) > 1
    ) AS t;
  `)
  const n = Number((shared.rows?.[0] as { n?: number } | undefined)?.n ?? 0)
  if (n > 0) {
    throw new Error(`20261104_120000 down: ${n} business customer(s) have more than one Miljø account. Remove the extra accounts deliberately first.`)
  }
  await db.execute(sql`
    DROP INDEX IF EXISTS "miljo_accounts_one_self_registered_per_customer";
    DROP INDEX IF EXISTS "miljo_accounts_business_customer_idx";
    DROP INDEX IF EXISTS "miljo_accounts_invite_token_hash_idx";
    CREATE UNIQUE INDEX "miljo_accounts_business_customer_idx" ON "miljo_accounts" USING btree ("business_customer_id");
    ALTER TABLE "miljo_accounts" DROP COLUMN IF EXISTS "invite_token_hash";
    ALTER TABLE "miljo_accounts" DROP COLUMN IF EXISTS "invite_expires_at";
    ALTER TABLE "miljo_accounts" DROP COLUMN IF EXISTS "invited_at";
    ALTER TABLE "miljo_accounts" DROP COLUMN IF EXISTS "must_change_password";
    ALTER TABLE "miljo_accounts" DROP COLUMN IF EXISTS "provisioning";
    ALTER TABLE "miljo_accounts" DROP COLUMN IF EXISTS "full_name";
    ALTER TABLE "business_customers" DROP COLUMN IF EXISTS "access_basis";
    DROP TYPE IF EXISTS "public"."enum_miljo_accounts_provisioning";
    DROP TYPE IF EXISTS "public"."enum_business_customers_access_basis";
  `)
}
