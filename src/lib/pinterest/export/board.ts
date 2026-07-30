// Board-name validation.
//
// Pinterest's bulk upload identifies the destination by board *title* — there is no board-id
// or board-URL column — and a section is addressed as "Board/Section". A typo cannot be
// caught locally (we never call the Pinterest API), so the value is at least normalized and
// checked for the things that would corrupt the file itself.

/** Generous ceiling; Pinterest does not publish a board-title limit. */
export const BOARD_MAX = 180

/** A leading formula character is rejected outright rather than silently quoted. */
const FORMULA_TRIGGER = /^[=+\-@]/

/**
 * C0/C1 control characters — including the CR/LF/TAB that would break the CSV record.
 * Written as a code-point scan rather than a regex so the source file never has to contain
 * literal control characters.
 */
function hasControlChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

export type BoardValidation = { ok: true; value: string } | { ok: false; error: string }

/**
 * Trim, normalize `Board / Section` → `Board/Section`, and reject anything unusable.
 * The returned value is what goes into every row's "Pinterest board" column.
 */
export function validateBoardName(raw: unknown): BoardValidation {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Tavlenavn mangler.' }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: 'Tavlenavn er påkrevd.' }
  }
  if (hasControlChar(trimmed)) {
    return { ok: false, error: 'Tavlenavnet kan ikke inneholde linjeskift eller kontrolltegn.' }
  }
  if (Array.from(trimmed).length > BOARD_MAX) {
    return { ok: false, error: `Tavlenavnet kan være maks ${BOARD_MAX} tegn.` }
  }
  if (FORMULA_TRIGGER.test(trimmed)) {
    return { ok: false, error: 'Tavlenavnet kan ikke starte med =, +, - eller @.' }
  }

  const parts = trimmed.split('/')
  if (parts.length > 2) {
    return { ok: false, error: 'Bruk «Tavle» eller «Tavle/Seksjon» — bare én skråstrek.' }
  }
  const cleaned = parts.map((p) => p.trim())
  if (cleaned.some((p) => p === '')) {
    return { ok: false, error: 'Både tavle- og seksjonsnavnet må fylles ut.' }
  }

  return { ok: true, value: cleaned.join('/') }
}
