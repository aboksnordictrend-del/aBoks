'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { formatNok, formatPercent } from '@/lib/partnerProgram/calculator'
import {
  BUSINESS_SALE_COMMISSION_PERCENT,
  METHOD_EXAMPLE_DEFAULTS,
  RETAILER_COMMISSION_PERCENT,
  RETAILER_DISCOUNT_PERCENT,
  calculateBusinessSaleExample,
  calculateRetailerExample,
} from '@/lib/partnerProgram/methodCalculator'
import type { SaleInfo } from '@/lib/pricing'
import { BORDER_WARM, CREAM, GOLD, INK, MUTED, OLIVE, PALE_SAGE, SANS, SERIF, SOFT } from '../bedrifter/theme'
import Reveal from '../historien/Reveal'
import { Field, parseNumber } from './CalculatorField'
import { AnimatedNumber, Icon, SubHeading } from './ui'

/**
 * The calculators for Bedriftssalg and Forhandlersalg.
 *
 * Prices are never typed in here: the product list is the live catalogue (`price` + `sale`
 * from the CMS, resolved on the server), and every figure is `methodCalculator` applied to the
 * visitor's product and quantity — Bedriftssalg through the shop's real quantity tiers,
 * Forhandlersalg through the 35 % retailer discount that replaces them.
 */

export interface CalculatorProduct {
  slug: string
  title: string
  price: number
  sale: SaleInfo | null
}

const QUANTITY_SLIDER = { min: 1, max: 100, step: 1 }
const ORDERS_SLIDER = { min: 1, max: 24, step: 1 }

const units = (n: number) => `${n} stk.`

function pickDefault(products: CalculatorProduct[], slug: string): string {
  return (products.find((p) => p.slug === slug) ?? products[0])?.slug ?? ''
}

/* ────────────────────────────── Bedriftssalg ────────────────────────────── */

export function BusinessSaleCalculator({ products }: { products: CalculatorProduct[] }) {
  const defaults = METHOD_EXAMPLE_DEFAULTS.business
  const [slug, setSlug] = useState(() => pickDefault(products, defaults.slug))
  const [quantity, setQuantity] = useState(String(defaults.quantity))

  const product = products.find((p) => p.slug === slug)
  const result = useMemo(
    () => (product ? calculateBusinessSaleExample(product, parseNumber(quantity)) : null),
    [product, quantity],
  )

  return (
    <CalculatorShell
      id="kalkulator-bedriftssalg"
      eyebrow="Regneeksempel · Bedriftssalg"
      title="Hva kan et bedriftssalg gi?"
      intro="Velg modell og antall. Mengderabatten hentes fra gjeldende priser i nettbutikken, og det gis ingen promokode-rabatt i tillegg."
      empty={!product || !result}
      inputs={
        <>
          <ProductSelect products={products} value={slug} onChange={setSlug} />
          <Field
            label="Antall"
            hint="Stk. av valgt modell i bestillingen"
            suffix="stk."
            value={quantity}
            onChange={setQuantity}
            slider={QUANTITY_SLIDER}
            sliderValue={result?.quantity ?? 1}
            formatSlider={units}
          />
          <FixedRates
            items={[
              ['Promokode-rabatt', 'Gis ikke'],
              ['Provisjon', formatPercent(BUSINESS_SALE_COMMISSION_PERCENT)],
            ]}
          />
        </>
      }
      result={
        result && (
          <ResultCard
            headline="Din provisjon"
            commissionOere={result.commissionOere}
            rows={[
              { label: 'Ordinær pris', note: `${units(result.quantity)} × ${formatNok(result.listUnitOere)}`, value: formatNok(result.ordinaryOere) },
              {
                label: 'Mengderabatt',
                note: result.isVolumeTier
                  ? `${result.tierRange}: ${formatNok(result.paidUnitOere)} per stk.`
                  : 'Ingen mengderabatt ved dette antallet',
                value: result.discountOere > 0 ? `− ${formatNok(result.discountOere)}` : formatNok(0),
              },
              { label: 'Kunden betaler for varene', note: 'uten frakt', value: formatNok(result.paidOere), strong: true },
              { label: `Din provisjon, ${formatPercent(BUSINESS_SALE_COMMISSION_PERCENT)}`, value: formatNok(result.commissionOere), strong: true, accent: true },
              { label: 'ABOKS AS beholder før kostnader', value: formatNok(result.retainedOere) },
            ]}
            live={`Provisjon ${formatNok(result.commissionOere)}. Kunden betaler ${formatNok(result.paidOere)} for varene.`}
            footnote={
              result.quoteOffered && result.quoteThreshold !== null
                ? `Fra ${units(result.quoteThreshold)} kan kunden også be om et eget tilbud. Provisjonen beregnes da av den endelige betalte vareverdien.`
                : 'Provisjonen gjelder ordren du har formidlet, og beregnes av det kunden faktisk betaler for varene.'
            }
          />
        )
      }
    />
  )
}

