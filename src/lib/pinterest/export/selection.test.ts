import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyBulkSelection, bulkSelectionState, countSelected } from './selection'

/** The preview's row-edit shape: the selection flag plus everything the admin can type. */
interface RowEdit {
  enabled: boolean
  title: string
  description: string
  keywords: string
  destinationUrl: string
}

const row = (overrides: Partial<RowEdit> = {}): RowEdit => ({
  enabled: true,
  title: 'aBoks',
  description: 'Fast plass til batteriene.',
  keywords: 'aBoks, batterioppbevaring',
  destinationUrl: 'https://aboks.no/produkter/aboks',
  ...overrides,
})

/** Four rows across all four sources, mirroring the keys the preview builds. */
const KEYS = [
  'product:product:1:image:1',
  'variant:10',
  'homepage:hero',
  'blob:blob:Pinterest/orden-pa-kjokkenet.webp',
]

function edits(enabledFlags: boolean[]): Record<string, RowEdit> {
  return Object.fromEntries(
    KEYS.map((key, i) => [key, row({ enabled: enabledFlags[i] ?? true, title: `Tittel ${i}` })]),
  )
}

describe('countSelected', () => {
  it('counts the selected visible rows', () => {
    assert.equal(countSelected(KEYS, edits([true, true, true, true])), 4)
    assert.equal(countSelected(KEYS, edits([true, false, true, false])), 2)
    assert.equal(countSelected(KEYS, edits([false, false, false, false])), 0)
  })

  it('treats a row with no edit entry as selected', () => {
    assert.equal(countSelected(KEYS, {}), 4)
  })

  it('is zero when nothing is visible', () => {
    assert.equal(countSelected([], edits([true, true, true, true])), 0)
  })

  it('ignores edits for rows that are not visible', () => {
    const withExtra = { ...edits([true, false, false, false]), 'blob:blob:gone.webp': row() }
    assert.equal(countSelected(KEYS, withExtra), 1)
  })
})

describe('Velg alle', () => {
  it('selects every visible row, across all four sources', () => {
    const before = edits([false, false, false, false])
    const after = applyBulkSelection(KEYS, before, true)
    for (const key of KEYS) assert.equal(after[key].enabled, true, key)
    assert.equal(countSelected(KEYS, after), 4)
  })

  it('leaves already-selected rows alone', () => {
    const before = edits([true, false, true, false])
    const after = applyBulkSelection(KEYS, before, true)
    assert.equal(countSelected(KEYS, after), 4)
    // Untouched entries keep their identity, so React skips re-rendering those rows.
    assert.equal(after[KEYS[0]], before[KEYS[0]])
    assert.notEqual(after[KEYS[1]], before[KEYS[1]])
  })

  it('preserves an edited title, description, keywords and destination', () => {
    const edited = {
      [KEYS[0]]: row({
        enabled: false,
        title: 'Redigert tittel æøå',
        description: 'Redigert beskrivelse.',
        keywords: 'egendefinert, nøkkelord',
        destinationUrl: 'https://aboks.no/produkter/aboks-vegg',
      }),
    }
    const after = applyBulkSelection([KEYS[0]], edited, true)
    assert.equal(after[KEYS[0]].enabled, true)
    assert.equal(after[KEYS[0]].title, 'Redigert tittel æøå')
    assert.equal(after[KEYS[0]].description, 'Redigert beskrivelse.')
    assert.equal(after[KEYS[0]].keywords, 'egendefinert, nøkkelord')
    assert.equal(after[KEYS[0]].destinationUrl, 'https://aboks.no/produkter/aboks-vegg')
  })
})

describe('Fjern alle valg', () => {
  it('deselects every visible row', () => {
    const after = applyBulkSelection(KEYS, edits([true, true, true, true]), false)
    for (const key of KEYS) assert.equal(after[key].enabled, false, key)
    assert.equal(countSelected(KEYS, after), 0)
  })

  it('keeps every row in the preview — it deselects, it does not remove', () => {
    const before = edits([true, true, true, true])
    const after = applyBulkSelection(KEYS, before, false)
    assert.deepEqual(Object.keys(after), Object.keys(before))
    assert.equal(Object.keys(after).length, 4)
  })

  it('preserves every edit', () => {
    const edited = {
      [KEYS[1]]: row({
        title: 'Variant-tittel',
        description: 'Variant-beskrivelse.',
        keywords: 'olivengrønn',
        destinationUrl: 'https://aboks.no/produkter/aboks?variant=ABOKS-OLIVE-001',
      }),
    }
    const after = applyBulkSelection([KEYS[1]], edited, false)
    assert.equal(after[KEYS[1]].enabled, false)
    assert.deepEqual(
      { ...after[KEYS[1]], enabled: true },
      { ...edited[KEYS[1]], enabled: true },
      'only `enabled` changed',
    )
  })
})

