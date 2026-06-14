import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'

export const getPayloadClient = cache(async () => {
  return await getPayload({ config: configPromise })
})

export async function getProducts() {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'products',
    where: { published: { equals: true } },
    depth: 2,
  })
  return result.docs
}

export async function getProductBySlug(slug: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
  })
  return result.docs[0] ?? null
}

export async function getVariantsForProduct(productId: string) {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'product-variants',
    where: { product: { equals: productId } },
    sort: 'sortOrder',
    depth: 2,
  })
  return result.docs
}
