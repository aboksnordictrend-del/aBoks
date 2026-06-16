/**
 * Verifies that the Payload importMap contains all required plugin entries.
 * Runs as part of build:vercel — fails the build early if an entry is missing,
 * which prevents a white screen in /admin at runtime.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const importMapPath = resolve(root, 'src/app/(payload)/admin/importMap.js')

const required = [
  '@payloadcms/storage-vercel-blob/client#VercelBlobClientUploadHandler',
]

let content
try {
  content = readFileSync(importMapPath, 'utf8')
} catch {
  console.error(`\n❌  importMap not found at:\n    ${importMapPath}\n    Run: npm run generate:importmap\n`)
  process.exit(1)
}

const missing = required.filter((key) => !content.includes(key))

if (missing.length > 0) {
  console.error('\n❌  importMap is missing required entries:')
  missing.forEach((k) => console.error(`    ${k}`))
  console.error('\n    Run: npm run generate:importmap\n')
  process.exit(1)
}

console.log('✅  importMap OK')
