'use client'

import { CALCULATOR_KINDS, CALCULATOR_SOLUTIONS } from '@/lib/bedrifter/calculator/config'
import type { SolutionKind } from '@/lib/bedrifter/calculator/types'
import { BORDER_WARM, INK, MUTED, OLIVE, SANS } from '../theme'

/**
 * The look of one type card. Written once, because the same card is both a choice in the
 * group below and the single badge a page locked to one kind shows — the two must not drift
 * into two slightly different olive cards.
 */
function cardStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '5px',
    textAlign: 'left',
    padding: '16px 18px',
    borderRadius: '18px',
    background: active ? OLIVE : '#fff',
    border: active ? `1.5px solid ${OLIVE}` : `1.5px solid ${BORDER_WARM}99`,
    transition: 'background .2s ease, border-color .2s ease',
  }
}

/** The title and hint inside a type card, in either of the card's two uses. */
function CardBody({ kind, active }: { kind: SolutionKind; active: boolean }) {
  const option = CALCULATOR_SOLUTIONS[kind]
  return (
    <>
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
    </>
  )
}

/**
 * Step one: which kind of workplace this is. Four cards rather than a select, so the choice
 * reads as part of the page.
 *
 * A radio group, so the arrow keys move between the options and a screen reader announces
 * which one is chosen. The selected card is marked by its border, its background *and* a
 * check — never by colour alone.
 *
 * On a page that is already about one kind of workplace — a package page — `fixed` turns the
 * group into that single kind's badge instead. See the prop.
 */
export default function CalculatorTypeSelector({
  selected,
  onSelect,
  fixed = false,
}: {
  selected: SolutionKind | null
  onSelect: (kind: SolutionKind) => void
  /**
   * Show `selected` as a badge rather than offering a choice.
   *
   * A package page is already a page about offices, or about borettslag — there is nothing
   * to pick and nothing to switch to, so the other three kinds are not rendered at all and
   * the one that applies is not a control. It is deliberately *not* a one-option radio
   * group: a radio you cannot change is a worse thing to land on with a keyboard or a
   * screen reader than a plain statement of what the figures below are about.
   */
  fixed?: boolean
}) {
  if (fixed && selected) {
    return (
      // The wrapper, not the badge, is the flex container: that is what keeps the badge at
      // the width of its own text instead of stretching across the whole form.
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <div style={cardStyle(true)}>
          <CardBody kind={selected} active />
        </div>
      </div>
    )
  }

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
              ...cardStyle(active),
              // Stretched by the grid, so all four cards are the height of the tallest.
              height: '100%',
              cursor: 'pointer',
            }}
          >
            <CardBody kind={kind} active={active} />
          </button>
        )
      })}
    </div>
  )
}
