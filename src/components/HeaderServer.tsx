import { getAccessories, getProducts } from '@/lib/payload'
import { PRODUCT_NAV_ORDER, buildShopMenu, toProductNavLinks } from '@/lib/navigation'
import Header from './Header'

export default async function HeaderServer() {
  // Both catalogues come from the same cached Payload helpers the listing pages use, so the
  // menu can never drift from /produkter and /tilbehor.
  const [products, accessories] = await Promise.all([getProducts(), getAccessories()])
  const shopMenu = buildShopMenu(
    toProductNavLinks(products, PRODUCT_NAV_ORDER),
    toProductNavLinks(accessories),
  )
  return <Header shopMenu={shopMenu} />
}
