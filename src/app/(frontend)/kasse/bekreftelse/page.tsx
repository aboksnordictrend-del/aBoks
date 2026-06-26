import { Suspense } from 'react'
import type { Metadata } from 'next'
import BekreftlseClient from './BekreftlseClient'

export const metadata: Metadata = {
  title: 'Bestilling bekreftet | aBoks',
  robots: { index: false, follow: false },
}

export default function BekreftelsePage() {
  return (
    <Suspense>
      <BekreftlseClient />
    </Suspense>
  )
}
