/**
 * Design tokens and the text/button styles the /bedrifter sections share.
 *
 * These are the same values the homepage and the product pages use inline — they live in
 * one module because the page now spans several component files (`BedrifterClient`,
 * `BusinessSolutions`, `SolutionCard`, `SolutionFlow`) and every one of them has to land
 * on exactly the same type scale, colours and spacing.
 */

export const SANS = 'var(--font-manrope)'
export const SERIF = 'var(--font-cormorant)'

export const INK = '#1a1d17'
export const SOFT = '#3a3f33'
export const MUTED = '#6b6f63'
export const SAGE = '#5e6a48'
export const OLIVE = '#39402c'
export const CREAM = '#faf6ee'
export const BEIGE = '#f2e7d7'
export const PALE_SAGE = '#e6ecdf'
export const GOLD = '#c9a76a'
export const BORDER_WARM = '#ddd2bb'
export const CHECK_GREEN = '#5f8253'

export const SECTION_PAD = 'clamp(72px,9vw,120px) 0'
/**
 * Clears the fixed header when an in-page anchor is targeted *without* JavaScript running
 * the scroll — a `/bedrifter#foresporsel` URL opened directly, or a no-JS visit. Clicks
 * inside the page go through `anchorClick`, which measures the header instead of
 * approximating it; see `lib/anchorScroll.ts`.
 */
export const ANCHOR_OFFSET = 'clamp(84px,11vh,110px)'

export const eyebrowStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: '12px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: SAGE,
  margin: '0 0 18px',
}

export const h2Style: React.CSSProperties = {
  fontFamily: SERIF,
  fontWeight: 500,
  fontSize: 'clamp(32px,4vw,52px)',
  letterSpacing: '-0.02em',
  lineHeight: 1.07,
  color: INK,
  margin: 0,
}

export const introStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 'clamp(16px,1.4vw,18px)',
  lineHeight: 1.7,
  color: SOFT,
  margin: '22px 0 0',
  maxWidth: '62ch',
}

/** Small uppercase label used inside the cards ("Passer for", "Dokumenter"). */
export const cardLabelStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: '11.5px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: SAGE,
  margin: '0 0 14px',
}

/** Horizontal padding comes from a class so the two hero buttons can sit side by side on
 *  a narrow phone — the homepage mobile hero uses the same one-row treatment. */
export const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: '17px',
  paddingBottom: '17px',
  borderRadius: '999px',
  background: OLIVE,
  color: CREAM,
  fontFamily: SANS,
  fontWeight: 600,
  fontSize: '15px',
  letterSpacing: '0.01em',
  textDecoration: 'none',
  minHeight: '54px',
}

export const secondaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: '17px',
  paddingBottom: '17px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,.55)',
  color: INK,
  fontFamily: SANS,
  fontWeight: 600,
  fontSize: '15px',
  letterSpacing: '0.01em',
  border: '1.5px solid rgba(26,29,23,.22)',
  textDecoration: 'none',
  minHeight: '54px',
}
