'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import { catalogueUnitPrice, lineTotalKr, validateQuantity, validateUnitPrice } from '@/lib/orders/manualOrderPricing'
import { decideLinePrice, isStandardPrice, type LineState } from '@/lib/orders/manualOrderForm'
import { fetchProduct, fetchVariant, idOf, productHasVariants, type ProductDoc } from './adminFetch'

/**
 * Price helper under one order line (Payload Admin, manual orders).
 *
 *   • picking a product/variant fills «Enhetspris» with the standard price — the same calculation
 *     checkout charges (sale price and quantity bands included);
 *   • the administrator may type an individual price over it; a quantity change keeps it;
 *   • changing product/variant restores the new standard price, and offers to keep a replaced
 *     individual price;
 *   • «Linjesum» follows unitPrice × quantity.
 *
 * An existing order is never changed by opening it: the component only reacts to edits made after
 * it mounted. The server recalculates and validates everything on save (hooks/orderManualPricing).
 */

type Resolution = { key: string; productKey: string | null; product: ProductDoc | null; error: string | null }

const muted: React.CSSProperties = { color: 'var(--theme-elevation-600)', fontSize: 13 }
const errorStyle: React.CSSProperties = { color: 'var(--theme-error-500)', fontSize: 13 }
const kr = (v: number) => `${v.toLocaleString('nb-NO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`

const OrderLinePricing: UIFieldClientComponent = ({ path }) => {
  const prefix = path.slice(0, path.lastIndexOf('.'))
  const row = useFormFields(([fields]) => ({
    product: fields?.[`${prefix}.product`]?.value,
    variant: fields?.[`${prefix}.variant`]?.value,
    quantity: fields?.[`${prefix}.quantity`]?.value,
  }))
  const unitPrice = useField<number | null>({ path: `${prefix}.unitPrice` })
  const lineTotal = useField<number | null>({ path: `${prefix}.lineTotal` })

  const productId = idOf(row.product)
  const variantId = idOf(row.variant)
  const quantity = typeof row.quantity === 'number' ? row.quantity : null
  const key = `${productId ?? ''}|${variantId ?? ''}`

  const [resolution, setResolution] = useState<Resolution | null>(null)
  const [notice, setNotice] = useState<{ individual: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // What was on screen when the form opened — never acted on.
  const mount = useRef({ key, inputs: `${unitPrice.value ?? ''}|${quantity ?? ''}` })
  const prev = useRef<LineState | null | undefined>(undefined)

  // ── Resolve the product (via the variant's parent) whenever product/variant change ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (productId == null && variantId == null) return { key, productKey: null, product: null, error: null }
      let productKey = productId
      if (variantId != null) {
        const variant = await fetchVariant(variantId)
        if (!variant) return { key, productKey, product: null, error: 'Fant ikke varianten.' }
        const parent = idOf(variant.product)
        if (productId != null && parent !== productId) return { key, productKey, product: null, error: 'Varianten tilhører et annet produkt.' }
        productKey = parent
      } else if (productId != null && (await productHasVariants(productId))) {
        return { key, productKey, product: null, error: 'Velg variant for produktet.' }
      }
      const product = productKey ? await fetchProduct(productKey) : null
      return { key, productKey, product, error: product ? null : 'Fant ikke produktet.' }
    })().then((r) => {
      if (!cancelled) setResolution(r)
    })
    return () => {
      cancelled = true
    }
  }, [key, productId, variantId])

  const catalogue = resolution?.key === key && resolution.product && quantity != null ? catalogueUnitPrice(resolution.product, quantity) : null

  // ── Decide the price on every change made after mounting ──
  useEffect(() => {
    if (resolution?.key !== key) return
    const next: LineState = {
      productKey: resolution.productKey,
      variantKey: variantId,
      quantity,
      unitPrice: typeof unitPrice.value === 'number' ? unitPrice.value : null,
      catalogue,
    }
    if (prev.current === undefined) {
      const openedWithProduct = key === mount.current.key && next.productKey != null
      if (openedWithProduct) {
        // A line that was already there when the form opened: remember it, change nothing.
        prev.current = next
        setError(resolution.error)
        return
      }
      // A new line, or one whose product was changed before the first answer came back: the
      // administrator's choice is a change from «no product».
      prev.current = { ...next, productKey: null, variantKey: null }
    }
    if (resolution.error) {
      setError(resolution.error)
      prev.current = next
      return
    }
    const decision = decideLinePrice(prev.current, next)
    if (decision.kind === 'set') {
      unitPrice.setValue(decision.unitPrice)
      setNotice(decision.replacedIndividual != null ? { individual: decision.replacedIndividual } : null)
      setError(null)
      prev.current = { ...next, unitPrice: decision.unitPrice }
      return
    }
    setError(decision.kind === 'error' ? decision.message : null)
    prev.current = next
  }, [resolution, key, quantity, catalogue])

  // A price typed by hand becomes the line's current price for the next decision.
  useEffect(() => {
    if (prev.current && typeof unitPrice.value === 'number') prev.current = { ...prev.current, unitPrice: unitPrice.value }
  }, [unitPrice.value])

  // ── Linjesum = unitPrice × quantity, only after something was edited ──
  useEffect(() => {
    const inputs = `${unitPrice.value ?? ''}|${quantity ?? ''}`
    if (inputs === mount.current.inputs) return
    mount.current.inputs = '' // from now on every change counts
    if (validateUnitPrice(unitPrice.value) || validateQuantity(quantity)) return
    const total = lineTotalKr(unitPrice.value as number, quantity as number)
    if (lineTotal.value !== total) lineTotal.setValue(total)
  }, [unitPrice.value, quantity])

  const current = typeof unitPrice.value === 'number' ? unitPrice.value : null
  const individual = catalogue != null && current != null && !isStandardPrice({ unitPrice: current, catalogue })
  const priceError = current != null ? validateUnitPrice(current) : null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '-8px 0 16px' }}>
      {error && <span style={errorStyle}>{error}</span>}
      {!error && priceError && <span style={errorStyle}>{priceError}</span>}
      {!error && catalogue != null && !individual && <span style={muted}>Standardpris: {kr(catalogue)}</span>}
      {!error && individual && (
        <>
          <span style={muted}>
            Individuell pris (standardpris {kr(catalogue as number)})
          </span>
          <Button buttonStyle="secondary" size="small" onClick={() => unitPrice.setValue(catalogue)}>
            Bruk standardpris
          </Button>
        </>
      )}
      {notice && (
        <>
          <span style={muted}>Den individuelle prisen {kr(notice.individual)} ble erstattet med standardprisen for nytt produkt.</span>
          <Button
            buttonStyle="secondary"
            size="small"
            onClick={() => {
              unitPrice.setValue(notice.individual)
              setNotice(null)
            }}
          >
            Behold {kr(notice.individual)}
          </Button>
        </>
      )}
    </div>
  )
}

export default OrderLinePricing
