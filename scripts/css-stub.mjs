/**
 * Lets `node --test` import React components that use CSS modules.
 *
 * Node cannot load a `.css` file, so importing any component that does
 * `import styles from './x.module.css'` fails with ERR_UNKNOWN_FILE_EXTENSION. Next.js
 * handles this in the real build; the test runner has no such step.
 *
 * This resolves any `.css` specifier to a tiny in-memory module whose default export
 * returns the requested class name as a string — the same shape a CSS module gives at
 * runtime, so `styles.card` is `'card'` and assertions can match on class names.
 *
 * Deliberately narrow: only `.css` specifiers are intercepted, everything else falls
 * through untouched, so no other test is affected.
 */
import { registerHooks } from 'node:module'

const STUB =
  'data:text/javascript,' +
  encodeURIComponent(
    'const handler = { get: (_t, key) => (typeof key === "string" ? key : undefined) };\n' +
      'export default new Proxy({}, handler);\n',
  )

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: STUB, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
