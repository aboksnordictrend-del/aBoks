'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { PROCESS_STEPS } from '@/lib/partnerProgram/content'
import { CREAM, GOLD, INK, OLIVE, SANS, SECTION_PAD, SERIF, SOFT, BORDER_WARM } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { SectionHeading } from './ui'

/**
 * «Slik fungerer det» — the six steps, as a connected horizontal timeline from `lg` and a
 * vertical one below it. The connecting line draws itself as the section scrolls into view;
 * each step then lifts in, in order. Both are static under reduced motion.
 *
 * The steps are an ordered list, so the numbering is real structure, not decoration.
 */
export default function ProcessTimeline() {
  const reduceMotion = useReducedMotion()
  const draw = (axis: 'x' | 'y') => ({
    initial: axis === 'x' ? { scaleX: 0 } : { scaleY: 0 },
    whileInView: axis === 'x' ? { scaleX: 1 } : { scaleY: 1 },
    viewport: { once: true, margin: '-120px' },
    transition: reduceMotion ? { duration: 0 } : { duration: 1.6, ease: [0.65, 0, 0.35, 1] as const },
  })

  return (
    <section
      id="slik-fungerer-det"
      aria-labelledby="prosess-title"
      style={{ background: CREAM, padding: SECTION_PAD, scrollMarginTop: '90px' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <Reveal>
          <SectionHeading
            id="prosess-title"
            eyebrow="Fra søknad til provisjon"
            title="Slik fungerer det"
            center
          />
        </Reveal>

        <div className="relative mt-[clamp(44px,6vw,80px)]">
          {/* Horizontal line, behind the step markers (lg+). */}
          <div
            aria-hidden="true"
            className="absolute hidden lg:block"
            style={{ left: 'calc(100% / 12)', right: 'calc(100% / 12)', top: '27px', height: '2px', background: BORDER_WARM }}
          >
            <motion.div
              {...draw('x')}
              style={{ height: '100%', background: `linear-gradient(90deg, ${OLIVE}, ${GOLD})`, transformOrigin: 'left' }}
            />
          </div>
          {/* Vertical line (below lg). */}
          <div
            aria-hidden="true"
            className="absolute lg:hidden"
            style={{ left: '27px', top: '28px', bottom: '28px', width: '2px', background: BORDER_WARM }}
          >
            <motion.div
              {...draw('y')}
              style={{ width: '100%', height: '100%', background: `linear-gradient(180deg, ${OLIVE}, ${GOLD})`, transformOrigin: 'top' }}
            />
          </div>

          <ol className="relative grid grid-cols-1 gap-9 lg:grid-cols-6 lg:gap-5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {PROCESS_STEPS.map((step, i) => (
              <li key={step.title}>
                <Reveal delay={reduceMotion ? 0 : 0.12 * i} className="flex gap-5 lg:flex-col lg:items-center lg:gap-0 lg:text-center">
                  <span
                    className="relative inline-flex shrink-0 items-center justify-center"
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: i === PROCESS_STEPS.length - 1 ? OLIVE : '#fffdf8',
                      border: `2px solid ${i === PROCESS_STEPS.length - 1 ? OLIVE : BORDER_WARM}`,
                      boxShadow: '0 0 0 6px ' + CREAM,
                      fontFamily: SERIF,
                      fontWeight: 600,
                      fontSize: '22px',
                      color: i === PROCESS_STEPS.length - 1 ? CREAM : OLIVE,
                    }}
                  >
                    <span className="sr-only">Steg </span>
                    {i + 1}
                  </span>
                  <div className="pt-2 lg:pt-6">
                    <h3
                      style={{
                        fontFamily: SANS,
                        fontWeight: 700,
                        fontSize: '16.5px',
                        lineHeight: 1.35,
                        color: INK,
                        margin: '0 0 8px',
                      }}
                    >
                      {step.title}
                    </h3>
                    <p style={{ fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.65, color: SOFT, margin: 0 }}>
                      {step.text}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
