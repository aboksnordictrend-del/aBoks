import { getPayload } from 'payload'
import configPromise from '../payload.config'

async function migrateDetails() {
  const payload = await getPayload({ config: configPromise })

  console.log('🔄 Migrating product details sections...')

  const { docs: products } = await payload.find({
    collection: 'products',
    limit: 100,
    depth: 0,
  })

  let updated = 0

  for (const product of products) {
    const existing = (product as any).details
    if (existing && Array.isArray(existing) && existing.length > 0) {
      console.log(`⏭️  ${product.title}: already has details, skipping`)
      continue
    }

    const capacity = (product as any).capacity ?? {}
    const hasAAA = (capacity.aaa ?? 0) > 0

    const details = [
      {
        title: 'Beskrivelse',
        content: hasAAA
          ? `${product.title} holder nye og brukte batterier samlet i én elegant boks med tre adskilte rom. Slutt på løse batterier i skuffen – du har alltid oversikt.`
          : `${product.title} holder nye og brukte batterier samlet i én kompakt boks med to adskilte rom. Slutt på løse batterier i skuffen – du har alltid oversikt.`,
      },
      {
        title: 'Spesifikasjoner',
        content: hasAAA
          ? 'Mål: 16 × 14 × 6 cm. Tre rom: AA, AAA og brukte. Matt finish. Fås i olivengrønn, mørk blå og sort.'
          : 'Kompakt design. To rom: AA og brukte. Matt finish.',
      },
      {
        title: 'Frakt og retur',
        content: 'Fri frakt over kr 650. Sendes innen 1–2 virkedager. 100 dagers åpent kjøp.',
      },
    ]

    await payload.update({
      collection: 'products',
      id: product.id,
      data: { details } as any,
    })

    console.log(`✅ ${product.title}: 3 sections migrated`)
    updated++
  }

  console.log(`\n✅ Done. ${updated} product(s) updated.`)
  process.exit(0)
}

migrateDetails().catch((err) => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
