export interface SaleInfo {
  salePrice?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
}

/**
 * Returns the effective price considering any active sale.
 * salePrice is only used when:
 *  - it is set, > 0, and strictly less than the regular price
 *  - the current time is within [saleStartDate, saleEndDate] if dates are provided
 */
export function getEffectivePrice(price: number, sale?: SaleInfo | null): number {
  const sp = sale?.salePrice
  if (!sp || sp <= 0 || sp >= price) return price

  const now = new Date()
  const start = sale?.saleStartDate ? new Date(sale.saleStartDate) : null
  const end = sale?.saleEndDate ? new Date(sale.saleEndDate) : null

  if (start && end) return now >= start && now <= end ? sp : price
  if (start) return now >= start ? sp : price
  if (end) return now <= end ? sp : price
  return sp
}

export function isSaleActive(price: number, sale?: SaleInfo | null): boolean {
  return getEffectivePrice(price, sale) < price
}
