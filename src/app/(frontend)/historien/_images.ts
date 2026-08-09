/**
 * The photographs and drawings used by /historien, resolved to files that already exist in
 * the Vercel Blob `Historien` folder. Nothing here uploads, renames or copies a file — every
 * pathname below was read from the folder listing, not guessed.
 *
 * `width`/`height` are the assets' intrinsic pixel sizes. They give the browser the aspect
 * ratio (so nothing shifts while loading) and let `next/image` pick a sensible srcset. How a
 * picture is *displayed* is decided at the call site: photos may be cropped to a shared
 * aspect box, while drawings, the screenshot and the certificate are rendered at their own
 * ratio and must never be cropped.
 */

const BLOB_BASE = 'https://cnmxattx5v3y5fdc.public.blob.vercel-storage.com'
const HISTORIEN_FOLDER = `${BLOB_BASE}/Historien`

export interface StoryImage {
  src: string
  width: number
  height: number
  alt: string
}

export const STORY_IMAGES = {
  hero: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_HISTORIEN_HERO.webp`,
    width: 1672,
    height: 941,
    alt: 'Ferdig aBoks i mørk blå på et sidebord i en stue, fylt med AA- og AAA-batterier',
  },
  problemBatteries: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_PROBLEM_BATTERIES.webp`,
    width: 1448,
    height: 1086,
    alt: 'Løse AA-, AAA-, knappcelle- og 9V-batterier blandet med emballasje i en plastboks',
  },
  /**
   * The paper sketch is the one story image that does not live in the `Historien` folder:
   * it is the same photograph the homepage teaser already uses, reused here rather than
   * re-uploaded under a second name.
   */
  firstSketch: {
    src: `${BLOB_BASE}/Skissen-1.webp`,
    width: 1448,
    height: 1086,
    alt: 'Den første håndtegnede skissen av aBoks på papir',
  },
  firstCad: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_FIRST_CAD.webp`,
    width: 821,
    height: 807,
    alt: 'Tidlig CAD-modell av aBoks vist som wireframe, med rom og innvendige nivåer',
  },
  prototypeV1: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_PROTOTYPE_V1.webp`,
    width: 1200,
    height: 900,
    alt: 'Første 3D-printede prototype i grått, merket AA og AAA, med batterier i uttaket nederst',
  },
  cascadeMechanism: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_CASCADE_MECHANISM.webp`,
    width: 698,
    height: 838,
    alt: 'Snitt-tegning av kaskademekanismen: batteriene beveger seg trinnvis ned gjennom sikksakkformede nivåer',
  },
  prototypeV2: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_PROTOTYPE_V2.webp`,
    width: 1000,
    height: 1000,
    alt: 'Prototype 2 i sort på en arbeidspult – større og mer teknisk i uttrykket',
  },
  prototypeV3: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_PROTOTYPE_V3.webp`,
    width: 1000,
    height: 1000,
    alt: 'Prototype 3 i hvitt med oransje og grønne detaljer – en mer kompakt utgave',
  },
  failedPrint: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_FAILED_PRINT.webp`,
    width: 1200,
    height: 900,
    alt: 'Mislykket 3D-utskrift i rødt: løse filamenttråder og feil i de innvendige nivåene',
  },
  firstPrinter: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_FIRST_3D_PRINTER.webp`,
    width: 960,
    height: 1280,
    alt: '3D-printeren som brukes til å produsere aBoks, med materialmatersystem på toppen',
  },
  prototypeV5: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_PROTOTYPE_V5.webp`,
    width: 960,
    height: 1280,
    alt: 'Prototype 5 med de innvendige kaskademodulene i olivengrønt og kremhvitt tatt ut av boksen',
  },
  designEvolution1: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_DESIGN_EVOLUTION_1.webp`,
    width: 1280,
    height: 1280,
    alt: 'Rød utviklingsmodell med synlige printlag og teknisk uttrykk',
  },
  designEvolution2: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_DESIGN_EVOLUTION_2.webp`,
    width: 960,
    height: 1280,
    alt: 'Hvit mellomversjon med renere ytterform og glattere overflate',
  },
  finalProduct: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_FINAL_PRODUCT.webp`,
    width: 1280,
    height: 1280,
    alt: 'Ferdig aBoks i sort med aBoks-logo og uttaket for batterier nederst',
  },
  trademarkCertificate: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_TRADEMARK_CERTIFICATE.webp`,
    width: 677,
    height: 951,
    alt: 'Registreringsbevis for varemerke fra Patentstyret med registreringsnummer 342807 for aBoks',
  },
  earlyHomeTest: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_EARLY_HOME_TEST.webp`,
    width: 1536,
    height: 2048,
    alt: 'Olivengrønn aBoks i bruk på en kjøkkenbenk – modulen for brukte batterier løftes ut',
  },
  firstPackaging: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_FIRST_PACKAGING.webp`,
    width: 1536,
    height: 2048,
    alt: 'Ferdig pakket aBoks med produktkort og et takkekort klart til utsendelse',
  },
  launchWebsite: {
    src: `${HISTORIEN_FOLDER}/TODO_IMAGE_ABOKS_LAUNCH_WEBSITE.webp`,
    width: 1345,
    height: 638,
    alt: 'Forsiden av aboks.no ved lansering, med aBoks i tre farger og fargevelger',
  },
} satisfies Record<string, StoryImage>

/**
 * The picture for the material section.
 *
 * The intended photograph — a close-up of the 3D-printing itself — does not exist in the
 * Blob folder yet. Rather than ship an empty box or a placeholder, the section borrows the
 * printer photo, which is not used anywhere else on the page. When the close-up is uploaded
 * as `TODO_IMAGE_3D_PRINTING_DETAIL.webp`, add it to `STORY_IMAGES` and point this constant
 * at it: the section's layout, copy and aspect box stay exactly as they are.
 */
export const MATERIAL_IMAGE: StoryImage = STORY_IMAGES.firstPrinter
