'use client'

import { useId, useMemo, useState } from 'react'
import {
  CORPORATE_EXAMPLE,
  PARTNER_COMMISSION_PERCENT,
  PARTNER_DISCOUNT_PERCENT,
  calculatePartnerExample,
  formatNok,
  formatPercent,
} from '@/lib/partnerProgram/calculator'
import { CALCULATOR_DISCLAIMER } from '@/lib/partnerProgram/content'
import { BORDER_WARM, CREAM, GOLD, INK, MUTED, OLIVE, PALE_SAGE, SANS, SECTION_PAD, SERIF, SOFT } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import EarningsChart from './EarningsChart'
import OrderBreakdown from './OrderBreakdown'
import { AnimatedNumber, Icon, SectionHeading } from './ui'
import styles from './bliPartner.module.css'

/**
 * The interactive commission calculator.
 *
 * Real state and real arithmetic: every figure on this panel — and every bar in the order
 * breakdown beside it — is `calculatePartnerExample` applied to the three inputs, and its
 * commission step is the real engine (`@/lib/partner/commission`). The partner discount and
 * the commission rate are shown as fixed values, not controls, because they are programme
 * terms.
 *
 * Inputs are held as the strings the visitor typed, so a half-typed number never jumps; the
 * calculation reads them through `parseNumber` and the shared clamping.
 */

/** «50 000», «50000», «1 299,5» → number; anything else → NaN (the calculator then clamps). */
function parseNumber(text: string): number {
  const cleaned = text.replace(/[\s  ]/g, '').replace(',', '.')
  return cleaned === '' ? Number.NaN : Number(cleaned)
}

const SLIDER = {
  orderValue: { min: 500, max: 100_000, step: 500 },
  orders: { min: 1, max: 200, step: 1 },
  corporate: { min: 0, max: 30, step: 1 },
} as const

export default function CommissionCalculator() {
  const [orderValue, setOrderValue] = useState(String(CORPORATE_EXAMPLE.orderValueKr))
  const [orders, setOrders] = useState('1')
  const [corporate, setCorporate] = useState(String(CORPORATE_EXAMPLE.corporateDiscountPercent ?? 0))

  const result = useMemo(
    () =>
      calculatePartnerExample({
        orderValueKr: parseNumber(orderValue),
        orders: parseNumber(orders),
        corporateDiscountPercent: parseNumber(corporate),
      }),
    [orderValue, orders, corporate],
  )
  const { total, input } = result

  return (
    <section
      id="kalkulator"
      aria-labelledby="kalkulator-title"
      style={{ background: CREAM, padding: SECTION_PAD, scrollMarginTop: '90px' }}
    >
      <div className="max-w-container mx-auto px-[clamp(20px,5vw,48px)]">
        <Reveal>
          <SectionHeading
            id="kalkulator-title"
            eyebrow="Provisjonskalkulator"
            title="Regn på ditt eget eksempel"
            intro="Juster ordreverdi, antall ordrer og bedriftsrabatt, og se hvordan rabattene og provisjonen henger sammen."
          />
        </Reveal>

        <div className="mt-[clamp(36px,5vw,56px)] grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* ── inputs + totals ── */}
          <Reveal>
            <div
              style={{
                background: '#fffdf8',
                border: `1px solid ${BORDER_WARM}`,
                borderRadius: '28px',
                padding: 'clamp(24px,3.4vw,40px)',
              }}
            >
              <Field
                label="Opprinnelig ordreverdi"
                hint="Per ordre, før rabatt og uten frakt"
                suffix="kr"
                value={orderValue}
                onChange={setOrderValue}
                slider={SLIDER.orderValue}
                sliderValue={input.orderValueKr}
                formatSlider={(n) => formatNok(n * 100)}
              />
              <Field
                label="Antall ordrer"
                hint="Med partnerkoden din"
                value={orders}
                onChange={setOrders}
                slider={SLIDER.orders}
                sliderValue={input.orders}
                formatSlider={(n) => `${n} ${n === 1 ? 'ordre' : 'ordrer'}`}
              />
              <Field
                label="Bedriftsrabatt"
                hint="Mengderabatt før partnerrabatten, 0 % for vanlige kjøp"
                suffix="%"
                value={corporate}
                onChange={setCorporate}
                slider={SLIDER.corporate}
                sliderValue={input.corporateDiscountPercent}
                formatSlider={(n) => formatPercent(n)}
              />

              <dl className="mt-2 grid grid-cols-2 gap-2.5">
                {[
                  ['Partnerrabatt', formatPercent(PARTNER_DISCOUNT_PERCENT)],
                  ['Provisjon', formatPercent(PARTNER_COMMISSION_PERCENT)],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: PALE_SAGE, borderRadius: '14px', padding: '12px 12px 10px' }}>
                    <dt style={{ fontFamily: SANS, fontSize: '12px', lineHeight: 1.3, color: SOFT }}>
                      {label}
                    </dt>
                    <dd className="flex items-center gap-1.5" style={{ margin: '4px 0 0', fontFamily: SANS, fontWeight: 700, fontSize: '16px', color: INK }}>
                      {value}
                      <Icon name="lock" size={13} color={MUTED} strokeWidth={2} />
                      <span className="sr-only">(fast)</span>
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Totals. One polite live region, so a screen reader hears the result without
                  the focus leaving the control that changed it. */}
              <div
                className="mt-7"
                style={{
                  borderRadius: '22px',
                  padding: 'clamp(20px,2.8vw,28px)',
                  background: `linear-gradient(155deg, #3f4730 0%, ${OLIVE} 60%, #262a1e 100%)`,
                  color: CREAM,
                }}
              >
                <p
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: '11.5px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: GOLD,
                    margin: 0,
                  }}
                >
                  Din provisjon{input.orders > 1 ? ` for ${input.orders} ordrer` : ''}
                </p>
                <p
                  style={{
                    fontFamily: SERIF,
                    fontWeight: 600,
                    fontSize: 'clamp(42px,5vw,60px)',
                    lineHeight: 1.05,
                    margin: '6px 0 16px',
                    color: '#ecdcb8',
                  }}
                >
                  <AnimatedNumber value={total.commissionOere} format={(n) => formatNok(Math.round(n))} duration={0.5} />
                </p>
                <dl className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2" style={{ margin: 0 }}>
                  <div>
                    <dt style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(250,246,238,.72)' }}>Kunden betaler</dt>
                    <dd style={{ margin: '2px 0 0', fontFamily: SANS, fontWeight: 700, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNok(total.customerPaysOere)}
                    </dd>
                  </div>
                  <div>
                    <dt style={{ fontFamily: SANS, fontSize: '13px', color: 'rgba(250,246,238,.72)' }}>ABOKS AS beholder før kostnader</dt>
                    <dd style={{ margin: '2px 0 0', fontFamily: SANS, fontWeight: 700, fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNok(total.retainedOere)}
                    </dd>
                  </div>
                </dl>
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                  {`Provisjon ${formatNok(total.commissionOere)}. Kunden betaler ${formatNok(total.customerPaysOere)}. ABOKS AS beholder ${formatNok(total.retainedOere)} før kostnader.`}
                </p>
              </div>
            </div>
          </Reveal>

          {/* ── per-order breakdown ── */}
          <Reveal delay={0.08}>
            <div
              className="h-full"
              style={{
                background: '#fffdf8',
                border: `1px solid ${BORDER_WARM}`,
                borderRadius: '28px',
                padding: 'clamp(24px,3.4vw,40px)',
              }}
            >
              <OrderBreakdown result={result} />
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div
            className="mt-5"
            style={{
              background: '#fffdf8',
              border: `1px solid ${BORDER_WARM}`,
              borderRadius: '28px',
              padding: 'clamp(24px,3.4vw,40px)',
            }}
          >
            <EarningsChart />
          </div>
        </Reveal>

        <p
          className="mx-auto mt-6 max-w-[78ch] text-center"
          style={{ fontFamily: SANS, fontSize: '13.5px', lineHeight: 1.65, color: SOFT }}
        >
          {CALCULATOR_DISCLAIMER}
        </p>
      </div>
    </section>
  )
}

