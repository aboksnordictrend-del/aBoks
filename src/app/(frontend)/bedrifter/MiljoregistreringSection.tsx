'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CHECK_GREEN,
  CREAM,
  INK,
  MUTED,
  OLIVE,
  PALE_SAGE,
  SANS,
  SOFT,
  h2Style,
  introStyle,
  primaryButton,
} from './theme'
import type { useRevealFactory } from './useReveal'

/**
 * aBoks Miljøregistrering, introduced on /bedrifter ahead of the packages.
 *
 * A marketing teaser only: it links to the /miljoregistrering information page and has no
 * connection to the registration app itself (/miljo/[code]).
 */

const iconProps = {
  'aria-hidden': true,
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: OLIVE,
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

function LeafIcon() {
  return (
    <svg {...iconProps} width={16} height={16} stroke={CHECK_GREEN} strokeWidth={2} style={{ flexShrink: 0 }}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}

function QrIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" />
    </svg>
  )
}

const FEATURES = [
  {
    icon: <QrIcon />,
    title: 'Enkel registrering med QR-kode',
    text: 'Ansatte registrerer batterier direkte fra mobilen, uten innlogging.',
  },
  {
    icon: <ChartIcon />,
    title: 'Oversikt og statistikk',
    text: 'Følg utviklingen over tid og se registrerte batterier og faktiske leveranser hver for seg.',
  },
  {
    icon: <DocumentIcon />,
    title: 'Miljørapport i PDF og CSV',
    text: 'Eksporter dokumentasjon som kan brukes i virksomhetens miljøarbeid og som underlag for Miljøfyrtårn-rapportering.',
  },
]

export default function MiljoregistreringSection({
  reveal,
}: {
  reveal: ReturnType<typeof useRevealFactory>
}) {
  return (
    <section
      aria-labelledby="miljoregistrering-heading"
      // No bottom padding: the packages section that follows brings its own top padding.
      style={{ background: CREAM, padding: 'clamp(72px,9vw,120px) 0 0' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <motion.div
          {...reveal()}
          style={{
            background: '#fff',
            border: '1px solid #e7e2d4',
            borderRadius: '24px',
            padding: 'clamp(28px,4.4vw,64px)',
            boxShadow: '0 2px 12px rgba(42,36,24,.05)',
          }}
        >
          <div
            className="grid grid-cols-1 lg:grid-cols-2"
            style={{ columnGap: 'clamp(40px,5vw,80px)', rowGap: 'clamp(32px,4vw,44px)' }}
          >
            <div>
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: '12px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: OLIVE,
                  margin: '0 0 18px',
                }}
              >
                <LeafIcon />
                aBoks Miljøregistrering
              </p>
              <h2 id="miljoregistrering-heading" style={{ ...h2Style, fontSize: 'clamp(30px,3.4vw,46px)' }}>
                Gjør batteriinnsamling til et dokumenterbart miljøtiltak
              </h2>
              <p style={introStyle}>
                Med aBoks Miljøregistrering kan virksomheten samle inn brukte batterier, registrere
                antallet og dokumentere faktiske leveranser.
              </p>
              <p style={{ ...introStyle, margin: '16px 0 0' }}>
                Ansatte registrerer batterier via QR-kode uten innlogging. Virksomheten får tilgang
                til statistikk og rapporter i PDF- og CSV-format, som kan brukes i miljøarbeidet og
                som støttedokumentasjon i forbindelse med Miljøfyrtårn.
              </p>
            </div>

            <ul
              className="lg:self-center"
              style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(22px,2.6vw,30px)' }}
            >
              {FEATURES.map((feature) => (
                <li key={feature.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>
                  <span
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: PALE_SAGE,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </span>
                  <div>
                    <h3
                      style={{
                        fontFamily: SANS,
                        fontWeight: 700,
                        fontSize: '17px',
                        lineHeight: 1.35,
                        color: INK,
                        margin: '2px 0 6px',
                      }}
                    >
                      {feature.title}
                    </h3>
                    <p style={{ fontFamily: SANS, fontSize: '15.5px', lineHeight: 1.6, color: SOFT, margin: 0 }}>
                      {feature.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p
            style={{
              fontFamily: SANS,
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: MUTED,
              margin: 'clamp(32px,4vw,44px) 0 0',
              paddingTop: 'clamp(20px,2.4vw,26px)',
              borderTop: '1px solid rgba(26,29,23,0.09)',
            }}
          >
            aBoks er et hjelpemiddel for miljøarbeid og dokumentasjon, ikke en
            Miljøfyrtårn-sertifisering. Registrerte mengder er egenrapporterte.
          </p>

          <div style={{ marginTop: 'clamp(24px,3vw,32px)' }}>
            <Link
              href="/miljoregistrering"
              data-btn
              className="w-full px-9 sm:w-auto"
              style={primaryButton}
            >
              Se Miljøregistrering
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
