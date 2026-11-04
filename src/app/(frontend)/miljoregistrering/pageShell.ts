/**
 * Content container of the Miljøregistrering app pages (registrer, bekreft, logg-inn, min-side,
 * glemt-passord, nytt-passord). Use it with an inline `maxWidth`.
 *
 * The fixed header's nav row (80 px: 12 px padding + 56 px logo + 12 px; @/components/Header)
 * overlaps the page — <body> clears only the benefits bar above it. So the top padding is that row
 * plus the visible gap: 24 px on mobile, 32 px from md. The row keeps its height when the header
 * turns solid or hides on scroll.
 */
export const PAGE_SHELL = 'mx-auto px-4 pb-[clamp(40px,7vw,80px)] pt-[104px] md:pt-[112px]'
