import Image from 'next/image'
import Link from 'next/link'
import Accordion from '@/components/Accordion'
import {
  ANCHOR_OFFSET,
  BEIGE,
  CREAM,
  GOLD,
  INK,
  MUTED,
  OLIVE,
  SANS,
  SECTION_PAD,
  SERIF,
  SOFT,
  eyebrowStyle,
  h2Style,
  introStyle,
  primaryButton,
} from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { SectionHeading } from '../bli-partner/ui'
import { AUDIENCES, DOCUMENTATION, FAQ, FINAL_CTA, INTRO, STEPS } from './content'
import { Icon, IconTile } from './icons'
import styles from './page.module.css'
import demoStyles from './demo/demo.module.css'

/*
 * The server-rendered sections of /miljoregistrering. Type scale, colours and spacing come from
 * the /bedrifter theme module (the shared scale of the business pages); the scroll reveal is the
 * one /historien and /bli-partner use.
 */

const container = 'max-w-container mx-auto px-[clamp(20px,5vw,48px)]'

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e7e2d4',
  borderRadius: '20px',
  padding: 'clamp(22px,2.4vw,30px)',
  boxShadow: '0 2px 12px rgba(42,36,24,.05)',
}

const cardTitle: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: '17px',
  lineHeight: 1.35,
  color: INK,
  margin: '0 0 6px',
}

const cardText: React.CSSProperties = { fontFamily: SANS, fontSize: '15.5px', lineHeight: 1.6, color: SOFT, margin: 0 }

/* ────────────────────────────── 2. Introduction ────────────────────────────── */

