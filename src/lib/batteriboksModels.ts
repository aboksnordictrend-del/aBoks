/**
 * Reads the /batteriboks model grid from Payload. Kept apart from ./batteriboks so the
 * page's copy and JSON-LD builders can be tested without loading the Payload config.
 */

import { getProducts, getVariantsForProduct } from '@/lib/payload'
import { BATTERIBOKS_MODELS, isModelSoldOut, type BatteriboksModel } from '@/lib/batteriboks'

function mediaUrl(val: unknown): string {
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'url' in val) return String((val as { url?: string }).url ?? '')
  return ''
}

/**
 * The models in BATTERIBOKS_MODELS that are published in Payload, in that order. A CMS
 * failure is logged and answered with an empty list so the rest of the page still renders.
 */
export async function getBatteriboksModels(): Promise<BatteriboksModel[]> {
  try {
    const products = await getProducts()
    const rows = await Promise.all(
      BATTERIBOKS_MODELS.map(async (model): Promise<BatteriboksModel | null> => {
        const product = products.find((p) => p.slug === model.slug)
        if (!product?.slug) return null
        const firstImage = product.images?.[0]
        const image = firstImage ? mediaUrl(firstImage.image) : ''
        if (!image) return null
        const variants = await getVariantsForProduct(String(product.id))
        return {
          slug: product.slug,
          name: product.title ?? model.name,
          tag: model.tag,
          copy: model.copy,
          href: `/produkter/${product.slug}`,
          image,
          imageAlt: firstImage?.alt || `${product.title} batteriboks`,
          price: product.price ?? 0,
          sale: {
            salePrice: product.salePrice ?? null,
            saleStartDate: product.saleStartDate ?? null,
            saleEndDate: product.saleEndDate ?? null,
          },
          soldOut: isModelSoldOut(product, variants),
          capacity: {
            aa: product.capacity?.aa ?? 0,
            aaa: product.capacity?.aaa ?? 0,
            usedCompartments: product.capacity?.usedCompartments ?? 0,
          },
          aaaInAaRoom: model.aaaInAaRoom ?? false,
        }
      }),
    )
    return rows.filter((row): row is BatteriboksModel => row !== null)
  } catch (err) {
    console.error(
      '[BATTERIBOKS] Failed to fetch products from Payload:',
      err instanceof Error ? err.message : String(err),
    )
    return []
  }
}
