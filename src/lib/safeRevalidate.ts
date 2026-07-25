/**
 * Runs a Next.js cache-revalidation callback (revalidateTag/revalidatePath) so that a
 * failure can never abort the surrounding database write.
 *
 * Why this exists: reviews are created from a public Server Action. When a Payload
 * afterChange hook calls revalidateTag/revalidatePath in that context, Next can throw
 * `Invariant: static generation store missing`. Because the hook runs inside payload.create,
 * that throw would abort the review insert and force the invitation to roll back to
 * `active` — so no review is ever saved. Revalidation is a pure cache side-effect, so we
 * swallow and log any error and let the write stand; the cache still refreshes on its normal
 * interval, and request-context callers (the admin panel) revalidate immediately as before.
 */
export async function safeRevalidate(
  run: () => void | Promise<void>,
  scope: string,
): Promise<void> {
  try {
    await run()
  } catch (err) {
    console.warn(
      JSON.stringify({
        scope,
        message: 'Skipped cache revalidation (no request/render store); write still committed.',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
  }
}
