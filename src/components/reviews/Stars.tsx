import { formatRating } from '@/lib/reviews'

const FILLED = '#e0a92e'
const EMPTY = '#d4cebf'
const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21.5l1.2-6.5L2.5 9.4l6.6-.9z'

/**
 * Read-only star display. Pure/presentational (no hooks) so it renders on the server too.
 *
 * Two identical layers of five stars: a grey track and a gold overlay. The overlay is clipped
 * with overflow:hidden on a wrapper — the star row inside keeps `width: max-content` and every
 * icon keeps `flex-shrink: 0`, so clipping cuts the row off instead of squeezing the icons.
 * Both layers use the exact same SVG path, the same width/height and the same gap; only the
 * fill colour differs.
 */
export default function Stars({
  value,
  size = 18,
  showValue = false,
  ariaLabel,
}: {
  value: number
  size?: number
  showValue?: boolean
  ariaLabel?: string
}) {
  const clamped = Math.max(0, Math.min(5, value))
  const label = ariaLabel ?? `${formatRating(clamped)} av 5 stjerner`

  const gap = Math.max(2, Math.round(size * 0.12))
  const trackWidth = size * 5 + gap * 4

  // Clip width in px rather than a flat rating/5 percentage: the gaps are not part of a star,
  // so a percentage of the full track would bleed the fill into the gutters. Whole stars take
  // their icon + gap, the partial star takes its own fraction of one icon width.
  const full = Math.floor(clamped)
  const fraction = clamped - full
  const clipWidth = Math.min(trackWidth, full * (size + gap) + fraction * size)

  return (
    <span
      role="img"
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', lineHeight: 0 }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          display: 'inline-block',
          width: `${trackWidth}px`,
          height: `${size}px`,
          flexShrink: 0,
        }}
      >
        {/* Grey track: five full-size stars */}
        <StarRow size={size} gap={gap} color={EMPTY} />

        {/* Gold overlay: the same five full-size stars, clipped by the wrapper */}
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${clipWidth}px`,
            overflow: 'hidden',
          }}
        >
          <StarRow size={size} gap={gap} color={FILLED} />
        </span>
      </span>

      {showValue && (
        <span
          style={{
            fontFamily: 'var(--font-manrope)',
            fontSize: `${Math.round(size * 0.8)}px`,
            fontWeight: 700,
            color: '#1a1d17',
            lineHeight: 1,
          }}
        >
          {formatRating(clamped)}
        </span>
      )}
    </span>
  )
}

function StarRow({ size, gap, color }: { size: number; gap: number; color: string }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${gap}px`,
        width: 'max-content',
        flexShrink: 0,
      }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} color={color} />
      ))}
    </span>
  )
}

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d={STAR_PATH} />
    </svg>
  )
}
