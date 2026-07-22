// Normalized Meta API errors. The public `message` is always safe to show a user and
// never contains the access token; the structured detail fields are for server-side
// logging only.

/** Structured detail parsed from a standard Meta Graph API error envelope. */
export interface MetaErrorDetail {
  message?: string
  type?: string
  code?: number
  errorSubcode?: number
  fbtraceId?: string
}

export class MetaError extends Error {
  readonly detail: MetaErrorDetail
  /** HTTP status of the Meta response, when the error came from a non-2xx reply. */
  readonly httpStatus?: number

  constructor(publicMessage: string, detail: MetaErrorDetail = {}, httpStatus?: number) {
    super(publicMessage)
    this.name = 'MetaError'
    this.detail = detail
    this.httpStatus = httpStatus
  }

  /** One-line, token-free summary for server logs. */
  logLine(): string {
    const d = this.detail
    const parts = [
      d.code != null ? `code=${d.code}` : null,
      d.errorSubcode != null ? `subcode=${d.errorSubcode}` : null,
      d.type ? `type=${d.type}` : null,
      d.fbtraceId ? `fbtrace_id=${d.fbtraceId}` : null,
      d.message ? `message=${JSON.stringify(d.message)}` : null,
      this.httpStatus != null ? `http=${this.httpStatus}` : null,
    ].filter(Boolean)
    return `[meta] ${parts.join(' ')}`
  }
}

/**
 * Parse the `{ error: { … } }` envelope Meta returns on failures. Falls back to a
 * generic detail when the body is not the expected shape.
 */
export function parseMetaError(body: unknown, httpStatus?: number): MetaError {
  const err =
    body && typeof body === 'object' && 'error' in body
      ? (body as { error: unknown }).error
      : undefined

  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const detail: MetaErrorDetail = {
      message: typeof e.message === 'string' ? e.message : undefined,
      type: typeof e.type === 'string' ? e.type : undefined,
      code: typeof e.code === 'number' ? e.code : undefined,
      errorSubcode: typeof e.error_subcode === 'number' ? e.error_subcode : undefined,
      fbtraceId: typeof e.fbtrace_id === 'string' ? e.fbtrace_id : undefined,
    }
    return new MetaError('Meta-tjenesten svarte med en feil. Prøv igjen senere.', detail, httpStatus)
  }

  return new MetaError('Meta-tjenesten svarte med en feil. Prøv igjen senere.', {}, httpStatus)
}
