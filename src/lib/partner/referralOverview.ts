import type { Payload, PayloadRequest } from 'payload'
import { oereToKr, toOere } from '@/lib/money'
import { computeReferralTotals, type ReferralCategory, type ReferralTotals } from './referral'

/**
 * The «Henviste kunder» overview on a regular partner: companies (Bedriftssalg) and physical
 * stores (Forhandlersalg) shown separately, each with its customers, its sales and its commission
 * totals. Two queries — customers and sales — whatever their number; everything else is the pure
 * `buildReferralOverview` below, using the same `computeReferralTotals` as the payout panel.
 *
 * Display only. Promo-code commission is not part of any figure here.
 */

export interface OverviewCustomerRow {
  id: string
  name: string
  status: string | null
  saleCount: number
  paidRevenue: number
  earned: number
  pending: number
  paidOut: number
  reversed: number
}

export interface OverviewSaleRow {
  id: string
  customerId: string | null
  customerName: string
  saleDate: string | null
  invoicedTotal: number | null
  commissionAmount: number | null
  paymentStatus: string | null
  commissionStatus: string | null
}

export interface OverviewCategory {
  customers: OverviewCustomerRow[]
  /** Newest first, at most `SALES_SHOWN_PER_CATEGORY`. */
  sales: OverviewSaleRow[]
  saleCount: number
  totals: ReferralTotals
}

export interface ReferralOverview {
  businessSale: OverviewCategory
  retailStore: OverviewCategory
}

export const SALES_SHOWN_PER_CATEGORY = 25

type Doc = Record<string, unknown>

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
const oereOf = (value: unknown): number | null => (num(value) == null ? null : toOere(num(value)!))

const totalsOf = (sales: Doc[]) =>
  computeReferralTotals(
    sales.map((s) => ({ category: s.category, commissionStatus: s.commissionStatus, commissionAmountOere: oereOf(s.commissionAmount) })),
    [],
  )

/** Pure: customers and sales (sales newest first) → the two category sections. */
export function buildReferralOverview(customers: readonly Doc[], sales: readonly Doc[]): ReferralOverview {
  const nameById = new Map(customers.map((c) => [String(c.id), str(c.name) ?? `Kunde ${String(c.id)}`]))

  const section = (category: ReferralCategory): OverviewCategory => {
    const categorySales = sales.filter((s) => s.category === category)
    const rows: OverviewCustomerRow[] = customers
      .filter((c) => c.category === category)
      .map((c) => {
        const own = categorySales.filter((s) => idOf(s.referredCustomer) === String(c.id))
        const t = totalsOf(own)
        const paidRevenueOere = own
          .filter((s) => s.paymentStatus === 'paid')
          .reduce((sum, s) => sum + (oereOf(s.invoicedTotal) ?? 0), 0)
        return {
          id: String(c.id),
          name: nameById.get(String(c.id))!,
          status: str(c.status),
          saleCount: own.length,
          paidRevenue: oereToKr(paidRevenueOere),
          earned: oereToKr(t.earnedTotalOere[category]),
          pending: oereToKr(t.pendingOere),
          paidOut: oereToKr(t.paidOutOere),
          reversed: oereToKr(t.reversedOere),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'))

    return {
      customers: rows,
      sales: categorySales.slice(0, SALES_SHOWN_PER_CATEGORY).map((s) => ({
        id: String(s.id),
        customerId: idOf(s.referredCustomer),
        customerName: nameById.get(idOf(s.referredCustomer) ?? '') ?? '—',
        saleDate: str(s.saleDate),
        invoicedTotal: num(s.invoicedTotal),
        commissionAmount: num(s.commissionAmount),
        paymentStatus: str(s.paymentStatus),
        commissionStatus: str(s.commissionStatus),
      })),
      saleCount: categorySales.length,
      totals: totalsOf(categorySales),
    }
  }

  return { businessSale: section('businessSale'), retailStore: section('retailStore') }
}

export async function loadReferralOverview(
  payload: Payload,
  partnerId: string | number,
  options: { req?: PayloadRequest } = {},
): Promise<ReferralOverview> {
  const common = { limit: 0, pagination: false as const, depth: 0, overrideAccess: true, ...(options.req ? { req: options.req } : {}) }
  const [customers, sales] = await Promise.all([
    payload.find({ collection: 'referred-customers', where: { partner: { equals: partnerId } }, ...common }),
    payload.find({ collection: 'referral-sales', where: { partner: { equals: partnerId } }, sort: '-saleDate', ...common }),
  ])
  return buildReferralOverview(customers.docs as unknown as Doc[], sales.docs as unknown as Doc[])
}
