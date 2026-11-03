'use client'

// Reads for the manual-order form, through the REST API as the signed-in staff user — so the
// collections' own access rules apply (Customers: staff; Bedriftskunder: administrators only).
// Results are cached per id for the life of the page; a failed read is not cached.

import type { PricedProductDoc } from '@/lib/orders/manualOrderPricing'
import type { BusinessCustomerDoc, CustomerDoc } from '@/lib/orders/customerInfoAutofill'

const cache = new Map<string, Promise<unknown>>()

function getJson<T>(url: string): Promise<T | null> {
  const hit = cache.get(url)
  if (hit) return hit as Promise<T | null>
  const request = fetch(url, { credentials: 'include', cache: 'no-store' })
    .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null)
    .then((value) => {
      if (value == null) cache.delete(url)
      return value
    })
  cache.set(url, request)
  return request
}

export const idOf = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}

export type ProductDoc = PricedProductDoc & { id: number | string; title?: string | null }

export const fetchProduct = (id: string) => getJson<ProductDoc>(`/api/products/${encodeURIComponent(id)}?depth=0`)

export const fetchVariant = (id: string) =>
  getJson<{ id: number | string; product?: unknown }>(`/api/product-variants/${encodeURIComponent(id)}?depth=0`)

export async function productHasVariants(id: string): Promise<boolean | null> {
  const res = await getJson<{ totalDocs?: number }>(
    `/api/product-variants?where[product][equals]=${encodeURIComponent(id)}&limit=1&depth=0`,
  )
  return res == null ? null : (res.totalDocs ?? 0) > 0
}

export const fetchCustomer = (id: string) => getJson<CustomerDoc>(`/api/customers/${encodeURIComponent(id)}?depth=0`)

export const fetchBusinessCustomer = (id: string) =>
  getJson<BusinessCustomerDoc>(`/api/business-customers/${encodeURIComponent(id)}?depth=0`)
