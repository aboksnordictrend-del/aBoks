/**
 * Strict contract for the review Server Action result, plus the pure mapping from a result
 * to the form's UI state. Kept in its own module (not the `'use server'` actions file, which
 * may only export async functions) so both the client form and the tests can import it.
 *
 * The whole point of the discriminated union is that the thank-you page is shown ONLY when
 * `success === true`. There is no other truthy signal — an error result, a validation
 * failure, or a thrown exception can never be mistaken for success.
 */
export type ReviewActionResult =
  | { success: true; reviewId?: string }
  | { success: false; errors?: Record<string, string>; message?: string }

export interface ReviewFormFeedback {
  /** True ONLY for a genuine success (a review was created). Drives the thank-you page. */
  submitted: boolean
  fieldErrors: Record<string, string>
  generalError: string
}

/** Narrowing helper: the single source of truth for "should we show the thank-you page?". */
export function isReviewSuccess(result: ReviewActionResult): result is { success: true; reviewId?: string } {
  return result.success === true
}

/**
 * Maps a resolved action result to the form feedback. Never invents success: only a
 * `success: true` result yields `submitted: true`. A `success: false` result surfaces field
 * errors and/or a general message and keeps the form open.
 */
export function feedbackFromResult(result: ReviewActionResult): ReviewFormFeedback {
  if (isReviewSuccess(result)) {
    return { submitted: true, fieldErrors: {}, generalError: '' }
  }
  return {
    submitted: false,
    fieldErrors: result.errors ?? {},
    generalError: result.message ?? '',
  }
}
