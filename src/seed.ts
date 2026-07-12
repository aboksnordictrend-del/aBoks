import { getPayload } from 'payload'
import configPromise from '../payload.config'

async function seed() {
  const payload = await getPayload({ config: configPromise })

  console.log('🌱 Starting seed...')

  // Check if admin user exists
  const existingUsers = await payload.find({ collection: 'users', limit: 1 })
  if (existingUsers.totalDocs === 0) {
    await payload.create({
      collection: 'users',
      data: {
        name: 'Admin',
        email: 'admin@aboks.no',
        password: 'aboks2026!',
        role: 'admin',
      },
    })
    console.log('✅ Admin user created (admin@aboks.no / aboks2026!)')
  } else {
    console.log('⏭️  Admin user already exists')
  }

  // Check if aBoks product exists
  const existingProducts = await payload.find({
    collection: 'products',
    where: { slug: { equals: 'aboks' } },
    limit: 1,
  })

  if (existingProducts.totalDocs > 0) {
    console.log('⏭️  aBoks product already exists')
    console.log('✅ Seed complete.')
    process.exit(0)
    return
  }

  // Create the aBoks product
  const product = await payload.create({
    collection: 'products',
    data: {
      title: 'aBoks',
      slug: 'aboks',
      tagline: 'Smart batteriorganisator med tre rom',
      description:
        'Hold orden på nye og brukte batterier i én elegant boks. Tre adskilte rom for AA, AAA og brukte celler – alltid full oversikt, alltid klar for gjenvinning.',
      price: 499,
      capacity: {
        aa: 20,
        aaa: 36,
        usedCompartments: 1,
      },
      features: [
        { number: '01', title: 'Tre adskilte rom', description: 'AA, AAA og brukte batterier – hver type på sin egen plass.' },
        { number: '02', title: 'Alltid oversikt', description: 'Se på et blikk hva du har igjen, og hva som skal gjenvinnes.' },
        { number: '03', title: 'Plukk-og-bytt-skuffer', description: 'Lette uttrekksskuffer gjør det enkelt å bytte batteri.' },
        { number: '04', title: 'Matt premium-finish', description: 'Diskré, slitesterkt design som passer i ethvert rom.' },
      ],
      faqs: [
        { question: 'Hvilke batterier passer i aBoks?', answer: 'aBoks har egne rom for AA- og AAA-batterier, pluss et eget rom for brukte batterier som skal leveres til gjenvinning.' },
        { question: 'Hvor mange batterier får jeg plass til?', answer: 'Du får plass til 20 AA-batterier og 36 AAA-batterier, i tillegg til et romslig rom for brukte batterier.' },
        { question: 'Hvilket materiale er aBoks laget av?', answer: 'aBoks er laget av et solid, matt materiale som tåler daglig bruk og er enkelt å holde rent.' },
        { question: 'Kan jeg henge aBoks på veggen?', answer: 'aBoks er designet for å stå støtt på benken eller i skuffen. En veggmontert løsning er på vei.' },
        { question: 'Hva er leverings- og returvilkårene?', answer: 'Vi sender innen 1–3 virkedager, tilbyr fri frakt over kr 650 og 100 dagers åpent kjøp.' },
      ],
      seo: {
        title: 'aBoks – Smart batteriorganisator',
        description: 'aBoks organiserer nye, brukte, AA- og AAA-batterier i én smart boks. Designet i Norge.',
      },
      published: true,
    },
  })

  console.log(`✅ Product created: ${product.title} (ID: ${product.id})`)

  // Create variants
  const variants = [
    {
      name: 'Olivengrønn',
      colorHex: '#5b6347',
      sku: 'ABOKS-OLIVE-001',
      inventory: 100,
      sortOrder: 0,
    },
    {
      name: 'Mørk blå',
      colorHex: '#243153',
      sku: 'ABOKS-BLUE-001',
      inventory: 100,
      sortOrder: 1,
    },
    {
      name: 'Sort',
      colorHex: '#1d1d1f',
      sku: 'ABOKS-BLACK-001',
      inventory: 100,
      sortOrder: 2,
    },
  ]

  for (const v of variants) {
    const variant = await payload.create({
      collection: 'product-variants',
      data: {
        product: product.id,
        name: v.name,
        colorHex: v.colorHex,
        sku: v.sku,
        inventory: v.inventory,
        sortOrder: v.sortOrder,
      },
    })
    console.log(`✅ Variant created: ${variant.name}`)
  }

  console.log('\n✅ Seed complete!')
  console.log('📌 Admin URL: http://localhost:3000/admin')
  console.log('📌 Email: admin@aboks.no')
  console.log('📌 Password: aboks2026!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
