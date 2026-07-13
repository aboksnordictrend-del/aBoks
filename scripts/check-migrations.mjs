/**
 * Verifies that every migration file on disk is also exported from
 * src/migrations/index.ts.
 *
 * The two are consumed by different code paths, and only one of them reads the index:
 *   • `payload migrate` (build:vercel) reads the *directory* and explicitly skips index.ts;
 *   • `prodMigrations` in payload.config.ts uses the *index* to apply pending migrations
 *     at runtime, against the database the app actually serves from.
 *
 * So a migration missing from the index still applies at build time but never applies
 * at runtime — which is exactly how production ended up without the shipped_email_*
 * columns while the deploy reported success. Fail the build instead.
 */
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const dir = resolve(root, 'src/migrations')

const files = readdirSync(dir)
  .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && f !== 'index.ts' && f !== 'index.js')
  .map((f) => f.replace(/\.(ts|js)$/, ''))

const index = readFileSync(resolve(dir, 'index.ts'), 'utf8')

const missing = files.filter((name) => !index.includes(`name: '${name}'`))

if (missing.length > 0) {
  console.error('\n❌  Migrations missing from src/migrations/index.ts:')
  missing.forEach((name) => console.error(`    ${name}`))
  console.error('\n    They would apply at build time but NOT at runtime (prodMigrations).\n')
  process.exit(1)
}

console.log(`✅  migrations registered (${files.length})`)
