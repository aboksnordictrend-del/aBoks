// TEST-ONLY. Minimal stand-ins for `orders` and `environmental-organizations` used with
// @/lib/testing/payloadRestHarness: the same slugs and the project's REAL access rules — and, for
// orders, the real `businessCustomer` field and its hook — without the rest of each collection's
// schema (customers, products, QR codes, e-mails, stock), which these suites never write.

import type { CollectionConfig } from 'payload'
import { MILJO_AUTH_CONTEXT } from '@/lib/miljo/business'
import type { RestHarness } from './payloadRestHarness'
import { EnvironmentalOrganizations } from '@/collections/EnvironmentalOrganizations'
import { Orders } from '@/collections/Orders'
import { enforceOrderBusinessCustomer, orderBusinessCustomerField } from '@/collections/hooks/orderBusinessCustomer'

export const OrdersStandIn: CollectionConfig = {
  slug: 'orders',
  access: Orders.access,
  fields: [
    { name: 'orderNumber', type: 'text' },
    { name: 'status', type: 'text' },
    orderBusinessCustomerField,
  ],
  hooks: { beforeChange: [enforceOrderBusinessCustomer] },
}

export const OrganizationsStandIn: CollectionConfig = {
  slug: 'environmental-organizations',
  access: EnvironmentalOrganizations.access,
  fields: [
    { name: 'name', type: 'text' },
    { name: 'publicCode', type: 'text' },
    { name: 'status', type: 'text' },
  ],
}

/** `req.context` of the Miljø sign-in routes — Payload's own `/miljo-accounts/login` refuses without it. */
export const MILJO_LOGIN = { [MILJO_AUTH_CONTEXT]: true }

/** Sign in the way /api/miljo/konto/logg-inn does (Local API + MILJO_LOGIN): `{ status, token?, message? }`. */
export async function miljoLoginOn(h: RestHarness, email: string, password: string): Promise<{ status: number; token?: string; message?: string }> {
  try {
    return { status: 200, token: await h.login('miljo-accounts', email, password, MILJO_LOGIN) }
  } catch (err) {
    return { status: Number((err as { status?: number }).status ?? 500), message: (err as Error).message }
  }
}
