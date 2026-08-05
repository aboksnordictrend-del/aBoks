/**
 * Stand-in for `next/image` under `node --test`. Installed by ../next-image-stub.mjs.
 *
 * Renders a plain `<img>` with the props that describe the picture — src, alt, sizes,
 * className, style — and drops the ones that only mean something to the Next.js image
 * pipeline (fill, priority, quality, loader, placeholder, blurDataURL). That is enough for
 * a test to assert what the customer sees; it is not an attempt to reproduce the real
 * component's srcset or layout behaviour, which belongs to the build, not to a unit test.
 */
import { createElement } from 'react'

export default function Image({
  src,
  alt = '',
  sizes,
  className,
  style,
  width,
  height,
  // Next-only props, deliberately discarded so React does not warn about unknown DOM attrs.
  fill: _fill,
  priority: _priority,
  quality: _quality,
  loader: _loader,
  placeholder: _placeholder,
  blurDataURL: _blurDataURL,
  unoptimized: _unoptimized,
  loading: _loading,
  ...rest
}) {
  return createElement('img', {
    src: typeof src === 'string' ? src : (src?.src ?? ''),
    alt,
    ...(sizes ? { sizes } : {}),
    ...(className ? { className } : {}),
    ...(style ? { style } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...rest,
  })
}
