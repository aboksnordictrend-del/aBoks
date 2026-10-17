import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Manual referral tracking — Bedriftssalg and Forhandlersalg (Stages 2–5).
//
// ── What this creates ──
//
//   • referred_customers (+ _referred_customers_v versions) — «Henviste kunder»
//   • referral_sales (+ _referral_sales_v versions)         — «Henvisningssalg»
//   • referral_commission_adjustments                       — «Provisjonsjusteringer»
//   • partner_payouts_rels                                  — a referral payout's sales and adjustments
//   • their enums, indexes and foreign keys, and the three admin document-lock columns
//
// ── What it changes on existing tables — additive only ──
//
//   • partner_payouts.promo_code_id: DROP NOT NULL. A referral payout has no promo code; every
//     existing row keeps its promo code. The foreign key stays exactly as created in
//     20260728_090000 (ON DELETE RESTRICT) — it is deliberately not touched here.
//   • partner_payouts: three NULLABLE columns, source / referral_gross_amount /
//     referral_deducted_amount, added WITHOUT a default, so every existing payout keeps NULL
//     (read by the app as a promo payout). No UPDATE runs: no historical row is rewritten.
//   • payload_locked_documents_rels: three nullable lock columns for the new collections.
//
// No DROP, DELETE, UPDATE, RENAME or TRUNCATE in up(). No other table is touched — orders,
// promo_codes, promo_code_usages, partners and checkout data are exactly as they were.
//
// ── How the DDL was produced ──
//
// The generated block below is drizzle-kit's own output for the difference between Payload's
// schema for this config and the same schema without these additions (not a diff against a live
// database, which would also re-emit unrelated historical drift). Two foreign keys were changed
// from the SET NULL drizzle emits to RESTRICT, because the columns are required (NOT NULL) and
// SET NULL would fail with a raw 23502 instead of a clear 23001 restrict_violation — the same deliberate deviation
// as partner_payouts.promo_code_id:
//
//   • referral_sales.referred_customer_id         — a customer with sales cannot be deleted
//   • referral_commission_adjustments.sale_id     — a sale with an adjustment cannot be deleted
//
// ── Database backstops for the application rules (hand-written, at the end of up()) ──
//
//   • one OPEN referred customer per registration number    (partial unique index)
//   • one ACTIVE referral sale per webshop order            (partial unique index)
//   • one ACTIVE correction per original sale               (partial unique index)
//   • one ACTIVE sale per invoice number per customer       (partial unique index)
//   • one adjustment per sale                               (unique index, generated)
//   • an adjustment is never positive                       (CHECK)
//
// "Open" = status pending/approved; "active" = payment status pending/paid. They mirror the
// hooks exactly, so the hooks refuse first with a Norwegian message; the indexes only stop two
// simultaneous saves that both passed the hook.
//
// Runs after 20261016–20261020.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_partner_payouts_source" AS ENUM('promoCode', 'referral');
    CREATE TYPE "public"."enum_referred_customers_status" AS ENUM('pending', 'approved', 'rejected', 'inactive');
    CREATE TYPE "public"."enum_referred_customers_category" AS ENUM('businessSale', 'retailStore');
    CREATE TYPE "public"."enum_referred_customers_country" AS ENUM('NO', 'SE', 'DK', 'FI', 'IS', 'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AZ', 'AU', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BA', 'BW', 'BV', 'BR', 'BN', 'BG', 'BF', 'BI', 'CA', 'KY', 'CL', 'CX', 'CO', 'CK', 'CR', 'CU', 'CW', 'VI', 'VG', 'AE', 'TF', 'DO', 'CF', 'IO', 'PS', 'DJ', 'DM', 'EC', 'EG', 'GQ', 'SV', 'CI', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FJ', 'PH', 'FR', 'GF', 'PF', 'FO', 'GA', 'GM', 'GE', 'GH', 'GI', 'GD', 'GL', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'GR', 'HN', 'HK', 'IN', 'ID', 'IQ', 'IR', 'IE', 'IL', 'IT', 'JM', 'JP', 'YE', 'JE', 'JO', 'KH', 'CM', 'CV', 'BQ', 'KZ', 'KE', 'CN', 'KG', 'KI', 'CC', 'KM', 'CD', 'CG', 'HR', 'KW', 'CY', 'LA', 'LV', 'LS', 'LB', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'IM', 'MA', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MZ', 'MM', 'NA', 'NR', 'NL', 'NP', 'NZ', 'NI', 'NE', 'NG', 'NU', 'KP', 'MK', 'MP', 'NF', 'NC', 'OM', 'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PN', 'PL', 'PT', 'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'KN', 'BL', 'MF', 'PM', 'SB', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SO', 'ES', 'LK', 'SH', 'LC', 'VC', 'GB', 'SD', 'SR', 'SJ', 'CH', 'SY', 'ZA', 'GS', 'KR', 'SS', 'TJ', 'TW', 'TZ', 'TH', 'TG', 'TK', 'TO', 'TT', 'TD', 'CZ', 'TN', 'TM', 'TC', 'TV', 'TR', 'DE', 'UG', 'UA', 'HU', 'UY', 'US', 'UM', 'UZ', 'VU', 'VA', 'VE', 'EH', 'VN', 'WF', 'ZM', 'ZW', 'TL', 'AT', 'AX');
    CREATE TYPE "public"."enum__referred_customers_v_version_status" AS ENUM('pending', 'approved', 'rejected', 'inactive');
    CREATE TYPE "public"."enum__referred_customers_v_version_category" AS ENUM('businessSale', 'retailStore');
    CREATE TYPE "public"."enum__referred_customers_v_version_country" AS ENUM('NO', 'SE', 'DK', 'FI', 'IS', 'AF', 'AL', 'DZ', 'AS', 'AD', 'AO', 'AI', 'AQ', 'AG', 'AR', 'AM', 'AW', 'AZ', 'AU', 'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BM', 'BT', 'BO', 'BA', 'BW', 'BV', 'BR', 'BN', 'BG', 'BF', 'BI', 'CA', 'KY', 'CL', 'CX', 'CO', 'CK', 'CR', 'CU', 'CW', 'VI', 'VG', 'AE', 'TF', 'DO', 'CF', 'IO', 'PS', 'DJ', 'DM', 'EC', 'EG', 'GQ', 'SV', 'CI', 'ER', 'EE', 'SZ', 'ET', 'FK', 'FJ', 'PH', 'FR', 'GF', 'PF', 'FO', 'GA', 'GM', 'GE', 'GH', 'GI', 'GD', 'GL', 'GP', 'GU', 'GT', 'GG', 'GN', 'GW', 'GY', 'HT', 'HM', 'GR', 'HN', 'HK', 'IN', 'ID', 'IQ', 'IR', 'IE', 'IL', 'IT', 'JM', 'JP', 'YE', 'JE', 'JO', 'KH', 'CM', 'CV', 'BQ', 'KZ', 'KE', 'CN', 'KG', 'KI', 'CC', 'KM', 'CD', 'CG', 'HR', 'KW', 'CY', 'LA', 'LV', 'LS', 'LB', 'LR', 'LY', 'LI', 'LT', 'LU', 'MO', 'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'IM', 'MA', 'MH', 'MQ', 'MR', 'MU', 'YT', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MS', 'MZ', 'MM', 'NA', 'NR', 'NL', 'NP', 'NZ', 'NI', 'NE', 'NG', 'NU', 'KP', 'MK', 'MP', 'NF', 'NC', 'OM', 'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PN', 'PL', 'PT', 'PR', 'QA', 'RE', 'RO', 'RU', 'RW', 'KN', 'BL', 'MF', 'PM', 'SB', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SX', 'SK', 'SI', 'SO', 'ES', 'LK', 'SH', 'LC', 'VC', 'GB', 'SD', 'SR', 'SJ', 'CH', 'SY', 'ZA', 'GS', 'KR', 'SS', 'TJ', 'TW', 'TZ', 'TH', 'TG', 'TK', 'TO', 'TT', 'TD', 'CZ', 'TN', 'TM', 'TC', 'TV', 'TR', 'DE', 'UG', 'UA', 'HU', 'UY', 'US', 'UM', 'UZ', 'VU', 'VA', 'VE', 'EH', 'VN', 'WF', 'ZM', 'ZW', 'TL', 'AT', 'AX');
    CREATE TYPE "public"."enum_referral_sales_category" AS ENUM('businessSale', 'retailStore');
    CREATE TYPE "public"."enum_referral_sales_vat_treatment" AS ENUM('noVat', 'vatDeducted');
    CREATE TYPE "public"."enum_referral_sales_commission_eligibility" AS ENUM('eligible', 'notEligible');
    CREATE TYPE "public"."enum_referral_sales_commission_status" AS ENUM('pending', 'earned', 'paid', 'reversed');
    CREATE TYPE "public"."enum_referral_sales_payment_status" AS ENUM('pending', 'paid', 'cancelled', 'refunded');
    CREATE TYPE "public"."enum__referral_sales_v_version_category" AS ENUM('businessSale', 'retailStore');
    CREATE TYPE "public"."enum__referral_sales_v_version_vat_treatment" AS ENUM('noVat', 'vatDeducted');
    CREATE TYPE "public"."enum__referral_sales_v_version_commission_eligibility" AS ENUM('eligible', 'notEligible');
    CREATE TYPE "public"."enum__referral_sales_v_version_commission_status" AS ENUM('pending', 'earned', 'paid', 'reversed');
    CREATE TYPE "public"."enum__referral_sales_v_version_payment_status" AS ENUM('pending', 'paid', 'cancelled', 'refunded');
    CREATE TYPE "public"."enum_referral_commission_adjustments_reason" AS ENUM('refundedAfterPayout', 'cancelledAfterPayout');
    CREATE TYPE "public"."enum_referral_commission_adjustments_category" AS ENUM('businessSale', 'retailStore');
    CREATE TABLE "partner_payouts_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" integer NOT NULL,
	"path" varchar NOT NULL,
	"referral_sales_id" integer,
	"referral_commission_adjustments_id" integer
);
    CREATE TABLE "referred_customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"status" "enum_referred_customers_status" DEFAULT 'pending' NOT NULL,
	"category" "enum_referred_customers_category" NOT NULL,
	"partner_id" integer NOT NULL,
	"referral_date" timestamp(3) with time zone NOT NULL,
	"country" "enum_referred_customers_country" DEFAULT 'NO' NOT NULL,
	"organization_number" varchar,
	"contact_person" varchar,
	"email" varchar,
	"phone" varchar,
	"duplicate_confirmed" boolean DEFAULT false,
	"duplicate_reason" varchar,
	"duplicate_confirmed_at" timestamp(3) with time zone,
	"duplicate_confirmed_by_id" integer,
	"internal_note" varchar,
	"registration_key" varchar,
	"name_key" varchar,
	"duplicate_confirmed_for" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
    CREATE TABLE "_referred_customers_v" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"version_name" varchar NOT NULL,
	"version_status" "enum__referred_customers_v_version_status" DEFAULT 'pending' NOT NULL,
	"version_category" "enum__referred_customers_v_version_category" NOT NULL,
	"version_partner_id" integer NOT NULL,
	"version_referral_date" timestamp(3) with time zone NOT NULL,
	"version_country" "enum__referred_customers_v_version_country" DEFAULT 'NO' NOT NULL,
	"version_organization_number" varchar,
	"version_contact_person" varchar,
	"version_email" varchar,
	"version_phone" varchar,
	"version_duplicate_confirmed" boolean DEFAULT false,
	"version_duplicate_reason" varchar,
	"version_duplicate_confirmed_at" timestamp(3) with time zone,
	"version_duplicate_confirmed_by_id" integer,
	"version_internal_note" varchar,
	"version_registration_key" varchar,
	"version_name_key" varchar,
	"version_duplicate_confirmed_for" varchar,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
    CREATE TABLE "referral_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"referred_customer_id" integer NOT NULL,
	"sale_date" timestamp(3) with time zone NOT NULL,
	"partner_id" integer,
	"category" "enum_referral_sales_category",
	"order_id" integer,
	"external_reference" varchar,
	"invoiced_total" numeric NOT NULL,
	"currency" varchar DEFAULT 'NOK',
	"shipping_amount" numeric,
	"other_excluded_amount" numeric,
	"vat_treatment" "enum_referral_sales_vat_treatment" NOT NULL,
	"vat_amount" numeric,
	"commission_eligibility" "enum_referral_sales_commission_eligibility",
	"commission_rate" numeric,
	"rate_override_reason" varchar,
	"commission_base" numeric,
	"commission_amount" numeric,
	"commission_status" "enum_referral_sales_commission_status" DEFAULT 'pending',
	"payment_status" "enum_referral_sales_payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp(3) with time zone,
	"closed_at" timestamp(3) with time zone,
	"payout_id" integer,
	"promo_commission_on_order" numeric,
	"allow_promo_overlap" boolean DEFAULT false,
	"promo_overlap_reason" varchar,
	"corrects_sale_id" integer,
	"internal_note" varchar,
	"created_by_id" integer,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
    CREATE TABLE "_referral_sales_v" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"version_title" varchar,
	"version_referred_customer_id" integer NOT NULL,
	"version_sale_date" timestamp(3) with time zone NOT NULL,
	"version_partner_id" integer,
	"version_category" "enum__referral_sales_v_version_category",
	"version_order_id" integer,
	"version_external_reference" varchar,
	"version_invoiced_total" numeric NOT NULL,
	"version_currency" varchar DEFAULT 'NOK',
	"version_shipping_amount" numeric,
	"version_other_excluded_amount" numeric,
	"version_vat_treatment" "enum__referral_sales_v_version_vat_treatment" NOT NULL,
	"version_vat_amount" numeric,
	"version_commission_eligibility" "enum__referral_sales_v_version_commission_eligibility",
	"version_commission_rate" numeric,
	"version_rate_override_reason" varchar,
	"version_commission_base" numeric,
	"version_commission_amount" numeric,
	"version_commission_status" "enum__referral_sales_v_version_commission_status" DEFAULT 'pending',
	"version_payment_status" "enum__referral_sales_v_version_payment_status" DEFAULT 'pending' NOT NULL,
	"version_paid_at" timestamp(3) with time zone,
	"version_closed_at" timestamp(3) with time zone,
	"version_payout_id" integer,
	"version_promo_commission_on_order" numeric,
	"version_allow_promo_overlap" boolean DEFAULT false,
	"version_promo_overlap_reason" varchar,
	"version_corrects_sale_id" integer,
	"version_internal_note" varchar,
	"version_created_by_id" integer,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
    CREATE TABLE "referral_commission_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"sale_id" integer NOT NULL,
	"partner_id" integer,
	"amount" numeric NOT NULL,
	"reason" "enum_referral_commission_adjustments_reason",
	"category" "enum_referral_commission_adjustments_category",
	"original_payout_id" integer,
	"settled_by_payout_id" integer,
	"settled_at" timestamp(3) with time zone,
	"note" varchar,
	"created_by_id" integer,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
    ALTER TABLE "partner_payouts" ALTER COLUMN "promo_code_id" DROP NOT NULL;
    ALTER TABLE "partner_payouts" ADD COLUMN "source" "enum_partner_payouts_source";
    ALTER TABLE "partner_payouts" ADD COLUMN "referral_gross_amount" numeric;
    ALTER TABLE "partner_payouts" ADD COLUMN "referral_deducted_amount" numeric;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referred_customers_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referral_sales_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referral_commission_adjustments_id" integer;
    ALTER TABLE "partner_payouts_rels" ADD CONSTRAINT "partner_payouts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partner_payouts"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "partner_payouts_rels" ADD CONSTRAINT "partner_payouts_rels_referral_sales_fk" FOREIGN KEY ("referral_sales_id") REFERENCES "public"."referral_sales"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "partner_payouts_rels" ADD CONSTRAINT "partner_payouts_rels_referral_commission_adjustments_fk" FOREIGN KEY ("referral_commission_adjustments_id") REFERENCES "public"."referral_commission_adjustments"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "referred_customers" ADD CONSTRAINT "referred_customers_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referred_customers" ADD CONSTRAINT "referred_customers_duplicate_confirmed_by_id_users_id_fk" FOREIGN KEY ("duplicate_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referred_customers_v" ADD CONSTRAINT "_referred_customers_v_parent_id_referred_customers_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."referred_customers"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referred_customers_v" ADD CONSTRAINT "_referred_customers_v_version_partner_id_partners_id_fk" FOREIGN KEY ("version_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referred_customers_v" ADD CONSTRAINT "_referred_customers_v_version_duplicate_confirmed_by_id_users_id_fk" FOREIGN KEY ("version_duplicate_confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_sales" ADD CONSTRAINT "referral_sales_referred_customer_id_referred_customers_id_fk" FOREIGN KEY ("referred_customer_id") REFERENCES "public"."referred_customers"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "referral_sales" ADD CONSTRAINT "referral_sales_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_sales" ADD CONSTRAINT "referral_sales_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_sales" ADD CONSTRAINT "referral_sales_payout_id_partner_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."partner_payouts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_sales" ADD CONSTRAINT "referral_sales_corrects_sale_id_referral_sales_id_fk" FOREIGN KEY ("corrects_sale_id") REFERENCES "public"."referral_sales"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_sales" ADD CONSTRAINT "referral_sales_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v" ADD CONSTRAINT "_referral_sales_v_parent_id_referral_sales_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."referral_sales"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v" ADD CONSTRAINT "_referral_sales_v_version_referred_customer_id_referred_customers_id_fk" FOREIGN KEY ("version_referred_customer_id") REFERENCES "public"."referred_customers"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v" ADD CONSTRAINT "_referral_sales_v_version_partner_id_partners_id_fk" FOREIGN KEY ("version_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v" ADD CONSTRAINT "_referral_sales_v_version_order_id_orders_id_fk" FOREIGN KEY ("version_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v" ADD CONSTRAINT "_referral_sales_v_version_payout_id_partner_payouts_id_fk" FOREIGN KEY ("version_payout_id") REFERENCES "public"."partner_payouts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v" ADD CONSTRAINT "_referral_sales_v_version_corrects_sale_id_referral_sales_id_fk" FOREIGN KEY ("version_corrects_sale_id") REFERENCES "public"."referral_sales"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "_referral_sales_v" ADD CONSTRAINT "_referral_sales_v_version_created_by_id_users_id_fk" FOREIGN KEY ("version_created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_commission_adjustments" ADD CONSTRAINT "referral_commission_adjustments_sale_id_referral_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."referral_sales"("id") ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "referral_commission_adjustments" ADD CONSTRAINT "referral_commission_adjustments_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_commission_adjustments" ADD CONSTRAINT "referral_commission_adjustments_original_payout_id_partner_payouts_id_fk" FOREIGN KEY ("original_payout_id") REFERENCES "public"."partner_payouts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_commission_adjustments" ADD CONSTRAINT "referral_commission_adjustments_settled_by_payout_id_partner_payouts_id_fk" FOREIGN KEY ("settled_by_payout_id") REFERENCES "public"."partner_payouts"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "referral_commission_adjustments" ADD CONSTRAINT "referral_commission_adjustments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "partner_payouts_rels_order_idx" ON "partner_payouts_rels" USING btree ("order");
    CREATE INDEX "partner_payouts_rels_parent_idx" ON "partner_payouts_rels" USING btree ("parent_id");
    CREATE INDEX "partner_payouts_rels_path_idx" ON "partner_payouts_rels" USING btree ("path");
    CREATE INDEX "partner_payouts_rels_referral_sales_id_idx" ON "partner_payouts_rels" USING btree ("referral_sales_id");
    CREATE INDEX "partner_payouts_rels_referral_commission_adjustments_id_idx" ON "partner_payouts_rels" USING btree ("referral_commission_adjustments_id");
    CREATE INDEX "referred_customers_name_idx" ON "referred_customers" USING btree ("name");
    CREATE INDEX "referred_customers_status_idx" ON "referred_customers" USING btree ("status");
    CREATE INDEX "referred_customers_category_idx" ON "referred_customers" USING btree ("category");
    CREATE INDEX "referred_customers_partner_idx" ON "referred_customers" USING btree ("partner_id");
    CREATE INDEX "referred_customers_referral_date_idx" ON "referred_customers" USING btree ("referral_date");
    CREATE INDEX "referred_customers_duplicate_confirmed_by_idx" ON "referred_customers" USING btree ("duplicate_confirmed_by_id");
    CREATE INDEX "referred_customers_registration_key_idx" ON "referred_customers" USING btree ("registration_key");
    CREATE INDEX "referred_customers_name_key_idx" ON "referred_customers" USING btree ("name_key");
    CREATE INDEX "referred_customers_updated_at_idx" ON "referred_customers" USING btree ("updated_at");
    CREATE INDEX "referred_customers_created_at_idx" ON "referred_customers" USING btree ("created_at");
    CREATE INDEX "_referred_customers_v_parent_idx" ON "_referred_customers_v" USING btree ("parent_id");
    CREATE INDEX "_referred_customers_v_version_version_name_idx" ON "_referred_customers_v" USING btree ("version_name");
    CREATE INDEX "_referred_customers_v_version_version_status_idx" ON "_referred_customers_v" USING btree ("version_status");
    CREATE INDEX "_referred_customers_v_version_version_category_idx" ON "_referred_customers_v" USING btree ("version_category");
    CREATE INDEX "_referred_customers_v_version_version_partner_idx" ON "_referred_customers_v" USING btree ("version_partner_id");
    CREATE INDEX "_referred_customers_v_version_version_referral_date_idx" ON "_referred_customers_v" USING btree ("version_referral_date");
    CREATE INDEX "_referred_customers_v_version_version_duplicate_confirme_idx" ON "_referred_customers_v" USING btree ("version_duplicate_confirmed_by_id");
    CREATE INDEX "_referred_customers_v_version_version_registration_key_idx" ON "_referred_customers_v" USING btree ("version_registration_key");
    CREATE INDEX "_referred_customers_v_version_version_name_key_idx" ON "_referred_customers_v" USING btree ("version_name_key");
    CREATE INDEX "_referred_customers_v_version_version_updated_at_idx" ON "_referred_customers_v" USING btree ("version_updated_at");
    CREATE INDEX "_referred_customers_v_version_version_created_at_idx" ON "_referred_customers_v" USING btree ("version_created_at");
    CREATE INDEX "_referred_customers_v_created_at_idx" ON "_referred_customers_v" USING btree ("created_at");
    CREATE INDEX "_referred_customers_v_updated_at_idx" ON "_referred_customers_v" USING btree ("updated_at");
    CREATE INDEX "referral_sales_referred_customer_idx" ON "referral_sales" USING btree ("referred_customer_id");
    CREATE INDEX "referral_sales_sale_date_idx" ON "referral_sales" USING btree ("sale_date");
    CREATE INDEX "referral_sales_partner_idx" ON "referral_sales" USING btree ("partner_id");
    CREATE INDEX "referral_sales_category_idx" ON "referral_sales" USING btree ("category");
    CREATE INDEX "referral_sales_order_idx" ON "referral_sales" USING btree ("order_id");
    CREATE INDEX "referral_sales_external_reference_idx" ON "referral_sales" USING btree ("external_reference");
    CREATE INDEX "referral_sales_commission_status_idx" ON "referral_sales" USING btree ("commission_status");
    CREATE INDEX "referral_sales_payment_status_idx" ON "referral_sales" USING btree ("payment_status");
    CREATE INDEX "referral_sales_payout_idx" ON "referral_sales" USING btree ("payout_id");
    CREATE INDEX "referral_sales_corrects_sale_idx" ON "referral_sales" USING btree ("corrects_sale_id");
    CREATE INDEX "referral_sales_created_by_idx" ON "referral_sales" USING btree ("created_by_id");
    CREATE INDEX "referral_sales_updated_at_idx" ON "referral_sales" USING btree ("updated_at");
    CREATE INDEX "referral_sales_created_at_idx" ON "referral_sales" USING btree ("created_at");
    CREATE INDEX "_referral_sales_v_parent_idx" ON "_referral_sales_v" USING btree ("parent_id");
    CREATE INDEX "_referral_sales_v_version_version_referred_customer_idx" ON "_referral_sales_v" USING btree ("version_referred_customer_id");
    CREATE INDEX "_referral_sales_v_version_version_sale_date_idx" ON "_referral_sales_v" USING btree ("version_sale_date");
    CREATE INDEX "_referral_sales_v_version_version_partner_idx" ON "_referral_sales_v" USING btree ("version_partner_id");
    CREATE INDEX "_referral_sales_v_version_version_category_idx" ON "_referral_sales_v" USING btree ("version_category");
    CREATE INDEX "_referral_sales_v_version_version_order_idx" ON "_referral_sales_v" USING btree ("version_order_id");
    CREATE INDEX "_referral_sales_v_version_version_external_reference_idx" ON "_referral_sales_v" USING btree ("version_external_reference");
    CREATE INDEX "_referral_sales_v_version_version_commission_status_idx" ON "_referral_sales_v" USING btree ("version_commission_status");
    CREATE INDEX "_referral_sales_v_version_version_payment_status_idx" ON "_referral_sales_v" USING btree ("version_payment_status");
    CREATE INDEX "_referral_sales_v_version_version_payout_idx" ON "_referral_sales_v" USING btree ("version_payout_id");
    CREATE INDEX "_referral_sales_v_version_version_corrects_sale_idx" ON "_referral_sales_v" USING btree ("version_corrects_sale_id");
    CREATE INDEX "_referral_sales_v_version_version_created_by_idx" ON "_referral_sales_v" USING btree ("version_created_by_id");
    CREATE INDEX "_referral_sales_v_version_version_updated_at_idx" ON "_referral_sales_v" USING btree ("version_updated_at");
    CREATE INDEX "_referral_sales_v_version_version_created_at_idx" ON "_referral_sales_v" USING btree ("version_created_at");
    CREATE INDEX "_referral_sales_v_created_at_idx" ON "_referral_sales_v" USING btree ("created_at");
    CREATE INDEX "_referral_sales_v_updated_at_idx" ON "_referral_sales_v" USING btree ("updated_at");
    CREATE UNIQUE INDEX "referral_commission_adjustments_sale_idx" ON "referral_commission_adjustments" USING btree ("sale_id");
    CREATE INDEX "referral_commission_adjustments_partner_idx" ON "referral_commission_adjustments" USING btree ("partner_id");
    CREATE INDEX "referral_commission_adjustments_original_payout_idx" ON "referral_commission_adjustments" USING btree ("original_payout_id");
    CREATE INDEX "referral_commission_adjustments_settled_by_payout_idx" ON "referral_commission_adjustments" USING btree ("settled_by_payout_id");
    CREATE INDEX "referral_commission_adjustments_created_by_idx" ON "referral_commission_adjustments" USING btree ("created_by_id");
    CREATE INDEX "referral_commission_adjustments_updated_at_idx" ON "referral_commission_adjustments" USING btree ("updated_at");
    CREATE INDEX "referral_commission_adjustments_created_at_idx" ON "referral_commission_adjustments" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referred_customers_fk" FOREIGN KEY ("referred_customers_id") REFERENCES "public"."referred_customers"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referral_sales_fk" FOREIGN KEY ("referral_sales_id") REFERENCES "public"."referral_sales"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_referral_commission_adjustm_fk" FOREIGN KEY ("referral_commission_adjustments_id") REFERENCES "public"."referral_commission_adjustments"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "partner_payouts_source_idx" ON "partner_payouts" USING btree ("source");
    CREATE INDEX "payload_locked_documents_rels_referred_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("referred_customers_id");
    CREATE INDEX "payload_locked_documents_rels_referral_sales_id_idx" ON "payload_locked_documents_rels" USING btree ("referral_sales_id");
    CREATE INDEX "payload_locked_documents_rels_referral_commission_adjust_idx" ON "payload_locked_documents_rels" USING btree ("referral_commission_adjustments_id");

    -- ── Backstops (hand-written) ──────────────────────────────────────────
    CREATE UNIQUE INDEX "referred_customers_open_registration_key_uq"
      ON "referred_customers" USING btree ("registration_key")
      WHERE "registration_key" IS NOT NULL AND "status" IN ('pending', 'approved');
    CREATE UNIQUE INDEX "referral_sales_active_order_uq"
      ON "referral_sales" USING btree ("order_id")
      WHERE "order_id" IS NOT NULL AND "payment_status" IN ('pending', 'paid');
    CREATE UNIQUE INDEX "referral_sales_active_correction_uq"
      ON "referral_sales" USING btree ("corrects_sale_id")
      WHERE "corrects_sale_id" IS NOT NULL AND "payment_status" IN ('pending', 'paid');
    CREATE UNIQUE INDEX "referral_sales_active_external_reference_uq"
      ON "referral_sales" USING btree ("referred_customer_id", "external_reference")
      WHERE "external_reference" IS NOT NULL AND "payment_status" IN ('pending', 'paid');
    ALTER TABLE "referral_commission_adjustments"
      ADD CONSTRAINT "referral_commission_adjustments_amount_not_positive" CHECK ("amount" <= 0);
  `)
}

// Refuses while ANY referral data exists, rather than destroying accounting records or failing
// halfway: restoring NOT NULL on partner_payouts.promo_code_id is impossible while a referral
// payout exists, and dropping the tables would erase registered sales and adjustments. On an
// empty install it removes exactly what up() added; existing promo payouts are untouched.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const result = (await db.execute(sql`
    SELECT
      (SELECT count(*) FROM "referred_customers") +
      (SELECT count(*) FROM "referral_sales") +
      (SELECT count(*) FROM "referral_commission_adjustments") +
      (SELECT count(*) FROM "partner_payouts" WHERE "promo_code_id" IS NULL OR "source" = 'referral') AS "rows"
  `)) as unknown as { rows?: { rows: string | number }[] }
  const rows = Number(result.rows?.[0]?.rows ?? 0)
  if (rows > 0) {
    throw new Error(
      `Refusing to roll back 20261021_090000: ${rows} referral row(s) exist (customers, sales, adjustments or referral payouts). Export and remove them deliberately first.`,
    )
  }

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referred_customers_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referral_sales_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referral_commission_adjustm_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_referred_customers_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_referral_sales_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_referral_commission_adjust_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referred_customers_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referral_sales_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referral_commission_adjustments_id";

    DROP TABLE IF EXISTS "partner_payouts_rels" CASCADE;
    DROP TABLE IF EXISTS "referral_commission_adjustments" CASCADE;
    DROP TABLE IF EXISTS "_referral_sales_v" CASCADE;
    DROP TABLE IF EXISTS "referral_sales" CASCADE;
    DROP TABLE IF EXISTS "_referred_customers_v" CASCADE;
    DROP TABLE IF EXISTS "referred_customers" CASCADE;

    DROP INDEX IF EXISTS "partner_payouts_source_idx";
    ALTER TABLE "partner_payouts" DROP COLUMN IF EXISTS "referral_deducted_amount";
    ALTER TABLE "partner_payouts" DROP COLUMN IF EXISTS "referral_gross_amount";
    ALTER TABLE "partner_payouts" DROP COLUMN IF EXISTS "source";
    ALTER TABLE "partner_payouts" ALTER COLUMN "promo_code_id" SET NOT NULL;

    DROP TYPE IF EXISTS "public"."enum_partner_payouts_source";
    DROP TYPE IF EXISTS "public"."enum_referred_customers_status";
    DROP TYPE IF EXISTS "public"."enum_referred_customers_category";
    DROP TYPE IF EXISTS "public"."enum_referred_customers_country";
    DROP TYPE IF EXISTS "public"."enum__referred_customers_v_version_status";
    DROP TYPE IF EXISTS "public"."enum__referred_customers_v_version_category";
    DROP TYPE IF EXISTS "public"."enum__referred_customers_v_version_country";
    DROP TYPE IF EXISTS "public"."enum_referral_sales_category";
    DROP TYPE IF EXISTS "public"."enum_referral_sales_vat_treatment";
    DROP TYPE IF EXISTS "public"."enum_referral_sales_commission_eligibility";
    DROP TYPE IF EXISTS "public"."enum_referral_sales_commission_status";
    DROP TYPE IF EXISTS "public"."enum_referral_sales_payment_status";
    DROP TYPE IF EXISTS "public"."enum__referral_sales_v_version_category";
    DROP TYPE IF EXISTS "public"."enum__referral_sales_v_version_vat_treatment";
    DROP TYPE IF EXISTS "public"."enum__referral_sales_v_version_commission_eligibility";
    DROP TYPE IF EXISTS "public"."enum__referral_sales_v_version_commission_status";
    DROP TYPE IF EXISTS "public"."enum__referral_sales_v_version_payment_status";
    DROP TYPE IF EXISTS "public"."enum_referral_commission_adjustments_reason";
    DROP TYPE IF EXISTS "public"."enum_referral_commission_adjustments_category";
  `)
}
