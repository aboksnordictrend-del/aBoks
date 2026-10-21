import type { Access, CollectionConfig, Field } from 'payload'
import {
  DEFAULT_CLOSING,
  DEFAULT_INTRO,
  ORGANIZATION_TYPE_OPTIONS,
  OPTION_SOURCE_OPTIONS,
  PILOT_ADMIN_GROUP,
  PILOT_LIMITS,
  PILOT_PROJECTS_SLUG,
  PILOT_STATUS_OPTIONS,
  QUESTION_TYPE_OPTIONS,
  STAT_KEY_OPTIONS,
} from '@/lib/pilot/constants'
import { defaultQuestions } from '@/lib/pilot/defaultQuestionnaire'
import { pilotPath } from '@/lib/pilot/urls'
import {
  enforceProjectRules,
  guardProjectDelete,
  prepareProject,
  validateSlugField,
} from './hooks/pilotProject'
import { loadDefaultQuestionnaireEndpoint } from './endpoints/pilotLoadDefaultQuestionnaire'

/**
 * Pilot projects («Pilotprosjekter») — product-testing projects with municipalities, schools,
 * businesses and other organisations. Each project has its own questionnaire and its own public
 * page at /pilot/[slug], served by one dynamic route (src/app/(frontend)/pilot/[slug]).
 *
 * Administrator-only in every direction. The public page reads a project through the local API on
 * the server and receives only the public questionnaire (see @/lib/pilot/server) — no internal
 * field (contact, notes, description) ever reaches a participant.
 *
 * Server rules — slug generation and uniqueness, question ids, questionnaire validation,
 * versioning, slug history and the delete guard — live in ./hooks/pilotProject.
 */

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'

type Sibling = Record<string, unknown> | undefined

const isChoice = (_: unknown, sibling: Sibling) =>
  sibling?.type === 'singleChoice' || sibling?.type === 'multipleChoice' || sibling?.type === 'dropdown'

const isRating = (_: unknown, sibling: Sibling) => sibling?.type === 'rating'

const questionFields: Field[] = [
  {
    type: 'row',
    fields: [
      {
        name: 'label',
        type: 'text',
        label: 'Spørsmål',
        required: true,
        maxLength: PILOT_LIMITS.labelMax,
        admin: { width: '60%' },
      },
      {
        name: 'type',
        type: 'select',
        label: 'Spørsmålstype',
        required: true,
        defaultValue: 'shortText',
        options: QUESTION_TYPE_OPTIONS,
        admin: { width: '40%' },
      },
    ],
  },
  {
    type: 'row',
    fields: [
      {
        name: 'required',
        type: 'checkbox',
        label: 'Obligatorisk',
        defaultValue: false,
        admin: { width: '33%' },
      },
      {
        name: 'enabled',
        type: 'checkbox',
        label: 'Aktivt (vises i skjemaet)',
        defaultValue: true,
        admin: { width: '33%' },
      },
      {
        name: 'statKey',
        type: 'select',
        label: 'Analysekategori',
        options: STAT_KEY_OPTIONS,
        admin: {
          width: '34%',
          description: 'Valgfritt. Knytter spørsmålet til et nøkkeltall i Pilotanalyse.',
        },
      },
    ],
  },
  {
    name: 'placeholder',
    type: 'text',
    label: 'Plassholdertekst',
    maxLength: PILOT_LIMITS.optionLabelMax,
    admin: {
      condition: (_, sibling) =>
        sibling?.type === 'shortText' || sibling?.type === 'longText' || sibling?.type === 'dropdown',
    },
  },
  {
    name: 'helpText',
    type: 'text',
    label: 'Hjelpetekst',
    maxLength: PILOT_LIMITS.labelMax,
    admin: { description: 'Valgfri kort forklaring under spørsmålet.' },
  },
  {
    // The condition sits on each field: Payload does not apply a condition set on a `row`.
    type: 'row',
    fields: [
      {
        name: 'scaleMinLabel',
        type: 'text',
        label: 'Tekst ved 1',
        maxLength: 60,
        admin: { width: '50%', placeholder: 'F.eks. Svært vanskelig', condition: isRating },
      },
      {
        name: 'scaleMaxLabel',
        type: 'text',
        label: 'Tekst ved 5',
        maxLength: 60,
        admin: { width: '50%', placeholder: 'F.eks. Svært enkelt', condition: isRating },
      },
    ],
  },
  {
    name: 'optionsSource',
    type: 'select',
    label: 'Svaralternativer fra',
    defaultValue: 'manual',
    options: OPTION_SOURCE_OPTIONS,
    admin: {
      condition: isChoice,
      description:
        '«Prosjektets aBoks-modeller» viser modellene valgt under Prosjekt, etterfulgt av alternativene under (f.eks. «Flere modeller»).',
    },
  },
  {
    name: 'options',
    type: 'array',
    label: 'Svaralternativer',
    labels: { singular: 'Svaralternativ', plural: 'Svaralternativer' },
    maxRows: PILOT_LIMITS.optionsMax,
    admin: { condition: isChoice, initCollapsed: false },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'label',
            type: 'text',
            label: 'Tekst',
            required: true,
            maxLength: PILOT_LIMITS.optionLabelMax,
            admin: { width: '50%' },
          },
          {
            name: 'isPositive',
            type: 'checkbox',
            label: 'Positivt svar',
            defaultValue: false,
            admin: {
              width: '20%',
              description: 'Telles i andelen positive svar (f.eks. «Ja»).',
            },
          },
          {
            name: 'excludeFromAverages',
            type: 'checkbox',
            label: 'Holdes utenfor gjennomsnitt og andeler',
            defaultValue: false,
            admin: {
              width: '30%',
              description:
                'F.eks. «Vet ikke». På spørsmålet om bruksfrekvens («Ikke brukt ennå») holdes også svarets produktvurderinger utenfor.',
            },
          },
        ],
      },
    ],
  },
  {
    name: 'questionId',
    type: 'text',
    label: 'Spørsmåls-ID',
    admin: {
      readOnly: true,
      description: 'Settes automatisk ved lagring og endres aldri. Knytter svar til spørsmålet.',
    },
  },
]

