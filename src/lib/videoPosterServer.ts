import { listBlobFolderImages, type BlobImage } from './blobImages'
import { blobFolder, blobPathname, pickVideoPoster, posterForVideo } from './videoPoster'

/**
 * Resolves each variant's video poster while the page is still on the server.
 *
 * The naming convention (`posterForVideo`) says what a still would be called;
 * the Blob folder listing says whether anyone actually uploaded it. Asking here
 * rather than in the browser is the whole point: the `poster` attribute reaches
 * Safari already correct, instead of being swapped after hydration — which iOS
 * ignores, leaving the flat background.
 *
 * One listing per folder per ISR window, shared by every variant on the page and
 * cached by `listBlobFolderImages`. A folder that can't be read comes back empty,
 * which sends every variant to its own image: worse-looking than a hand-made
 * still, but never a broken one.
 */
export async function withVideoPosters<T extends { videoUrl: string | null; image: string }>(
  variants: T[],
  listFolder: (prefix: string) => Promise<BlobImage[]> = listBlobFolderImages,
): Promise<(T & { videoPoster: string | null })[]> {
  const folders = new Set<string>()
  for (const variant of variants) {
    const path = blobPathname(posterForVideo(variant.videoUrl))
    if (path) folders.add(blobFolder(path))
  }

  const uploaded = new Set<string>()
  if (folders.size > 0) {
    const listings = await Promise.all([...folders].map((prefix) => listFolder(prefix)))
    for (const listing of listings) {
      for (const blob of listing) uploaded.add(blob.pathname)
    }
  }

  return variants.map((variant) => ({
    ...variant,
    videoPoster: pickVideoPoster(variant.videoUrl, variant.image, uploaded) ?? null,
  }))
}
