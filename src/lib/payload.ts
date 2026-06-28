import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

export const getPayloadClient = cache(async () => {
  return await getPayload({ config: configPromise })
})

export const getProducts = unstable_cache(
  async () => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'products',
      where: { published: { equals: true } },
      depth: 2,
    })
    return result.docs
  },
  ['products-all'],
  { revalidate: 3600, tags: ['products'] },
)

export const getProductBySlug = unstable_cache(
  async (slug: string) => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'products',
      where: { slug: { equals: slug } },
      depth: 2,
      limit: 1,
    })
    return result.docs[0] ?? null
  },
  ['product-by-slug'],
  { revalidate: 3600, tags: ['products'] },
)

export const getVariantsForProduct = unstable_cache(
  async (productId: string) => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'product-variants',
      where: { product: { equals: productId } },
      sort: 'sortOrder',
      depth: 2,
    })
    return result.docs
  },
  ['variants-for-product'],
  { revalidate: 3600, tags: ['product-variants'] },
)
