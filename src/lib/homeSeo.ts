/**
 * Search and sharing metadata for the homepage, kept apart from the page so it can be
 * tested without rendering the client-side hero.
 */

/** Already carries the brand, so it is set `absolute` and bypasses the `%s | aBoks` template. */
export const HOME_TITLE = 'aBoks – norskdesignet batteriboks for nye og brukte batterier'

/**
 * The image shown when https://aboks.no is shared — the same Blob photo as the desktop hero.
 * Width and height are the file's real pixel size (read from its WebP header).
 */
export const HOME_SHARE_IMAGE = {
  url: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Hero-desktop-ny.webp',
  width: 1659,
  height: 948,
  type: 'image/webp',
  alt: 'Fire aBoks batteribokser i svart, olivengrønt, mørkeblått og hvitt, med batterier i skuffene',
}
