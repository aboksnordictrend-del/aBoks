'use client'

import { useEffect, useRef } from 'react'
import { useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import { sumOrderTotals } from '@/lib/orders/manualOrderPricing'

/**
 * Live «Delsum» and «Totalt» for a manual order: subtotal = Σ Linjesum, total = subtotal + Frakt −
 * the frozen promo discount (0 without one). Recalculated on every line added or removed, every
 * Linjesum change and every change of shipping — but only after the form was edited, so opening an
 * existing order never rewrites its totals. The server recalculates on save
 * (hooks/orderManualPricing).
 */

const LINE_TOTAL = /^items\.(\d+)\.lineTotal$/
const kr = (v: number) => `${v.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`

const OrderTotals: UIFieldClientComponent = () => {
  // A stable signature of every input, so the component re-renders only when one of them changes.
  const signature = useFormFields(([fields]) => {
    const lines = Object.entries(fields ?? {})
      .map(([path, field]) => {
        const match = LINE_TOTAL.exec(path)
        return match ? { index: Number(match[1]), value: field?.value } : null
      })
      .filter((x): x is { index: number; value: unknown } => x != null)
      .sort((a, b) => a.index - b.index)
      .map((x) => (typeof x.value === 'number' ? x.value : 0))
    const shipping = fields?.shipping?.value
    const discount = fields?.['discount.discountAmount']?.value
    return JSON.stringify({ lines, shipping: typeof shipping === 'number' ? shipping : 0, discount: typeof discount === 'number' ? discount : 0 })
  })
  const subtotal = useField<number | null>({ path: 'subtotal' })
  const total = useField<number | null>({ path: 'total' })
  const mounted = useRef(signature)

  const { lines, shipping, discount } = JSON.parse(signature) as { lines: number[]; shipping: number; discount: number }
  const totals = sumOrderTotals(lines, shipping, discount)

  useEffect(() => {
    if (signature === mounted.current) return
    mounted.current = '' // from now on every change counts
    if (subtotal.value !== totals.subtotal) subtotal.setValue(totals.subtotal)
    if (total.value !== totals.total) total.setValue(totals.total)
  }, [signature])

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', margin: '-8px 0 24px', fontSize: 13, color: 'var(--theme-elevation-600)' }}>
      <span>Delsum {kr(totals.subtotal)}</span>
      <span>+ frakt {kr(totals.shipping)}</span>
      {totals.discount > 0 && <span>− rabatt {kr(totals.discount)}</span>}
      <strong style={{ color: 'var(--theme-text)' }}>= Totalt {kr(totals.total)}</strong>
      <span>Alle beløp inkl. MVA.</span>
    </div>
  )
}

export default OrderTotals
