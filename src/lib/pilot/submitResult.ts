// Result contract of the public pilot submission (server action ↔ form). Pure.

export type PilotActionResult =
  | { success: true; closingMessage: string }
  | {
      success: false
      message?: string
      errors?: Record<string, string>
      reason?: 'closed' | 'stale' | 'invalid' | 'error'
    }

/** The confirmation screen is shown only for an explicit `success: true`. */
export function isStoredResult(result: unknown): result is { success: true; closingMessage: string } {
  return typeof result === 'object' && result !== null && (result as { success?: unknown }).success === true
}
