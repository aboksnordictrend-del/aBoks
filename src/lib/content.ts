/**
 * Shared marketing copy used by both the home page sections and the
 * standalone /slik-fungerer-det and /vanlige-sporsmal pages, so the two
 * never drift apart.
 */

export const FAQS = [
  { id: 'f1', question: 'Hvilke batterier passer i aBoks?', answer: 'aBoks har egne rom for AA- og AAA-batterier, pluss et eget rom for brukte batterier som skal leveres til gjenvinning.' },
  { id: 'f2', question: 'Hvor mange batterier får jeg plass til?', answer: 'Du får plass til 20 AA-batterier og 36 AAA-batterier, i tillegg til et romslig rom for brukte batterier.' },
  { id: 'f3', question: 'Hvilket materiale er aBoks laget av?', answer: 'aBoks er laget av et solid, matt materiale som tåler daglig bruk og er enkelt å holde rent.' },
  { id: 'f4', question: 'Kan jeg henge aBoks på veggen?', answer: 'aBoks er designet for å stå støtt på benken eller i skuffen. En veggmontert løsning er på vei.' },
  { id: 'f5', question: 'Hva er leverings- og returvilkårene?', answer: 'Vi sender innen 1–3 virkedager, tilbyr fri frakt over kr 650 og 100 dagers åpent kjøp.' },
]

export const COMPARTMENTS = [
  { tag: 'AA', name: 'Nye AA-batterier', desc: 'Romslig rom som holder de fulle AA-batteriene klare til bruk.' },
  { tag: 'AAA', name: 'Nye AAA-batterier', desc: 'Smalere rom dimensjonert for de mindre AAA-cellene.' },
  { tag: '⟲', name: 'Brukte batterier', desc: 'Et eget rom for tomme celler – så de faktisk når gjenvinningen.' },
]

export const STEPS = [
  { number: 1, title: 'Sett inn modulene',                      posterUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Sett-inn-modulene-1080.webp',        videoUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Sett-inn-modulene-34.mp4' },
  { number: 2, title: 'Fyll med batterier',                     posterUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Fyll-med-batterier-1080.webp',    videoUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Fyll-med-batterier-34.mp4' },
  { number: 3, title: 'Bruk batteriene',                        posterUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Bruk-batteriene-1080.webp',          videoUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Bruk-batteriene-34.mp4' },
  { number: 4, title: 'Lever brukte batterier til gjenvinning', posterUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Lever-brukte-batterier-1080.webp', videoUrl: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Slik-kommer-du/Lever-brukte-batterier-34.mp4' },
]

/** Longer, page-only description for each step on /slik-fungerer-det. */
export const STEP_DETAILS: Record<number, string> = {
  1: 'aBoks leveres med tre moduler. Sett dem inn i boksen – ett rom for nye AA, ett for nye AAA og ett for de brukte cellene. Ingen verktøy, ingen montering.',
  2: 'Fyll hvert rom med batteriene du allerede har liggende i skuffen. Nye batterier på sin faste plass, så du ser hva du har igjen.',
  3: 'Trenger du et batteri, tar du det rett fra riktig rom. Når det er tomt, legger du det i rommet for brukte i stedet for tilbake i skuffen.',
  4: 'Når rommet for brukte er fullt, tar du med hele modulen til nærmeste innsamlingspunkt. Batteriene når gjenvinningen – og boksen er klar igjen.',
}

export const CAPACITY = [
  { big: '20', unit: 'AA-batterier', note: 'Eget rom for nye AA.' },
  { big: '36', unit: 'AAA-batterier', note: 'Eget rom for nye AAA.' },
  { big: '1', unit: 'rom for brukte', note: 'Samle dem til gjenvinning.' },
]
