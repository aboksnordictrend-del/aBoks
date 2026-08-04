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
