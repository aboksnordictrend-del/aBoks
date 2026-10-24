/**
 * "Reasons to buy" copy shown over a product's gallery.
 *
 * Messages belong to gallery POSITIONS, not to images: message n is shown on whatever image
 * sits at position n of the gallery, so replacing or reordering images in Payload never moves
 * a message. A gallery with fewer images simply shows fewer messages; any image beyond the
 * last message shows none. Nothing here touches image data.
 *
 * Keyed by product slug so only the products listed here get the feature — today: aBoks only.
 */

export interface GalleryReasons {
  heading: string
  /** messages[i] is shown on gallery position i (0-based). */
  messages: readonly string[]
}

const GALLERY_REASONS: Readonly<Record<string, GalleryReasons>> = {
  aboks: {
    heading: 'Hvorfor trenger du aBoks?',
    messages: [
      'Du vet alltid hvor de nye batteriene er.',
      'Du vet alltid hvor du skal legge brukte batterier.',
      'Vennene dine har ikke en sånn. Ennå. 😉',
      'Mamma fortjener en gave hun faktisk får bruk for. ❤️',
      'Pappa blir glad for en ny leke! 😁',
      'Batterirot? Her er løsningen! 💡',
      'Kjøp én gang – glem batterirotet!',
      'Fordi batterier fortjener et bedre hjem enn roteskuffen. 😎',
      'Støtt en norsk produsent! 🇳🇴',
      'Slutt å lete etter batterier i alle skuffene!',
      'Gjør morgendagen bedre enn gårsdagen. ✨',
    ],
  },
}

export function galleryReasonsFor(slug: string): GalleryReasons | null {
  return GALLERY_REASONS[slug] ?? null
}
