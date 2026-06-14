import type { Metadata } from 'next'
import CheckoutClient from './CheckoutClient'

export const metadata: Metadata = {
  title: 'Kasse',
  description: 'Gjennomfør din bestilling av aBoks.',
  robots: { index: false },
}

export default function CheckoutPage() {
  return <CheckoutClient />
}