/* ────────────────────────────── Forhandlersalg ────────────────────────────── */

export function RetailerCalculator({ products }: { products: CalculatorProduct[] }) {
  const defaults = METHOD_EXAMPLE_DEFAULTS.retailer
  const [slug, setSlug] = useState(() => pickDefault(products, defaults.slug))
  const [quantity, setQuantity] = useState(String(defaults.quantity))
  const [orders, setOrders] = useState(String(defaults.orders))

  const product = products.find((p) => p.slug === slug)
  const result = useMemo(
    () => (product ? calculateRetailerExample(product, parseNumber(quantity), parseNumber(orders)) : null),
    [product, quantity, orders],
  )
  const o = result?.perOrder

  return (
    <CalculatorShell
      id="kalkulator-forhandlersalg"
      eyebrow="Regneeksempel · Forhandlersalg"
      title="Hva kan en forhandler gi over tid?"
      intro="Velg modell, antall per bestilling og hvor mange bestillinger forhandleren gjør. Rabatten beregnes av ordinær veiledende utsalgspris – aldri av kampanjepriser – og kombineres ikke med mengderabatt eller andre rabatter."
      empty={!product || !result || !o}
      inputs={
        <>
          <ProductSelect products={products} value={slug} onChange={setSlug} />
          <Field
            label="Antall per bestilling"
            hint="Stk. av valgt modell"
            suffix="stk."
            value={quantity}
            onChange={setQuantity}
            slider={QUANTITY_SLIDER}
            sliderValue={o?.quantity ?? 1}
            formatSlider={units}
          />
          <Field
            label="Antall bestillinger"
            hint="Like store, som illustrasjon"
            value={orders}
            onChange={setOrders}
            slider={ORDERS_SLIDER}
            sliderValue={result?.orders ?? 1}
            formatSlider={(n) => `${n} ${n === 1 ? 'bestilling' : 'bestillinger'}`}
          />
          <FixedRates
            items={[
              ['Forhandlerrabatt', formatPercent(RETAILER_DISCOUNT_PERCENT)],
              ['Provisjon', formatPercent(RETAILER_COMMISSION_PERCENT)],
            ]}
          />
        </>
      }
      result={
        result &&
        o && (
          <ResultCard
            headline={result.orders > 1 ? `Din provisjon for ${result.orders} bestillinger` : 'Din provisjon'}
            commissionOere={result.total.commissionOere}
            rows={[
              { label: 'Ordinær utsalgspris', note: `${units(o.quantity)} × ${formatNok(o.listUnitOere)}, uten kampanjepris`, value: formatNok(o.ordinaryOere) },
              { label: `Forhandlerrabatt ${formatPercent(RETAILER_DISCOUNT_PERCENT)}`, note: 'i stedet for mengderabatt og andre rabatter', value: `− ${formatNok(o.discountOere)}` },
              { label: 'Forhandleren betaler for varene', note: 'per bestilling, uten frakt', value: formatNok(o.paidOere), strong: true },
              { label: `Provisjon per bestilling, ${formatPercent(RETAILER_COMMISSION_PERCENT)}`, value: formatNok(o.commissionOere), strong: true, accent: true },
              { label: 'ABOKS AS beholder før kostnader', note: 'per bestilling', value: formatNok(o.retainedOere) },
            ]}
            live={`Provisjon ${formatNok(result.total.commissionOere)} for ${result.orders} ${result.orders === 1 ? 'bestilling' : 'bestillinger'}.`}
            footnote={`Du får ${formatPercent(RETAILER_COMMISSION_PERCENT)} av hver betalte bestilling fra forhandleren som er registrert på deg – også når forhandleren bestiller direkte fra ABOKS AS – så lenge partneravtalen gjelder.`}
          />
        )
      }
    />
  )
}

/* ────────────────────────────── shared pieces ────────────────────────────── */