describe('bulk selection never disturbs the rest of the preview', () => {
  it('does not mutate the input record or the visible-key array', () => {
    const before = edits([true, false, true, false])
    const snapshot = JSON.parse(JSON.stringify(before))
    const keys = [...KEYS]
    applyBulkSelection(keys, before, true)
    assert.deepEqual(before, snapshot, 'the previous state object is untouched')
    assert.deepEqual(keys, KEYS, 'row order is untouched')
  })

  it('preserves key order, so the rendered row order cannot change', () => {
    const before = edits([false, false, false, false])
    const after = applyBulkSelection(KEYS, before, true)
    assert.deepEqual(Object.keys(after), Object.keys(before))
  })

  it('leaves rows outside the visible set completely alone', () => {
    const hidden = 'product:product:9:image:9'
    const before = { ...edits([true, true, true, true]), [hidden]: row({ enabled: false }) }
    const after = applyBulkSelection(KEYS, before, false)
    assert.equal(after[hidden].enabled, false)
    assert.equal(after[hidden], before[hidden])
  })

  it('has no access to the source filters — it only ever writes `enabled`', () => {
    const before = edits([true, true, false, true])
    const after = applyBulkSelection(KEYS, before, true)
    for (const key of KEYS) {
      const { enabled: _a, ...restBefore } = before[key]
      const { enabled: _b, ...restAfter } = after[key]
      assert.deepEqual(restAfter, restBefore, key)
    }
  })
})

describe('button states', () => {
  it('offers both actions on a partly selected list', () => {
    const state = bulkSelectionState(KEYS, edits([true, false, true, false]))
    assert.deepEqual(state, { total: 4, selected: 2, canSelectAll: true, canClearAll: true })
  })

  it('disables "Velg alle" when everything is already selected', () => {
    const state = bulkSelectionState(KEYS, edits([true, true, true, true]))
    assert.equal(state.canSelectAll, false)
    assert.equal(state.canClearAll, true)
  })

  it('disables "Fjern alle valg" when nothing is selected', () => {
    const state = bulkSelectionState(KEYS, edits([false, false, false, false]))
    assert.equal(state.canSelectAll, true)
    assert.equal(state.canClearAll, false)
  })

  it('disables both when there are no rows', () => {
    const state = bulkSelectionState([], {})
    assert.deepEqual(state, { total: 0, selected: 0, canSelectAll: false, canClearAll: false })
  })

  it('flips correctly the moment a bulk action is applied', () => {
    let current = edits([true, false, true, false])
    assert.equal(bulkSelectionState(KEYS, current).canSelectAll, true)

    current = applyBulkSelection(KEYS, current, true)
    assert.equal(bulkSelectionState(KEYS, current).canSelectAll, false, 'all selected')
    assert.equal(bulkSelectionState(KEYS, current).canClearAll, true)

    current = applyBulkSelection(KEYS, current, false)
    assert.equal(bulkSelectionState(KEYS, current).canClearAll, false, 'none selected')
    assert.equal(bulkSelectionState(KEYS, current).canSelectAll, true)
  })
})

describe('download count', () => {
  it('updates immediately after each bulk action', () => {
    let current = edits([true, false, false, false])
    assert.equal(countSelected(KEYS, current), 1)

    current = applyBulkSelection(KEYS, current, true)
    assert.equal(countSelected(KEYS, current), 4, 'Last ned CSV (4)')

    current = applyBulkSelection(KEYS, current, false)
    assert.equal(countSelected(KEYS, current), 0, 'download disabled at 0')
  })

  it('reflects a 52-row preview', () => {
    const keys = Array.from({ length: 52 }, (_, i) => `product:p${i}`)
    const start = Object.fromEntries(keys.map((k) => [k, row({ enabled: false })]))
    assert.equal(countSelected(keys, applyBulkSelection(keys, start, true)), 52)
  })
})

describe('row checkboxes still work after a bulk action', () => {
  it('a single row can be toggled off after Velg alle', () => {
    const afterBulk = applyBulkSelection(KEYS, edits([false, false, false, false]), true)
    // The per-row handler is a plain patch on one key, exactly as before.
    const afterClick = { ...afterBulk, [KEYS[2]]: { ...afterBulk[KEYS[2]], enabled: false } }
    assert.equal(countSelected(KEYS, afterClick), 3)
    assert.equal(bulkSelectionState(KEYS, afterClick).canSelectAll, true)
  })

  it('a single row can be toggled on after Fjern alle valg', () => {
    const afterBulk = applyBulkSelection(KEYS, edits([true, true, true, true]), false)
    const afterClick = { ...afterBulk, [KEYS[0]]: { ...afterBulk[KEYS[0]], enabled: true } }
    assert.equal(countSelected(KEYS, afterClick), 1)
    assert.equal(bulkSelectionState(KEYS, afterClick).canClearAll, true)
  })
})