export function IntroSection() {
  return (
    <section aria-labelledby="intro-title" style={{ background: CREAM, padding: SECTION_PAD }}>
      <div className={container}>
        <Reveal style={{ maxWidth: '780px' }}>
          <p style={{ ...eyebrowStyle, display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Icon name="leaf" size={16} color="#5f8253" strokeWidth={2} />
            Hva er Miljøregistrering?
          </p>
          <h2 id="intro-title" style={h2Style}>
            {INTRO.title}
          </h2>
          {INTRO.paragraphs.map((p, i) => (
            <p key={i} style={{ ...introStyle, margin: i === 0 ? '22px 0 0' : '14px 0 0' }}>
              {p}
            </p>
          ))}
        </Reveal>
        <ul
          className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
          style={{ listStyle: 'none', margin: 'clamp(36px,4.4vw,56px) 0 0', padding: 0 }}
        >
          {INTRO.benefits.map((b, i) => (
            <li key={b.title}>
              <Reveal delay={i * 0.06} style={{ ...cardStyle, height: '100%' }}>
                <IconTile name={b.icon} />
                <h3 style={{ ...cardTitle, margin: '18px 0 6px' }}>{b.title}</h3>
                <p style={cardText}>{b.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ────────────────────────────── 3. How it works ────────────────────────────── */

export function StepsSection() {
  return (
    <section
      id="slik-fungerer-det"
      aria-labelledby="steps-title"
      style={{ background: BEIGE, padding: SECTION_PAD, scrollMarginTop: ANCHOR_OFFSET }}
    >
      <div className={container}>
        <Reveal>
          <SectionHeading id="steps-title" eyebrow="Tre enkle steg" title={STEPS.title} center />
        </Reveal>
        <ol className={styles.steps} style={{ marginTop: 'clamp(40px,5vw,64px)' }}>
          {STEPS.items.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <Reveal delay={i * 0.08}>
                <div className={styles.stepHead}>
                  <span className={styles.stepNumber} aria-hidden="true">
                    {i + 1}
                  </span>
                  <IconTile name={s.icon} background="#fff" />
                </div>
                <h3 style={{ ...cardTitle, fontSize: '19px' }}>
                  <span className="sr-only">Steg {i + 1}: </span>
                  {s.title}
                </h3>
                <p style={cardText}>{s.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ────────────────────────────── Demo section frame ────────────────────────────── */

/**
 * Heading + photo + interactive block. The block (a client component) arrives as children,
 * so the frame itself stays server-rendered.
 */
export function DemoSection({
  id,
  eyebrow,
  title,
  intro,
  image,
  reverse = false,
  background,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  intro: string
  image?: { src: string; alt: string }
  reverse?: boolean
  background: string
  children: React.ReactNode
}) {
  const titleId = `${id}-title`
  return (
    <section id={id} aria-labelledby={titleId} style={{ background, padding: SECTION_PAD, scrollMarginTop: ANCHOR_OFFSET }}>
      <div className={container}>
        <Reveal style={{ marginBottom: 'clamp(28px,3.6vw,48px)' }}>
          <SectionHeading id={titleId} eyebrow={eyebrow} title={title} intro={intro} />
        </Reveal>
        {image ? (
          <div className={`${demoStyles.split} ${reverse ? demoStyles.splitReverse : ''}`}>
            <div className={demoStyles.photo}>
              <div className={demoStyles.photoInner}>
                <Image src={image.src} alt={image.alt} fill sizes="(min-width: 600px) 560px, 92vw" style={{ objectFit: 'cover' }} />
              </div>
            </div>
            <div className={`${demoStyles.scope} ${demoStyles.formCol}`}>{children}</div>
          </div>
        ) : (
          <div className={demoStyles.scope}>{children}</div>
        )}
      </div>
    </section>
  )
}

/** The note above the first demo: what the demos are, and that nothing is saved. */
export function DemoNotice() {
  return (
    <div style={{ background: CREAM, padding: 'clamp(40px,5vw,64px) 0 0' }}>
      <div className={container}>
        <Reveal
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            padding: '18px 20px',
            borderRadius: '16px',
            border: '1px dashed #d9b77a',
            background: '#fdf8ee',
          }}
        >
          <Icon name="info" color="#8a6a2c" />
          <p style={{ fontFamily: SANS, fontSize: '15px', lineHeight: 1.6, color: SOFT, margin: 0 }}>
            <strong style={{ color: INK }}>Interaktiv demo.</strong> Prøv registrering, levering og statistikk slik de fungerer i
            aBoks Miljøregistrering. Demoen bruker bare fiktive eksempeldata for {'«'}Demo Bedrift AS{'»'} i nettleseren din —
            ingen ekte registreringer eller leveranser opprettes, og ingenting lagres.
          </p>
        </Reveal>
      </div>
    </div>
  )
}

/* ────────────────────────────── 8. Documentation / Miljøfyrtårn ────────────────────────────── */

export function DocumentationSection() {
  return (
    <section aria-labelledby="dokumentasjon-title" style={{ background: OLIVE, padding: SECTION_PAD }}>
      <div className={container}>
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ columnGap: 'clamp(40px,6vw,88px)', rowGap: 'clamp(32px,4vw,48px)', alignItems: 'center' }}
        >
          <Reveal>
            <p style={{ ...eyebrowStyle, color: '#a9c08f' }}>Miljøarbeid og dokumentasjon</p>
            <h2 id="dokumentasjon-title" style={{ ...h2Style, color: CREAM }}>
              {DOCUMENTATION.title}
            </h2>
            <p style={{ ...introStyle, color: '#c8d2c3', maxWidth: '52ch' }}>{DOCUMENTATION.text}</p>
          </Reveal>
          <Reveal delay={0.08}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {DOCUMENTATION.points.map((p) => (
                <li
                  key={p.text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    border: '1px solid rgba(250,246,238,0.22)',
                    background: 'rgba(250,246,238,0.05)',
                    fontFamily: SANS,
                    fontWeight: 600,
                    fontSize: '16px',
                    lineHeight: 1.45,
                    color: CREAM,
                  }}
                >
                  <Icon name={p.icon} color={GOLD} />
                  {p.text}
                </li>
              ))}
            </ul>
            <p
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: 1.6,
                color: '#c8d2c3',
                margin: '22px 0 0',
              }}
            >
              <Icon name="info" size={18} color="#a9c08f" />
              {DOCUMENTATION.disclaimer}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ────────────────────────────── 9. Audiences ────────────────────────────── */

export function AudienceSection() {
  return (
    <section aria-labelledby="malgrupper-title" style={{ background: CREAM, padding: SECTION_PAD }}>
      <div className={container}>
        <Reveal>
          <SectionHeading id="malgrupper-title" eyebrow="Hvem passer det for?" title={AUDIENCES.title} />
        </Reveal>
        <ul
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
          style={{ listStyle: 'none', margin: 'clamp(32px,4vw,52px) 0 0', padding: 0 }}
        >
          {AUDIENCES.items.map((a, i) => (
            <li key={a.title}>
              <Reveal delay={i * 0.05} style={{ ...cardStyle, height: '100%' }}>
                <IconTile name={a.icon} />
                <h3 style={{ ...cardTitle, margin: '18px 0 6px' }}>{a.title}</h3>
                <p style={cardText}>{a.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ────────────────────────────── 10. FAQ ────────────────────────────── */

export function FaqSection() {
  return (
    <section aria-labelledby="faq-title" style={{ background: BEIGE, padding: SECTION_PAD }}>
      <div className={`${container} grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]`}>
        <Reveal>
          <SectionHeading
            id="faq-title"
            eyebrow="Spørsmål og svar"
            title="Ofte stilte spørsmål om aBoks Miljøregistrering"
            intro={
              <>
                Finner du ikke svaret? Se{' '}
                <Link href="/kontakt" style={{ color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                  kontaktsiden
                </Link>
                .
              </>
            }
          />
        </Reveal>
        <Reveal delay={0.06}>
          <Accordion items={FAQ} />
        </Reveal>
      </div>
    </section>
  )
}

/* ────────────────────────────── 11. Final CTA ────────────────────────────── */

export function FinalCtaSection() {
  return (
    <section aria-labelledby="cta-title" style={{ background: CREAM, padding: SECTION_PAD }}>
      <div className={container}>
        <Reveal
          style={{
            borderRadius: '28px',
            background: OLIVE,
            padding: 'clamp(44px,6vw,80px) clamp(24px,5vw,72px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 'clamp(28px,4vw,48px)',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              id="cta-title"
              style={{
                fontFamily: SERIF,
                fontWeight: 500,
                fontSize: 'clamp(30px,3.8vw,50px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.06,
                color: CREAM,
                margin: '0 0 16px',
              }}
            >
              {FINAL_CTA.title}
            </h2>
            <p style={{ fontFamily: SANS, fontSize: '17px', lineHeight: 1.65, color: '#c8d2c3', margin: 0, maxWidth: '48ch' }}>
              {FINAL_CTA.text}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap md:justify-end">
            <Link
              href={FINAL_CTA.primary.href}
              data-btn
              className="w-full px-10 sm:w-auto"
              style={{ ...primaryButton, background: CREAM, color: INK, fontWeight: 700 }}
            >
              {FINAL_CTA.primary.label}
            </Link>
            <Link
              href={FINAL_CTA.secondary.href}
              data-btn
              className="w-full px-8 sm:w-auto"
              style={{
                ...primaryButton,
                background: 'transparent',
                color: CREAM,
                border: '1.5px solid rgba(250,246,238,.45)',
              }}
            >
              {FINAL_CTA.secondary.label}
            </Link>
          </div>
        </Reveal>
        <p style={{ fontFamily: SANS, fontSize: '13px', color: MUTED, textAlign: 'center', margin: '22px 0 0' }}>
          Demoen på denne siden bruker bare fiktive eksempeldata.
        </p>
      </div>
    </section>
  )
}
