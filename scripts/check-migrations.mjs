/**
 * Verifies that every migration file on disk is also exported from
 * src/migrations/index.ts.
 *
 * Note what this does and does not do. `payload migrate` reads the migration
 * *directory* and explicitly skips index.ts, so migrations apply whether or not they
 * are listed there — the index is not what broke production. This check just keeps the
 * index (which `payload migrate:create` maintains) from silently drifting out of sync
 * with the directory, so it stays trustworthy for anything that does read it.
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