function Field({
  label,
  hint,
  suffix,
  value,
  onChange,
  slider,
  sliderValue,
  formatSlider,
}: {
  label: string
  hint: string
  suffix?: string
  value: string
  onChange: (value: string) => void
  slider: { min: number; max: number; step: number }
  sliderValue: number
  formatSlider: (n: number) => string
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const clamped = Math.min(Math.max(sliderValue, slider.min), slider.max)
  const fill = ((clamped - slider.min) / (slider.max - slider.min)) * 100

  return (
    <div style={{ marginBottom: '22px' }}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <label htmlFor={id} style={{ fontFamily: SANS, fontWeight: 700, fontSize: '14.5px', color: INK }}>
          {label}
          <span id={hintId} style={{ display: 'block', fontWeight: 500, fontSize: '12.5px', color: MUTED, marginTop: '2px' }}>
            {hint}
          </span>
        </label>
        <span
          className="flex items-center"
          style={{ border: `1px solid ${BORDER_WARM}`, borderRadius: '12px', background: CREAM, paddingRight: suffix ? '12px' : 0 }}
        >
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-describedby={hintId}
            style={{
              width: suffix === 'kr' ? '120px' : '84px',
              padding: '10px 12px',
              border: 'none',
              background: 'transparent',
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: '16px',
              color: INK,
              textAlign: 'right',
              outline: 'none',
              fontVariantNumeric: 'tabular-nums',
            }}
            onBlur={() => {
              // Snap to what was actually calculated, so the field never shows a value the
              // result does not reflect (e.g. «0» orders, or 90 % corporate discount).
              // `sliderValue` is the calculator's normalised input, not the slider's range.
              if (parseNumber(value) !== sliderValue) onChange(String(sliderValue))
            }}
          />
          {suffix && (
            <span aria-hidden="true" style={{ fontFamily: SANS, fontWeight: 600, fontSize: '14px', color: MUTED }}>
              {suffix}
            </span>
          )}
        </span>
      </div>
      <input
        type="range"
        className={`${styles.range} mt-3`}
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={clamped}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label}, glidebryter`}
        aria-valuetext={formatSlider(clamped)}
        style={{ ['--fill' as string]: `${fill}%` } as React.CSSProperties}
      />
    </div>
  )
}
