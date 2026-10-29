/**
 * What a catalogue product is and who makes it. Shared by the product page (title, JSON-LD)
 * and the Google Merchant feed, so what Google is told is the same everywhere.
 *
 * The CMS has no brand field, so brand is decided from data that is reliable on its own:
 *
 * 1. a title that starts with a known third-party brand («GP Ultra AA 10 stk.») is that brand;
 * 2. the main catalogue (`section: 'products'`) holds only aBoks's own organisers;
 * 3. an accessory is aBoks's own when it is listed in OWN_ACCESSORY_SLUGS (the spare-part
 *    modules) or carries «aBoks» in its name.
 *
 * Anything else is a product of unknown make, and its brand is `null` — never guessed as
 * aBoks. The feed and the structured data then leave the brand out rather than state a wrong
 * one; Merchant Center reports the missing brand on that item until it is added here.
 */

export const OWN_BRAND = 'aBoks'

interface ThirdPartyBrand {
  brand: string
  /** Matches the product title as written in Payload. */
  titlePattern: RegExp
  kind: 'battery'
}

const THIRD_PARTY_BRANDS: ThirdPartyBrand[] = [
  // «GP Ultra AA 10 stk.», «GP Ultra AAA 10 stk.»
  { brand: 'GP', titlePattern: /^GP\s/i, kind: 'battery' },
]

/** Accessories made by aBoks: the spare-part modules for the organisers. */
const OWN_ACCESSORY_SLUGS = new Set(['aa-modul', 'aaa-modul', 'bb-modul'])

/**
 * organizer — an aBoks organiser; accessory — an aBoks accessory or spare part;
 * battery — a third-party battery; unknown — an accessory of unknown make.
 */
export type ProductKind = 'organizer' | 'battery' | 'accessory' | 'unknown'

export interface ProductIdentityInput {
  title: string
  /** The Payload `section`; anything but 'accessories' is the main catalogue. */
  section?: string | null
  slug?: string | null
}

function thirdPartyBrand(product: ProductIdentityInput): ThirdPartyBrand | undefined {
  return THIRD_PARTY_BRANDS.find((entry) => entry.titlePattern.test(product.title.trim()))
}

export function productKind(product: ProductIdentityInput): ProductKind {
  const thirdParty = thirdPartyBrand(product)
  if (thirdParty) return thirdParty.kind
  if (product.section !== 'accessories') return 'organizer'
  const ownAccessory =
    OWN_ACCESSORY_SLUGS.has(product.slug ?? '') || /\baboks\b/i.test(product.title)
  return ownAccessory ? 'accessory' : 'unknown'
}

/** The brand, or null when it cannot be told from reliable data. */
export function productBrand(product: ProductIdentityInput): string | null {
  const thirdParty = thirdPartyBrand(product)
  if (thirdParty) return thirdParty.brand
  return productKind(product) === 'unknown' ? null : OWN_BRAND
}

/** «AA» / «AAA» when the product name states it — never assumed. */
function batterySize(name: string): string | undefined {
  return name.match(/\b(AAA|AA)\b/i)?.[1]?.toUpperCase()
}

/** Google taxonomy paths, from https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt */
export const GOOGLE_CATEGORY = {
  /** 630 */
  householdSupplies: 'Home & Garden > Household Supplies',
  /** 4928 */
  generalPurposeBatteries: 'Electronics > Electronics Accessories > Power > Batteries > General Purpose Batteries',
} as const

/**
 * `google_product_category` and `product_type` for the Merchant feed. Batteries are filed as
 * batteries; everything else keeps the organiser classification the feed has always used.
 */
export function merchantClassification(product: ProductIdentityInput): {
  googleProductCategory: string
  productType: string
} {
  if (productKind(product) === 'battery') {
    const size = batterySize(product.title)
    return {
      googleProductCategory: GOOGLE_CATEGORY.generalPurposeBatteries,
      productType: size ? `Batteries / ${size} batteries` : 'Batteries',
    }
  }
  return {
    googleProductCategory: GOOGLE_CATEGORY.householdSupplies,
    productType: 'Battery organizer / Home organization',
  }
}

/**
 * The SEO title for /produkter/[slug], built around the product name as written.
 *
 * - organisers keep «– Smart batteriorganisator» and get the layout's «| aBoks»;
 * - batteries say what they are: «GP Ultra AA 10 stk. – AA-batterier | aBoks» (the size is
 *   read from the name, never assumed);
 * - aBoks accessories read «AA-Modul – tilbehør til aBoks», which already ends with the
 *   brand, so it bypasses the template rather than repeat it;
 * - a product of unknown make gets its own name and the shop's suffix, nothing more.
 *
 * `document` goes to `metadata.title`; `social` is the same text without the suffix, for
 * Open Graph.
 */
export function productSeoTitle(product: ProductIdentityInput): {
  document: string | { absolute: string }
  social: string
} {
  const name = product.title.trim()
  switch (productKind(product)) {
    case 'battery': {
      const size = batterySize(name)
      const title = `${name} – ${size ? `${size}-batterier` : 'batterier'}`
      return { document: title, social: title }
    }
    case 'accessory': {
      const title = `${name} – tilbehør til ${OWN_BRAND}`
      return { document: { absolute: title }, social: title }
    }
    case 'unknown':
      return { document: name, social: name }
    default: {
      const title = `${name} – Smart batteriorganisator`
      return { document: title, social: title }
    }
  }
}
