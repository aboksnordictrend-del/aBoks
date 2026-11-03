// TEST-ONLY. Minimal stand-ins for `orders` and `environmental-organizations` used with
// @/lib/testing/payloadRestHarness: the same slugs and the project's REAL access rules — and, for
// orders, the real `businessCustomer` field and its hook — without the rest of each collection's
// schema (customers, products, QR codes, e-mails, stock), which these suites never write.

import type { CollectionConfig } from 'payload'
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
