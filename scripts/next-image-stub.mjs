/**
 * Lets `node --test` render components that use `next/image`.
 *
 * Outside a Next.js build, `next/image` resolves to an object React cannot render at all —
 * every `renderToStaticMarkup` of a component containing one dies with "Element type is
 * invalid … but got: object". Next handles this in the real build; the test runner has no
 * such step. (`next/link` needs no help: it is an ordinary forwardRef and renders as `<a>`.)
 *
 * This resolves the single specifier `next/image` to ./stubs/next-image.mjs, which renders a
 * plain `<img>`. The same shape and intent as ./css-stub.mjs next door.
 *
 * Deliberately narrow: only the exact specifier `next/image` is intercepted — not
 * `next/image.js`, not any other `next/*` module — so no other test is affected.
 */
import { registerHooks } from 'node:module'

const STUB_URL = new URL('./stubs/next-image.mjs', import.meta.url).href

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'next/image') {
      return { url: STUB_URL, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
