import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Order-number allocation: a dedicated sequence, `orders_order_number_seq`.
//
// Manual orders created in the admin panel submit no Ordrenummer (the field is read-only),
// so the number is now assigned server-side by the orders beforeValidate hook, which draws
// from this sequence. `nextval` is atomic, so two concurrent checkouts can never be handed
// the same number — unlike a "SELECT max(order_number) + 1", which would let both read the
// same maximum and then collide on the unique index.
//
// The sequence starts one above the highest number that already exists (numbers are
// 'AB-' + 6 digits, so the digits are the counter), which keeps the existing series running
// and makes it impossible to re-issue a number an old order already holds. Existing rows
// are only read, never modified.
//
// Purely additive and idempotent — creating it twice is a no-op, and it is left alone if it
// already exists (so re-running never rewinds the counter).
//
// The unique index on orders.order_number already exists (created with the table as
// `orders_order_number_idx`), so nothing is added for it here.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    DECLARE
      start_value bigint;
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relkind = 'S'
          AND relname = 'orders_order_number_seq'
          AND relnamespace = 'public'::regnamespace
      ) THEN
        SELECT GREATEST(
                 28400, -- floor of the existing AB-0284xx… series, used when there are no orders
                 COALESCE(MAX(NULLIF(regexp_replace(order_number, '[^0-9]', '', 'g'), '')::bigint), 0)
               ) + 1
          INTO start_value
          FROM orders;

        EXECUTE format(
          'CREATE SEQUENCE "public"."orders_order_number_seq" AS bigint INCREMENT BY 1 MINVALUE 1 START WITH %s',
          start_value
        );
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP SEQUENCE IF EXISTS "public"."orders_order_number_seq";
  `)
}
