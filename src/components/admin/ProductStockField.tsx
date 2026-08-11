'use client'

import { useEffect, useState } from 'react'
import { useDocumentInfo, useField } from '@payloadcms/ui'

/**
 * The «Lagerbeholdning» input on a Product — shown only for products that have no variants.
 *
 * Why a component rather than `admin.condition`: whether a product has variants is a fact
 * about rows in *another* collection, and a field condition only ever sees the current form's
 * own values. The alternatives are worse — a cached `hasVariants` flag on the product drifts
 * the moment someone adds or deletes a variant, and hiding nothing at all would offer two
 * competing places to type a stock figure. So this asks the API directly, every time the
 * document is opened, and the answer is always current.
 *
 * While the count is unknown nothing is rendered: an input that appears and then disappears
 * is worse than one that appears a moment late, and an admin must never type a number into a
 * field that is about to turn out to be the wrong one. A new product (no id yet) has no
 * variants by definition and gets the input immediately.
 *
 * The rule this enforces visually is enforced for real on the server — see @/lib/stock: a
 * product with variants is priced, sold and decremented from `product-variants.inventory`
 * and its own `stock` column is never read.
 */

interface ProductStockFieldProps {
  /** Supplied by Payload. Always 'stock' here; defaulted so the component is self-contained. */
  path?: string
}

type VariantCountState =
  | { status: 'unknown' }
  | { status: 'none' }
  | { status: 'has-variants'; count: number }

const DESCRIPTION = 'Antall enheter på lager.'
const MANAGED_BY_VARIANTS =
  'Lagerbeholdningen for dette produktet styres på hver fargevariant, under Produktvarianter.'

export default function ProductStockField({ path }: ProductStockFieldProps) {
  const { id } = useDocumentInfo()
  const fieldPath = path ?? 'stock'
  const { value, setValue, showError, errorMessage } = useField<number>({ path: fieldPath })

  const [variants, setVariants] = useState<VariantCountState>(
    // A document that has never been saved cannot have variants pointing at it.
    id ? { status: 'unknown' } : { status: 'none' },
  )

  useEffect(() => {
    if (!id) {
      setVariants({ status: 'none' })
      return
    }

    let cancelled = false
    setVariants({ status: 'unknown' })

    // `limit=1` because only the count matters — Payload returns `totalDocs` regardless, and
    // fetching every variant document to count them would be wasteful.
    fetch(
      `/api/product-variants?where[product][equals]=${encodeURIComponent(String(id))}&limit=1&depth=0`,
      { credentials: 'include' },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((body: unknown) => {
        if (cancelled) return
        const total =
          body && typeof body === 'object' && typeof (body as { totalDocs?: unknown }).totalDocs === 'number'
            ? (body as { totalDocs: number }).totalDocs
            : null
        // A failed or unreadable answer leaves the state unknown, so nothing is rendered.
        // Silently showing the input would invite a stock figure that is never read.
        if (total === null) return
        setVariants(total > 0 ? { status: 'has-variants', count: total } : { status: 'none' })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [id])

  if (variants.status === 'unknown') return null

  if (variants.status === 'has-variants') {
    return (
      <div className="field-type" style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem', opacity: 0.7 }}>
          Lagerbeholdning
        </div>
        <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.7, lineHeight: 1.5 }}>
          {MANAGED_BY_VARIANTS}
        </p>
      </div>
    )
  }

  const inputId = `field-${fieldPath}`

  return (
    <div className={`field-type number${showError ? ' error' : ''}`} style={{ marginBottom: '1rem' }}>
      <label className="field-label" htmlFor={inputId}>
        Lagerbeholdning
      </label>
      <input
        id={inputId}
        name={fieldPath}
        type="number"
        min={0}
        step={1}
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          // An emptied box is "not set", not 0 — @/lib/stock reads both as nothing to sell,
          // and blanking the field must not look like a deliberate write of zero.
          setValue(raw === '' ? null : Number(raw))
        }}
      />
      <div className="field-description" style={{ fontSize: '0.8rem', opacity: 0.7 }}>
        {DESCRIPTION}
      </div>
      {showError && errorMessage ? (
        <div className="field-error" style={{ fontSize: '0.8rem' }}>
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}
