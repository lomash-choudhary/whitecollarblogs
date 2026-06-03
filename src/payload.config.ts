import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { s3Storage } from '@payloadcms/storage-s3'

import { Users } from './collections/Users'
import { Posts } from './collections/Posts'
import { Authors } from './collections/Authors'
import { PipelineStages } from './collections/PipelineStages'
import { Media } from './collections/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'app/admin/[[...segments]]/admin/importMap.js'),
    },
  },
  collections: [Users, Posts, Authors, PipelineStages, Media],
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  cors: '*',
  csrf: undefined,
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || 'small-group-secret-key-39c284jd82e11a',
  db: postgresAdapter({
    pool: {
      connectionString: (() => {
        const raw =
          process.env.DATABASE_URI ||
          'postgresql://postgres:postgres@127.0.0.1:5432/payload'
        return raw
      })(),
      max: 10,
      idleTimeoutMillis: 5000,
    },
  }),
  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
          generateFileURL: ({ filename }) => {
            const bucket = process.env.S3_BUCKET
            const refId = process.env.S3_PROJECT_REF || 'zxzodcunrrrylpaghpxr'
            if (bucket) {
              return `https://${refId}.supabase.co/storage/v1/object/public/${bucket}/media/${filename}`
            }
            return `/media/${filename}`
          },
        },
      },
      bucket: process.env.S3_BUCKET || '',
      config: {
        endpoint: process.env.S3_ENDPOINT || '',
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        region: process.env.S3_REGION || 'ap-south-1',
        forcePathStyle: true,
      },
      enabled: Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY),
    }),
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
