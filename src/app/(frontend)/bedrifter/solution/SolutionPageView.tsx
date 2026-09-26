'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { anchorClick } from '@/lib/anchorScroll'
import {
  BUSINESS_SOLUTIONS,
  solutionHref,
  type BusinessSolution,
} from '@/lib/bedrifterSolutions'
import type { ConfigurableProduct, SolutionPageContent } from '@/lib/solutions/types'
import InquiryForm from '../InquiryForm'
import SolutionFlow from '../SolutionFlow'
import SolutionConfigurator from './SolutionConfigurator'
import {
  ANCHOR_OFFSET,
  BEIGE,
  BORDER_WARM,
  CREAM,
  GOLD,
  INK,
  MUTED,
  OLIVE,
  PALE_SAGE,
  SANS,
  SECTION_PAD,
  SERIF,
  SOFT,
  eyebrowStyle,
  h2Style,
  introStyle,
  primaryButton,
  secondaryButton,
} from '../theme'
import { useRevealFactory } from '../useReveal'

/** A place name, as a tag. Shared by both placement layouts. */
const placementTagStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: '14px',
  fontWeight: 600,
  color: '#4a4e41',
  border: `1px solid ${BORDER_WARM}`,
  borderRadius: '999px',
  padding: '9px 18px',
  background: 'rgba(255,255,255,.6)',
}

const placementNoteStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '16px',
  fontFamily: SERIF,
  fontStyle: 'italic',
  fontWeight: 500,
  fontSize: 'clamp(18px,1.9vw,23px)',
  lineHeight: 1.4,
  color: OLIVE,
  margin: 'clamp(26px,3vw,36px) 0 0',
  maxWidth: '46ch',
}

const placementNoteRuleStyle: React.CSSProperties = {
  width: '26px',
  height: '1.5px',
  background: GOLD,
  flexShrink: 0,
  marginTop: '15px',
}

/**
 * A complete solution page — hero, how it works, where it fits, the configurator, the
 * benefits and the inquiry form.
 *
 * Everything on it comes from the solution's content module and from the live catalogue, so
 * the three remaining packages need a content module and nothing else. The design follows
 * /bedrifter: the same tokens, the same section rhythm and the same reveal.
 */
