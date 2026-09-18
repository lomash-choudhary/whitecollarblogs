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
    {
      // `author.url` in every published article's `BlogPosting`. Google asks
      // for a page that uniquely identifies the writer — a bio page or a
      // profile — to tell two people of the same name apart, and reports its
      // absence as a recommendation on every article.
      //
      // Optional, and **left empty rather than guessed**: none of the four
      // sites has an author page, so a derived `/authors/<name>` would be a
      // link to a 404 in the one place a search engine follows it. Empty, the
      // key is dropped from the front matter and no `url` is emitted at all,
      // which is the honest answer to "we do not publish author pages".
      name: 'url',
      type: 'text',
      required: false,
      admin: {
        description:
          'Optional. A page that identifies this author — a LinkedIn profile or a bio page. Published as author.url in every article they write. Leave empty if there is none.',
        placeholder: 'https://www.linkedin.com/in/…',
      },
    },
  ],
}
