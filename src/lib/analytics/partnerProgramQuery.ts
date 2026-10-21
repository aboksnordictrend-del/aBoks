// The database half of the partner-programme analytics. All decisions live in
// `./partnerProgram.ts`; this file only reads rows and maps them to plain inputs.
//
// Seven queries, whatever the number of partners, codes or sales — never one per row:
//
//   1. partners                      (name, status, type only — no contact or bank data)
//   2. partner promo-code usages     (all history: balances need it)
//   3. the statuses of the orders those usages point at (one `in` query, status only)
//   4. the promo codes the usages and payouts point at (labels and partner link only)
//   5. partner payouts
//   6. referral sales
//   7. referral commission adjustments
//
// Read-only. Personal data (customer e-mail on usages, partner contact/bank details) is never
// selected.

import type { Payload } from 'payload'
import type { PartnerProgramData } from './partnerProgram'

/** Payload treats `limit: 0` as "no limit"; pagination off so nothing is silently truncated. */
const ALL = { limit: 0, pagination: false as const, depth: 0, overrideAccess: true }

const idOf = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? null : String(id)
  }
  return String(value)
}
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null)

type Doc = Record<string, unknown>

export async function loadPartnerProgramData(payload: Payload): Promise<PartnerProgramData> {
  const [partners, usages, payouts, sales, adjustments] = await Promise.all([
    payload.find({
      collection: 'partners',
      select: { name: true, status: true, partnerType: true },
      ...ALL,
    }),
    payload.find({
      collection: 'promo-code-usages',
      where: { isPartnerUsage: { equals: true } },
      select: {
        promoCode: true,
        order: true,
        isPartnerUsage: true,
        commissionAmount: true,
        commissionBaseSnapshot: true,
        orderAmountAfterDiscount: true,
        partnerNameSnapshot: true,
      },
      ...ALL,
    }),
    payload.find({ collection: 'partner-payouts', ...ALL }),
    payload.find({ collection: 'referral-sales', ...ALL }),
    payload.find({ collection: 'referral-commission-adjustments', ...ALL }),
  ])

  const usageDocs = usages.docs as unknown as Doc[]
  const payoutDocs = payouts.docs as unknown as Doc[]

  const orderIds = [...new Set(usageDocs.map((u) => idOf(u.order)).filter((id): id is string => !!id))]
  const promoIds = [
    ...new Set(
      [...usageDocs.map((u) => idOf(u.promoCode)), ...payoutDocs.map((p) => idOf(p.promoCode))].filter(
        (id): id is string => !!id,
      ),
    ),
  ]

  const [orders, promoCodes] = await Promise.all([
    orderIds.length > 0
      ? payload.find({ collection: 'orders', where: { id: { in: orderIds } }, select: { status: true }, ...ALL })
      : Promise.resolve({ docs: [] }),
    promoIds.length > 0
      ? payload.find({
          collection: 'promo-codes',
          where: { id: { in: promoIds } },
          select: { code: true, partner: true, partnerName: true },
          ...ALL,
        })
      : Promise.resolve({ docs: [] }),
  ])

  return {
    partners: (partners.docs as unknown as Doc[]).map((p) => ({
      id: String(p.id),
      name: str(p.name) ?? `Partner ${String(p.id)}`,
      status: str(p.status),
      partnerType: str(p.partnerType),
    })),
    promoCodes: (promoCodes.docs as unknown as Doc[]).map((c) => ({
      id: String(c.id),
      code: str(c.code) ?? `Kode ${String(c.id)}`,
      partnerId: idOf(c.partner),
      partnerName: str(c.partnerName),
    })),
    usages: usageDocs.map((u) => ({
      id: String(u.id),
      promoCodeId: idOf(u.promoCode),
      orderId: idOf(u.order),
      isPartnerUsage: u.isPartnerUsage === true,
      commissionAmount: num(u.commissionAmount),
      commissionBaseSnapshot: str(u.commissionBaseSnapshot),
      orderAmountAfterDiscount: num(u.orderAmountAfterDiscount),
      partnerNameSnapshot: str(u.partnerNameSnapshot),
    })),
    orderStatuses: (orders.docs as unknown as Doc[]).map((o) => ({ id: String(o.id), status: str(o.status) })),
    payouts: payoutDocs.map((p) => ({
      id: String(p.id),
      source: str(p.source),
      promoCodeId: idOf(p.promoCode),
      partnerId: idOf(p.partner),
      partnerNameSnapshot: str(p.partnerNameSnapshot),
      amount: num(p.amount),
      payoutDate: str(p.payoutDate),
    })),
    sales: (sales.docs as unknown as Doc[]).map((s) => ({
      id: String(s.id),
      partnerId: idOf(s.partner),
      category: str(s.category),
      paymentStatus: str(s.paymentStatus),
      commissionStatus: str(s.commissionStatus),
      commissionAmount: num(s.commissionAmount),
      commissionBase: num(s.commissionBase),
      invoicedTotal: num(s.invoicedTotal),
      shippingAmount: num(s.shippingAmount),
      productCost: num(s.productCost),
      actualShippingCost: num(s.actualShippingCost),
      vatAmount: num(s.vatAmount),
      saleDate: str(s.saleDate),
      orderId: idOf(s.order),
    })),
    adjustments: (adjustments.docs as unknown as Doc[]).map((a) => ({
      id: String(a.id),
      partnerId: idOf(a.partner),
      amount: num(a.amount),
      settled: idOf(a.settledByPayout) != null,
      createdAt: str(a.createdAt),
    })),
  }
}
