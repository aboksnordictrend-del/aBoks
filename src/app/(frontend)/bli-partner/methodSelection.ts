import { scrollToAnchor } from '@/lib/anchorScroll'
import type { PartnerMethodId } from '@/lib/partnerProgram/methods'

/**
 * How a method card tells the tab section which method to show.
 *
 * The cards and the tabs are separate sections with no shared parent state, so a card
 * dispatches this window event and `MethodTabs` listens for it. The URL hash (`#bedriftssalg`)
 * carries the same choice for deep links and for a reload.
 */

export const METHOD_SELECT_EVENT = 'aboks:partner-method'

/** The id of the tab section, which is where a card scrolls to. */
export const METHOD_TABS_ID = 'metode'

export function selectPartnerMethod(id: PartnerMethodId): void {
  window.dispatchEvent(new CustomEvent<PartnerMethodId>(METHOD_SELECT_EVENT, { detail: id }))
  // After the tab has rendered its panel, so the landing position is measured against it.
  requestAnimationFrame(() => {
    scrollToAnchor(METHOD_TABS_ID)
    window.history.replaceState(null, '', `#${id}`)
  })
}
