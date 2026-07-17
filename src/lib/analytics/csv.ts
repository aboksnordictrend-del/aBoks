// CSV serialization for the analytics exports.
//
// Targets Excel (nb-NO): UTF-8 BOM so Excel detects encoding, semicolon delimiter
// (the nb-NO list separator), and comma as decimal separator. Values are quoted and
// internal quotes doubled, so text can never break out into HTML or extra columns.

import { computeOrderFinancials } from './calc'
import type { AnalyticsOrder, ProductRow } from './types'

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

/** Aggregated product/variant sales. */
export function productsCsv(products: ProductRow[]): string {
  const headers = [
    'Produkt', 'Variant', 'Antall', 'Omsetning (brutto)', 'Omsetning (netto)',
    'Kostpris', 'Bruttofortjeneste', 'Margin %', 'Andel av omsetning %', 'Kostpris estimert',
  ]
  const rows = products.map((p) => [
    p.productName,
    p.variantName ?? '',
    p.unitsSold,
    p.revenueGross,
    p.revenueNet,
    p.cost,
    p.grossProfit,
    p.marginPercent,
    p.revenueShare,
    p.costEstimated ? 'ja' : 'nei',
  ])
  return toCsv(headers, rows)
}

/** Per-order financials, no personal data. */
export function ordersCsv(orders: AnalyticsOrder[]): string {
  const headers = [
    'Ordrenummer', 'Dato', 'Status', 'Antall', 'Brutto omsetning', 'Netto omsetning',
    'MVA', 'Vareforbruk', 'Frakt betalt', 'Faktisk fraktkostnad', 'Betalingsgebyr',
    'Bruttofortjeneste', 'Dekningsbidrag',
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
      r.grossProfit,
      r.contributionProfit,
    ])
  return toCsv(headers, rows)
}
