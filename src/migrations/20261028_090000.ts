import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Universal analysis categories for pilot questionnaires («Analysekategori»).
//
// ── What this changes ──
//
//   • enum_pilot_projects_questions_stat_key gains the six universal categories (usage, benefit,
//     satisfaction, recommendation, feedback; usability already existed) and 'none' («Ingen
//     kategori»).
//   • pilot_projects_questions_options.no_product_experience — the «Ingen produkterfaring» option
//     flag. It replaces the old rule that tied «not used yet» to the «Bruksfrekvens» category.
//   • pilot_projects_questions.count_in_assessment — «Telles i samlet vurdering» on Ja / Nei
//     questions, which have no «Positivt svar» option to mark.
//
// ── Additive only ──
//
// The legacy enum values stay: questionnaires saved with them keep loading and saving unchanged,
// and the code maps them to the new categories when grouping. The new columns default to false.
// No UPDATE runs — no questionnaire definition, evaluation, snapshot or answer is touched. A
// legacy «Bruksfrekvens» question keeps its «not used yet» meaning in code (see
// src/lib/pilot/questionnaire.ts `marksNoExperience`), so no backfill is needed. No DROP, DELETE,
// RENAME or TRUNCATE in up(). No other table is touched.
//
// Runs after 20261022_150000.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_pilot_projects_questions_stat_key" ADD VALUE IF NOT EXISTS 'usage';
    ALTER TYPE "public"."enum_pilot_projects_questions_stat_key" ADD VALUE IF NOT EXISTS 'benefit';
    ALTER TYPE "public"."enum_pilot_projects_questions_stat_key" ADD VALUE IF NOT EXISTS 'satisfaction';
    ALTER TYPE "public"."enum_pilot_projects_questions_stat_key" ADD VALUE IF NOT EXISTS 'recommendation';
    ALTER TYPE "public"."enum_pilot_projects_questions_stat_key" ADD VALUE IF NOT EXISTS 'feedback';
    ALTER TYPE "public"."enum_pilot_projects_questions_stat_key" ADD VALUE IF NOT EXISTS 'none';
    ALTER TABLE "pilot_projects_questions_options" ADD COLUMN IF NOT EXISTS "no_product_experience" boolean DEFAULT false;
    ALTER TABLE "pilot_projects_questions" ADD COLUMN IF NOT EXISTS "count_in_assessment" boolean DEFAULT false;
  `)
}

// Postgres cannot remove enum values in place, so the type is rebuilt with the legacy values.
// Refuses while any question uses one of the new values, rather than rewriting questionnaires.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  const used = await db.execute(sql`
    SELECT count(*)::int AS n FROM "pilot_projects_questions"
    WHERE "stat_key"::text IN ('usage', 'benefit', 'satisfaction', 'recommendation', 'feedback', 'none');
  `)
  const n = Number((used.rows?.[0] as { n?: number } | undefined)?.n ?? 0)
  if (n > 0) {
    throw new Error(
      `20261028_090000 down: ${n} pilot question(s) use a new analysis category. Change them in the admin first.`,
    )
  }
  await db.execute(sql`
    ALTER TABLE "pilot_projects_questions_options" DROP COLUMN IF EXISTS "no_product_experience";
    ALTER TABLE "pilot_projects_questions" DROP COLUMN IF EXISTS "count_in_assessment";
    ALTER TABLE "pilot_projects_questions" ALTER COLUMN "stat_key" TYPE text;
    DROP TYPE "public"."enum_pilot_projects_questions_stat_key";
    CREATE TYPE "public"."enum_pilot_projects_questions_stat_key" AS ENUM('location', 'model', 'frequency', 'usability', 'usefulness', 'organization', 'continue', 'improvements', 'comments', 'room');
    ALTER TABLE "pilot_projects_questions" ALTER COLUMN "stat_key" TYPE "public"."enum_pilot_projects_questions_stat_key" USING "stat_key"::"public"."enum_pilot_projects_questions_stat_key";
  `)
}
