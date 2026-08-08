import { getImageProps } from 'next/image'

/**
 * The art-directed "Fra planter til aBoks" visual, shared by the homepage material story
 * and the product pages so the assets, their intrinsic sizes and the `sizes` hints live in
 * exactly one place.
 *
 * No `'use client'`: this is plain markup, so it stays a server component where the caller
 * is one (the product pages) and simply compiles as client markup where the caller is a
 * client component (the homepage section, which wraps it in a framer-motion reveal).
 *
 * Two separate assets, not one image cropped by CSS: a landscape frame for desktop and a
 * portrait frame for mobile. `<picture>`'s `media` rule means the browser downloads only
 * the one it needs — unlike the `hidden md:block` pattern used in the homepage hero, where
 * both files are fetched.
 *
 * The intrinsic sizes below are the real pixel dimensions of the blob assets. Note that the
 * desktop file is 3:2 (1536×1024) even though it is named "4x3"; each asset is rendered at
 * its own ratio so neither one is cropped.
 */
const DESKTOP = {
  src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Fra-planter-til-aboks/Biobasert-PLA-4x3-Desktop.webp',
  width: 1536,
  height: 1024,
}
const MOBILE = {
  src: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Fra-planter-til-aboks/Biobasert-PLA-4x5-Mobile.webp',
  width: 1122,
  height: 1402,
}

export const FRA_PLANTER_ALT = 'Fra plantebaserte råvarer til biobasert PLA og ferdig aBoks'

// Both call sites render the image across the site container, so it settles at 1240px minus
// the container's 48px side padding once the viewport is wide enough for the cap to apply.
const DESKTOP_SIZES = '(max-width: 1239px) 100vw, 1144px'
const MOBILE_SIZES = '92vw'

export default function FraPlanterTilABoksImage({
  background = '#efe6d3',
  className,
}: {
  /** Placeholder behind the image while it loads. Pick one that suits the section band. */
  background?: string
  className?: string
}) {
  const desktop = getImageProps({ ...DESKTOP, alt: FRA_PLANTER_ALT, sizes: DESKTOP_SIZES }).props
  const mobile = getImageProps({ ...MOBILE, alt: FRA_PLANTER_ALT, sizes: MOBILE_SIZES }).props

  return (
    // Each breakpoint's wrapper carries its asset's exact intrinsic ratio, so the box is
    // reserved before the image loads (no CLS) and `object-cover` has nothing left to crop.
    // 22px is the radius the homepage already uses on its editorial 4:3 visuals.
    <div
      className={`relative w-full overflow-hidden aspect-[1122/1402] md:aspect-[1536/1024]${className ? ` ${className}` : ''}`}
      style={{ borderRadius: '22px', background }}
    >
      <picture>
        <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes={desktop.sizes} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img {...mobile} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
    </div>
  )
}
