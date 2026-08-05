import { Suspense } from 'react'
import type { Metadata } from 'next'
import CheckoutClient from './CheckoutClient'
import { getAccessories, getProducts } from '@/lib/payload'
import { productTitlesBySlug } from '@/lib/cart/lineTitle'

export const metadata: Metadata = {
  title: 'Kasse | aBoks',
  description: 'Fullfør bestillingen din hos aBoks.',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  // Same cached catalogue lookup as the cart page, for the same reason: the summary must name
  // each line correctly in the moment before the server's trusted line names arrive.
  const [products, accessories] = await Promise.all([getProducts(), getAccessories()])
  const productTitles = productTitlesBySlug([...products, ...accessories])

  return (
    <Suspense>
      <CheckoutClient productTitles={productTitles} />
    </Suspense>
  )
}
