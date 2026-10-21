import type { Access, CollectionConfig } from 'payload'
import { PILOT_ADMIN_GROUP, PILOT_EVALUATIONS_SLUG, PILOT_PROJECTS_SLUG } from '@/lib/pilot/constants'

/**
 * Submitted pilot evaluations («Pilotevalueringer»). One document per anonymous submission.
 *
 * ── Immutable history ──
 *
 * Each evaluation carries the questionnaire exactly as the participant saw it
 * (`questionnaireSnapshot`: question ids, texts, types and options) and its answers with the
 * question text at submission time. It points at its project by id, never by slug, so renaming a
 * project, changing its slug or editing its questions afterwards changes nothing here. Nobody can
 * update an evaluation — not even an administrator; the only change possible is deletion.
 *
 * ── Privacy ──
 *
 * No name, e-mail, IP address or other identifier is stored. Rate limiting works on an in-memory
 * counter only (see src/app/(frontend)/pilot/[slug]/actions.ts).
 *
 * ── Access ──
 *
 * Created only by the public form's server action, through the local API with overrideAccess. The
 * REST and GraphQL APIs offer nothing to the public: read, create and update are closed; read and
 * delete are for administrators.
 */

const adminOnly: Access = ({ req }) => req.user?.role === 'admin'
const nobody: Access = () => false

export const PilotEvaluations: CollectionConfig = {
  slug: PILOT_EVALUATIONS_SLUG,
  labels: { singular: 'Pilotevaluering', plural: 'Pilotevalueringer' },
  admin: {
    useAsTitle: 'projectName',
    group: PILOT_ADMIN_GROUP,
    defaultColumns: ['projectName', 'modelLabel', 'questionnaireVersion', 'submittedAt'],
    description:
      'Anonyme innsendte evalueringer. Kan ikke redigeres — spørsmålene lagres slik de var ved innsending. Se Pilotanalyse for statistikk og CSV-eksport.',
    pagination: { defaultLimit: 50 },
  },
  access: {
    read: adminOnly,
    create: nobody,
    update: nobody,
    delete: adminOnly,
  },
  defaultSort: '-submittedAt',
  fields: [
    {
      name: 'project',
      type: 'relationship',
      relationTo: PILOT_PROJECTS_SLUG,
      label: 'Pilotprosjekt',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'projectName',
          type: 'text',
          label: 'Prosjektnavn (ved innsending)',
          admin: { readOnly: true, width: '50%' },
        },
        {
          name: 'organization',
          type: 'text',
          label: 'Organisasjon (ved innsending)',
          admin: { readOnly: true, width: '50%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'model',
          type: 'relationship',
          relationTo: 'products',
          label: 'aBoks-modell',
          admin: { readOnly: true, width: '50%' },
        },
        {
          name: 'modelLabel',
          type: 'text',
          label: 'Modell (svar)',
          admin: { readOnly: true, width: '50%' },
        },
      ],
    },
    {
      name: 'answers',
      type: 'array',
      label: 'Svar',
      labels: { singular: 'Svar', plural: 'Svar' },
      admin: {
        readOnly: true,
        components: { RowLabel: '@/components/admin/pilot/AnswerRowLabel#default' },
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'questionId', type: 'text', label: 'Spørsmåls-ID', required: true, admin: { readOnly: true, width: '30%' } },
            { name: 'questionType', type: 'text', label: 'Spørsmålstype', admin: { readOnly: true, width: '20%' } },
            { name: 'questionLabel', type: 'text', label: 'Spørsmål (ved innsending)', admin: { readOnly: true, width: '50%' } },
          ],
        },
        { name: 'displayValue', type: 'textarea', label: 'Svar', admin: { readOnly: true } },
        {
          // `{ answer: string | number | string[] }` — wrapped, because a bare string in a json field
          // is read by Payload as JSON text.
          name: 'value',
          type: 'json',
          label: 'Svarverdi (strukturert)',
          admin: { readOnly: true, hidden: true },
        },
      ],
    },
    {
      // Collapsed: the raw snapshot is for audit, and would otherwise dominate the page.
      type: 'collapsible',
      label: 'Spørreskjema ved innsending (teknisk kopi)',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'questionnaireSnapshot',
          type: 'json',
          label: 'Spørreskjema ved innsending',
          admin: {
            readOnly: true,
            description: 'Uforanderlig kopi av spørsmålene og svaralternativene deltakeren så.',
          },
        },
      ],
    },
    // ── Sidebar ──
    {
      name: 'submittedAt',
      type: 'date',
      label: 'Innsendt',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd.MM.yyyy HH:mm' },
      },
    },
    {
      name: 'questionnaireVersion',
      type: 'number',
      label: 'Spørreskjemaversjon',
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
  timestamps: true,
}
