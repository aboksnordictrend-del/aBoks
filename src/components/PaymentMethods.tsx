/**
 * The row of payment-method badges under the product page's "Legg i handlekurv"
 * button. Purely informational — it mirrors what Kustom Checkout actually offers
 * and touches no cart or checkout code.
 *
 * Two things must stay in step with the real checkout: the list itself (a badge for
 * a method Kustom does not offer is worse than no badge at all) and each badge's
 * plate. Kustom renders Klarna, Vipps and Mastercard on their brand plate and the
 * rest on a plain white card, so the marks here are stored as bare artwork and the
 * plate colour lives in `plate` below.
 *
 * `border` is never omitted, only recoloured: a badge without one would be a pixel
 * shorter than its neighbours, so a coloured plate simply borders itself.
 */
const WHITE_PLATE = { background: '#fff', border: '#e7e2d4' }

const PAYMENT_METHODS = [
  { name: 'Klarna', file: 'klarna.svg', plate: { background: '#ffb3c7', border: '#ffb3c7' } },
  { name: 'Vipps', file: 'vipps.svg', plate: { background: '#ff5b24', border: '#ff5b24' } },
  { name: 'Visa', file: 'visa.svg', plate: WHITE_PLATE },
  { name: 'Mastercard', file: 'mastercard.svg', plate: { background: '#000', border: '#000' } },
  { name: 'Apple Pay', file: 'apple-pay.svg', plate: WHITE_PLATE },
  { name: 'Google Pay', file: 'google-pay.svg', plate: WHITE_PLATE },
] as const

/**
 * Every badge is the same box, so six very differently proportioned marks (Klarna's
 * wordmark is ~4:1, the Vipps smile ~2.3:1) still read as one even row. The mark
 * inside is `object-fit: contain`, so each keeps its own aspect ratio and only ever
 * scales down.
 *
 * The size is deliberately flat across every breakpoint — this is a quiet trust
 * signal, and a badge that grows with the viewport starts competing with the cart
 * button above it. BADGE_WIDTH is therefore a ceiling, not a target: it is only a
 * flex *basis*, so the six badges shrink together when the column is narrower than
 * the row needs and never grow past it. One centred line survives a 320px phone as
 * well as the wide desktop column — no wrap, no horizontal scroll.
 *
 * The inset is a fixed px pair on purpose: percentage padding would resolve against
 * the row's width, not the badge's, and swallow the badge whole on a phone.
 */
const BADGE_WIDTH = '44px'
const BADGE_ASPECT = '1.5'

export default function PaymentMethods() {
  return (
    <ul
      aria-label="Betalingsmåter"
      style={{
        listStyle: 'none',
        margin: '0 0 22px',
        padding: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 'clamp(4px, 1.5vw, 8px)',
      }}
    >
      {PAYMENT_METHODS.map((method) => (
        <li
          key={method.name}
          style={{
            flex: `0 1 ${BADGE_WIDTH}`,
            maxWidth: BADGE_WIDTH,
            // Without this the flex item's automatic minimum size is its content's
            // min-content width, which beats max-width — an SVG with no width/height
            // attribute reports a 300px default, and a mark that fails to load reports
            // its alt text. Either would blow the row past the column.
            minWidth: 0,
            aspectRatio: BADGE_ASPECT,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 5px',
            background: method.plate.background,
            border: `1px solid ${method.plate.border}`,
            borderRadius: '8px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/images/payment/${method.file}`}
            alt={method.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </li>
      ))}
    </ul>
  )
}
