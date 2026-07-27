// CSV serialization for the analytics exports.
//
// Targets Excel (nb-NO): UTF-8 BOM so Excel detects encoding, semicolon delimiter
// (the nb-NO list separator), and comma as decimal separator. Values are quoted and
// internal quotes doubled, so text can never break out into HTML or extra columns.

import { computeOrderFinancials } from './calc'
import { channelLabel } from '../marketingChannels'
import type { MarketingExpenseInput } from './marketing'
import type { AnalyticsOrder, ProductRow } from './types'

interface CsvPeriod {
  from: string
  to: string
}

const BOM = '﻿'
const DELIM = ';'

function cell(value: string | number): string {
  if (typeof value === 'number') {
    // nb-NO decimal comma; keep it plain so Excel parses it as a number.
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
  }
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(cell).join(DELIM)]
  for (const row of rows) lines.push(row.map(cell).join(DELIM))
  return BOM + lines.join('\r\n') + '\r\n'
}

/** Aggregated sales, one row per variant (with its parent product), plus the period. */
export function productsCsv(products: ProductRow[], period: CsvPeriod): string {
  const from = period.from.slice(0, 10)
  const to = period.to.slice(0, 10)
  const headers = [
    'Produkt-ID', 'Produkt', 'Variant-ID', 'Variantnavn', 'Farge',
    'Ordre', 'Antall', 'Omsetning inkl. MVA', 'Omsetning eks. MVA',
    'Kostpris', 'Bruttofortjeneste', 'Margin %', 'Andel av omsetning %',
    'Kostpris estimert', 'Periode fra', 'Periode til',
  ]
  const rows: (string | number)[][] = []
  for (const p of products) {
    for (const v of p.variants) {
      rows.push([
        p.productId ?? '',
        p.productName,
        v.variantId ?? '',
        v.displayName,
        v.variantName,
        v.orderCount,
        v.unitsSold,
        v.revenueGross,
        v.revenueNet,
        v.cost,
        v.grossProfit,
        v.marginPercent,
        v.revenueShare,
        v.costEstimated ? 'ja' : 'nei',
        from,
        to,
      ])
    }
  }
  return toCsv(headers, rows)
}

/** Marketing expenses touching the period (one row per record, not pro-rated). */
export function marketingCsv(expenses: MarketingExpenseInput[]): string {
  const headers = [
    'Dato', 'Periode fra', 'Periode til', 'Kanal', 'Beløp inkl. MVA',
    'MVA-sats', 'Beløp eks. MVA', 'Beskrivelse', 'Referanse',
  ]
  const rows = [...expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((e) => [
      e.date.slice(0, 10),
      e.periodFrom ? e.periodFrom.slice(0, 10) : '',
      e.periodTo ? e.periodTo.slice(0, 10) : '',
      channelLabel(e.channel),
      e.amount ?? 0,
      e.vatRate ?? 0,
      e.amountExVat,
      e.description ?? '',
      e.externalReference ?? '',
    ])
  return toCsv(headers, rows)
}

/** Per-order financials, no personal data. */
export function ordersCsv(orders: AnalyticsOrder[]): string {
  // Existing columns keep their names, order and meaning. Four promo columns are appended at
  // the end so any saved spreadsheet or filter that referenced a column position still works.
  // `Brutto omsetning` is, and has always been, what the customer actually paid — for a
  // discounted order that is now the post-discount amount, matching the stored order total.
  const headers = [
    'Ordrenummer', 'Dato', 'Status', 'Antall', 'Brutto omsetning', 'Netto omsetning',
    'MVA', 'Vareforbruk', 'Frakt betalt', 'Faktisk fraktkostnad', 'Betalingsgebyr',
    'Ekstra kostnader', 'Bruttofortjeneste', 'Dekningsbidrag',
    'Rabattkode', 'Rabatt', 'Omsetning før rabatt', 'Margin %',
  ]
  const rows = orders
    .map(computeOrderFinancials)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((r) => [
      r.orderNumber,
      r.date.slice(0, 10),
      r.status,
      r.unitsSold,
      r.revenueGross,
      r.revenueNet,
      r.vatAmount,
      r.productCost,
      r.shippingCharged,
      r.actualShippingCost,
      r.paymentFee,
      r.extraCosts,
      r.grossProfit,
      r.contributionProfit,
      // Blank and 0 for an order without a promo, per the sheet's existing conventions.
      r.promoCode,
      r.discountAmount,
      r.revenueBeforeDiscount,
      // Margin on the revenue actually received; 0 rather than Infinity/NaN at zero revenue.
      r.revenueNet > 0 ? Math.round((r.grossProfit / r.revenueNet) * 10000) / 100 : 0,
    ])
  return toCsv(headers, rows)
}
