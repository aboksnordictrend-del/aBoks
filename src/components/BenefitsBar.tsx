/**
 * Global benefits bar — the warm-beige utility strip that sits directly above the main nav
 * inside the fixed <header>, on every frontend page and at every breakpoint.
 *
 * It replaces the old homepage-only "trust bar", which only existed while the header was
 * transparent over a hero and was hidden below `lg`. This one is always rendered, always
 * solid, and always the same promises.
 *
 * Its height is `--benefits-bar-h` (see globals.css). The same variable pads the <body>,
 * so every page keeps exactly the clearance under the nav row it had before the bar existed —
 * no per-page offsets had to change.
 */

const ITEMS = [
  {
    text: '100 dagers åpent kjøp',
    // Return arrow — a circular arrow closing back on itself.
    icon: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
    /** `justify-self` only bites in the `lg` grid; the mobile flex row ignores it. */
    className: 'inline-flex justify-self-start',
  },
  {
    text: 'Designet i Norge',
    // Leaf.
    icon: (
      <>
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" />
        <path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12" />
      </>
    ),
    // The one item the bar can afford to lose: below `lg` there is only room for the two
    // promises that affect a purchase decision, so this drops out entirely rather than
    // squeezing the other two.
    className: 'hidden lg:inline-flex justify-self-center',
  },
  {
    text: 'Fri frakt over 650 kr',
    // Delivery truck.
    icon: (
      <>
        <path d="M2 5.5h11v10H2z" />
        <path d="M13 9h4l3 3.2v3.3h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
    className: 'inline-flex justify-self-end',
  },
] as const

export default function BenefitsBar() {
  return (
    <div
      style={{
        background: '#f2e7d7',
        borderBottom: '1px solid #ddd2bb',
        height: 'var(--benefits-bar-h)',
      }}
    >
      {/* Two layouts, one markup: a `justify-between` row while the middle item is
          display:none, and three equal columns from `lg` up so the items land on the
          left / centre / right thirds of the same track the nav uses. */}
      <div className="max-w-container mx-auto flex h-full items-center justify-between px-[14px] sm:px-[clamp(20px,5vw,48px)] lg:grid lg:grid-cols-3">
        {ITEMS.map((item) => (
          <span
            key={item.text}
            className={item.className}
            style={{
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-manrope)',
              // Shrinks a touch below ~390px so both promises stay on one line at 320px,
              // and settles at the desktop size from the container width up.
              fontSize: 'clamp(10.5px, 2.9vw, 12.5px)',
              fontWeight: 600,
              letterSpacing: '0.01em',
              color: '#39402c',
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              {item.icon}
            </svg>
            {item.text}
          </span>
        ))}
      </div>
    </div>
  )
}
