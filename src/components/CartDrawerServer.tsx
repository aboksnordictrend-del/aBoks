import { getAccessories, getProducts } from '@/lib/payload'
import { productTitlesBySlug } from '@/lib/cart/lineTitle'
import CartDrawer from './CartDrawer'

/**
 * Gives the drawer the same slug → title map the /handlekurv page is given, so a line named
 * from the live catalogue reads identically in both places (and a cart persisted before
 * `CartItem.productTitle` existed is named at all).
 *
 * Both reads are the cached, `products`-tagged ones the header and the cart page already make,
 * so mounting this in the layout adds no database work to a page render.
 */
export default async function CartDrawerServer() {
  const [products, accessories] = await Promise.all([getProducts(), getAccessories()])
  return <CartDrawer productTitles={productTitlesBySlug([...products, ...accessories])} />
}