export const PilotProjects: CollectionConfig = {
  slug: PILOT_PROJECTS_SLUG,
  labels: { singular: 'Pilotprosjekt', plural: 'Pilotprosjekter' },
  admin: {
    useAsTitle: 'name',
    group: PILOT_ADMIN_GROUP,
    defaultColumns: ['name', 'organization', 'organizationType', 'status', 'startDate', 'endDate'],
    listSearchableFields: ['name', 'organization', 'slug'],
    description:
      'Produkttesting med kommuner, skoler, bedrifter og andre. Hvert prosjekt har sitt eget spørreskjema og sin egen lenke og QR-kode.',
    // «Forhåndsvis»: the real public page, which shows any status to a logged-in administrator
    // with submission switched off.
    preview: (doc) =>
      typeof doc?.slug === 'string' && doc.slug ? `${pilotPath(doc.slug)}?forhandsvisning=1` : null,
  },
  access: {
    read: adminOnly,
    create: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  defaultSort: '-createdAt',
  endpoints: [loadDefaultQuestionnaireEndpoint],
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Prosjekt',
          fields: [
            {
              name: 'name',
              type: 'text',
              label: 'Prosjektnavn',
              required: true,
              maxLength: 120,
              admin: { description: 'Vises øverst i spørreskjemaet.' },
            },
            {
              name: 'slug',
              type: 'text',
              label: 'URL-slug',
              unique: true,
              maxLength: PILOT_LIMITS.slugMax,
              validate: validateSlugField,
              admin: {
                description:
                  'Offentlig adresse: aboks.no/pilot/[slug]. Lages automatisk fra prosjektnavnet hvis feltet er tomt. Endres den senere, sender den gamle adressen fortsatt videre hit.',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'organization',
                  type: 'text',
                  label: 'Organisasjon',
                  required: true,
                  maxLength: 160,
                  admin: { width: '60%' },
                },
                {
                  name: 'organizationType',
                  type: 'select',
                  label: 'Organisasjonstype',
                  required: true,
                  defaultValue: 'kommune',
                  options: ORGANIZATION_TYPE_OPTIONS,
                  admin: { width: '40%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'contactPerson',
                  type: 'text',
                  label: 'Kontaktperson',
                  maxLength: 120,
                  admin: { width: '50%' },
                },
                {
                  name: 'contactEmail',
                  type: 'email',
                  label: 'Kontakt-e-post',
                  admin: { width: '50%' },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'startDate',
                  type: 'date',
                  label: 'Startdato',
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } },
                },
                {
                  name: 'endDate',
                  type: 'date',
                  label: 'Sluttdato',
                  admin: { width: '50%', date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } },
                },
              ],
            },
            {
              name: 'description',
              type: 'textarea',
              label: 'Prosjektbeskrivelse',
              admin: { description: 'Intern. Vises ikke i det offentlige spørreskjemaet.' },
            },
            {
              name: 'models',
              type: 'relationship',
              relationTo: 'products',
              hasMany: true,
              label: 'aBoks-modeller i prosjektet',
              admin: {
                description:
                  'Modellene som testes. Brukes som svaralternativer i spørsmålet om modell (kilde «Prosjektets aBoks-modeller»).',
              },
            },
            {
              name: 'internalNotes',
              type: 'textarea',
              label: 'Interne notater',
              admin: { description: 'Vises aldri offentlig.' },
            },
          ],
        },
        {
          label: 'Spørreskjema',
          description:
            'Spørsmålene tilhører bare dette prosjektet. Endringer påvirker ikke evalueringer som allerede er sendt inn — hver evaluering lagrer spørsmålene slik de var.',
          fields: [
            {
              name: 'loadDefaultQuestionnaire',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/components/admin/pilot/LoadDefaultQuestionnaireButton#default',
                },
              },
            },
            {
              name: 'intro',
              type: 'textarea',
              label: 'Introduksjon',
              defaultValue: DEFAULT_INTRO,
              maxLength: PILOT_LIMITS.introMax,
            },
            {
              name: 'closingMessage',
              type: 'textarea',
              label: 'Avslutningsmelding',
              defaultValue: DEFAULT_CLOSING,
              maxLength: PILOT_LIMITS.introMax,
              admin: { description: 'Vises etter at evalueringen er sendt inn.' },
            },
            {
              name: 'questions',
              type: 'array',
              label: 'Spørsmål',
              labels: { singular: 'Spørsmål', plural: 'Spørsmål' },
              maxRows: PILOT_LIMITS.questionsMax,
              // A new project starts with a copy of the default questionnaire.
              defaultValue: () => defaultQuestions(),
              admin: {
                initCollapsed: true,
                components: {
                  RowLabel: '@/components/admin/pilot/QuestionRowLabel#default',
                },
              },
              fields: questionFields,
            },
          ],
        },
      ],
    },
    // ── Sidebar ──
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'draft',
      options: PILOT_STATUS_OPTIONS,
      admin: {
        position: 'sidebar',
        description: 'Bare aktive prosjekter tar imot svar.',
      },
    },
    {
      name: 'publicLink',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/components/admin/pilot/PilotLinkPanel#default' },
      },
    },
    {
      name: 'questionnaireVersion',
      type: 'number',
      label: 'Spørreskjemaversjon',
      defaultValue: 1,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Øker automatisk når spørsmål eller svaralternativer endres.',
      },
    },
    {
      name: 'questionnaireFingerprint',
      type: 'text',
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'slugHistory',
      type: 'array',
      label: 'Tidligere URL-slugs',
      labels: { singular: 'Tidligere slug', plural: 'Tidligere slugs' },
      admin: {
        position: 'sidebar',
        readOnly: true,
        initCollapsed: true,
        // Only worth showing once a slug has actually changed.
        condition: (data) => Array.isArray(data?.slugHistory) && data.slugHistory.length > 0,
        description: 'Gamle adresser videresendes permanent hit, så QR-koder som allerede er skrevet ut fungerer fortsatt.',
      },
      fields: [
        { name: 'slug', type: 'text', label: 'Slug', required: true, admin: { readOnly: true } },
        { name: 'changedAt', type: 'date', label: 'Endret', admin: { readOnly: true } },
      ],
    },
  ],
  hooks: {
    beforeValidate: [prepareProject],
    beforeChange: [enforceProjectRules],
    beforeDelete: [guardProjectDelete],
  },
  timestamps: true,
}
