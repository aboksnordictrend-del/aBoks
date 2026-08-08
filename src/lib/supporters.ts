/**
 * The organisations that backed aBoks' development, shared by the homepage strip
 * (`SupportedBySection`) and the product-page line under the cart button
 * (`ProductSupportTrust`) so the assets are declared once.
 *
 * Static on purpose — this is a short, rarely-changing credit, so it lives in code
 * rather than in Payload. Add an entry here to add a logo; `href` is optional and only
 * rendered when set (left out for now, since the official URLs aren't confirmed).
 *
 * `width`/`height` are the assets' intrinsic pixel sizes. They only give the browser
 * the aspect ratio (so there's no layout shift) — the rendered size comes from each
 * consumer's CSS box, which never sets both dimensions and so can't distort a logo.
 */
export interface Supporter {
  name: string
  logoUrl: string
  width: number
  height: number
  href?: string
}

export const SUPPORTERS: Supporter[] = [
  {
    name: 'Hitra kommune',
    logoUrl:
      'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Utviklet-med-stotte-fra/Hitra-kommune-logo.webp',
    width: 750,
    height: 284,
  },
  {
    name: 'Thams Innovasjon',
    logoUrl:
      'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Utviklet-med-stotte-fra/Thams-innovation-logo.webp',
    width: 1000,
    height: 221,
  },
]
