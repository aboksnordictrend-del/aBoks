export type InspirasjonArticle = {
  category: string
  title: string
  description: string
  date: string
  publishedAt: string
  slug: string
  image?: string
  imageAlt?: string
  /** Natural pixel dimensions of `image`, required for correct og:image:width/height. */
  imageWidth?: number
  imageHeight?: number
}

export const ARTICLES_PER_PAGE = 9

const articles: InspirasjonArticle[] = [
  {
    category: 'Bærekraftig hjem',
    title: 'Slik sorterer du batteriene riktig hjemme',
    description:
      'Å sortere batteriene riktig hjemme er et av de enkleste grepene for et tryggere hjem og en renere natur. Her er de praktiske rådene som faktisk fungerer i en travel hverdag – fra teiping av poler til en fast plass for nye og brukte batterier.',
    date: 'Juni 2026',
    publishedAt: '2026-06-01',
    slug: '/inspirasjon/slik-sorterer-du-batteriene-riktig-hjemme',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Sorterer-batteriene-hjemme.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Sortere batteriene riktig hjemme – aBoks guide',
  },
  {
    category: 'Bærekraft & gjenvinning',
    title: 'Hvorfor det lønner seg å levere inn brukte batterier',
    description:
      'Å levere inn brukte batterier er en av de enkleste miljøhandlingene vi gjør hjemme – og en av dem flest glemmer. Her er hvorfor det lønner seg for både lommeboka, sikkerheten og naturen, og hvordan litt orden hjemme gjør hele forskjellen.',
    date: 'Juni 2026',
    publishedAt: '2026-06-02',
    slug: '/inspirasjon/levere-inn-brukte-batterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Hvorfor-det-l%C3%B8nner.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Levere inn brukte batterier – aBoks guide',
  },
  {
    category: 'Hjem & Organisering',
    title: 'Orden i skuffen – 5 tips for et ryddigere og tryggere hjem',
    description:
      'Den ene rotskuffen sier ofte mer om hjemmet enn vi liker å innrømme. Med fem enkle grep – fra soneinndeling til smart batterioppbevaring – skaper du orden i skuffen som varer, og et hjem som er tryggere og mer bærekraftig.',
    date: 'Juni 2026',
    publishedAt: '2026-06-03',
    slug: '/inspirasjon/orden-i-skuffen',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Orden-i-skuffen.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Orden i skuffen – aBoks guide til hjemorganisering',
  },
  {
    category: 'Hjem & bærekraft',
    title: 'Hvilke batterier passer til hva? Den komplette guiden for hjemmet',
    description:
      'Hvilke batterier passer til hva? Vi gir deg oversikten over alkaliske, litium- og oppladbare AA- og AAA-batterier – hvor de hører hjemme, hvordan du oppbevarer dem trygt, og hvordan du gjenvinner riktig i Norge.',
    date: 'Juni 2026',
    publishedAt: '2026-06-04',
    slug: '/inspirasjon/hvilke-batterier-passer-til-hva',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Hvilke-batterier-passer.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Hvilke batterier passer til hva – aBoks guide',
  },
  {
    category: 'Bærekraftig hjem',
    title: 'aBoks og fremtidens bærekraftige hjem',
    description:
      'aBoks og fremtidens bærekraftige hjem henger tettere sammen enn de fleste tror. Når noe så lite som et batteri får sin faste plass, blir hverdagen ryddigere, tryggere og mer sirkulær. Her er de praktiske grepene som teller.',
    date: 'Juni 2026',
    publishedAt: '2026-06-05',
    slug: '/inspirasjon/aboks-fremtidens-baerekraftige-hjem',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/aBoks-fremtid.webp',
    imageWidth: 1024,
    imageHeight: 576,
    imageAlt: 'aBoks og fremtidens bærekraftige hjem – orden og gjenvinning',
  },
  {
    category: 'Bærekraft & smart hverdag',
    title: 'Slik forlenger du levetiden på batteriene dine',
    description:
      'Med noen enkle grep kan du forlenge levetiden på batteriene dine betydelig – spare penger, redusere avfall og gjøre hjemmet både tryggere og mer bærekraftig. Her er ekspertrådene som faktisk virker.',
    date: 'Juni 2026',
    publishedAt: '2026-06-06',
    slug: '/inspirasjon/forleng-levetiden-pa-batteriene',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Levetiden-pa-batteriene.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Slik forlenger du levetiden på batteriene dine – aBoks guide',
  },
  {
    category: 'Bærekraft & gjenvinning',
    title: 'Hvordan resirkuleres batterier? Fra innsamling til nye råvarer',
    description:
      'Hvordan resirkuleres batterier egentlig – fra du legger en utbrukt celle i en boks hjemme til metallene er på vei inn i et nytt produkt? Vi følger hele reisen gjennom innsamling, sortering og kjemisk utvinning, og viser hvorfor det aller viktigste leddet i kjeden er deg.',
    date: 'Juni 2026',
    publishedAt: '2026-06-07',
    slug: '/inspirasjon/hvordan-resirkuleres-batterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Recycling-factory.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Hvordan resirkuleres batterier – fra innsamling til nye råvarer',
  },
  {
    category: 'Gjenvinning & bærekraft',
    title: 'Hvor kan man levere brukte batterier? Komplett guide for norske hjem',
    description:
      'En praktisk og oppdatert oversikt over hvor du leverer brukte batterier i Norge – fra dagligvarebutikken til gjenvinningsstasjonen – med tips til trygg oppbevaring og hvorfor riktig batteriretur er viktig for miljø og brannsikkerhet.',
    date: '2026',
    publishedAt: '2026-06-08',
    slug: '/inspirasjon/hvor-levere-brukte-batterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/levere%20brukte%20batterier.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Hvor kan man levere brukte batterier – aBoks guide',
  },
  {
    category: 'Bærekraftig hjem',
    title: 'Global oppvarming i dag – hva venter oss i fremtiden?',
    description:
      'Global oppvarming merkes allerede i norsk natur og hverdag. Her får du oppdaterte fakta, fremtidsscenarier og konkrete grep for et tryggere, mer bærekraftig hjem.',
    date: 'Juli 2026',
    publishedAt: '2026-07-04',
    slug: '/inspirasjon/global-oppvarming-i-dag-hva-venter-oss',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Global-oppvarming.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Global oppvarming i dag – hva venter oss i fremtiden – aBoks guide',
  },
  {
    category: 'Bærekraft & gjenvinning',
    title: 'Miljøkonsekvensene av usorterte batterier',
    description:
      'Et batteri i restavfallet virker ubetydelig – men summen av mange feilsorterte batterier fører til branner på avfallsanlegg og tapte råstoffer. Se hvorfor riktig sortering betyr mer enn du tror, og hvordan enkle vaner hjemme gjør en reell forskjell.',
    date: 'Juli 2026',
    publishedAt: '2026-07-05',
    slug: '/inspirasjon/miljokonsekvenser-usorterte-batterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Miljokonsekvensene-av-usorterte-batterier.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Miljøkonsekvensene av usorterte batterier – aBoks guide',
  },
  {
    category: 'Hjem & Organisering',
    title: 'Den beste gaven til alle – praktisk, enkel og alltid nyttig',
    description:
      'Den beste gaven til alle er sjelden den mest spektakulære – den er den som faktisk blir brukt. Her er kriteriene og idéene som treffer uansett hvem du gir til.',
    date: 'Juli 2026',
    publishedAt: '2026-07-06',
    slug: '/inspirasjon/den-beste-gaven-til-alle',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/den-beste-gaven-til-alle.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Den beste gaven til alle – aBoks guide',
  },
  {
    category: 'Bærekraftig hjem',
    title: 'Fotball-VM 2026: Heia Norge – og heia miljøet!',
    description:
      'Norge er tilbake i et VM for første gang siden 1998 – og fotballsommeren foregår ofte midt på natten. Her er hvordan du gjør fotballkvelden hjemme både uforglemmelig og litt mer bærekraftig, med batterier klare til fjernkontroll og speaker, og en trygg plass for de brukte til de leveres til gjenvinning.',
    date: 'Juli 2026',
    publishedAt: '2026-07-11',
    slug: '/inspirasjon/fotball-vm-2026-heia-norge-heia-miljoet',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Heia%20Norge.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Fotball-VM 2026: Heia Norge – og heia miljøet – aBoks guide',
  },
  {
    category: 'Kunnskap & hverdag',
    title: 'Hvordan fungerer batterier? Slik blir kjemi til strøm',
    description:
      'Et batteri er et kjemisk kraftverk i miniatyr. Her er den forståelige forklaringen på hvordan batterier fungerer – og hvorfor kunnskapen gjør hjemmet ditt både ryddigere og tryggere.',
    date: 'Juli 2026',
    publishedAt: '2026-07-26',
    slug: '/inspirasjon/hvordan-fungerer-batterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Hvordan-fungerer-baterier.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Hvordan fungerer batterier – anode, katode og elektrolytt forklart – aBoks guide',
  },
  {
    category: 'Teknologi & bærekraft',
    title: 'Hvordan fungerer trådløs strøm? Den komplette guiden for hjemmet',
    description:
      'Trådløs strøm har flyttet inn i norske hjem – i nattbordladeren, i øreproppene og i bilen. Men hva skjer egentlig i luftgapet mellom laderen og telefonen? Her er den forståelige forklaringen, tallene som overrasker, og de praktiske rådene som gjør hverdagen både tryggere og mer bærekraftig.',
    date: 'Juli 2026',
    publishedAt: '2026-07-27',
    slug: '/inspirasjon/hvordan-fungerer-tradlos-strom',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Hvordan-fungerer-tr%C3%A5dlos-str%C3%B8m.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Hvordan fungerer trådløs strøm – induksjon, Qi2 og ladesikkerhet – aBoks guide',
  },
  {
    category: 'Bærekraft & smart hverdag',
    title: 'Oppladbare eller engangsbatterier? Slik regner du ut hva som lønner seg',
    description:
      'Oppladbare eller engangsbatterier? Svaret avhenger ikke av batteriet, men av apparatet. Her er formelen som gir deg ditt eget break-even-punkt – pluss tallene som overrasker de fleste.',
    date: 'Juli 2026',
    publishedAt: '2026-07-28',
    slug: '/inspirasjon/oppladbare-eller-engangsbatterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Oppladbare-eller-engangsbatterier.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Oppladbare eller engangsbatterier – break-even, kostnad og miljø – aBoks guide',
  },
  {
    category: 'Hjem & sikkerhet',
    title: 'De beste løsningene for batterioppbevaring hjemme',
    description:
      'God batterioppbevaring hjemme handler om mer enn å rydde en roteskuff – det reduserer brannfare, tar vare på ressurser og gjør hverdagen enklere. Her er de smarteste og tryggeste løsningene for nye og brukte batterier.',
    date: 'August 2026',
    publishedAt: '2026-08-02',
    slug: '/inspirasjon/beste-losninger-batterioppbevaring-hjemme',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Batterioppbevaring-hjemme.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'De beste løsningene for batterioppbevaring hjemme – aBoks guide',
  },
  {
    category: 'Sikkerhet & bærekraft',
    title: 'Hvordan oppbevare batterier trygt hjemme?',
    description:
      'Å oppbevare batterier trygt hjemme er et av de enkleste og mest oversette grepene for et tryggere hjem. Med noen få rutiner – teiping av poler, adskilte rom for nye og brukte, og riktig lagring – holder du brannfaren nede og batteriene lenger friske.',
    date: 'August 2026',
    publishedAt: '2026-08-03',
    slug: '/inspirasjon/oppbevare-batterier-trygt-hjemme',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Hvordan-oppbevare-batterier-trygt-hjemme.webp',
    imageWidth: 1408,
    imageHeight: 1117,
    imageAlt: 'Hvordan oppbevare batterier trygt hjemme – aBoks guide',
  },
  {
    category: 'Bærekraft & smart hverdag',
    title: 'Langtidsoppbevaring av oppladbare batterier: slik tar du vare på dem riktig',
    description:
      'Riktig langtidsoppbevaring avgjør om de oppladbare batteriene dine fortsatt leverer full kraft neste sesong – eller er ubrukelige når du trenger dem. Her er ekspertrådene om ladenivå, temperatur og trygg oppbevaring som faktisk fungerer i et norsk hjem.',
    date: 'August 2026',
    publishedAt: '2026-08-04',
    slug: '/inspirasjon/langtidsoppbevaring-oppladbare-batterier',
    image: 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com/Inspirasjon/Langtidsoppbevaring-av-oppladbare-batterier.webp',
    imageWidth: 1672,
    imageHeight: 941,
    imageAlt: 'Langtidsoppbevaring av oppladbare batterier – oppladbare AA- og AAA-batterier ryddig samlet i en boks på en tørr hylle',
  },
]

export function getSortedArticles(): InspirasjonArticle[] {
  return [...articles].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
}

export function getTotalPages(): number {
  return Math.max(1, Math.ceil(articles.length / ARTICLES_PER_PAGE))
}

export function getArticlesForPage(page: number): InspirasjonArticle[] {
  const start = (page - 1) * ARTICLES_PER_PAGE
  return getSortedArticles().slice(start, start + ARTICLES_PER_PAGE)
}
