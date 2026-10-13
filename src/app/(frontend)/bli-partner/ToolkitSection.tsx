import { TOOLKIT_ITEMS } from '@/lib/partnerProgram/content'
import { BEIGE, BORDER_WARM, CREAM, GOLD, INK, MUTED, OLIVE, PALE_SAGE, SANS, SECTION_PAD, SERIF, SOFT } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { Icon, SectionHeading } from './ui'

/**
 * «Vi gir deg verktøyene du trenger» — what an approved partner can receive.
 *
 * The visual is an abstract mock-up of a toolkit (placeholder lines, no product photography
 * and no real code), so it can never be mistaken for actual material. Nothing physical, no
 * advertising budget and no dedicated contact person is promised.
 */
export default function ToolkitSection() {
  return (
    <section aria-labelledby="verktoy-title" style={{ background: BEIGE, padding: SECTION_PAD }}>
      <div className="max-w-container mx-auto grid grid-cols-1 gap-12 px-[clamp(20px,5vw,48px)] lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <Reveal>
            <SectionHeading
              id="verktoy-title"
              eyebrow="Markedsføringsstøtte"
              title="Vi gir deg verktøyene du trenger"
              intro="Som godkjent partner får du tilgang til materiell som gjør det enkelt å anbefale aBoks – i egne kanaler og med egne ord."
            />
          </Reveal>
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2" style={{ listStyle: 'none', padding: 0 }}>
            {TOOLKIT_ITEMS.map((item, i) => (
              <li key={item.title}>
                <Reveal delay={0.05 * i}>
                  <div className="flex gap-3" style={{ background: '#fffdf8', border: `1px solid ${BORDER_WARM}`, borderRadius: '16px', padding: '16px' }}>
                    <span style={{ marginTop: '2px' }}>
                      <Icon name="check" size={18} color="#5f8253" strokeWidth={2.2} />
                    </span>
                    <span>
                      <span style={{ display: 'block', fontFamily: SANS, fontWeight: 700, fontSize: '15px', color: INK }}>{item.title}</span>
                      <span style={{ display: 'block', marginTop: '3px', fontFamily: SANS, fontSize: '14px', lineHeight: 1.55, color: SOFT }}>{item.text}</span>
                    </span>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <Reveal delay={0.1}>
          <ToolkitMockup />
        </Reveal>
      </div>
    </section>
  )
}

/** Abstract, decorative stack of «materials» — hidden from assistive technology. */
function ToolkitMockup() {
  const line = (width: string, color = BORDER_WARM) => (
    <span style={{ display: 'block', height: '8px', width, borderRadius: '999px', background: color }} />
  )
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-[520px]" style={{ aspectRatio: '1 / 0.92' }}>
      {/* back card: «photos» */}
      <div
        className="absolute"
        style={{ left: '4%', top: '2%', width: '62%', height: '56%', borderRadius: '22px', background: PALE_SAGE, border: `1px solid ${BORDER_WARM}`, transform: 'rotate(-5deg)', padding: '18px' }}
      >
        <div className="grid h-full grid-cols-2 gap-2.5">
          {['#d9e0cf', '#cfd8c2', '#e3e8da', '#c7d1b8'].map((c) => (
            <span key={c} style={{ borderRadius: '12px', background: c }} />
          ))}
        </div>
      </div>
      {/* middle card: «copy» */}
      <div
        className="absolute flex flex-col gap-3"
        style={{ right: '2%', top: '14%', width: '58%', borderRadius: '22px', background: '#fffdf8', border: `1px solid ${BORDER_WARM}`, boxShadow: '0 24px 50px -30px rgba(26,29,23,.35)', padding: '22px', transform: 'rotate(3deg)' }}
      >
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '22px', color: INK }}>Godkjent tekst</span>
        {line('92%')}
        {line('80%')}
        {line('86%')}
        {line('54%')}
      </div>
      {/* front card: the code */}
      <div
        className="absolute"
        style={{ left: '12%', bottom: '2%', width: '70%', borderRadius: '24px', background: `linear-gradient(155deg, #3f4730 0%, ${OLIVE} 60%, #262a1e 100%)`, color: CREAM, padding: '24px', boxShadow: '0 30px 60px -30px rgba(26,29,23,.55)' }}
      >
        <span style={{ display: 'block', fontFamily: SANS, fontWeight: 700, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD }}>
          Din partnerkode
        </span>
        <span
          className="mt-3 inline-flex items-center gap-3"
          style={{ border: '1.5px dashed rgba(250,246,238,.45)', borderRadius: '12px', padding: '10px 16px', fontFamily: SANS, fontWeight: 800, fontSize: '20px', letterSpacing: '0.16em' }}
        >
          ••••••
        </span>
        <span style={{ display: 'block', marginTop: '14px', fontFamily: SANS, fontSize: '13px', color: 'rgba(250,246,238,.75)' }}>
          10 % rabatt for kundene dine
        </span>
        <span style={{ position: 'absolute', right: '22px', top: '22px', fontFamily: SANS, fontSize: '11px', color: MUTED, background: CREAM, borderRadius: '999px', padding: '3px 9px' }}>
          Eksempel
        </span>
      </div>
    </div>
  )
}
