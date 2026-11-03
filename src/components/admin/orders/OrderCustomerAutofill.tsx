'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, useField, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientComponent } from 'payload'
import {
  CUSTOMER_INFO_FIELDS,
  CUSTOMER_INFO_LABELS,
  customerInfoFromBusinessCustomer,
  customerInfoFromCustomer,
  mergeProposal,
  planAutofill,
  type AutofillPlan,
  type BusinessCustomerDoc,
  type CustomerInfoField,
} from '@/lib/orders/customerInfoAutofill'
import { fetchBusinessCustomer, fetchCustomer, idOf } from './adminFetch'

/**
 * Fills «Kundeinformasjon» when an administrator picks a Kunde and/or Bedriftskunde on an order —
 * before saving. Empty fields are filled at once; a field that already holds something different
 * is only replaced after «Erstatt». The Bedriftskunde wins where it has a value (e-mail).
 *
 * Opening an existing order changes nothing: only a change of the selection made in the form
 * triggers it. The customer records are only read (REST, with the signed-in user's access), never
 * written. See @/lib/orders/customerInfoAutofill for which fields map where.
 */

const muted: React.CSSProperties = { color: 'var(--theme-elevation-600)', fontSize: 13 }

function useInfoField(name: CustomerInfoField) {
  return useField<string | null>({ path: `customerInfo.${name}` })
}

const OrderCustomerAutofill: UIFieldClientComponent = () => {
  const selected = useFormFields(([fields]) => ({
    customer: idOf(fields?.customer?.value),
    business: idOf(fields?.businessCustomer?.value),
  }))
  const info = {
    email: useInfoField('email'),
    firstName: useInfoField('firstName'),
    lastName: useInfoField('lastName'),
    address: useInfoField('address'),
    postalCode: useInfoField('postalCode'),
    city: useInfoField('city'),
    phone: useInfoField('phone'),
  } satisfies Record<CustomerInfoField, ReturnType<typeof useInfoField>>

  const mounted = useRef(`${selected.customer ?? ''}|${selected.business ?? ''}`)
  const [pending, setPending] = useState<AutofillPlan['conflicts']>([])
  const [business, setBusiness] = useState<BusinessCustomerDoc | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The organisation's details, shown for information (the order has no fields for them).
  useEffect(() => {
    let cancelled = false
    if (!selected.business) {
      setBusiness(null)
      return
    }
    fetchBusinessCustomer(selected.business).then((doc) => {
      if (!cancelled) setBusiness(doc)
    })
    return () => {
      cancelled = true
    }
  }, [selected.business])

  useEffect(() => {
    const selection = `${selected.customer ?? ''}|${selected.business ?? ''}`
    if (selection === mounted.current) return
    mounted.current = '' // every later change counts
    let cancelled = false
    ;(async () => {
      const [customerDoc, businessDoc] = await Promise.all([
        selected.customer ? fetchCustomer(selected.customer) : Promise.resolve(null),
        selected.business ? fetchBusinessCustomer(selected.business) : Promise.resolve(null),
      ])
      if (cancelled) return
      if ((selected.customer && !customerDoc) || (selected.business && !businessDoc)) {
        setError('Kunne ikke hente kundedata. Fyll inn kundeinformasjonen manuelt.')
      } else setError(null)
      const proposal = mergeProposal(customerInfoFromCustomer(customerDoc), customerInfoFromBusinessCustomer(businessDoc))
      const current = Object.fromEntries(CUSTOMER_INFO_FIELDS.map((f) => [f, info[f].value]))
      const plan = planAutofill(current, proposal)
      for (const [field, value] of Object.entries(plan.fill) as [CustomerInfoField, string][]) info[field].setValue(value)
      setPending(plan.conflicts)
    })()
    return () => {
      cancelled = true
    }
  }, [selected.customer, selected.business])

  return (
    <div style={{ display: 'grid', gap: 8, margin: '0 0 16px' }}>
      {business && (
        <span style={muted}>
          Bedriftskunde: {String(business.name ?? '')}
          {business.organizationNumber ? ` · org.nr. ${String(business.organizationNumber)}` : ''}
          {business.contactName ? ` · kontaktperson ${String(business.contactName)}` : ''}
        </span>
      )}
      {error && <span style={{ color: 'var(--theme-error-500)', fontSize: 13 }}>{error}</span>}
      {pending.length > 0 && (
        <div style={{ display: 'grid', gap: 6, padding: 12, border: '1px solid var(--theme-warning-500)', borderRadius: 4 }}>
          <strong style={{ fontSize: 13 }}>Kundeinformasjonen har allerede andre verdier:</strong>
          {pending.map((c) => (
            <span key={c.field} style={muted}>
              {CUSTOMER_INFO_LABELS[c.field]}: «{c.current}» → «{c.proposed}»
            </span>
          ))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button
              buttonStyle="primary"
              size="small"
              onClick={() => {
                for (const c of pending) info[c.field].setValue(c.proposed)
                setPending([])
              }}
            >
              Erstatt
            </Button>
            <Button buttonStyle="secondary" size="small" onClick={() => setPending([])}>
              Behold mine verdier
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderCustomerAutofill
