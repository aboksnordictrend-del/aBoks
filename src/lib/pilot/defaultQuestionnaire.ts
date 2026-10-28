// The default questionnaire («Standard spørreskjema»). Every new pilot project starts with a copy
// of it; once copied, a project's questions belong to that project alone and can be edited, removed
// or reordered without touching any other project or this template.
//
// The fixed question ids below are the same in every project that started from the template, which
// lets the cross-project overview line up «the same» question between organisations.

import type { QuestionConfig } from './questionnaire'
import { DEFAULT_CLOSING, DEFAULT_INTRO } from './constants'

export const DEFAULT_QUESTIONNAIRE_INTRO = DEFAULT_INTRO
export const DEFAULT_QUESTIONNAIRE_CLOSING = DEFAULT_CLOSING

const opt = (
  label: string,
  extra: { excludeFromAverages?: boolean; isPositive?: boolean; noProductExperience?: boolean } = {},
) => ({
  label,
  excludeFromAverages: extra.excludeFromAverages ?? false,
  isPositive: extra.isPositive ?? false,
  noProductExperience: extra.noProductExperience ?? false,
})

/** A fresh copy each call, so no caller can mutate the template itself. */
export function defaultQuestions(): QuestionConfig[] {
  return [
    {
      questionId: 'brukssted',
      type: 'shortText',
      label: 'Hvor har du brukt aBoks?',
      placeholder: 'Navn på bedrift, skole eller institusjon...',
      required: true,
      enabled: true,
      statKey: 'usage',
    },
    {
      questionId: 'modell',
      type: 'singleChoice',
      label: 'Hvilken aBoks-modell har du brukt?',
      required: true,
      enabled: true,
      statKey: 'usage',
      optionsSource: 'projectModels',
      options: [opt('Flere modeller')],
    },
    {
      questionId: 'bruksfrekvens',
      type: 'singleChoice',
      label: 'Hvor ofte har du brukt produktet?',
      required: false,
      enabled: true,
      statKey: 'usage',
      optionsSource: 'manual',
      options: [
        opt('Daglig'),
        opt('Ukentlig'),
        opt('Noen få ganger'),
        // A participant who has not used the product yet has no product experience to rate:
        // their ratings are left out of the averages.
        opt('Ikke brukt ennå', { excludeFromAverages: true, noProductExperience: true }),
      ],
    },
    {
      questionId: 'brukervennlighet',
      type: 'rating',
      label: 'Hvor enkelt er produktet å bruke?',
      required: false,
      enabled: true,
      statKey: 'usability',
      scaleMinLabel: 'Svært vanskelig',
      scaleMaxLabel: 'Svært enkelt',
    },
    {
      questionId: 'nytte',
      type: 'rating',
      label: 'Hvor nyttig er aBoks på arbeidsplassen?',
      required: false,
      enabled: true,
      statKey: 'benefit',
      scaleMinLabel: 'Lite nyttig',
      scaleMaxLabel: 'Svært nyttig',
    },
    {
      questionId: 'organisering',
      type: 'singleChoice',
      label: 'Har aBoks bidratt til bedre organisering av batterier?',
      required: false,
      enabled: true,
      statKey: 'benefit',
      optionsSource: 'manual',
      options: [opt('Ja', { isPositive: true }), opt('Delvis'), opt('Nei'), opt('Vet ikke', { excludeFromAverages: true })],
    },
    {
      questionId: 'fortsette',
      type: 'singleChoice',
      label: 'Ønsker du å fortsette å bruke aBoks?',
      required: false,
      enabled: true,
      statKey: 'recommendation',
      optionsSource: 'manual',
      options: [opt('Ja', { isPositive: true }), opt('Kanskje'), opt('Nei')],
    },
    {
      questionId: 'forbedringer',
      type: 'longText',
      label: 'Hva synes du bør forbedres?',
      required: false,
      enabled: true,
      statKey: 'feedback',
    },
    {
      questionId: 'kommentarer',
      type: 'longText',
      label: 'Har du andre kommentarer eller forslag?',
      required: false,
      enabled: true,
      statKey: 'feedback',
    },
    {
      questionId: 'rom',
      type: 'shortText',
      label: 'Hvilket rom eller hvilken avdeling har du brukt produktet i?',
      required: false,
      enabled: true,
      statKey: 'usage',
    },
  ]
}
