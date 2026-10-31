/**
 * The models every package configurator offers, by Payload slug and in the order the rows
 * appear. Shared by all four packages: the composition is free, so each configurator lists
 * the whole catalogue and the customer sets a product they do not need to 0.
 *
 * The package page also renders one product section per slug here — the configurator's
 * "Se produktdetaljer" links land on them — so a slug added here gets both.
 */
export const CONFIGURATOR_PRODUCT_SLUGS: string[] = [
  'aboks',
  'aboks-mini',
  'aboks-nano',
  'aboks-office',
  'aboks-spesial',
  'aboks-vegg',
  'aboks-xl',
]