export default function SolutionPageView({
  solution,
  content,
  products,
}: {
  solution: BusinessSolution
  content: SolutionPageContent
  /** The configurator's products, resolved from Payload. Empty hides the configurator. */
  products: ConfigurableProduct[]
}) {
  const reveal = useRevealFactory()

  // The form opens already naming this solution: the dropdown preset, and a message saying
  // what the inquiry is about. Both are starting points the customer can edit freely.
  const [interest, setInterest] = useState(content.inquiry.interestOption)
  const [message, setMessage] = useState(content.inquiry.message)
  /** The last message this page wrote into the form — see `requestQuote`. */
  const presetMessage = useRef(content.inquiry.message)

  /**
   * "Be om tilbud" — presets the form and takes over the scroll to it. Anything the customer
   * has typed is left alone: the message is only written when the field is empty or still
   * holds a preset this page put there.
   */
  const requestQuote = anchorClick('foresporsel', () => {
    setInterest(content.inquiry.interestOption)
    const next = content.inquiry.message
    setMessage((current) => (current === '' || current === presetMessage.current ? next : current))
    presetMessage.current = next
  })

  const otherSolutions = BUSINESS_SOLUTIONS.filter((s) => s.slug !== solution.slug)
  const illustration = solution.illustration
  const roles = content.placement.roles

  /** The placement heading, in whichever of the two layouts the section takes. */
  const placementIntro = (
    <>
      <p style={eyebrowStyle}>Tilpasses lokalene</p>
      <h2 id="plassering-heading" style={h2Style}>
        {content.placement.heading}
      </h2>
      <p style={introStyle}>{content.placement.intro}</p>
    </>
  )

  return (
    <main>
      {/* ==================== HERO ==================== */}
      <section
        aria-labelledby="losning-heading"
        style={{
          background: CREAM,
          paddingTop: 'clamp(104px,13vh,150px)',
          paddingBottom: 'clamp(56px,7vw,96px)',
        }}
      >
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.nav
            {...reveal()}
            aria-label="Brødsmuler"
            style={{
              fontFamily: SANS,
              fontSize: '13.5px',
              color: MUTED,
              marginBottom: 'clamp(22px,3vw,34px)',
            }}
          >
            <Link href="/bedrifter" style={{ color: MUTED, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              For bedrifter
            </Link>
            <span aria-hidden="true" style={{ padding: '0 8px' }}>
              ·
            </span>
            <span style={{ color: SOFT }}>{content.title}</span>
          </motion.nav>

          <div
            className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr]"
            style={{
              columnGap: 'clamp(32px,4.5vw,72px)',
              rowGap: 'clamp(28px,4vw,44px)',
              alignItems: 'center',
            }}
          >
            <motion.div {...reveal()}>
              <p style={eyebrowStyle}>{content.eyebrow}</p>
              <h1
                id="losning-heading"
                style={{
                  fontFamily: SERIF,
                  fontWeight: 500,
                  fontSize: 'clamp(34px,4.4vw,56px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.06,
                  color: INK,
                  margin: 0,
                }}
              >
                {content.title}
              </h1>
              <p
                style={{
                  fontFamily: SERIF,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 'clamp(21px,2.2vw,30px)',
                  lineHeight: 1.25,
                  color: OLIVE,
                  margin: '14px 0 0',
                }}
              >
                {content.headline}
              </p>
              <p style={introStyle}>{content.ingress}</p>

              <div className="mt-[clamp(28px,3.4vw,40px)] flex flex-wrap gap-3">
                {products.length > 0 && (
                  <a
                    href="#konfigurer"
                    data-btn
                    onClick={anchorClick('konfigurer')}
                    className="w-full justify-center px-9 sm:w-auto"
                    style={primaryButton}
                  >
                    Tilpass løsningen
                  </a>
                )}
                <a
                  href="#foresporsel"
                  data-btn
                  onClick={requestQuote}
                  className="w-full justify-center px-8 sm:w-auto"
                  style={secondaryButton}
                >
                  Be om tilbud
                </a>
              </div>
            </motion.div>

            {/* The solution's own illustration, the one the card on /bedrifter uses. */}
            {illustration && (
              <motion.div
                {...reveal(0.08)}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <Image
                  src={illustration.src}
                  alt={illustration.alt ?? solution.plannedIllustration}
                  fill
                  priority
                  sizes="(max-width: 1023px) 100vw, 56vw"
                  style={{ objectFit: 'contain' }}
                />
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section aria-labelledby="slik-fungerer-heading" style={{ background: BEIGE, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '720px', marginBottom: 'clamp(40px,5vw,64px)' }}>
            <p style={eyebrowStyle}>{content.steps.eyebrow ?? 'Slik henger det sammen'}</p>
            <h2 id="slik-fungerer-heading" style={h2Style}>
              {content.steps.heading}
            </h2>
            {content.steps.intro && <p style={introStyle}>{content.steps.intro}</p>}
          </motion.div>

          <SolutionFlow reveal={reveal} steps={content.steps.items} />
        </div>
      </section>

      {/* ==================== PLACEMENT ====================
          Two shapes from the same content: a solution whose products all do the same job
          lists the rooms it suits, while one whose products have distinct roles gives each
          product its own card. Which one is a property of the content, not of the slug. */}
      <section aria-labelledby="plassering-heading" style={{ background: CREAM, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          {roles ? (
            <>
              <motion.div {...reveal()} style={{ maxWidth: '760px', marginBottom: 'clamp(36px,4.5vw,56px)' }}>
                {placementIntro}
              </motion.div>

              <ul
                className="grid grid-cols-1 md:grid-cols-3"
                style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'clamp(18px,2.2vw,26px)' }}
              >
                {roles.map((role, i) => (
                  <motion.li
                    key={role.product}
                    {...reveal(i * 0.06)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: 'clamp(22px,2.6vw,30px)',
                      background: '#fff',
                      border: `1px solid ${BORDER_WARM}99`,
                      borderRadius: '22px',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: SANS,
                        fontWeight: 700,
                        fontSize: '11.5px',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: '#5e6a48',
                        margin: 0,
                      }}
                    >
                      {role.product}
                    </p>
                    <h3
                      style={{
                        fontFamily: SERIF,
                        fontWeight: 500,
                        fontSize: 'clamp(21px,2.1vw,26px)',
                        letterSpacing: '-0.015em',
                        lineHeight: 1.15,
                        color: INK,
                        margin: '12px 0 0',
                      }}
                    >
                      {role.label}
                    </h3>
                    <p
                      style={{
                        fontFamily: SANS,
                        fontSize: '15px',
                        lineHeight: 1.65,
                        color: SOFT,
                        margin: '12px 0 0',
                      }}
                    >
                      {role.text}
                    </p>
                    <ul
                      style={{
                        listStyle: 'none',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        margin: 'clamp(18px,2vw,22px) 0 0',
                        padding: 0,
                      }}
                    >
                      {role.locations.map((location) => (
                        <li key={location} style={placementTagStyle}>
                          {location}
                        </li>
                      ))}
                    </ul>
                  </motion.li>
                ))}
              </ul>

              {content.placement.note && (
                <motion.p {...reveal(0.1)} style={placementNoteStyle}>
                  <span aria-hidden="true" style={placementNoteRuleStyle} />
                  {content.placement.note}
                </motion.p>
              )}
            </>
          ) : (
            <div
              className="grid grid-cols-1 lg:grid-cols-2"
              style={{ columnGap: 'clamp(40px,6vw,88px)', rowGap: 'clamp(28px,4vw,40px)' }}
            >
              <motion.div {...reveal()}>{placementIntro}</motion.div>

              <motion.div {...reveal(0.08)}>
                <ul
                  style={{
                    listStyle: 'none',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    margin: 0,
                    padding: 0,
                  }}
                >
                  {(content.placement.items ?? []).map((item) => (
                    <li key={item} style={placementTagStyle}>
                      {item}
                    </li>
                  ))}
                </ul>

                {content.placement.note && (
                  <p style={placementNoteStyle}>
                    <span aria-hidden="true" style={placementNoteRuleStyle} />
                    {content.placement.note}
                  </p>
                )}
              </motion.div>
            </div>
          )}
        </div>
      </section>

      {/* ==================== CONFIGURATOR ====================
          Hidden entirely if the catalogue could not be read — the page then still explains
          the solution and still takes an inquiry, rather than showing an empty configurator. */}
      {products.length > 0 && (
        <SolutionConfigurator
          content={content.configurator}
          products={products}
          onQuoteRequest={requestQuote}
        />
      )}

      {/* ==================== BENEFITS ==================== */}
      <section aria-labelledby="fordeler-heading" style={{ background: OLIVE, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '720px', marginBottom: 'clamp(36px,4.5vw,56px)' }}>
            <p style={{ ...eyebrowStyle, color: '#a9c08f' }}>Fordeler</p>
            <h2 id="fordeler-heading" style={{ ...h2Style, color: CREAM }}>
              {content.benefits.heading}
            </h2>
            {content.benefits.intro && (
              <p style={{ ...introStyle, color: '#c8d2c3' }}>{content.benefits.intro}</p>
            )}
          </motion.div>

          <ul
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'clamp(20px,2.6vw,30px)' }}
          >
            {content.benefits.items.map((benefit, i) => (
              <motion.li
                key={benefit.title}
                {...reveal(i * 0.06)}
                style={{
                  padding: 'clamp(22px,2.6vw,30px)',
                  borderRadius: '20px',
                  background: 'rgba(250,246,238,.07)',
                  border: '1px solid rgba(250,246,238,.14)',
                }}
              >
                <h3
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: '17px',
                    lineHeight: 1.35,
                    color: CREAM,
                    margin: '0 0 10px',
                  }}
                >
                  {benefit.title}
                </h3>
                <p
                  style={{
                    fontFamily: SANS,
                    fontSize: '15px',
                    lineHeight: 1.65,
                    color: '#c8d2c3',
                    margin: 0,
                  }}
                >
                  {benefit.text}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* ==================== INQUIRY ==================== */}
      <section
        id="foresporsel"
        aria-labelledby="foresporsel-heading"
        style={{ background: PALE_SAGE, padding: SECTION_PAD, scrollMarginTop: ANCHOR_OFFSET }}
      >
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <motion.div {...reveal()} style={{ marginBottom: 'clamp(30px,4vw,44px)' }}>
              <p style={eyebrowStyle}>Uforpliktende</p>
              <h2 id="foresporsel-heading" style={h2Style}>
                {content.inquiry.heading}
              </h2>
              <p style={introStyle}>{content.inquiry.intro}</p>
            </motion.div>

            {/* The one B2B form the site has, with its own endpoint — reused as it is. */}
            <InquiryForm
              interest={interest}
              onInterestChange={setInterest}
              message={message}
              onMessageChange={setMessage}
            />
          </div>
        </div>
      </section>

      {/* ==================== OTHER SOLUTIONS ==================== */}
      <section aria-labelledby="andre-losninger-heading" style={{ background: CREAM, padding: SECTION_PAD }}>
        <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
          <motion.div {...reveal()} style={{ maxWidth: '720px', marginBottom: 'clamp(32px,4vw,48px)' }}>
            <p style={eyebrowStyle}>Flere bedriftsløsninger</p>
            <h2 id="andre-losninger-heading" style={{ ...h2Style, fontSize: 'clamp(28px,3.4vw,44px)' }}>
              Andre løsninger fra aBoks.
            </h2>
          </motion.div>

          <ul
            className="grid grid-cols-1 md:grid-cols-3"
            style={{ listStyle: 'none', margin: 0, padding: 0, gap: 'clamp(18px,2.2vw,26px)' }}
          >
            {otherSolutions.map((other, i) => (
              <motion.li key={other.slug} {...reveal(i * 0.06)}>
                <Link
                  href={solutionHref(other)}
                  data-btn
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    padding: 'clamp(22px,2.6vw,30px)',
                    background: '#fff',
                    border: `1px solid ${BORDER_WARM}99`,
                    borderRadius: '22px',
                    textDecoration: 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: '11.5px',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#5e6a48',
                    }}
                  >
                    {other.category}
                  </span>
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontWeight: 500,
                      fontSize: 'clamp(21px,2.1vw,26px)',
                      letterSpacing: '-0.015em',
                      lineHeight: 1.15,
                      color: INK,
                      margin: '12px 0 0',
                    }}
                  >
                    {other.name}
                  </span>
                  <span
                    style={{
                      fontFamily: SANS,
                      fontWeight: 600,
                      fontSize: '14px',
                      color: OLIVE,
                      marginTop: 'auto',
                      paddingTop: '18px',
                    }}
                  >
                    Se løsningen →
                  </span>
                </Link>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
