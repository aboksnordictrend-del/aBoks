import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

export const getPayloadClient = cache(async () => {
  return await getPayload({ config: configPromise })
})

export type ProductSection = 'products' | 'accessories'

const getProductsInSection = unstable_cache(
  async (section: ProductSection) => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'products',
      where: {
        published: { equals: true },
        // A row written before the `section` column existed reads as null; treat it as
        // a regular product so nothing can drop out of /produkter.
        ...(section === 'products'
          ? { or: [{ section: { equals: 'products' } }, { section: { exists: false } }] }
          : { section: { equals: 'accessories' } }),
      },
      depth: 2,
    })
    return result.docs
  },
  ['products-by-section'],
  { revalidate: 3600, tags: ['products'] },
)

/** Published products in the main catalogue (/produkter). */
export const getProducts = () => getProductsInSection('products')

/** Published products in the accessories catalogue (/tilbehor). */
export const getAccessories = () => getProductsInSection('accessories')

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

/**
 * Published product looked up by its CMS name. Used where a page needs one specific
 * product but must keep following it if the slug is edited in Payload — the slug is
 * read off the returned doc rather than being written into the code.
 */
export const getPublishedProductByTitle = unstable_cache(
  async (title: string) => {
    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'products',
      where: { title: { equals: title }, published: { equals: true } },
      depth: 2,
      limit: 1,
    })
    return result.docs[0] ?? null
  },
  ['published-product-by-title'],
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
