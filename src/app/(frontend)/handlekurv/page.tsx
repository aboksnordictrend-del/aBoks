import type { Metadata } from 'next'
import CartClient from './CartClient'
import { getAccessories, getProducts } from '@/lib/payload'
import { productTitlesBySlug } from '@/lib/cart/lineTitle'

export const metadata: Metadata = {
  title: 'Handlekurv | aBoks',
  description: 'Se innholdet i din aBoks-handlekurv.',
  robots: { index: false,
            follow: false,
   },
}

export default async function CartPage() {
  // Slug → current product name, for every published product in both catalogues. Two reads
  // that are already cached and tagged `products`, so renaming a product in Payload shows up
  // here on the next request; the whole map is a handful of short strings.
  //
  // The cart lives in localStorage and the server cannot see it, so this is sent for the
  // catalogue rather than for the cart. It is what names lines persisted before
  // `CartItem.productTitle` existed, and what keeps every line current after a rename. A line
  // whose product has left the catalogue falls back to its own stored title.
  const [products, accessories] = await Promise.all([getProducts(), getAccessories()])
  const productTitles = productTitlesBySlug([...products, ...accessories])

  return <CartClient productTitles={productTitles} />
}
