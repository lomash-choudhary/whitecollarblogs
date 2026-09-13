import type { CollectionConfig } from 'payload'

import { toStorageSafeFilename } from '@/lib/uploadFilename'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: 'public/media',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 300,
        position: 'centre',
      },
      {
        name: 'card',
        width: 768,
        height: 1024,
        position: 'centre',
      },
      {
        name: 'tablet',
        width: 1024,
        height: undefined,
        position: 'centre',
      },
    ],
    adminThumbnail: 'thumbnail',
    mimeTypes: [
      'image/*',
      'video/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
  },
  hooks: {
    // beforeOperation runs before generateFileData reads req.file, so this is
    // the last point at which the name can be changed. Without it a macOS
    // screenshot — whose name contains U+202F — is refused by Supabase with
    // "Invalid key", which names the object key and so looks like a bad
    // S3_ACCESS_KEY_ID.
    beforeOperation: [
      ({ req }) => {
        if (req.file?.name) {
          req.file.name = toStorageSafeFilename(req.file.name)
        }
      },
    ],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
    },
  ],
}
