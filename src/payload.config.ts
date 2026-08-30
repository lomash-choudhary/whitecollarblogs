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
import { databaseSsl, normalizeDatabaseUrl } from './utils/databaseSsl'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const DATABASE_URI = normalizeDatabaseUrl(
  process.env.DATABASE_URI || 'postgresql://postgres:postgres@127.0.0.1:5432/payload',
)

/**
 * Payload signs login tokens with this. A value committed to the repository is
 * a value anyone can read, so production must supply its own or the CMS can be
 * logged into by anyone who has seen the source. Fail loudly rather than boot
 * with a known key.
 */
const PAYLOAD_SECRET = (() => {
  const fromEnv = process.env.PAYLOAD_SECRET
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'PAYLOAD_SECRET is not set. Generate one with `openssl rand -base64 32` and ' +
        'add it to the environment before building or deploying.',
    )
  }
  return 'development-only-secret-do-not-use-in-production'
})()

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
  secret: PAYLOAD_SECRET,
  db: postgresAdapter({
    push: false,
    pool: {
      connectionString: DATABASE_URI,
      // Neon and friends reject plaintext connections; local Postgres has no
      // TLS at all. databaseSsl() picks the right one for the given URL.
      ssl: databaseSsl(DATABASE_URI),
      max: 3,
      idleTimeoutMillis: 30000,
      // Fail fast instead of hanging a serverless function on a dead database.
      connectionTimeoutMillis: 15000,
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
