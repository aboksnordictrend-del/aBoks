// Curated homepage content for the Pinterest export.
//
// This list is INTENTIONALLY hand-maintained. Nothing here is scraped from HomeClient.tsx and
// nothing enumerates Vercel Blob — Blob is the storage layer, not a catalogue, and a folder
// listing would sweep in manuals, review photos, icons, backgrounds and decorative graphics
// that have no business on a Pinterest board.
//
// Rules for adding an entry:
//   • product-focused promotional imagery only (the product in use, or the product itself);
//   • the image must already be published on the live site and publicly reachable over https;
//   • `destinationPath` must be an existing canonical route — do not invent one;
//   • keep titles ≤ 100 and descriptions ≤ 500 characters (they are truncated otherwise);
//   • set `createdAt` if the image should sort by its own date — the export lists newest
//     first, and undated entries follow the dated ones in the order written here.

export interface PinterestHomepageItem {
  /** Stable id. Used as the export's sourceId, so changing it re-creates the row identity. */
  id: string
  /** Absolute https URL, or a site-relative path resolved against the canonical origin. */
  imageUrl: string
  title: string
  description: string
  /** Site-relative destination, e.g. '/produkter'. */
  destinationPath: string
  /** Comma-separated keyword list, or ''. */
  keywords: string
  /**
   * Optional ISO date for when this promotional image was produced, e.g. '2026-07-15'.
   * The export sorts newest first; entries without a date keep the order they appear in
   * below and are placed after every dated row. Set it when you add fresh campaign imagery
   * that should lead the export.
   */
  createdAt?: string
}

const BLOB = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'

export const PINTEREST_HOMEPAGE_ITEMS: PinterestHomepageItem[] = [
  {
    id: 'hero',
    imageUrl: `${BLOB}/aBoks-hero-decktop.webp`,
    title: 'aBoks – fast plass til alle batteriene i hjemmet',
    description:
      'Slutt på rotet i skuffen. aBoks samler nye AA- og AAA-batterier i egne rom, og har en egen plass til de brukte til de leveres til gjenvinning.',
    destinationPath: '/produkter',
    keywords: 'batteriorganisering, oppbevaring, ryddig hjem, batterier',
  },
  {
    id: 'produkt-oversikt',
    imageUrl: `${BLOB}/aBoks.webp`,
    title: 'aBoks batteriboks – tre rom, én fast plass',
    description:
      'Ett rom for nye AA, ett for nye AAA og ett for brukte batterier. Enkelt å se hva du har igjen, og enkelt å levere de brukte til gjenvinning.',
    destinationPath: '/produkter',
    keywords: 'batteriboks, oppbevaring, organisering',
  },
  {
    id: 'farge-olivengronn',
    imageUrl: `${BLOB}/aBoks-olive.webp`,
    title: 'aBoks i olivengrønn – tar seg godt ut hvor som helst',
    description:
      'Matt, solid og laget for daglig bruk. Olivengrønn aBoks passer like godt i stua som i boden.',
    destinationPath: '/produkter',
    keywords: 'olivengrønn, interiør, batterioppbevaring',
  },
  {
    id: 'farge-hvit',
    imageUrl: `${BLOB}/aBoks-Hvit-1.webp`,
    title: 'aBoks i hvit – rent og tidløst',
    description:
      'En diskré batteriboks som forsvinner inn i hyllen. Tre rom holder nye og brukte batterier fra hverandre.',
    destinationPath: '/produkter',
    keywords: 'hvit, minimalistisk, oppbevaring',
  },
  {
    id: 'farge-sort',
    imageUrl: `${BLOB}/aBoks-sort.webp`,
    title: 'aBoks i sort – tidløst design som varer',
    description:
      'Solid materiale, matt overflate og tre rom som gir batteriene en fast plass i hjemmet.',
    destinationPath: '/produkter',
    keywords: 'sort, design, batterier',
  },
  {
    id: 'rom-stue',
    imageUrl: `${BLOB}/Ved-TV.png`,
    title: 'Batteriene rett ved TV-en – klar til fjernkontrollen',
    description:
      'Ha aBoks stående der batteriene faktisk brukes. Nye batterier på fast plass, brukte i sitt eget rom til de leveres inn.',
    destinationPath: '/slik-fungerer-det',
    keywords: 'stue, TV, fjernkontroll, organisering',
  },
  {
    id: 'rom-kjokken',
    imageUrl: `${BLOB}/Pa-familiekj%C3%B8kkenet.png`,
    title: 'Orden på familiekjøkkenet – batteriene har sin egen plass',
    description:
      'Rotskuffen på kjøkkenet er der batteriene forsvinner. Med aBoks vet alle i huset hvor de nye ligger og hvor de brukte skal.',
    destinationPath: '/slik-fungerer-det',
    keywords: 'kjøkken, orden, familie, oppbevaring',
  },
  {
    id: 'rom-hjemmekontor',
    imageUrl: `${BLOB}/Pa-hjemmekontoret.png`,
    title: 'aBoks på hjemmekontoret – alltid et batteri klart',
    description:
      'Tastatur, mus og headset går tomme på verst tenkelige tidspunkt. Med aBoks har du alltid et nytt batteri innen rekkevidde.',
    destinationPath: '/slik-fungerer-det',
    keywords: 'hjemmekontor, arbeidsplass, batterier',
  },
  {
    id: 'rom-barnerommet',
    imageUrl: `${BLOB}/Pa-barnerommet.png`,
    title: 'Trygg batterioppbevaring på barnerommet',
    description:
      'Løse batterier i en skuff er ikke bare rot – det er også en risiko. aBoks samler dem på ett sted, også de brukte.',
    destinationPath: '/slik-fungerer-det',
    keywords: 'barnerom, sikkerhet, batterier, oppbevaring',
  },
  {
    id: 'sikkerhet',
    imageUrl: `${BLOB}/Sikkerhet.webp`,
    title: 'Trygg oppbevaring av brukte batterier',
    description:
      'Brukte batterier i restavfallet starter branner på avfallsanlegg. aBoks gir dem et eget rom til de leveres til gjenvinning.',
    destinationPath: '/slik-fungerer-det',
    keywords: 'sikkerhet, gjenvinning, brannsikkerhet, batterier',
  },
]
