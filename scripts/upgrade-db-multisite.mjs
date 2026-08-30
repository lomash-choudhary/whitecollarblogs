/**
 * Prepares a database for this app.
 *
 * On an empty database it creates the whole schema from scripts/schema.sql.
 * On an existing one it adds the columns multi-site publishing needs, which
 * Payload cannot add itself because the config runs with `push: false`.
 *
 * Idempotent — running it twice is safe.
 *
 *   npm run db:upgrade
 *   DATABASE_URI="postgresql://...neon.tech/neondb?sslmode=require" npm run db:upgrade
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'

// Minimal .env loader so the script works without extra dependencies.
const envPath = path.join(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

const rawConnectionString =
  process.env.DATABASE_URI || 'postgresql://postgres:postgres@127.0.0.1:5432/payload'

// Mirror of normalizeDatabaseUrl() in src/utils/databaseSsl.ts. node-postgres
// currently treats sslmode=require as verify-full and warns that a future major
// will weaken it; saying verify-full outright keeps today's behaviour and drops
// the warning.
function normalizeDatabaseUrl(url) {
  const wanted = process.env.DATABASE_SSL_NO_VERIFY === 'true' ? 'no-verify' : 'verify-full'
  try {
    const parsed = new URL(url)
    const mode = parsed.searchParams.get('sslmode')
    if (mode && ['require', 'prefer', 'verify-ca', 'verify-full'].includes(mode)) {
      parsed.searchParams.set('sslmode', wanted)
      return parsed.toString()
    }
    return url
  } catch {
    return url
  }
}

const connectionString = normalizeDatabaseUrl(rawConnectionString)

// Mirror of src/utils/databaseSsl.ts — this script runs under plain node and
// cannot import the TypeScript version. Hosted Postgres (Neon, Supabase, RDS)
// refuses plaintext connections, local Postgres has no TLS at all.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

function databaseSsl(url) {
  if (/[?&]sslmode=/i.test(url)) return undefined
  let hostname
  try {
    hostname = new URL(url).hostname
  } catch {
    return undefined
  }
  if (LOCAL_HOSTS.has(hostname)) return undefined
  return process.env.DATABASE_SSL_NO_VERIFY === 'true' ? { rejectUnauthorized: false } : true
}

// Every statement is schema-qualified. A pooled Neon connection can arrive with
// no search_path at all (PgBouncer hands out a backend another client already
// SET), and an unqualified `posts` then resolves to nothing.
const STATEMENTS = [
  `ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS site varchar DEFAULT 'wcb'`,
  `ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS external_status varchar`,
  `ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS external_message varchar`,
  `ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS external_url varchar`,
  `ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS last_dispatched_at timestamp(3) with time zone`,
  `UPDATE public.posts SET site = 'wcb' WHERE site IS NULL`,
  `CREATE INDEX IF NOT EXISTS posts_site_key_idx ON public.posts (site)`,
]

const client = new pg.Client({
  connectionString,
  ssl: databaseSsl(connectionString),
  connectionTimeoutMillis: 15000,
})

try {
  await client.connect()
  console.log(`Connected to ${connectionString.replace(/:[^:@/]+@/, ':****@')}`)

  // A pooled backend may have been left with no search_path by an earlier
  // client. Put it back for this session before touching anything.
  await client.query(`SET search_path TO public`)

  // A brand new database has no tables at all. Create them from the committed
  // schema rather than making the operator hunt for a separate psql command.
  const { rows } = await client.query(
    `SELECT to_regclass('public.posts') IS NOT NULL AS has_posts`,
  )

  if (!rows[0].has_posts) {
    const schemaPath = path.join(import.meta.dirname, 'schema.sql')
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`This database is empty and ${schemaPath} is missing.`)
    }
    console.log('\nEmpty database — creating the schema from scripts/schema.sql')
    // pg_dump 17+ emits \restrict / \unrestrict, which are psql client
    // meta-commands rather than SQL. Drop them so the driver can run the file.
    const schemaSql = fs
      .readFileSync(schemaPath, 'utf8')
      .split('\n')
      .filter((line) => !line.startsWith('\\'))
      .join('\n')
    await client.query(schemaSql)
    const { rows: counted } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    )
    console.log(`  ✓ ${counted[0].n} tables created`)
  }

  for (const sql of STATEMENTS) {
    await client.query(sql)
    console.log(`  ✓ ${sql}`)
  }

  console.log('\nDatabase is ready.')
  console.log('Create the first admin at <your-app>/admin, or with:')
  console.log(
    `  curl -X POST <your-app>/api/users/first-register -H 'Content-Type: application/json' \\\n` +
      `    -d '{"email":"you@example.com","password":"a-long-password","name":"Owner"}'`,
  )
} catch (err) {
  console.error('\nSchema upgrade failed:', err.message)
  if (/insecure|SSL|self.signed/i.test(err.message)) {
    console.error(
      '\nThis looks like a TLS problem. Hosted providers need TLS — add ?sslmode=require\n' +
        'to DATABASE_URI. If the certificate chain cannot be verified, re-run with\n' +
        'DATABASE_SSL_NO_VERIFY=true.',
    )
  }
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
