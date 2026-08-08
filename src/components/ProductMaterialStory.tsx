import FraPlanterTilABoksImage from './FraPlanterTilABoksImage'

/**
 * The material story shown on product pages, directly under "Hvorfor aBoks".
 *
 * Deliberately not a client component: it is static markup with no state, no effects and no
 * handlers, so it renders on the server and ships no JavaScript. It is passed into
 * ProductClient as a prop from the server page for exactly that reason — rendering it inside
 * the client component would pull it into the browser bundle for no gain.
 *
 * It carries no links or buttons: the reader is already on the product page and the section
 * is meant to be self-contained.
 */

// Hairline used to separate the process steps — the same value the aBoks Vegg section uses
// on this green band.
const HAIRLINE = 'rgba(57,64,44,0.16)'

const STEPS = [
  {
    number: '01',
    title: 'Plantebaserte råvarer',
    description: 'PLA starter med fornybare råvarer fra planter, i stedet for fossil olje.',
  },
  {
    number: '02',
    title: 'Fra planter til PLA',
    description:
      'Plantebaserte råvarer foredles gjennom flere trinn til PLA – et biobasert materiale.',
  },
  {
    number: '03',
    title: 'PLA Matte filament',
    description:
      'PLA formes til filamentet vi bruker for å gi aBoks sin karakteristiske matte overflate.',
  },
  {
    number: '04',
    title: '3D-printet i Norge',
    description: 'Hver aBoks produseres lokalt i Norge, lag for lag.',
  },
]

export default function ProductMaterialStory() {
  return (
    // Pale sage between the cream of "Hvorfor aBoks" above and the warm beige of the FAQ
    // below: the section reads as its own chapter without introducing a new colour. Padding
    // is the product page's section rhythm, not the homepage's.
    <section
      aria-labelledby="produkt-materialet-heading"
      style={{ background: '#e6ecdf', padding: 'clamp(64px,8vw,104px) 0' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        {/* Centred header at the same width and spacing as the "Hvorfor aBoks" header. */}
        <div style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto clamp(44px,6vw,68px)' }}>
          <p
            style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: '12px',
              letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5e6a48', margin: '0 0 16px',
            }}
          >
            Materialet
          </p>
          <h2
            id="produkt-materialet-heading"
            style={{
              fontFamily: 'var(--font-cormorant)', fontWeight: 500,
              fontSize: 'clamp(30px,3.8vw,48px)', letterSpacing: '-0.02em', lineHeight: 1.07,
              color: '#1a1d17', margin: '0 0 18px',
            }}
          >
            Fra planter til aBoks
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-manrope)', fontSize: '16px', lineHeight: 1.65,
              color: '#3a3f33', margin: 0,
            }}
          >
            3D-printet i Norge av biobasert PLA Matte, laget av plantebaserte råvarer.
          </p>
        </div>

        <FraPlanterTilABoksImage background="#dde3d4" />

        {/* Ordered list: the four steps are a sequence, so the order is carried by the markup
            rather than only by the printed numerals — which are decorative typography here and
            hidden from assistive tech to avoid announcing the position twice.
            One column on phones (four narrow columns would squeeze the copy), two from `sm`,
            four from `lg` where the container is wide enough for the single row. */}
        <ol
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          style={{
            listStyle: 'none',
            margin: 'clamp(44px,6vw,68px) 0 0',
            padding: 0,
            gap: 'clamp(26px,3vw,40px)',
          }}
        >
          {STEPS.map((step) => (
            // A hairline instead of a card keeps this lighter than the feature cards above,
            // which is what separates the two sections visually.
            <li key={step.number} style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: '22px' }}>
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-cormorant)', fontWeight: 400,
                  fontSize: '28px', lineHeight: 1, letterSpacing: '-0.01em',
                  color: '#c9a76a', marginBottom: '16px', display: 'block',
                }}
              >
                {step.number}
              </span>
              <h3
                style={{
                  fontFamily: 'var(--font-manrope)', fontWeight: 700,
                  fontSize: 'clamp(16.5px,1.3vw,18px)', lineHeight: 1.3,
                  color: '#1a1d17', margin: '0 0 10px',
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-manrope)', fontSize: '15px',
                  lineHeight: 1.7, color: '#4a5142', margin: 0,
                }}
              >
                {step.description}
              </p>
            </li>
          ))}
        </ol>

        {/* Editorial closing line, in the same italic serif the aBoks Vegg section uses for
            its subheading. */}
        <p
          style={{
            fontFamily: 'var(--font-cormorant)', fontStyle: 'italic', fontWeight: 500,
            fontSize: 'clamp(19px,1.9vw,25px)', lineHeight: 1.35, letterSpacing: '-0.01em',
            color: '#39402c', textAlign: 'center',
            maxWidth: '620px', margin: 'clamp(44px,6vw,68px) auto 0',
          }}
        >
          Fra fornybare, plantebaserte råvarer til ferdig aBoks – designet og produsert i Norge.
        </p>
      </div>
    </section>
  )
}
