'use client'

import { useEffect, useState } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import ReferralCommissionPreviewView, { buildCommissionPreview } from './ReferralCommissionPreviewView'

/**
 * Live commission preview on a referral sale. Reads the form's current values as the administrator
 * types and hands them to `buildCommissionPreview`, which runs the server's own calculation. The
 * only thing fetched is the chosen customer's category (once per customer), because a new sale
 * does not have it until it is saved.
 *
 * Display only: nothing here writes to the form or the database.
 */

const idOf = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}

export default function ReferralCommissionPreview() {
  const { savedDocumentData } = useDocumentInfo()
  const v = useFormFields(([fields]) => ({
    referredCustomer: fields?.referredCustomer?.value,
    commissionEligibility: fields?.commissionEligibility?.value,
    commissionRate: fields?.commissionRate?.value,
    rateOverrideReason: fields?.rateOverrideReason?.value,
    invoicedTotal: fields?.invoicedTotal?.value,
    shippingAmount: fields?.shippingAmount?.value,
    otherExcludedAmount: fields?.otherExcludedAmount?.value,
    vatTreatment: fields?.vatTreatment?.value,
    vatAmount: fields?.vatAmount?.value,
    paymentStatus: fields?.paymentStatus?.value,
    order: fields?.order?.value,
  }))

  const saved = (savedDocumentData ?? {}) as Record<string, unknown>
  const customerId = idOf(v.referredCustomer)
  const savedCustomerId = idOf(saved.referredCustomer)
  // The saved category is valid as long as the customer has not been changed in the form.
  const knownCategory = customerId != null && customerId === savedCustomerId ? saved.category : undefined

  const [fetched, setFetched] = useState<{ id: string; category: unknown } | null>(null)
  const needsFetch = customerId != null && knownCategory == null && fetched?.id !== customerId

  useEffect(() => {
    if (!needsFetch || customerId == null) return
    const controller = new AbortController()
    fetch(`/api/referred-customers/${encodeURIComponent(customerId)}?depth=0`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((doc: { category?: unknown } | null) => setFetched({ id: customerId, category: doc?.category ?? null }))
      .catch(() => {
        if (!controller.signal.aborted) setFetched({ id: customerId, category: null })
      })
    return () => controller.abort()
  }, [customerId, needsFetch])

  const category = knownCategory ?? (fetched?.id === customerId ? fetched.category : undefined)

  const preview = buildCommissionPreview({
    ...v,
    category,
    loadingCustomer: needsFetch,
    savedPaymentStatus: saved.paymentStatus,
    savedCommissionBase: saved.commissionBase,
    savedCommissionAmount: saved.commissionAmount,
    hasOrder: idOf(v.order) != null,
  })

  return <ReferralCommissionPreviewView preview={preview} />
}
