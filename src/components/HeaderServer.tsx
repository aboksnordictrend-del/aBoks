import { getProducts } from '@/lib/payload'
import Header from './Header'

const PRODUCT_SLUG_ORDER = ['aboks', 'aboks-mini', 'aboks-nano']

export default async function HeaderServer() {
  const products = await getProducts()
  const productLinks = products
    .map((p) => ({ title: p.title as string, slug: p.slug as string }))
    .sort((a, b) => {
      const ai = PRODUCT_SLUG_ORDER.indexOf(a.slug)
      const bi = PRODUCT_SLUG_ORDER.indexOf(b.slug)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  return <Header products={productLinks} />
}
