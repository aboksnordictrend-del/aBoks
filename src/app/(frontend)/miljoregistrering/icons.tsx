import { OLIVE } from '../bedrifter/theme'

/**
 * Line icons for /miljoregistrering on a 24×24 grid — the stroke style of the Miljøregistrering
 * teaser on /bedrifter (MiljoregistreringSection.tsx), whose QR, chart and document paths are
 * repeated here.
 */
const PATHS = {
  qr: 'M4 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  document: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
  clipboard: 'M9 4h6v3H9zM9 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15M9 13l2 2 4-4',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 13h8M8 16h5',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10ZM2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M3 21h18M8 7h4M8 11h4M8 15h4',
  landmark: 'M3 21h18M5 21v-9M9.5 21v-9M14.5 21v-9M19 21v-9M2.5 9 12 3l9.5 6z',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6',
  home: 'M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-6h4v6',
  check: 'M20 6 9 17l-5-5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8h.01M11 12h1v5h1',
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 22,
  color = OLIVE,
  strokeWidth = 1.8,
}: {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/** The 48px pale-sage tile the /bedrifter teaser puts its icons in. */
export function IconTile({ name, size = 48, background = '#e6ecdf' }: { name: IconName; size?: number; background?: string }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        background,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon name={name} />
    </span>
  )
}
