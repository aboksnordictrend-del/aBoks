/**
 * Poster URL for a blob-hosted product video, by naming convention:
 * `Video/aBoks-sort-video.mp4` -> `Video/aBoks-sort-video-poster.webp`.
 *
 * Variants carry only a `videoUrl` in the CMS, so the still frame is derived
 * rather than stored. Upload the poster next to the mp4 under that exact name
 * whenever a new product video is added — without it the media block falls
 * back to its plain background, which is what it showed before posters existed.
 */
export function posterForVideo(videoUrl: string | null | undefined): string | undefined {
  if (!videoUrl) return undefined
  const match = videoUrl.match(/^(.*)\.mp4(\?.*)?$/i)
  if (!match) return undefined
  return `${match[1]}-poster.webp${match[2] ?? ''}`
}

/**
 * The blob pathname a URL points at — `Video/aBoks-sort-video-poster.webp` — so a
 * poster URL can be compared against a Blob folder listing. Any query string is
 * dropped; the base only serves to accept relative URLs too.
 */
export function blobPathname(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url, 'https://blob.invalid').pathname.replace(/^\/+/, '') || undefined
  } catch {
    return undefined
  }
}

/** The folder a blob pathname sits in, `Video/`, or `''` for a file at the root. */
export function blobFolder(pathname: string): string {
  const cut = pathname.lastIndexOf('/')
  return cut < 0 ? '' : pathname.slice(0, cut + 1)
}

/**
 * Which still a click-to-play video shows before the visitor presses play.
 *
 * Decided on the server against the real Blob folder listing, never in the
 * browser: the answer has to be in the HTML from the first paint, or Safari
 * keeps the frame it already laid out. A film with a purpose-made
 * `-poster.webp` next to it uses that; one uploaded without a still — aBoks
 * Vegg's per-colour films — uses the picture of the variant it belongs to,
 * which is always there and always matches the selected colour.
 *
 * `uploadedPosters` holds blob pathnames known to exist. An empty set therefore
 * sends every video to its variant image, which is the safe way round: that
 * image is part of the page's own data and cannot 404.
 */
export function pickVideoPoster(
  videoUrl: string | null | undefined,
  variantImage: string | null | undefined,
  uploadedPosters: ReadonlySet<string>,
): string | undefined {
  const derived = posterForVideo(videoUrl)
  const path = blobPathname(derived)
  if (derived && path && uploadedPosters.has(path)) return derived
  return variantImage || undefined
}
