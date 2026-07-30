// Bulk row selection for the Pinterest export preview.
//
// Pure and deliberately narrow: these functions know about a row's `enabled` flag and nothing
// else. They cannot reach the source filters, the sort order or the preview fetch, so "Velg
// alle" is structurally incapable of disturbing any of them — and because every edit is
// carried through by a spread, a title, description, keyword list or destination the admin
// typed survives a bulk toggle untouched.

/** The one field bulk selection is allowed to write. Rows carry more; this is all it sees. */
export interface SelectableRow {
  enabled: boolean
}

/** How many of the visible rows are currently selected. A row with no edit entry counts as on. */
export function countSelected<T extends SelectableRow>(
  visibleKeys: readonly string[],
  edits: Readonly<Record<string, T>>,
): number {
  return visibleKeys.filter((key) => edits[key]?.enabled !== false).length
}

/**
 * Set `enabled` on every visible row, leaving everything else in each edit exactly as it was
 * and leaving rows outside `visibleKeys` untouched.
 *
 * Returns a new record — the caller passes it straight to `setEdits`, so React sees a fresh
 * object and re-renders. `visibleKeys` is read-only, so the preview's own ordering array can
 * never be mutated by a bulk action.
 */
export function applyBulkSelection<T extends SelectableRow>(
  visibleKeys: readonly string[],
  edits: Readonly<Record<string, T>>,
  enabled: boolean,
): Record<string, T> {
  const next: Record<string, T> = { ...edits }
  for (const key of visibleKeys) {
    const current = next[key]
    // A key with no edit yet is not invented here; the preview seeds one for every row it
    // renders, and inventing entries would leave stale keys behind after a filter change.
    if (!current) continue
    if (current.enabled === enabled) continue
    next[key] = { ...current, enabled }
  }
  return next
}

export interface BulkSelectionState {
  /** Visible rows. */
  total: number
  /** Visible rows currently selected. */
  selected: number
  /** "Velg alle" is available: there are rows, and at least one is off. */
  canSelectAll: boolean
  /** "Fjern alle valg" is available: there are rows, and at least one is on. */
  canClearAll: boolean
}

/** Everything the two bulk buttons need to render, derived from the row selection itself. */
export function bulkSelectionState<T extends SelectableRow>(
  visibleKeys: readonly string[],
  edits: Readonly<Record<string, T>>,
): BulkSelectionState {
  const total = visibleKeys.length
  const selected = countSelected(visibleKeys, edits)
  return {
    total,
    selected,
    canSelectAll: total > 0 && selected < total,
    canClearAll: total > 0 && selected > 0,
  }
}
