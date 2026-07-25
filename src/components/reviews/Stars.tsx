import { formatRating } from '@/lib/reviews'

/**
 * Read-only star display. Pure/presentational (no hooks) so it renders on the server too.
 * Uses a clip-based half/partial fill so an average like 4,8 shows an accurate bar.
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

  return (
    <span
      role="img"
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', lineHeight: 0 }}
    >
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {/* Empty track */}
        <span style={{ display: 'inline-flex', color: '#d4cebf' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={size} />
          ))}
        </span>
        {/* Filled overlay clipped to the rating fraction */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'inline-flex',
            color: '#e0a92e',
            width: `${(clamped / 5) * 100}%`,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={size} />
          ))}
        </span>
      </span>
      {showValue && (
        <span style={{ fontFamily: 'var(--font-manrope)', fontSize: `${Math.round(size * 0.8)}px`, fontWeight: 700, color: '#1a1d17', lineHeight: 1 }}>
          {formatRating(clamped)}
        </span>
      )}
    </span>
  )
}

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21.5l1.2-6.5L2.5 9.4l6.6-.9z" />
    </svg>
  )
}
