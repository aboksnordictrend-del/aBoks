import type { Metadata } from 'next'
import CheckoutClient from './CheckoutClient'

export const metadata: Metadata = {
  title: 'Kasse | aBoks',
  description: 'Fullfør bestillingen din hos aBoks.',
  robots: { index: false,
            follow: false,
   },
}

export default function CheckoutPage() {
  return <CheckoutClient />
}
