import type { Metadata } from 'next'
import CartClient from './CartClient'

export const metadata: Metadata = {
  title: 'Handlekurv',
  description: 'Se innholdet i din aBoks-handlekurv.',
  robots: { index: false },
}

export default function CartPage() {
  return <CartClient />
}
