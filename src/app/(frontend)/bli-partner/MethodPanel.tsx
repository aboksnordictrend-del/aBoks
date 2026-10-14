import type { ReactNode } from 'react'
import type { PartnerMethod } from '@/lib/partnerProgram/methods'
import { formatPercent } from '@/lib/partnerProgram/calculator'
import { BORDER_WARM, CREAM, GOLD, INK, OLIVE, SANS, SERIF, SOFT, cardLabelStyle } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { Icon } from './ui'

/**
 * The body of one method tab: what the method is, its key figures, how it works step by step,
 * what the buyer and the partner each get, and the conditions — always shown beside the
 * benefits. Method-specific blocks (worked example, calculator, price tables) follow as
 * `children`.
 *
 * Everything comes from `PARTNER_METHODS`, so the three tabs share one layout and differ only
 * in data.
 */
export default function MethodPanel({ method, children }: { method: PartnerMethod; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ── summary + figures ── */}
        <Reveal style={{ height: '100%' }}>
          <div
            className="relative h-full overflow-hidden"
            style={{
              background: `linear-gradient(155deg, #3f4730 0%, ${OLIVE} 50%, #262a1e 100%)`,
              borderRadius: '28px',
              padding: 'clamp(26px,4vw,48px)',
              color: CREAM,
            }}
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-[300px] w-[300px]"
              viewBox="0 0 340 340"
              fill="none"
            >
              <circle cx="170" cy="170" r="120" stroke={GOLD} strokeOpacity=".22" />
              <circle cx="170" cy="170" r="165" stroke={GOLD} strokeOpacity=".12" />
            </svg>
            <p style={{ ...cardLabelStyle, color: GOLD, margin: 0 }}>Metode {method.number}</p>
            <h3
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: 'clamp(34px,3.6vw,50px)',
                letterSpacing: '-0.02em',
                lineHeight: 1.05,
                margin: '14px 0 0',
              }}
            >
              {method.name}{' '}
              <span style={{ color: '#ecdcb8', whiteSpace: 'nowrap' }}>· {formatPercent(method.rate)}</span>
            </h3>
            <p
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(15.5px,1.3vw,17px)',
                lineHeight: 1.7,
                color: 'rgba(250,246,238,.85)',
                margin: '16px 0 0',
                maxWidth: '58ch',
              }}
            >
              {method.summary}
            </p>
            <dl className="mt-8 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
              {method.figures.map((figure) => (
                <div key={figure.label} style={{ borderTop: '1px solid rgba(250,246,238,.16)', paddingTop: '14px' }}>
                  <dt className="sr-only">{figure.label}</dt>
                  <dd style={{ margin: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: SERIF,
                        fontWeight: 600,
                        fontSize: 'clamp(26px,2.4vw,34px)',
                        lineHeight: 1.05,
                        color: '#ecdcb8',
                      }}
                    >
                      {figure.value}
                    </span>
                    <span
                      aria-hidden="true"
                      style={{ display: 'block', marginTop: '6px', fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.45, color: 'rgba(250,246,238,.72)' }}
                    >
                      {figure.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {/* ── workflow ── */}
        <Reveal delay={0.06} style={{ height: '100%' }}>
          <div
            className="h-full"
            style={{
              background: '#fffdf8',
              border: `1px solid ${BORDER_WARM}`,
              borderRadius: '28px',
              padding: 'clamp(24px,3.4vw,40px)',
            }}
          >
            <h4 style={{ ...cardLabelStyle, margin: '0 0 6px' }}>Slik fungerer det</h4>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {method.steps.map((step, i) => (
                <li
                  key={step.title}
                  className="flex gap-4"
                  style={{ padding: '16px 0', borderTop: i === 0 ? 'none' : `1px solid ${BORDER_WARM}` }}
                >
                  <span
                    className="inline-flex shrink-0 items-center justify-center"
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: i === method.steps.length - 1 ? OLIVE : CREAM,
                      border: `1.5px solid ${i === method.steps.length - 1 ? OLIVE : BORDER_WARM}`,
                      color: i === method.steps.length - 1 ? CREAM : OLIVE,
                      fontFamily: SERIF,
                      fontWeight: 600,
                      fontSize: '17px',
                    }}
                  >
                    <span className="sr-only">Steg </span>
                    {i + 1}
                  </span>
                  <span>
                    <span style={{ display: 'block', fontFamily: SANS, fontWeight: 700, fontSize: '15.5px', lineHeight: 1.35, color: INK }}>
                      {step.title}
                    </span>
                    <span style={{ display: 'block', marginTop: '4px', fontFamily: SANS, fontSize: '14.5px', lineHeight: 1.6, color: SOFT }}>
                      {step.text}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>

      {/* ── benefits, buyer and partner ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <BenefitList label={method.buyerLabel} items={method.buyerBenefits} />
        <BenefitList label="For deg som partner" items={method.partnerBenefits} />
      </div>

      {/* ── conditions ── */}
      <Reveal>
        <ul
          className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-3"
          style={{ listStyle: 'none', margin: 0, padding: '6px 4px 0' }}
        >
          {method.conditions.map((condition) => (
            <li
              key={condition}
              className="flex items-start gap-3"
              style={{ fontFamily: SANS, fontSize: '14px', lineHeight: 1.65, color: SOFT }}
            >
              <span aria-hidden="true" style={{ color: OLIVE, fontWeight: 700, lineHeight: 1.5 }}>
                —
              </span>
              {condition}
            </li>
          ))}
        </ul>
      </Reveal>

      {children}
    </div>
  )
}

function BenefitList({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <Reveal style={{ height: '100%' }}>
      <div
        className="h-full"
        style={{
          background: '#fffdf8',
          border: `1px solid ${BORDER_WARM}`,
          borderRadius: '24px',
          padding: 'clamp(22px,3vw,34px)',
        }}
      >
        <h4 style={{ ...cardLabelStyle, margin: '0 0 4px' }}>{label}</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item, i) => (
            <li
              key={item}
              className="flex items-start gap-3"
              style={{
                borderTop: i === 0 ? 'none' : `1px solid ${BORDER_WARM}`,
                padding: '12px 0',
                fontFamily: SANS,
                fontSize: '15px',
                lineHeight: 1.55,
                color: SOFT,
              }}
            >
              <span style={{ marginTop: '2px' }}>
                <Icon name="check" size={18} color="#5f8253" strokeWidth={2.2} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  )
}