function CalculatorShell({
  id,
  eyebrow,
  title,
  intro,
  inputs,
  result,
  empty,
}: {
  id: string
  eyebrow: string
  title: string
  intro: string
  inputs: ReactNode
  result: ReactNode
  empty: boolean
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-[clamp(20px,3vw,36px)]" style={{ scrollMarginTop: '90px' }}>
      <Reveal>
        <SubHeading id={`${id}-title`} eyebrow={eyebrow} title={title} intro={intro} />
      </Reveal>
      {empty ? (
        <p
          className="mt-6"
          style={{
            background: '#fffdf8',
            border: `1px solid ${BORDER_WARM}`,
            borderRadius: '20px',
            padding: '20px 22px',
            fontFamily: SANS,
            fontSize: '15px',
            lineHeight: 1.6,
            color: SOFT,
          }}
        >
          Prisene kunne ikke hentes akkurat nå. Se gjeldende priser på{' '}
          <Link href="/bedrifter" style={{ color: OLIVE, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            siden for bedrifter
          </Link>
          .
        </p>
      ) : (
        <div className="mt-[clamp(24px,3vw,36px)] grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Reveal>
            <div
              style={{
                background: '#fffdf8',
                border: `1px solid ${BORDER_WARM}`,
                borderRadius: '28px',
                padding: 'clamp(24px,3.4vw,40px)',
              }}
            >
              {inputs}
            </div>
          </Reveal>
          <Reveal delay={0.08}>{result}</Reveal>
        </div>
      )}
    </section>
  )
}

function ProductSelect({
  products,
  value,
  onChange,
}: {
  products: CalculatorProduct[]
  value: string
  onChange: (slug: string) => void
}) {
  const id = useId()
  return (
    <div style={{ marginBottom: '22px' }}>
      <label htmlFor={id} style={{ display: 'block', fontFamily: SANS, fontWeight: 700, fontSize: '14.5px', color: INK }}>
        Modell
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full"
        style={{
          minHeight: '48px',
          padding: '10px 14px',
          border: `1px solid ${BORDER_WARM}`,
          borderRadius: '12px',
          background: CREAM,
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: '16px',
          color: INK,
        }}
      >
        {products.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.title}
          </option>
        ))}
      </select>
    </div>
  )
}

function FixedRates({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-2.5" style={{ margin: 0 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ background: PALE_SAGE, borderRadius: '14px', padding: '12px 12px 10px' }}>
          <dt style={{ fontFamily: SANS, fontSize: '12px', lineHeight: 1.3, color: SOFT }}>{label}</dt>
          <dd className="flex items-center gap-1.5" style={{ margin: '4px 0 0', fontFamily: SANS, fontWeight: 700, fontSize: '16px', color: INK }}>
            {value}
            <Icon name="lock" size={13} color={MUTED} strokeWidth={2} />
            <span className="sr-only">(fast)</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

interface ResultRow {
  label: string
  note?: string
  value: string
  strong?: boolean
  accent?: boolean
}

function ResultCard({
  headline,
  commissionOere,
  rows,
  live,
  footnote,
}: {
  headline: string
  commissionOere: number
  rows: ResultRow[]
  live: string
  footnote: string
}) {
  return (
    <div
      className="h-full"
      style={{
        borderRadius: '28px',
        padding: 'clamp(24px,3.4vw,40px)',
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
        {headline}
      </p>
      <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(42px,5vw,60px)', lineHeight: 1.05, margin: '6px 0 18px', color: '#ecdcb8' }}>
        <AnimatedNumber value={commissionOere} format={(n) => formatNok(Math.round(n))} duration={0.5} />
      </p>
      <dl style={{ margin: 0, fontFamily: SANS }}>
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4"
            style={{ padding: '11px 0', borderTop: '1px solid rgba(250,246,238,.14)' }}
          >
            <dt style={{ fontSize: '14.5px', lineHeight: 1.4, fontWeight: row.strong ? 700 : 500, color: row.accent ? '#ecdcb8' : 'rgba(250,246,238,.86)' }}>
              {row.label}
              {row.note && (
                <span style={{ display: 'block', fontWeight: 500, fontSize: '12.5px', color: 'rgba(250,246,238,.62)' }}>{row.note}</span>
              )}
            </dt>
            <dd style={{ margin: 0, fontSize: '15.5px', fontWeight: row.strong ? 700 : 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p style={{ fontFamily: SANS, fontSize: '13px', lineHeight: 1.6, color: 'rgba(250,246,238,.72)', margin: '14px 0 0' }}>
        {footnote}
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {live}
      </p>
    </div>
  )
}
