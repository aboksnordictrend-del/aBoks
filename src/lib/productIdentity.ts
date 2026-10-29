/**
 * What a catalogue product is and who makes it. Shared by the product page (title, JSON-LD)
 * and the Google Merchant feed, so the brand stated to Google is the same everywhere.
 *
 * The CMS has no brand field, so brand comes from one explicit list: a product whose title
 * starts with a known third-party brand is that brand's, and everything else is aBoks's own
 * (the organisers, and the modules sold as spare parts for them). A new third-party product
 * needs its brand added to THIRD_PARTY_BRANDS — without it, it would be reported as aBoks.
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

export type ProductKind = 'organizer' | 'battery' | 'accessory'

export interface ProductIdentityInput {
  title: string
  /** The Payload `section`; anything but 'accessories' is the main catalogue. */
  section?: string | null
}

function thirdPartyBrand(product: ProductIdentityInput): ThirdPartyBrand | undefined {
  return THIRD_PARTY_BRANDS.find((entry) => entry.titlePattern.test(product.title.trim()))
}

export function productBrand(product: ProductIdentityInput): string {
  return thirdPartyBrand(product)?.brand ?? OWN_BRAND
}

export function productKind(product: ProductIdentityInput): ProductKind {
  const thirdParty = thirdPartyBrand(product)
  if (thirdParty) return thirdParty.kind
  return product.section === 'accessories' ? 'accessory' : 'organizer'
}

/**
 * The SEO title for /produkter/[slug], built around the product name as written.
 *
 * - organisers keep «– Smart batteriorganisator» and get the layout's «| aBoks»;
 * - batteries say what they are: «GP Ultra AA 10 stk. – AA-batterier | aBoks» (the size is
 *   read from the name, never assumed);
 * - aBoks accessories read «AA-Modul – tilbehør til aBoks», which already ends with the
 *   brand, so it bypasses the template rather than repeat it.
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
      const size = name.match(/\b(AAA|AA)\b/i)?.[1]?.toUpperCase()
      const title = `${name} – ${size ? `${size}-batterier` : 'batterier'}`
      return { document: title, social: title }
    }
    case 'accessory': {
      const title = `${name} – tilbehør til ${OWN_BRAND}`
      return { document: { absolute: title }, social: title }
    }
    default: {
      const title = `${name} – Smart batteriorganisator`
      return { document: title, social: title }
    }
  }
}
