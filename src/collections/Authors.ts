import type { CollectionConfig } from 'payload'

export const Authors: CollectionConfig = {
  slug: 'authors',
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
      name: 'role',
      type: 'text',
      required: true,
      defaultValue: 'Technical Recruiter',
    },
    {
      name: 'department',
      type: 'select',
      required: true,
      options: [
        { label: 'Engineering', value: 'engineering' },
        { label: 'Sales & Growth', value: 'sales' },
        { label: 'HR & Operations', value: 'hr-ops' },
        { label: 'Marketing', value: 'marketing' },
        { label: 'Executive', value: 'executive' },
      ],
      defaultValue: 'hr-ops',
    },
    {
      name: 'avatar',
      type: 'text',
      required: false,
    },
  ],
}
