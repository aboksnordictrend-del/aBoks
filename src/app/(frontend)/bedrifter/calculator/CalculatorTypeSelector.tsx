'use client'

import { CALCULATOR_KINDS, CALCULATOR_SOLUTIONS } from '@/lib/bedrifter/calculator/config'
import type { SolutionKind } from '@/lib/bedrifter/calculator/types'
import { BORDER_WARM, INK, MUTED, OLIVE, SANS } from '../theme'

/**
 * Step one: which kind of workplace this is. Four cards rather than a select, so the choice
 * reads as part of the page.
 *
 * A radio group, so the arrow keys move between the options and a screen reader announces
 * which one is chosen. The selected card is marked by its border, its background *and* a
 * check — never by colour alone.
 */
export default function CalculatorTypeSelector({
  selected,
  onSelect,
}: {
  selected: SolutionKind | null
  onSelect: (kind: SolutionKind) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Hva slags virksomhet gjelder det?"
      // Two across from `sm` and no further: inside the calculator's left column four cards
      // would be about 120px wide each, which breaks "Produksjon / lager" over three lines.
      // A 2×2 grid gives every title room to sit on one or two comfortable lines instead.
      className="grid grid-cols-1 sm:grid-cols-2"
      style={{ gap: 'clamp(10px,1.4vw,14px)' }}
    >
      {CALCULATOR_KINDS.map((kind) => {
        const option = CALCULATOR_SOLUTIONS[kind]
        const active = selected === kind
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(kind)}
            className="abx-calc-type"
            style={{
              // Stretched by the grid, so all four cards are the height of the tallest.
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '5px',
              textAlign: 'left',
              padding: '16px 18px',
              borderRadius: '18px',
              cursor: 'pointer',
              background: active ? OLIVE : '#fff',
              border: active ? `1.5px solid ${OLIVE}` : `1.5px solid ${BORDER_WARM}99`,
              transition: 'background .2s ease, border-color .2s ease',
            }}
          >
            <span
              style={{
                display: 'flex',
                // Top-aligned: a title that takes two lines keeps the mark beside its first
                // line rather than centred against the whole block.
                alignItems: 'flex-start',
                gap: '8px',
                fontFamily: SANS,
                fontWeight: 700,
                fontSize: '15px',
                lineHeight: 1.3,
                color: active ? '#faf6ee' : INK,
              }}
            >
              {/* A mark, not just a colour, so the choice survives a colour-blind reading. */}
              <span
                aria-hidden="true"
                style={{
                  fontSize: '12px',
                  lineHeight: 1.6,
                  flexShrink: 0,
                  opacity: active ? 1 : 0.35,
                }}
              >
                {active ? '✓' : '○'}
              </span>
              {/* Breaks at the slash rather than mid-word, and never past the padding. */}
              <span style={{ minWidth: 0, overflowWrap: 'break-word' }}>{option.label}</span>
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '13px',
                lineHeight: 1.45,
                color: active ? '#c8d2c3' : MUTED,
                // Lines up under the title rather than under the mark.
                paddingLeft: '20px',
              }}
            >
              {option.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
