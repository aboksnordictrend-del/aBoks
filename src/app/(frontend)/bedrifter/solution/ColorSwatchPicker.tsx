'use client'

import { INK } from '../theme'

/** Just enough of a variant to draw and pick a swatch. */
export interface SwatchVariant {
  id: string
  name: string
  colorHex: string
}

/**
 * A light swatch needs a rim to be visible against the cream page at all. Same rule and same
 * threshold the product page applies; kept here rather than imported so this picker does not
 * pull a page component into the bundle, and so the product page stays untouched.
 */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const full = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c
  const r = parseInt(full.substring(0, 2), 16)
  const g = parseInt(full.substring(2, 4), 16)
  const b = parseInt(full.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.65
}

/**
 * The colour swatches, in the product page's visual language: a filled circle per variant,
 * the chosen one ringed. Each product on a solution page has its own picker, so two products
 * never share a selection and never have to offer the same colours.
 */
export default function ColorSwatchPicker({
  variants,
  selectedId,
  onSelect,
  label,
}: {
  variants: SwatchVariant[]
  selectedId: string
  onSelect: (variantId: string) => void
  /** Names the group for a screen reader — "Farge på aBoks Office". */
  label: string
}) {
  if (variants.length === 0) return null

  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}
    >
      {variants.map((variant) => {
        const selected = variant.id === selectedId
        const light = isLightColor(variant.colorHex)
        return (
          <button
            key={variant.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={variant.name}
            title={variant.name}
            onClick={() => onSelect(variant.id)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              background: variant.colorHex,
              boxShadow: selected
                ? `0 0 0 2px #fff, 0 0 0 4px ${INK}${light ? ', inset 0 0 0 1px #c0bdb5' : ''}`
                : light
                  ? '0 0 0 1.5px #b0ada5'
                  : '0 0 0 1px rgba(0,0,0,.18)',
              transition: 'box-shadow 0.2s ease',
              // 40px plus the ring clears the 44px touch target on a phone.
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}
