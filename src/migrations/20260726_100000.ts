import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Aligns the orders table with the Payload config: customerInfo.email / firstName / lastName
// are optional fields, but their columns were left NOT NULL by the original dev push. Any
// write that omits one of them dies with a raw Postgres 23502 instead of being accepted —
// which blocks a manual order created in the admin panel, and also the checkout's
// pre-create in initKustomCheckout (it stores no customer info at all; the details only
// arrive with the Kustom webhook).
//
// Only these three columns are affected; address / postal_code / city / phone in the same
// group are already nullable. No data is read or rewritten — DROP NOT NULL is a catalog-only
// change, and re-running it on an already-nullable column is a no-op.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ALTER COLUMN "customer_info_email" DROP NOT NULL,
      ALTER COLUMN "customer_info_first_name" DROP NOT NULL,
      ALTER COLUMN "customer_info_last_name" DROP NOT NULL;
  `)
}

// Restoring NOT NULL is only valid while every row still has a value. Rather than inventing
// a placeholder — which would silently corrupt customer data — this refuses to run and says
// exactly which rows are in the way.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      null_email      bigint;
      null_first_name bigint;
      null_last_name  bigint;
    BEGIN
      SELECT count(*) FILTER (WHERE "customer_info_email" IS NULL),
             count(*) FILTER (WHERE "customer_info_first_name" IS NULL),
             count(*) FILTER (WHERE "customer_info_last_name" IS NULL)
        INTO null_email, null_first_name, null_last_name
        FROM "orders";

      IF null_email > 0 OR null_first_name > 0 OR null_last_name > 0 THEN
        RAISE EXCEPTION
          'Cannot restore NOT NULL on orders.customer_info_*: % order(s) have no e-mail, % no first name, % no last name.',
          null_email, null_first_name, null_last_name
          USING HINT =
            'Fill in or delete those orders first: SELECT id, order_number FROM orders WHERE customer_info_email IS NULL OR customer_info_first_name IS NULL OR customer_info_last_name IS NULL;';
      END IF;

      ALTER TABLE "orders"
        ALTER COLUMN "customer_info_email" SET NOT NULL,
        ALTER COLUMN "customer_info_first_name" SET NOT NULL,
        ALTER COLUMN "customer_info_last_name" SET NOT NULL;
    END $$;
  `)
}
