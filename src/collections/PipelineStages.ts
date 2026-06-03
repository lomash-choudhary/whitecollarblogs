import type { CollectionConfig } from 'payload'

export const PipelineStages: CollectionConfig = {
  slug: 'pipeline-stages',
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'key',
      type: 'select',
      required: true,
      unique: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'In Review', value: 'review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'color',
      type: 'text',
      required: true,
      defaultValue: '#64748b',
    },
  ],
}
