// Server-side data collection for the Pinterest export.
//
// The only I/O in the whole feature. Reads exactly three collections' worth of catalogue data
// — products, their variants, and (implicitly) the media relationships resolved by `depth: 2`.
// It never lists Vercel Blob, never touches orders, customers, reviews or marketing expenses.

import type { Payload, PayloadRequest } from 'payload'
import type { Product, ProductVariant } from '@/payload-types'
import { listPinterestBlobObjects, type PinterestBlobListing } from './blobItems'
import { PINTEREST_BLOB_PREFIX } from './blobNaming'
import { buildExportItems, type BuildExportOptions } from './items'
import type { PinterestExportPreview } from './types'

/** The catalogue is small; these are safety ceilings, not expected sizes. */
const PRODUCT_LIMIT = 500
const VARIANT_LIMIT = 1000

/**
 * Fetch the catalogue and normalize it into a preview.
 *
 * Unpublished products are fetched deliberately: the preview reports them under "Hoppet over"
 * with a reason, which is far more useful than a silently short list. `overrideAccess: false`
 * + the caller's user keeps collection access control in force.
 */
export async function collectExportPreview(
  payload: Payload,
  user: PayloadRequest['user'],
  options: BuildExportOptions,
  /** Injectable for tests, which must never touch the real Blob account. */
  listBlob: (prefix: string) => Promise<PinterestBlobListing> = listPinterestBlobObjects,
): Promise<PinterestExportPreview> {
  const [productResult, variantResult, blob] = await Promise.all([
    payload.find({
      collection: 'products',
      depth: 2,
      limit: PRODUCT_LIMIT,
      sort: 'title',
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'product-variants',
      depth: 2,
      limit: VARIANT_LIMIT,
      sort: 'sortOrder',
      overrideAccess: false,
      user,
    }),
    // Only when the source is selected — an unticked filter must not cost a Blob round trip.
    // The listing never throws; a failure comes back as an error string and becomes a warning.
    options.sources.blob
      ? listBlob(PINTEREST_BLOB_PREFIX)
      : Promise.resolve<PinterestBlobListing>({ objects: [], error: null }),
  ])

  return buildExportItems(
    {
      products: productResult.docs as Product[],
      variants: variantResult.docs as ProductVariant[],
      blob,
    },
    options,
  )
}
