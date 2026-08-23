/**
 * The shop navigation shown in the burger menu's HANDLE column.
 *
 * Nothing here knows a product name or a slug: the two catalogues come from Payload through
 * @/lib/payload (`getProducts` / `getAccessories`, both already limited to published rows),
 * and these functions only shape them into links. Publishing a new accessory in the admin is
 * therefore all it takes for it to appear under «Tilbehør» — no component edit.
 *
 * Kept free of server-only imports so the pure shaping rules can be unit-tested.
 */

export type MenuLink = { label: string; href: string }

/** A menu row that may open an accordion of child links underneath it. */
export type MenuEntry = MenuLink & { children?: MenuLink[] }

/** What a Payload `products` row needs to have to become a menu link. */
type ProductDoc = { title?: string | null; slug?: string | null }

/**
 * The main catalogue's running order in the menu. Slugs not listed keep the order Payload
 * returned them in, so a new product still shows up — just after the named ones.
 */
export const PRODUCT_NAV_ORDER = ['aboks', 'aboks-mini', 'aboks-nano', 'aboks-vegg'] as const

/**
 * Accessories are ordinary `products` rows with `section: 'accessories'` and are served from
 * the same route as the main catalogue, so one href rule covers both.
 */
const productHref = (slug: string) => `/produkter/${slug}`

export function toProductNavLinks(
  docs: readonly ProductDoc[],
  order: readonly string[] = [],
): MenuLink[] {
  const rank = (slug: string) => {
    const i = order.indexOf(slug)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return docs
    .filter(
      (doc): doc is { title: string; slug: string } =>
        typeof doc.title === 'string' && doc.title.length > 0 &&
        typeof doc.slug === 'string' && doc.slug.length > 0,
    )
    .slice()
    .sort((a, b) => rank(a.slug) - rank(b.slug))
    .map((doc) => ({ label: doc.title, href: productHref(doc.slug) }))
}

/**
 * The HANDLE column: three rows, two of which carry a submenu. «Produkter» and «Tilbehør»
 * stay real links to their own listing pages — the chevron beside them is what opens the
 * accordion — so the menu works exactly as before for anyone who just wants the overview.
 */
export function buildShopMenu(products: MenuLink[], accessories: MenuLink[]): MenuEntry[] {
  return [
    {
      label: 'Produkter',
      href: '/produkter',
      children: [{ label: 'Alle produkter', href: '/produkter' }, ...products],
    },
    { label: 'Tilbehør', href: '/tilbehor', children: accessories },
    { label: 'Handlekurv', href: '/handlekurv' },
  ]
}

/**
 * Accordion rule: opening one submenu closes the other, and pressing the open one closes it.
 * At most one product list is ever on screen.
 */
export function nextExpandedMenu(current: string | null, pressed: string): string | null {
  return current === pressed ? null : pressed
}
