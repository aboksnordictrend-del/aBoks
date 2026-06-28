import { getProducts } from '@/lib/payload'
import Header from './Header'

export default async function HeaderServer() {
  const products = await getProducts()
  const productLinks = products.map((p) => ({
    title: p.title as string,
    slug: p.slug as string,
  }))
  return <Header products={productLinks} />
}
