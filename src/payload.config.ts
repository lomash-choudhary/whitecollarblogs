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

/**
 * Supabase's S3 endpoint and its public object URL are the same project host
 * with a different path, so the project is named exactly once — in
 * `S3_ENDPOINT` — and the public base is derived from it:
 *
 *   S3_ENDPOINT  https://<ref>.supabase.co/storage/v1/s3
 *   public URL   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/media/<file>
 *
 * A second `S3_PROJECT_REF` used to hold the ref, with a hard-coded project as
 * its fallback. Two variables for one coordinate can be half-updated, and with
 * the var unset the fallback pointed every stored URL at a different Supabase
 * project than the uploads were going to — the same trap as a default repo
 * coordinate, failing quietly instead of naming the missing var.
 */
const s3PublicBaseUrl = (endpoint: string): string => {
  let parsed: URL
  try {
    parsed = new URL(endpoint)
  } catch {
    throw new Error(
      `S3_ENDPOINT is not a valid URL. Expected ` +
        `https://<project-ref>.supabase.co/storage/v1/s3`,
    )
  }

  const pathname = parsed.pathname.replace(/\/+$/, '')
  if (!pathname.endsWith('/s3')) {
    throw new Error(
      `S3_ENDPOINT must be the storage S3 endpoint, ending in /s3 ` +
        `(https://<project-ref>.supabase.co/storage/v1/s3).`,
    )
  }

  return `${parsed.origin}${pathname.slice(0, -'/s3'.length)}/object/public`
}

/**
 * Credentials decide whether files go to Supabase at all; with either missing
 * the plugin is off and Payload writes to `public/media` on the local disk.
 * That is the right behaviour for a fresh clone and the wrong one to discover
 * in production, so a half-configured bucket is refused rather than silently
 * demoted.
 */
const S3_STORAGE_ENABLED = Boolean(
  process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
)
const S3_BUCKET = process.env.S3_BUCKET || ''
const S3_ENDPOINT = process.env.S3_ENDPOINT || ''

if (S3_STORAGE_ENABLED) {
  const missing = [
    ['S3_BUCKET', S3_BUCKET],
    ['S3_ENDPOINT', S3_ENDPOINT],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(
      `S3 credentials are set but ${missing.join(' and ')} ` +
        `${missing.length > 1 ? 'are' : 'is'} not. Add ` +
        `${missing.length > 1 ? 'them' : 'it'} to the environment, or unset ` +
        `S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY to store uploads on the local disk.`,
    )
  }
}

// Computed once at boot so a malformed endpoint fails immediately, rather than
// on the first upload or the first read of the media list.
const S3_PUBLIC_BASE_URL = S3_STORAGE_ENABLED ? s3PublicBaseUrl(S3_ENDPOINT) : ''

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
          // Runs on every read as well as on save, so an existing row's URL is
          // recomputed from the current environment rather than frozen at the
          // value it was stored with.
          generateFileURL: ({ filename }) =>
            `${S3_PUBLIC_BASE_URL}/${S3_BUCKET}/media/${filename}`,
        },
      },
      bucket: S3_BUCKET,
      config: {
        endpoint: S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
        region: process.env.S3_REGION || 'ap-south-1',
        forcePathStyle: true,
      },
      enabled: S3_STORAGE_ENABLED,
    }),
  ],
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
