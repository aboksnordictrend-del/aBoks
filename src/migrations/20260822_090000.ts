import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// `orders.review_invitation_sent_at` — when the review-invitation e-mail was actually sent.
//
// The admin already had a «Send anmeldelsesinvitasjon» button, but a `ui` field holds no
// value, so as a list column it rendered "<No Send Review Invitation>" for every order,
// including the ones that had been invited. This adds the real column behind it.
//
// Additive and idempotent: one nullable column on `orders`, plus a one-time backfill from
// `review_invitations`. No DROP, no DELETE, no TRUNCATE, and no other column is touched.
//
// ── The backfill ────────────────────────────────────────────────────────────────
//
// `review_invitations.sent_at` is a trustworthy source: the invitation endpoint stamps it
// with the moment it built the send, and if `payload.sendEmail()` then throws it flips that
// same row to `status = 'revoked'`. So a row that is NOT revoked is a row whose e-mail the
// mail server accepted.
//
// Revoked rows are the interesting case, because 'revoked' means two different things:
//
//   1. the send failed — the endpoint revokes the row it just created; it is the newest
//      row for that order, and nothing was ever delivered;
//   2. a later resend superseded it — `revokeActiveInvitationsForOrder` revokes the
//      previous link before creating the new one, so the e-mail HAD gone out; there is
//      always a newer row for that order.
//
// The two are told apart by exactly that: a revoked row that is not the newest for its
// order was superseded, so it counts. A revoked newest row does not. This matters for the
// order whose most recent resend failed — its previous, superseded invitation is the last
// one the customer actually received, and it would otherwise be discarded.
//
// Orders with no qualifying invitation are left NULL. That is the honest value: nothing
// here knows when — or whether — they were invited, and an invented date would be worse
// than an empty column. `WHERE review_invitation_sent_at IS NULL` also keeps the backfill
// safe to re-run: it never overwrites a timestamp written by a live send.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "review_invitation_sent_at" timestamp(3) with time zone;
  `)

  await db.execute(sql`
    WITH ranked AS (
      SELECT
        "order_id",
        "sent_at",
        "status",
        ROW_NUMBER() OVER (
          PARTITION BY "order_id"
          ORDER BY "sent_at" DESC, "id" DESC
        ) AS rn
      FROM "review_invitations"
      WHERE "order_id" IS NOT NULL AND "sent_at" IS NOT NULL
    ),
    delivered AS (
      SELECT "order_id", MAX("sent_at") AS "sent_at"
      FROM ranked
      WHERE "status" <> 'revoked' OR rn > 1
      GROUP BY "order_id"
    )
    UPDATE "orders" o
    SET "review_invitation_sent_at" = d."sent_at"
    FROM delivered d
    WHERE o."id" = d."order_id"
      AND o."review_invitation_sent_at" IS NULL;
  `)
}

// Drops exactly what this migration added. Nothing is lost that cannot be recomputed: the
// `review_invitations` rows the backfill reads from are untouched, so re-running `up`
// reconstructs the same values.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "review_invitation_sent_at";
  `)
}
